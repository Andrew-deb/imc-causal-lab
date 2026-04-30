import logging
import uuid
import numpy as np
import pandas as pd

from app.utils.progress import PipelineTracker
from app.utils.error_handling import safe_run

from app.configs import settings
from app.schemas.modeling_schema import (
    ColumnMapping,
    ModelingConfig,
    TreatmentBalanceResult,
    ModelResult,
    ChannelResult,
    CrossModelComparison,
    AssociativeVsCausalComparison,
    ChannelSummary,
    PipelineResult,
)
from app.pipelines.data_processing import (
    merge_datasets,
    apply_temporal_alignment,
    check_treatment_balance,
    engineer_features,
)
from app.causal.estimators import get_all_estimators

logger = logging.getLogger(__name__)

# All 4 Kotler & Keller IMC categories
ALL_IMC_CATEGORIES = ["advertising", "direct_marketing", "promotion", "public_relations"]



# Build ChannelResult from multiple ModelResults


def _build_channel_result(
    channel_name: str,
    model_results: dict[str, ModelResult],
    balance_status: str,
) -> ChannelResult:
    """
    Aggregate multiple estimator results into a single ChannelResult.

    - consensus_ate/att: median across causal models (excludes logistic_regression)
    - agreement_score: 1 - (std / |mean|) of causal ATEs (higher = more agreement)
    - best_model: the causal model with the tightest confidence interval
    - confidence_level: "high" / "medium" / "low" based on agreement + balance
    """
    # Separate causal models from associative baseline
    causal_results = {
        name: r for name, r in model_results.items()
        if name != "logistic_regression"
    }

    if not causal_results:
        # Only logistic regression ran — no causal consensus
        lr = model_results.get("logistic_regression")
        return ChannelResult(
            channel_name=channel_name,
            model_results=model_results,
            consensus_ate=lr.ate if lr else 0.0,
            consensus_att=lr.att if lr else 0.0,
            agreement_score=0.0,
            best_model="logistic_regression",
            confidence_level="low",
        )

    # Consensus: median of causal ATEs (robust to outliers)
    causal_ates = [r.ate for r in causal_results.values()]
    causal_atts = [r.att for r in causal_results.values()]
    consensus_ate = float(np.median(causal_ates))
    consensus_att = float(np.median(causal_atts))

    # Agreement: how much do the causal models agree?
    # 1 - (std / |mean|), clamped to [0, 1]
    ate_mean = np.mean(causal_ates)
    ate_std = np.std(causal_ates)
    if abs(ate_mean) > 1e-6:
        agreement = max(0.0, min(1.0, 1.0 - (ate_std / abs(ate_mean))))
    else:
        agreement = 1.0 if ate_std < 1e-6 else 0.0

    # Best model: prefer the one with the tightest CI, else causal_forest
    best_model = "causal_forest"
    narrowest_ci = float("inf")
    for name, r in causal_results.items():
        if r.ate_ci and len(r.ate_ci) == 2:
            ci_width = abs(r.ate_ci[1] - r.ate_ci[0])
            if ci_width < narrowest_ci:
                narrowest_ci = ci_width
                best_model = name

    # Confidence level
    if agreement >= 0.7 and balance_status == "good":
        confidence_level = "high"
    elif agreement >= 0.4 or balance_status == "good":
        confidence_level = "medium"
    else:
        confidence_level = "low"

    return ChannelResult(
        channel_name=channel_name,
        model_results=model_results,
        consensus_ate=round(consensus_ate, 6),
        consensus_att=round(consensus_att, 6),
        agreement_score=round(float(agreement), 4),
        best_model=best_model,
        confidence_level=confidence_level,
    )



# Associative vs Causal comparison per channel


def _build_associative_vs_causal(
    channel_name: str,
    model_results: dict[str, ModelResult],
    consensus_ate: float,
) -> AssociativeVsCausalComparison:
    """
    Build the associative (LogReg) vs causal (consensus) comparison
    for thesis presentation.
    """
    lr = model_results.get("logistic_regression")
    lr_ate = lr.ate if lr else 0.0

    # Confounding bias = associative ATE - causal ATE
    bias = lr_ate - consensus_ate
    bias_pct = (abs(bias) / abs(consensus_ate) * 100) if abs(consensus_ate) > 1e-6 else 0.0

    if bias > 0:
        bias_direction = "overestimated"
    elif bias < 0:
        bias_direction = "underestimated"
    else:
        bias_direction = "matched"

    return AssociativeVsCausalComparison(
        estimated_effect={
            "associative": f"{lr_ate:.4f}",
            "causal": f"{consensus_ate:.4f}",
        },
        confounding_correction={
            "bias": f"{bias:+.4f}",
            "bias_pct": f"{bias_pct:.1f}%",
            "direction": bias_direction,
        },
        individual_targeting={
            "has_ite": "true" if lr and lr.ite_array else "false",
            "has_uplift_segments": "true" if lr and lr.uplift_segments else "false",
        },
        interpretation={
            "summary": (
                f"The associative model {bias_direction} the treatment effect by "
                f"{bias_pct:.1f}% compared to causal methods. "
                f"Associative ATE: {lr_ate:.4f}, Causal consensus ATE: {consensus_ate:.4f}."
            ),
            "recommendation": (
                "Use the causal consensus estimate for decision-making. "
                "The associative baseline demonstrates the confounding bias "
                "that would occur without proper causal adjustment."
            ),
        },
    )



# Cross-model comparison per channel


def _build_cross_model_comparison(
    model_results: dict[str, ModelResult],
) -> CrossModelComparison:
    """Build a comparison table across all models for a channel."""
    metrics = []
    for name, r in model_results.items():
        row = {
            "model": name,
            "ate": r.ate,
            "att": r.att,
            "ate_ci_lower": r.ate_ci[0] if r.ate_ci else None,
            "ate_ci_upper": r.ate_ci[1] if r.ate_ci else None,
            "has_feature_importances": r.feature_importances is not None,
            "persuadables_pct": (
                r.uplift_segments.persuadables if r.uplift_segments else None
            ),
        }
        metrics.append(row)
    return CrossModelComparison(metrics=metrics)



# CATE by segment (subgroup analysis)


def _compute_cate_by_segment(
    ite: np.ndarray,
    df: pd.DataFrame,
    segment_cols: list[str],
) -> dict[str, dict[str, float]]:
    """
    Compute average CATE within subgroups.

    This is the function we previewed in the estimator clarifications.
    It runs HERE because the estimators only receive numpy arrays (X, T, Y)
    and don't have access to the DataFrame column names needed for grouping.

    Args:
        ite: array of individual treatment effects from the estimator
        df: the aligned DataFrame with demographic columns
        segment_cols: columns to group by (e.g., ["gender", "state"])

    Returns: {"gender": {"Male": 12.5, "Female": 18.3}, ...}
    """
    result = {}
    for col in segment_cols:
        if col in df.columns:
            groups = df.groupby(col).apply(
                lambda g: float(np.mean(ite[g.index]))
            )
            result[col] = {str(k): round(v, 4) for k, v in groups.items()}
    return result



# MAIN PIPELINE


def run_pipeline(
    customers_df: pd.DataFrame,
    transactions_df: pd.DataFrame,
    campaigns_df: pd.DataFrame,
    imc_mapping: dict[str, str],
    col_mapping: ColumnMapping,
    config: ModelingConfig | None = None,
) -> PipelineResult:
    """
    Execute the full causal inference pipeline.

    Steps:
      1. Merge datasets (customer + transaction + campaign)
      2. Check treatment balance per IMC category
      3. Apply temporal alignment (per-customer expanding RFM)
      4. Engineer features → {channel: (X, T, Y)}
      5. Run all estimators per viable channel
      6. Build ChannelResults with consensus + comparison
      7. Package into PipelineResult for the dashboard

    Args:
        customers_df: customer demographics
        transactions_df: transaction history
        campaigns_df: campaign metadata
        imc_mapping: {"Email Marketing": "direct_marketing", ...}
        col_mapping: column name mapping
        config: optional overrides for modeling parameters

    Returns:
        PipelineResult ready for API serialisation
    """
    if config is None:
        config = ModelingConfig()

    session_id = str(uuid.uuid4())

    with PipelineTracker("🔬 IMC CAUSAL PIPELINE", total_steps=7) as tracker:

        # ── Step 1: Merge ──────────────────────────────────────────
        with tracker.step(1, "Merging datasets") as s:
            merged = merge_datasets(
                customers_df, transactions_df, campaigns_df,
                imc_mapping, col_mapping,
                outcome_window_days=config.outcome_window_days,
            )
            imc_categories = sorted(set(imc_mapping.values()))
            s.detail(f"{len(merged):,} rows, {len(imc_categories)} channels")

        # ── Step 2: Treatment balance ──────────────────────────────
        with tracker.step(2, "Checking treatment balance") as s:
            balance_results = check_treatment_balance(
                merged, imc_categories, all_possible_categories=ALL_IMC_CATEGORIES
            )
            balance_lookup = {br.imc_category: br.status for br in balance_results}
            viable = sum(1 for br in balance_results if br.status in ("good", "warning"))
            s.detail(f"{viable}/{len(imc_categories)} viable")

        # ── Step 3: Temporal alignment ─────────────────────────────
        with tracker.step(3, "Temporal alignment (RFM)"):
            aligned = apply_temporal_alignment(merged, campaigns_df, col_mapping)

        # ── Step 4: Feature engineering ────────────────────────────
        with tracker.step(4, "Engineering features") as s:
            channel_data, confounder_cols, scaler, label_encoders = engineer_features(
                aligned, imc_categories, col_mapping, balance_results=balance_results
            )
            segment_cols = ["gender", "state", "preferred_channel"]
            s.detail(f"{len(confounder_cols)} confounders, {len(channel_data)} channels")

        # ── Step 5: Run estimators per channel ─────────────────────
        with tracker.step(5, "Running causal estimators") as s:
            estimators = get_all_estimators(config.models_to_run)
            n_total = len(channel_data) * len(estimators)
            s.detail(f"{n_total} model fits")

        def _run_channel(channel_name: str, X, T, Y):
            """Run all estimators for a single channel."""
            model_results: dict[str, ModelResult] = {}

            for estimator in estimators:
                fallback = ModelResult(model_name=estimator.name, ate=0.0, att=0.0)
                result = safe_run(
                    estimator.run, X, T, Y, feature_names=confounder_cols,
                    fallback=fallback,
                    error_msg=f"{channel_name}/{estimator.name}",
                )

                # Populate CATE by segment for the best causal model
                if result.ate != 0.0 and estimator.name == "causal_forest" and result.ite_array:
                    full_ite = np.array(result.ite_array)
                    result.cate_by_segment = _compute_cate_by_segment(
                        full_ite, aligned.head(len(full_ite)), segment_cols
                    )

                model_results[estimator.name] = result
                pbar.set_postfix_str(f"{channel_name} → {estimator.name} ✓ ATE={result.ate:.2f}")
                pbar.update(1)

            # Build channel-level aggregation
            balance_status = balance_lookup.get(channel_name, "good")
            channel_result = _build_channel_result(
                channel_name, model_results, balance_status
            )
            cross = _build_cross_model_comparison(model_results)
            avc = _build_associative_vs_causal(
                channel_name, model_results, channel_result.consensus_ate
            )

            persuadables_pct = 0.0
            best_result = model_results.get(channel_result.best_model)
            if best_result and best_result.uplift_segments:
                persuadables_pct = best_result.uplift_segments.persuadables

            summary = ChannelSummary(
                channel=channel_name,
                consensus_ate=channel_result.consensus_ate,
                best_model=channel_result.best_model,
                agreement_score=channel_result.agreement_score,
                persuadables_pct=round(persuadables_pct, 4),
                confidence_level=channel_result.confidence_level,
            )
            return channel_name, channel_result, cross, avc, summary

        channel_results: dict[str, ChannelResult] = {}
        cross_model_comparisons: dict[str, CrossModelComparison] = {}
        assoc_vs_causal: dict[str, AssociativeVsCausalComparison] = {}
        channel_summaries: list[ChannelSummary] = []

        pbar = tracker.model_loop(total=n_total)
        for ch, (X, T, Y) in channel_data.items():
            try:
                name, ch_result, cross, avc, summary = _run_channel(ch, X, T, Y)
                channel_results[name] = ch_result
                cross_model_comparisons[name] = cross
                assoc_vs_causal[name] = avc
                channel_summaries.append(summary)
            except Exception as e:
                logger.error(f"Channel '{ch}' failed entirely: {e}")
        pbar.close()

        # ── Step 6: Build channel ranking ──────────────────────────
        with tracker.step(6, "Ranking channels"):
            ranked = sorted(
                channel_summaries,
                key=lambda s: s.consensus_ate,
                reverse=True,
            )
            channel_ranking = [
                {
                    "rank": i + 1,
                    "channel": s.channel,
                    "consensus_ate": s.consensus_ate,
                    "confidence_level": s.confidence_level,
                }
                for i, s in enumerate(ranked)
            ]

        # ── Step 7: Package PipelineResult ─────────────────────────
        with tracker.step(7, "Packaging results"):
            result = PipelineResult(
                session_id=session_id,
                channel_ranking=channel_ranking,
                campaign_type_count=len(set(imc_mapping.keys())),
                channel_data=channel_results,
                balance_results=balance_results,
                cross_model_comparison=cross_model_comparisons,
                associative_vs_causal=assoc_vs_causal,
                channel_summary=channel_summaries,
                imc_mapping=imc_mapping,
            )

        top = channel_ranking[0]['channel'] if channel_ranking else 'none'
        tracker.complete(f"Pipeline complete — {len(channel_results)} channels | 🏆 Top: {top}")

    return result


# ── EVALUATION PIPELINE ─────────────────────────────────────────────

def run_evaluation(
    customers_df: pd.DataFrame,
    transactions_df: pd.DataFrame,
    campaigns_df: pd.DataFrame,
    imc_mapping: dict[str, str],
    col_mapping: ColumnMapping,
    config: ModelingConfig | None = None,
) -> dict:
    """
    Run the evaluation pipeline: compute uplift metrics + descriptive stats.

    Re-runs merge/align/engineer to get (X, T, Y) per channel, then:
      1. Fits each estimator and extracts ITEs + propensity scores
      2. Computes evaluation metrics (Uplift AUC, Qini, Precision@K, etc.)
      3. Computes descriptive statistics (Treatment vs Control comparison)

    Returns a dict ready for EvaluationResponse serialisation.
    """
    from app.causal.evaluation import compute_all_metrics
    from app.pipelines.data_processing import compute_descriptive_statistics
    from app.schemas.modeling_schema import (
        EvaluationMetrics, ModelEvaluationResult,
        ChannelEvaluationResult, EvaluationResponse,
    )

    if config is None:
        config = ModelingConfig()

    session_id = str(uuid.uuid4())

    with PipelineTracker("📊 IMC EVALUATION PIPELINE", total_steps=5) as tracker:

        # ── Step 1: Merge ──────────────────────────────────────────
        with tracker.step(1, "Merging datasets") as s:
            merged = merge_datasets(
                customers_df, transactions_df, campaigns_df,
                imc_mapping, col_mapping,
                outcome_window_days=config.outcome_window_days,
            )
            imc_categories = sorted(set(imc_mapping.values()))
            s.detail(f"{len(merged):,} rows")

        # ── Step 2: Balance + alignment ────────────────────────────
        with tracker.step(2, "Balance + temporal alignment"):
            balance_results = check_treatment_balance(
                merged, imc_categories, all_possible_categories=ALL_IMC_CATEGORIES
            )
            aligned = apply_temporal_alignment(merged, campaigns_df, col_mapping)

        # ── Step 3: Descriptive statistics ─────────────────────────
        with tracker.step(3, "Descriptive statistics") as s:
            desc_stats = compute_descriptive_statistics(
                aligned, imc_categories, col_mapping, balance_results
            )
            s.detail(f"{len(desc_stats)} channels")

        # ── Step 4: Feature engineering ────────────────────────────
        with tracker.step(4, "Engineering features") as s:
            channel_data, confounder_cols, _, _ = engineer_features(
                aligned, imc_categories, col_mapping, balance_results=balance_results
            )
            s.detail(f"{len(channel_data)} channels")

        # ── Step 5: Fit models + compute metrics ──────────────────
        with tracker.step(5, "Fitting models + computing metrics") as s:
            estimators = get_all_estimators(config.models_to_run)
            n_total = len(channel_data) * len(estimators)
            s.detail(f"{n_total} evaluations")

        channel_evals = {}
        pbar = tracker.model_loop(total=n_total, colour="magenta")

        for ch, (X, T, Y) in channel_data.items():
            model_evals = {}

            for estimator in estimators:
                fallback_result = ModelResult(model_name=estimator.name, ate=0.0, att=0.0)
                result = safe_run(
                    estimator.run, X, T, Y, feature_names=confounder_cols,
                    fallback=fallback_result,
                    error_msg=f"{ch}/{estimator.name}",
                )

                ite = np.array(result.ite_array) if result.ite_array else np.zeros(len(T))
                if len(ite) < len(T):
                    full_ite = np.full(len(T), np.mean(ite))
                    full_ite[:len(ite)] = ite
                    ite = full_ite

                propensity = None
                if estimator.name in ("dr_learner", "causal_forest"):
                    propensity = getattr(estimator, "_last_propensity", None)

                metrics = compute_all_metrics(ite, T, Y, propensity, k=0.10)
                model_evals[estimator.name] = ModelEvaluationResult(
                    model_name=estimator.name,
                    metrics=EvaluationMetrics(**metrics),
                )
                pbar.set_postfix_str(f"{ch} → {estimator.name} ✓")
                pbar.update(1)

            channel_evals[ch] = ChannelEvaluationResult(
                channel_name=ch,
                model_evaluations=model_evals,
            )

        pbar.close()

        # Build flattened performance summary table
        summary_table = []
        for ch, ch_eval in channel_evals.items():
            for model_name, model_eval in ch_eval.model_evaluations.items():
                m = model_eval.metrics
                summary_table.append({
                    "channel": ch,
                    "model": model_name,
                    "uplift_auc": m.uplift_auc,
                    "qini_auc": m.qini_auc,
                    "precision_at_10pct": m.precision_at_k,
                    "recall_at_10pct": m.recall_at_k,
                    "base_classifier_auc": m.base_classifier_auc,
                })

        tracker.complete(f"Evaluation complete — {len(channel_evals)} channels × {len(estimators)} models")

    return EvaluationResponse(
        session_id=session_id,
        channel_evaluations=channel_evals,
        descriptive_statistics=desc_stats,
        model_performance_summary=summary_table,
    )

