import logging
import numpy as np
import pandas as pd
import sklearn.preprocessing import StandardScaler, LabelEncoder

from app.configs import settings
from app.schemas.modeling_schema import ColumnMapping, TreatmentBalanceResult

logger = logging.getLogger(__name__)


# 1. Merge dataset

def merge_datasets(
    customers_df: pd.DataFrame,
    transactions_df: pd.DataFrame,
    campaigns_df: pd.DataFrame,
    imc_mapping: dict[str, str],
    col_mapping: ColumnMapping,
) -> pd.DataFrame:
    """
    Join customers + transactions, then link campaigns via date overlap.

    Returns one row per transaction with binary treatment indicators
    (T_advertising, T_direct_marketing, T_promotion, T_public_relations).
    """
    tx_date = col_mapping.transaction_date_col
    start_col = col_mapping.campaign_start_col
    end_col = col_mapping.campaign_end_col
    cust_id = col_mapping.customer_id_col
    ctype_col = col_mapping.campaign_type_col


    transactions_df[tx_date] = pd.to_datetime(transactions_df[tx_date])
    campaigns_df[start_col] = pd.to_datetime(campaigns_df[start_col])
    campaigns_df[end_col] = pd.to_datetime(campaigns_df[end_col])

    
    merged = transactions_df.merge(customers_df, on=cust_id, how="left")
    logger.info(f"Merged: {len(merged)} transactions × {len(customers_df)} customers")

    # ── Add IMC category to campaigns
    campaigns_df["imc_category"] = campaigns_df[ctype_col].map(imc_mapping)


    imc_categories = sorted(set(imc_mapping.values()))

    for cat in imc_categories:
        t_col = f"T_{cat}"
        merged[t_col] = 0

        cat_campaigns = campaigns_df[campaigns_df["imc_category"] == cat]
        for _, campaign in cat_campaigns.iterrows():
            mask = (merged[tx_date] >= campaign[start_col]) & (
                merged[tx_date] <= campaign[end_col]
            )
            merged.loc[mask, t_col] = 1

        treated_pct = merged[t_col].mean() * 100
        logger.info(f"  {cat}: {treated_pct:.1f}% treated")

    return merged



# 2. TREATMENT BALANCE CHECK


def check_treatment_balance(
    merged_df: pd.DataFrame,
    imc_categories: list[str],
) -> list[TreatmentBalanceResult]:
    """
    For each IMC category, check if the T/C split is viable using the threshold defined in the configs
    """
    results = []

    for cat in imc_categories:
        t_col = f"T_{cat}"
        treated = int(merged_df[t_col].sum())
        total = len(merged_df)
        control = total - treated
        pct = treated / total if total > 0 else 0.0

        if settings.BALANCE_GOOD_MIN <= pct <= settings.BALANCE_GOOD_MAX:
            status = "good"
        elif pct < settings.BALANCE_INSUFFICIENT_MIN or pct > settings.BALANCE_INSUFFICIENT_MAX:
            status = "insufficient"
        else:
            status = "weak"

        results.append(
            TreatmentBalanceResult(
                imc_category=cat,
                treated_count=treated,
                control_count=control,
                treated_pct=round(pct, 4),
                status=status,
            )
        )
        logger.info(f"  {cat}: {pct:.1%} treated → {status}")

    return results


# 3. TEMPORAL ALIGNMENT

def apply_temporal_alignment(
    merged_df: pd.DataFrame,
    campaigns_df: pd.DataFrame,
    col_mapping: ColumnMapping,
    outcome_window_days: int = 30,
) -> pd.DataFrame:
    """
    Enforcing temporal ordering: confounders BEFORE campaigns, outcomes AFTER.

    Strategy:
      1. Pre-period cutoff = earliest campaign start date
      2. Compute per-customer RFM from transactions BEFORE the cutoff
      3. Analysis period = cutoff to (latest campaign end + outcome_window)
      4. Join RFM as confounders to analysis-period transactions
    """
    tx_date = col_mapping.transaction_date_col
    cust_id = col_mapping.customer_id_col
    amount_col = col_mapping.transaction_amount_col
    start_col = col_mapping.campaign_start_col
    end_col = col_mapping.campaign_end_col

    # ── Define time boundaries
    campaign_starts = pd.to_datetime(campaigns_df[start_col])
    campaign_ends = pd.to_datetime(campaigns_df[end_col])
    pre_period_cutoff = campaign_starts.min()
    outcome_end = campaign_ends.max() + pd.Timedelta(days=outcome_window_days)

    logger.info(f"Pre-period: before {pre_period_cutoff.date()}")
    logger.info(f"Analysis window: {pre_period_cutoff.date()} → {outcome_end.date()}")

    # ── Split pre-period vs analysis 
    pre_txns = merged_df[merged_df[tx_date] < pre_period_cutoff]
    analysis_txns = merged_df[
        (merged_df[tx_date] >= pre_period_cutoff)
        & (merged_df[tx_date] <= outcome_end)
    ].copy()

    logger.info(f"Pre-period transactions: {len(pre_txns)}")
    logger.info(f"Analysis transactions: {len(analysis_txns)}")

    # ── Compute per-customer RFM from pre-period ───────────────────
    rfm = (
        pre_txns.groupby(cust_id)
        .agg(
            recency=(tx_date, lambda x: (pre_period_cutoff - x.max()).days),
            frequency=(tx_date, "count"),
            monetary=(amount_col, "sum"),
        )
        .reset_index()
    )

    # ── Join RFM to analysis transactions ──────────────────────────
    aligned = analysis_txns.merge(rfm, on=cust_id, how="left")

    # Fill NaN for customers with no pre-period history
    aligned["recency"] = aligned["recency"].fillna(-1)
    aligned["frequency"] = aligned["frequency"].fillna(0)
    aligned["monetary"] = aligned["monetary"].fillna(0.0)

    logger.info(f"Aligned dataset: {len(aligned)} rows, {len(rfm)} customers with RFM")

    return aligned


# 4. FEATURE ENGINEERING

def engineer_features(
    aligned_df: pd.DataFrame,
    imc_categories: list[str],
    col_mapping: ColumnMapping,
) -> dict[str, tuple[np.ndarray, np.ndarray, np.ndarray]]:
    """
    Encode, impute, standardise → {channel_name: (X, T, Y)}.

    Confounders (X):
      - Demographics: age, gender, state (from customers)
      - Behavioral: recency, frequency, monetary (from temporal alignment)
      - User-specified: col_mapping.confounder_cols (if any)

    Treatment (T): binary T_{category} per channel
    Outcome (Y): transaction amount
    """
    amount_col = col_mapping.transaction_amount_col
    df = aligned_df.copy()

    # ── Auto-detect confounder columns 
    # Demographics (common columns from customers table)
    demographic_candidates = ["age", "gender", "state", "city", "preferred_channel"]
    demographic_cols = [c for c in demographic_candidates if c in df.columns]

    # RFM columns (from temporal alignment)
    rfm_cols = ["recency", "frequency", "monetary"]

    # User-specified additional confounders
    extra_cols = [c for c in col_mapping.confounder_cols if c in df.columns]

    confounder_cols = demographic_cols + rfm_cols + extra_cols
    logger.info(f"Confounders: {confounder_cols}")

    # ── Encode categoricals 
    label_encoders = {}
    for col in confounder_cols:
        if df[col].dtype == "object":
            le = LabelEncoder()
            df[col] = le.fit_transform(df[col].astype(str))
            label_encoders[col] = le

    # ── Impute missing values 
    for col in confounder_cols:
        if df[col].isna().any():
            df[col] = df[col].fillna(df[col].median())

    # ── Standardise numeric features 
    scaler = StandardScaler()
    df[confounder_cols] = scaler.fit_transform(df[confounder_cols])

    # ── Build per-channel (X, T, Y) tuples 
    result = {}
    for cat in imc_categories:
        t_col = f"T_{cat}"
        X = df[confounder_cols].values
        T = df[t_col].values.astype(int)
        Y = df[amount_col].values.astype(float)

        result[cat] = (X, T, Y)
        logger.info(
            f"  {cat}: X{X.shape}, T(treated={T.sum()}, control={len(T)-T.sum()}), Y(mean={Y.mean():.2f})"
        )

    return result, confounder_cols, scaler, label_encoders
