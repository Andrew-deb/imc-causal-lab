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
    EvaluationResponse,
    EvaluationMetrics,
    ModelEvaluationResult,
)
from app.pipelines.data_processing import (
    merge_datasets,
    apply_temporal_alignment,
    check_treatment_balance,
    engineer_features,
)
from app.causal.estimators import get_all_estimators
from app.causal.evaluation import compute_all_metrics, select_best_model

logger = logging.getLogger(__name__)

# All 4 Kotler & Keller IMC categories
ALL_IMC_CATEGORIES = ["advertising", "direct_marketing", "promotion", "public_relations"]



# Build ChannelResult from multiple ModelResults


def _build_channel_result(
    channel_name: str,
    model_results: dict[str, ModelResult],
    balance_status: str,
    eval_best_model: str | None = None,
    eval_best_uplift_auc: float | None = None,
    eval_best_qini_auc: float | None = None,
) -> ChannelResult:
    """
    Aggregate multiple estimator results into a single ChannelResult.

    Model selection is driven by evaluation metrics (Uplift AUC) when available.
    Falls back to narrowest-CI selection if evaluation data is not provided.

    - consensus_ate/att: Best model's ATE/ATT (evaluation-selected).
    - agreement_score: 1 - (std / |mean|) of causal ATEs (diagnostic).
    - best_model: evaluation-selected model (by Uplift AUC).
    - confidence_level: "high" / "medium" / "low" based on agreement + balance (diagnostic).
    """
    # Separate causal models from associative baseline
    lr = model_results.get("logistic_regression")
    baseline_ate = lr.ate if lr else 0.0

    causal_results = {
        name: r for name, r in model_results.items()
        if name != "logistic_regression"
    }

    # 1. Aggressive Outlier Rejection
    # Filter out models that suffered from extreme extrapolation failure.
    valid_causal_results = {}
    for name, r in causal_results.items():
        # Heuristic: If a causal estimate is completely unphysical
        # (e.g. > 3x the baseline effect AND absolute magnitude > 100)
        if abs(r.ate) > max(100.0, 3 * abs(baseline_ate)):
            logger.warning(
                f"Dropping {name} for channel {channel_name}: "
                f"ATE {r.ate:.2f} is implausible compared to baseline {baseline_ate:.2f}"
            )
            continue
        valid_causal_results[name] = r

    if not valid_causal_results:
        # Fallback to associative if all causal models failed or were rejected
        logger.warning(f"No valid causal models for {channel_name}. Falling back to associative baseline.")
        return ChannelResult(
            channel_name=channel_name,
            model_results=model_results,
            consensus_ate=baseline_ate,
            consensus_att=lr.att if lr else 0.0,
            agreement_score=0.0,
            best_model="logistic_regression",
            confidence_level="low",
        )

    # 2. Model Selection — Evaluation-driven (Uplift AUC) or CI-width fallback
    if eval_best_model and eval_best_model in valid_causal_results:
        best_model = eval_best_model
    else:
        # Fallback: narrowest CI (only when evaluation metrics weren't computed)
        best_model = "causal_forest"  # default
        narrowest_ci = float("inf")
        for name, r in valid_causal_results.items():
            if r.ate_ci and len(r.ate_ci) == 2:
                ci_width = abs(r.ate_ci[1] - r.ate_ci[0])
                if ci_width < narrowest_ci:
                    narrowest_ci = ci_width
                    best_model = name

    # Best model's ATE/ATT become the reported values
    best_result = valid_causal_results[best_model]
    consensus_ate = best_result.ate
    consensus_att = best_result.att

    # 3. Agreement Score & Confidence Level (diagnostics — trust layer)
    ates = [r.ate for r in valid_causal_results.values()]
    ate_mean = np.mean(ates)
    ate_std = np.std(ates) if len(ates) > 1 else 0.0
    if abs(ate_mean) > 1e-6:
        agreement = max(0.0, min(1.0, 1.0 - (ate_std / abs(ate_mean))))
    else:
        agreement = 1.0 if ate_std < 1e-6 else 0.0

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
        best_model_uplift_auc=round(eval_best_uplift_auc, 6) if eval_best_uplift_auc is not None else None,
        best_model_qini_auc=round(eval_best_qini_auc, 6) if eval_best_qini_auc is not None else None,
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
    job_id: str | None = None,
    session_id: str | None = None,
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
        job_id: optional background job tracking ID
        session_id: optional wizard upload session ID

    Returns:
        PipelineResult ready for API serialisation
    """
    if config is None:
        config = ModelingConfig()

    if session_id is None:
        session_id = str(uuid.uuid4())

    with PipelineTracker("[IMC] CAUSAL PIPELINE", total_steps=7, job_id=job_id, session_id=session_id) as tracker:

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
                pbar.set_postfix_str(f"{channel_name} -> {estimator.name} [OK] ATE={result.ate:.2f}")
                pbar.update(1)

            # Compute mean outcome for control group (baseline spending)
            # Used by frontend to compute % lift = ATE / mean_Y_control × 100
            control_mask = T == 0
            mean_y_control = float(np.mean(Y[control_mask])) if np.sum(control_mask) > 0 else float(np.mean(Y))

            # ── Inline evaluation: compute metrics for each model ──
            model_evals: dict[str, ModelEvaluationResult] = {}
            for est_name, result in model_results.items():
                ite = np.array(result.ite_array) if result.ite_array else np.zeros(len(T))
                if len(ite) < len(T):
                    full_ite = np.full(len(T), np.mean(ite) if len(ite) > 0 else 0.0)
                    full_ite[:len(ite)] = ite
                    ite = full_ite
                try:
                    metrics = compute_all_metrics(ite, T, Y, propensity_scores=None, k=0.10)
                    model_evals[est_name] = ModelEvaluationResult(
                        model_name=est_name, metrics=EvaluationMetrics(**metrics)
                    )
                except Exception:
                    pass  # Skip models that fail metric computation

            # Select best model by evaluation metrics (Uplift AUC + Qini tiebreaker)
            eval_best = select_best_model(model_evals) if model_evals else None
            eval_best_uplift_auc = None
            eval_best_qini_auc = None
            if eval_best and eval_best in model_evals:
                eval_best_uplift_auc = model_evals[eval_best].metrics.uplift_auc
                eval_best_qini_auc = model_evals[eval_best].metrics.qini_auc

            # Build channel-level aggregation (evaluation-driven model selection)
            balance_status = balance_lookup.get(channel_name, "good")
            channel_result = _build_channel_result(
                channel_name, model_results, balance_status,
                eval_best_model=eval_best,
                eval_best_uplift_auc=eval_best_uplift_auc,
                eval_best_qini_auc=eval_best_qini_auc,
            )
            channel_result.mean_outcome_control = round(mean_y_control, 4)

            cross = _build_cross_model_comparison(model_results)

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
            return channel_name, channel_result, cross, summary

        channel_results: dict[str, ChannelResult] = {}
        cross_model_comparisons: dict[str, CrossModelComparison] = {}
        channel_summaries: list[ChannelSummary] = []

        pbar = tracker.model_loop(total=n_total)
        for ch, (X, T, Y) in channel_data.items():
            try:
                name, ch_result, cross, summary = _run_channel(ch, X, T, Y)
                channel_results[name] = ch_result
                cross_model_comparisons[name] = cross
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
                    "mean_outcome_control": channel_results[s.channel].mean_outcome_control,
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
                channel_summary=channel_summaries,
            )

        top = channel_ranking[0]['channel'] if channel_ranking else 'none'
        tracker.complete(f"Pipeline complete — {len(channel_results)} channels | Top: {top}")

    return result


# ── EVALUATION PIPELINE ─────────────────────────────────────────────

def run_evaluation(
    customers_df: pd.DataFrame,
    transactions_df: pd.DataFrame,
    campaigns_df: pd.DataFrame,
    imc_mapping: dict[str, str],
    col_mapping: ColumnMapping,
    config: ModelingConfig | None = None,
    job_id: str | None = None,
    session_id: str | None = None,
) -> dict:
    """
    Run the evaluation pipeline: compute uplift metrics + descriptive stats.

    Re-runs merge/align/engineer to get (X, T, Y) per channel, then:
      1. Fits each estimator and extracts ITEs + propensity scores
      2. Computes evaluation metrics (Uplift AUC, Qini, Precision@K, etc.)
      3. Computes descriptive statistics (Treatment vs Control comparison)

    Returns a dict ready for EvaluationResponse serialisation.
    """
    from app.pipelines.data_processing import compute_descriptive_statistics
    from app.schemas.modeling_schema import (
        ChannelEvaluationResult, EvaluationResponse,
    )

    if config is None:
        config = ModelingConfig()

    if session_id is None:
        session_id = str(uuid.uuid4())

    with PipelineTracker("[IMC] EVALUATION PIPELINE", total_steps=6, job_id=job_id, session_id=session_id) as tracker:

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
            balance_lookup = {br.imc_category: br.status for br in balance_results}
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
        best_model_per_channel = {}
        # Collect model results per channel for associative vs causal comparison
        channel_model_results: dict[str, dict[str, ModelResult]] = {}
        pbar = tracker.model_loop(total=n_total, colour="magenta")

        for ch, (X, T, Y) in channel_data.items():
            model_evals = {}
            model_results_for_ch: dict[str, ModelResult] = {}

            for estimator in estimators:
                fallback_result = ModelResult(model_name=estimator.name, ate=0.0, att=0.0)
                result = safe_run(
                    estimator.run, X, T, Y, feature_names=confounder_cols,
                    fallback=fallback_result,
                    error_msg=f"{ch}/{estimator.name}",
                )

                # Store the model result for associative vs causal comparison
                model_results_for_ch[estimator.name] = result

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
                pbar.set_postfix_str(f"{ch} -> {estimator.name} [OK]")
                pbar.update(1)

            channel_evals[ch] = ChannelEvaluationResult(
                channel_name=ch,
                model_evaluations=model_evals,
            )
            channel_model_results[ch] = model_results_for_ch

            # Select best targeting model for this channel (by Uplift AUC)
            best_model_per_channel[ch] = select_best_model(model_evals)

        pbar.close()

        # ── Step 6: Best model selection + summary + associative vs causal
        with tracker.step(6, "Selecting best models + building summary") as s:
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
                        "is_best": model_name == best_model_per_channel.get(ch),
                    })

            # Build associative vs causal comparison per channel
            assoc_vs_causal: dict[str, AssociativeVsCausalComparison] = {}
            for ch, mr in channel_model_results.items():
                balance_status = balance_lookup.get(ch, "good")
                eval_best = best_model_per_channel.get(ch)
                eval_uplift = None
                eval_qini = None
                if eval_best and ch in channel_evals:
                    eval_m = channel_evals[ch].model_evaluations.get(eval_best)
                    if eval_m:
                        eval_uplift = eval_m.metrics.uplift_auc
                        eval_qini = eval_m.metrics.qini_auc
                ch_result = _build_channel_result(
                    ch, mr, balance_status,
                    eval_best_model=eval_best,
                    eval_best_uplift_auc=eval_uplift,
                    eval_best_qini_auc=eval_qini,
                )
                assoc_vs_causal[ch] = _build_associative_vs_causal(
                    ch, mr, ch_result.consensus_ate
                )

            winners = ", ".join(f"{ch}: {m}" for ch, m in best_model_per_channel.items())
            s.detail(f"Top: {winners}")

        tracker.complete(f"Evaluation complete — {len(channel_evals)} channels × {len(estimators)} models")

    return EvaluationResponse(
        session_id=session_id,
        channel_evaluations=channel_evals,
        descriptive_statistics=desc_stats,
        model_performance_summary=summary_table,
        best_model_per_channel=best_model_per_channel,
        associative_vs_causal=assoc_vs_causal,
    )


