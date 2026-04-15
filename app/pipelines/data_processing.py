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
    outcome_window_days: int = 30,
) -> pd.DataFrame:
    """
    Join customers + transactions, then link campaigns via date overlap.

    Treatment window = campaign start → campaign end + outcome_window_days.
    This captures both immediate (during-campaign) and delayed (post-campaign)
    effects, which is standard in marketing effectiveness analysis.

    Returns one row per transaction with binary treatment indicators
    (T_advertising, T_direct_marketing, T_promotion, T_public_relations).
    """
    tx_date = col_mapping.transaction_date_col
    start_col = col_mapping.campaign_start_col
    end_col = col_mapping.campaign_end_col
    cust_id = col_mapping.customer_id_col
    ctype_col = col_mapping.campaign_type_col

    # ── Parse dates ────────────────────────────────────────────────
    transactions_df[tx_date] = pd.to_datetime(transactions_df[tx_date])
    campaigns_df[start_col] = pd.to_datetime(campaigns_df[start_col])
    campaigns_df[end_col] = pd.to_datetime(campaigns_df[end_col])

    # ── Join customers + transactions ──────────────────────────────
    merged = transactions_df.merge(customers_df, on=cust_id, how="left")
    logger.info(f"Merged: {len(merged)} transactions × {len(customers_df)} customers")

    # ── Add IMC category to campaigns ──────────────────────────────
    campaigns_df["imc_category"] = campaigns_df[ctype_col].map(imc_mapping)

    # ── Create per-category treatment indicators ───────────────────
    imc_categories = sorted(set(imc_mapping.values()))
    window_delta = pd.Timedelta(days=outcome_window_days)

    for cat in imc_categories:
        t_col = f"T_{cat}"
        merged[t_col] = 0

        cat_campaigns = campaigns_df[campaigns_df["imc_category"] == cat]
        for _, campaign in cat_campaigns.iterrows():
            # Treatment window: campaign start → campaign end + outcome window
            # Captures both during-campaign and delayed post-campaign effects
            campaign_end_extended = campaign[end_col] + window_delta
            mask = (merged[tx_date] >= campaign[start_col]) & (
                merged[tx_date] <= campaign_end_extended
            )
            merged.loc[mask, t_col] = 1

        treated_pct = merged[t_col].mean() * 100
        logger.info(f"  {cat}: {treated_pct:.1f}% treated (window: campaign + {outcome_window_days}d)")

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
    Enforce temporal ordering: confounders BEFORE treatment, outcomes AFTER.

    Strategy — Per-Customer Expanding RFM:
      For each transaction, compute RFM using ONLY that customer's prior
      transactions. This ensures temporal validity at every point in a
      multi-year dataset without requiring a single global pre-period.

      - Frequency: count of customer's previous transactions
      - Monetary:  cumulative spend from previous transactions
      - Recency:   days since customer's most recent previous transaction

    The campaigns_df is used only for logging the analysis time span.
    Treatment indicators (T_*) are already set by merge_datasets().
    """
    tx_date = col_mapping.transaction_date_col
    cust_id = col_mapping.customer_id_col
    amount_col = col_mapping.transaction_amount_col
    start_col = col_mapping.campaign_start_col
    end_col = col_mapping.campaign_end_col

    df = merged_df.copy()

    # ── Log the dataset time span ──────────────────────────────────
    campaign_starts = pd.to_datetime(campaigns_df[start_col])
    campaign_ends = pd.to_datetime(campaigns_df[end_col])
    logger.info(
        f"Campaign span: {campaign_starts.min().date()} → {campaign_ends.max().date()} "
        f"({(campaign_ends.max() - campaign_starts.min()).days} days)"
    )
    logger.info(
        f"Transaction span: {df[tx_date].min().date()} → {df[tx_date].max().date()}"
    )

    # ── Sort by customer then date (required for cumulative ops) ───
    df = df.sort_values([cust_id, tx_date]).reset_index(drop=True)

    # ── Frequency: count of prior transactions per customer ────────
    # cumcount() gives 0-based position within group (0, 1, 2, ...)
    # which equals the count of transactions BEFORE this one
    df["frequency"] = df.groupby(cust_id).cumcount()

    # ── Monetary: cumulative spend from prior transactions ─────────
    # cumsum() then shift by 1 so current transaction is excluded
    df["monetary"] = (
        df.groupby(cust_id)[amount_col]
        .cumsum()
        .groupby(df[cust_id])
        .shift(1, fill_value=0.0)
    )

    # ── Recency: days since previous transaction ───────────────────
    # diff() gives timedelta to previous row within group
    # First transaction per customer has no prior → fill with -1
    df["recency"] = (
        df.groupby(cust_id)[tx_date]
        .diff()
        .dt.days
        .fillna(-1)
        .astype(int)
    )

    logger.info(
        f"Temporal alignment complete: {len(df)} rows, "
        f"frequency range [{df['frequency'].min()}-{df['frequency'].max()}], "
        f"monetary range [{df['monetary'].min():.0f}-{df['monetary'].max():.0f}]"
    )

    return df


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
