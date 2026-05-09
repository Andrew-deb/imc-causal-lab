import logging
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler, LabelEncoder

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
    try:
        transactions_df[tx_date] = pd.to_datetime(transactions_df[tx_date])
    except Exception as e:
        raise ValueError(
            f"Failed to parse dates in transaction column '{tx_date}'. "
            f"Ensure you selected the correct date column during mapping. Error: {str(e)[:100]}"
        )

    try:
        campaigns_df[start_col] = pd.to_datetime(campaigns_df[start_col])
        campaigns_df[end_col] = pd.to_datetime(campaigns_df[end_col])
    except Exception as e:
        raise ValueError(
            f"Failed to parse dates in campaign columns '{start_col}' or '{end_col}'. "
            f"Ensure you selected correct date columns. Error: {str(e)[:100]}"
        )

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


# 4. TREATMENT BALANCE CHECK

def check_treatment_balance(
    merged_df: pd.DataFrame,
    imc_categories: list[str],
    all_possible_categories: list[str] | None = None,
) -> list[TreatmentBalanceResult]:
    """
    Evaluate T/C balance for each IMC category.

    Status thresholds (from configs):
      - GOOD:         treated_pct between 20-80%
      - WARNING:      treated_pct between 10-20% or 80-90%
      - INSUFFICIENT: treated_pct below 10% or above 90%

    Also handles categories that exist in the IMC taxonomy but have
    no mapped campaigns in the dataset.
    """
    results = []

    # Check each category that HAS campaigns mapped to it
    for cat in imc_categories:
        t_col = f"T_{cat}"
        if t_col not in merged_df.columns:
            continue

        total = len(merged_df)
        treated = int(merged_df[t_col].sum())
        control = total - treated
        treated_pct = treated / total if total > 0 else 0.0

        # Determine status and message using config thresholds
        if treated_pct < settings.BALANCE_INSUFFICIENT_MIN or treated_pct > settings.BALANCE_INSUFFICIENT_MAX:
            status = "insufficient"
            message = (
                f"Causal analysis unavailable for {cat}: treatment/control split "
                f"is {treated_pct:.0%}/{1-treated_pct:.0%}, which is too imbalanced "
                f"for reliable causal estimation. A minimum of {settings.BALANCE_INSUFFICIENT_MIN:.0%} "
                f"in both groups is required."
            )
        elif treated_pct < settings.BALANCE_GOOD_MIN or treated_pct > settings.BALANCE_GOOD_MAX:
            status = "warning"
            message = (
                f"Treatment/control split for {cat} is {treated_pct:.0%}/{1-treated_pct:.0%}. "
                f"Results may have higher variance due to imbalance. "
                f"Ideal range is {settings.BALANCE_GOOD_MIN:.0%}-{settings.BALANCE_GOOD_MAX:.0%}."
            )
        else:
            status = "good"
            message = (
                f"Treatment/control split for {cat} is {treated_pct:.0%}/{1-treated_pct:.0%}. "
                f"Balance is within the ideal range for causal estimation."
            )

        results.append(TreatmentBalanceResult(
            imc_category=cat,
            treated_count=treated,
            control_count=control,
            treated_pct=round(treated_pct, 4),
            status=status,
            message=message,
        ))

        log_fn = logger.info if status == "good" else logger.warning
        log_fn(
            f"  {cat}: {treated:,} treated / {control:,} control "
            f"({treated_pct:.1%}) [{status.upper()}]"
        )

    # Check for categories that are NOT present in the data at all
    if all_possible_categories:
        mapped_cats = set(imc_categories)
        for cat in all_possible_categories:
            if cat not in mapped_cats:
                results.append(TreatmentBalanceResult(
                    imc_category=cat,
                    treated_count=0,
                    control_count=0,
                    treated_pct=0.0,
                    status="not_in_dataset",
                    message=(
                        f"No campaigns in the dataset map to the '{cat}' IMC category. "
                        f"This category requires campaign types such as "
                        f"{'public relations, sponsorship, or event marketing' if cat == 'public_relations' else cat.replace('_', ' ')} "
                        f"campaigns to be present in the uploaded data."
                    ),
                ))
                logger.info(
                    f"  {cat}: No campaigns mapped to this category in the dataset"
                )

    return results


# 5. FEATURE ENGINEERING

def engineer_features(
    aligned_df: pd.DataFrame,
    imc_categories: list[str],
    col_mapping: ColumnMapping,
    balance_results: list[TreatmentBalanceResult] | None = None,
) -> dict[str, tuple[np.ndarray, np.ndarray, np.ndarray]]:
    """
    Encode, impute, standardise → {channel_name: (X, T, Y)}.

    Confounders (X):
      - Demographics: age, gender, state (from customers)
      - Behavioral: recency, frequency, monetary (from temporal alignment)
      - User-specified: col_mapping.confounder_cols (if any)

    Treatment (T): binary T_{category} per channel
    Outcome (Y): transaction amount

    Skips categories flagged as 'insufficient' or 'not_in_dataset' by
    the balance check — these cannot be used for causal estimation.
    """
    amount_col = col_mapping.transaction_amount_col
    df = aligned_df.copy()

    # ── Determine which categories to skip ─────────────────────────
    skip_categories = set()
    if balance_results:
        for br in balance_results:
            if br.status in ("insufficient", "not_in_dataset"):
                skip_categories.add(br.imc_category)
                logger.warning(
                    f"  Skipping '{br.imc_category}': status={br.status} — "
                    f"cannot perform causal estimation"
                )

    # ── Auto-detect confounder columns 
    # Demographics (common columns from customers table)
    demographic_candidates = ["age", "gender", "state", "city", "preferred_channel"]
    demographic_cols = [c for c in demographic_candidates if c in df.columns]

    # RFM columns (from temporal alignment)
    rfm_cols = ["recency", "frequency", "monetary"]

    # User-specified additional confounders — filter unsuitable columns
    auto_cols = set(demographic_cols + rfm_cols)
    # Columns that must never be confounders
    exclude_cols = {
        col_mapping.customer_id_col,
        col_mapping.transaction_amount_col,
        col_mapping.transaction_date_col,
        col_mapping.campaign_start_col,
        col_mapping.campaign_end_col,
        col_mapping.campaign_type_col,
        "transaction_id", "imc_category",
    }
    # Also exclude treatment indicator columns
    exclude_cols.update(f"T_{cat}" for cat in imc_categories)

    extra_cols = []
    for c in col_mapping.confounder_cols:
        if c not in df.columns:
            continue
        if c in auto_cols or c in exclude_cols:
            continue
        # Skip datetime columns — can't be standardised
        if pd.api.types.is_datetime64_any_dtype(df[c]):
            logger.info(f"  Skipping confounder '{c}': datetime column")
            continue
        # Skip columns that look like IDs (all unique strings/ints)
        if df[c].nunique() == len(df):
            logger.info(f"  Skipping confounder '{c}': all-unique (likely an ID)")
            continue
        extra_cols.append(c)

    confounder_cols = demographic_cols + rfm_cols + extra_cols
    logger.info(f"Confounders ({len(confounder_cols)}): {confounder_cols}")

    # ── Impute missing values (before encoding) 
    for col in confounder_cols:
        if df[col].isna().any():
            if pd.api.types.is_numeric_dtype(df[col]):
                df[col] = df[col].fillna(df[col].median())
            else:
                df[col] = df[col].fillna(df[col].mode().iloc[0] if len(df[col].mode()) > 0 else "unknown")

    # ── Encode categoricals (after imputation)
    label_encoders = {}
    for col in confounder_cols:
        if pd.api.types.is_string_dtype(df[col]) or df[col].dtype == "object":
            le = LabelEncoder()
            df[col] = le.fit_transform(df[col].astype(str))
            label_encoders[col] = le
    # ── Final safety: ensure all confounders are numeric after encoding ──
    safe_cols = []
    for col in confounder_cols:
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            logger.warning(f"  Dropping confounder '{col}': still datetime after encoding")
            continue
        if not pd.api.types.is_numeric_dtype(df[col]):
            logger.warning(f"  Dropping confounder '{col}': non-numeric dtype {df[col].dtype}")
            continue
        safe_cols.append(col)
    confounder_cols = safe_cols
    logger.info(f"Final confounders ({len(confounder_cols)}): {confounder_cols}")

    # ── Standardise numeric features 
    scaler = StandardScaler()
    df[confounder_cols] = scaler.fit_transform(df[confounder_cols])

    # ── Build per-channel (X, T, Y) tuples 
    result = {}
    for cat in imc_categories:
        # Skip categories that failed balance check
        if cat in skip_categories:
            continue

        t_col = f"T_{cat}"

        # Build a clean subset: drop rows where Y or any confounder is NaN
        subset = df[confounder_cols + [t_col, amount_col]].copy()
        before_len = len(subset)
        subset = subset.dropna()
        dropped = before_len - len(subset)
        if dropped > 0:
            logger.info(f"  {cat}: dropped {dropped} NaN rows ({dropped/before_len*100:.1f}%)")

        X = subset[confounder_cols].values
        T = subset[t_col].values.astype(int)
        Y = subset[amount_col].values.astype(float)

        # Safety: skip if only one class in T after NaN filtering
        unique_classes = set(T)
        if len(unique_classes) < 2:
            logger.warning(
                f"  Skipping '{cat}': only class(es) {unique_classes} in T after filtering "
                f"— need both treated (1) and control (0)"
            )
            continue

        # Performance: subsample large datasets (configurable via MAX_SUBSAMPLE_ROWS)
        max_rows = settings.MAX_SUBSAMPLE_ROWS
        if max_rows > 0 and len(X) > max_rows:
            rng = np.random.RandomState(42)
            idx = rng.choice(len(X), max_rows, replace=False)
            X, T, Y = X[idx], T[idx], Y[idx]
            logger.info(f"  {cat}: subsampled {before_len} -> {max_rows} rows for speed")

        result[cat] = (X, T, Y)
        logger.info(
            f"  {cat}: X{X.shape}, T(treated={T.sum()}, control={len(T)-T.sum()}), Y(mean={Y.mean():.2f})"
        )

    return result, confounder_cols, scaler, label_encoders


# 6. DESCRIPTIVE STATISTICS (Treatment vs Control)

def compute_descriptive_statistics(
    aligned_df: pd.DataFrame,
    imc_categories: list[str],
    col_mapping: ColumnMapping,
    balance_results: list[TreatmentBalanceResult] | None = None,
) -> dict:
    """
    Compute Treatment vs Control descriptive statistics per channel.
    Aligned with Marthalia (2024) Table 1 for thesis comparability.

    Variables computed:
      - Average Order Value (transaction amount mean)
      - Recency (days since last purchase)
      - Frequency (prior transaction count)
      - Monetary (cumulative prior spend)
      - Product Category Diversity (unique categories per customer)
      - Discount Applied (% of transactions with discount)

    Standardized Difference = Cohen's d:
      d = (mean_treated - mean_control) / sqrt((var_T + var_C) / 2)
    Values > 0.1 indicate meaningful imbalance (Rosenbaum & Rubin, 1985).
    """
    from app.schemas.modeling_schema import DescriptiveStats, ChannelDescriptiveStats

    amount_col = col_mapping.transaction_amount_col
    df = aligned_df.copy()

    # Determine which categories to skip
    skip_cats = set()
    if balance_results:
        for br in balance_results:
            if br.status in ("insufficient", "not_in_dataset"):
                skip_cats.add(br.imc_category)

    # ── Prepare derived variables ────────────────────────────────
    # Product category diversity (unique categories per customer, broadcast to rows)
    cust_id = col_mapping.customer_id_col
    if "product_category" in df.columns:
        cat_diversity = df.groupby(cust_id)["product_category"].transform("nunique")
        df["product_category_diversity"] = cat_diversity
    else:
        df["product_category_diversity"] = 0

    # Discount applied rate (binary: was a discount used?)
    if "discount_applied" in df.columns:
        df["has_discount"] = (df["discount_applied"] > 0).astype(float)
    else:
        df["has_discount"] = 0.0

    # Average order value = transaction amount (already available)
    # RFM cols (recency, frequency, monetary) already computed by temporal alignment

    # ── Variables to compare ─────────────────────────────────────
    variables = {
        "Average Order Value": amount_col,
        "Recency (days)": "recency",
        "Frequency": "frequency",
        "Monetary (cumulative)": "monetary",
        "Product Category Diversity": "product_category_diversity",
        "Discount Applied (%)": "has_discount",
    }

    def _cohens_d(treated_vals, control_vals):
        """Compute Cohen's d standardized difference."""
        var_t = np.var(treated_vals, ddof=1) if len(treated_vals) > 1 else 0
        var_c = np.var(control_vals, ddof=1) if len(control_vals) > 1 else 0
        pooled_std = np.sqrt((var_t + var_c) / 2)
        if pooled_std < 1e-10:
            return 0.0
        return (np.mean(treated_vals) - np.mean(control_vals)) / pooled_std

    # ── Compute per channel ──────────────────────────────────────
    result = {}
    for cat in imc_categories:
        if cat in skip_cats:
            continue

        t_col = f"T_{cat}"
        if t_col not in df.columns:
            continue

        treated_mask = df[t_col] == 1
        control_mask = df[t_col] == 0
        n_treated = int(treated_mask.sum())
        n_control = int(control_mask.sum())

        if n_treated == 0 or n_control == 0:
            continue

        stats_list = []
        for var_name, col_name in variables.items():
            if col_name not in df.columns:
                continue

            t_vals = df.loc[treated_mask, col_name].dropna().values
            c_vals = df.loc[control_mask, col_name].dropna().values

            if len(t_vals) == 0 or len(c_vals) == 0:
                continue

            t_mean = float(np.mean(t_vals))
            c_mean = float(np.mean(c_vals))

            # For percentage variables, display as percentage
            if var_name == "Discount Applied (%)":
                t_mean = round(t_mean * 100, 2)
                c_mean = round(c_mean * 100, 2)

            std_diff = _cohens_d(t_vals.astype(float), c_vals.astype(float))

            stats_list.append(DescriptiveStats(
                variable=var_name,
                treated_mean=round(t_mean, 4),
                control_mean=round(c_mean, 4),
                std_diff=round(abs(std_diff), 4),
            ))

        result[cat] = ChannelDescriptiveStats(
            channel_name=cat,
            n_treated=n_treated,
            n_control=n_control,
            stats=stats_list,
        )
        logger.info(f"  {cat}: {len(stats_list)} descriptive variables computed")

    return result
