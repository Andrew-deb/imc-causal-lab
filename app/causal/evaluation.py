"""
Uplift Model Evaluation Metrics
================================

Implements evaluation metrics for causal/uplift models, aligned with
Marthalia (2024) Table 2 for direct comparability.

Metrics:
  - Uplift AUC:        Area under the uplift curve
  - Qini AUC:          Area under the Qini curve (Radcliffe, 2007)
  - Precision@K:       Targeting accuracy in top-K% of predicted uplift
  - Recall@K:          Coverage of true responders in top-K%
  - Base Classifier AUC: Propensity model's treatment prediction accuracy

All metrics operate on (ITE predictions, treatment T, outcome Y) tuples,
which are already produced by the causal estimators.
"""
import logging
import numpy as np
from sklearn.metrics import roc_auc_score

logger = logging.getLogger(__name__)

# NumPy 2.0+ compatibility: np.trapz was renamed to np.trapezoid
_trapz = getattr(np, 'trapezoid', None) or getattr(np, 'trapz')


def _validate_inputs(ite: np.ndarray, T: np.ndarray, Y: np.ndarray) -> bool:
    """Check that inputs are valid for metric computation."""
    if len(ite) != len(T) or len(ite) != len(Y):
        logger.warning("ITE/T/Y length mismatch — skipping metrics")
        return False
    if len(np.unique(T)) < 2:
        logger.warning("Only one treatment class — skipping metrics")
        return False
    if len(ite) < 20:
        logger.warning("Too few observations for reliable metrics")
        return False
    return True


# ── Uplift Curve & AUC ──────────────────────────────────────────────

def compute_uplift_curve(
    ite: np.ndarray,
    T: np.ndarray,
    Y: np.ndarray,
    n_bins: int = 100,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Compute the uplift curve.

    Sort individuals by predicted ITE (descending). At each population
    fraction k, compute the cumulative uplift:
        uplift(k) = E[Y|T=1, top-k] - E[Y|T=0, top-k]

    Returns:
        (fractions, uplift_values) — arrays of length n_bins+1
    """
    # Sort by predicted uplift (descending)
    order = np.argsort(-ite)
    T_sorted = T[order]
    Y_sorted = Y[order]

    fractions = np.linspace(0, 1, n_bins + 1)
    uplift_values = np.zeros(n_bins + 1)

    n = len(ite)
    for i, frac in enumerate(fractions):
        if frac == 0:
            continue
        k = max(1, int(frac * n))
        T_top = T_sorted[:k]
        Y_top = Y_sorted[:k]

        n_treated = np.sum(T_top == 1)
        n_control = np.sum(T_top == 0)

        if n_treated > 0 and n_control > 0:
            uplift_values[i] = np.mean(Y_top[T_top == 1]) - np.mean(Y_top[T_top == 0])
        elif n_treated > 0:
            uplift_values[i] = np.mean(Y_top[T_top == 1])
        else:
            uplift_values[i] = 0.0

    return fractions, uplift_values


def compute_uplift_auc(
    ite: np.ndarray,
    T: np.ndarray,
    Y: np.ndarray,
) -> float | None:
    """
    Area Under the Uplift Curve (normalized).

    Higher values indicate better uplift targeting — the model
    successfully identifies individuals who benefit most from treatment.
    """
    if not _validate_inputs(ite, T, Y):
        return None

    fractions, uplift_values = compute_uplift_curve(ite, T, Y)

    # Normalize: AUC of the model curve minus AUC of random targeting
    model_auc = float(_trapz(uplift_values, fractions))
    # Random targeting: constant uplift = overall ATE across all fractions
    overall_ate = np.mean(Y[T == 1]) - np.mean(Y[T == 0]) if np.sum(T == 0) > 0 else 0
    random_auc = overall_ate  # integral of constant over [0,1]

    # Normalized uplift AUC
    if abs(random_auc) > 1e-10:
        return round(float((model_auc - random_auc) / abs(random_auc)), 6)
    return round(float(model_auc), 6)


# ── Qini Curve & AUC ────────────────────────────────────────────────

def compute_qini_curve(
    ite: np.ndarray,
    T: np.ndarray,
    Y: np.ndarray,
    n_bins: int = 100,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Compute the Qini curve (Radcliffe, 2007).

    The Qini curve measures cumulative incremental gains. At fraction k:
        Qini(k) = (n_t1_in_top_k / n_t_total) - (n_c1_in_top_k / n_c_total)

    Where:
      n_t1 = treated responders (T=1, Y > threshold)
      n_c1 = control responders (T=0, Y > threshold)

    Threshold = median(Y) — standard binary response threshold.

    Returns:
        (fractions, qini_values) — arrays for plotting
    """
    # Binary response: Y above median is a "responder"
    y_threshold = np.median(Y)
    Y_binary = (Y > y_threshold).astype(int)

    # Sort by predicted uplift (descending)
    order = np.argsort(-ite)
    T_sorted = T[order]
    Y_sorted = Y_binary[order]

    n_treated_total = np.sum(T == 1)
    n_control_total = np.sum(T == 0)

    fractions = np.linspace(0, 1, n_bins + 1)
    qini_values = np.zeros(n_bins + 1)

    n = len(ite)
    for i, frac in enumerate(fractions):
        if frac == 0:
            continue
        k = max(1, int(frac * n))
        T_top = T_sorted[:k]
        Y_top = Y_sorted[:k]

        # Treated responders in top-k
        n_t1 = np.sum((T_top == 1) & (Y_top == 1))
        # Control responders in top-k
        n_c1 = np.sum((T_top == 0) & (Y_top == 1))

        # Qini value (normalized by total treated/control)
        q_t = n_t1 / n_treated_total if n_treated_total > 0 else 0
        q_c = n_c1 / n_control_total if n_control_total > 0 else 0
        qini_values[i] = q_t - q_c

    return fractions, qini_values


def compute_qini_auc(
    ite: np.ndarray,
    T: np.ndarray,
    Y: np.ndarray,
) -> float | None:
    """
    Qini coefficient: Area under the Qini curve.

    Standard metric for evaluating uplift models (Radcliffe, 2007).
    Positive values indicate better-than-random targeting.
    """
    if not _validate_inputs(ite, T, Y):
        return None

    fractions, qini_values = compute_qini_curve(ite, T, Y)
    return round(float(_trapz(qini_values, fractions)), 6)


# ── Precision@K and Recall@K ────────────────────────────────────────

def compute_precision_at_k(
    ite: np.ndarray,
    T: np.ndarray,
    Y: np.ndarray,
    k: float = 0.10,
) -> float | None:
    """
    Precision@K — targeting accuracy in top K% of predicted uplift.

    Among the top-K% individuals (ranked by predicted ITE), what fraction
    are true "positive responders"?

    A positive responder = treated individual with outcome above median
    AND outcome higher than the average control outcome.

    Args:
        k: fraction of population to consider (0.10 = top 10%)
    """
    if not _validate_inputs(ite, T, Y):
        return None

    # Define positive responders: treated with Y > median(Y)
    y_threshold = np.median(Y)
    is_responder = (T == 1) & (Y > y_threshold)

    # Top-k by predicted ITE
    n_top = max(1, int(k * len(ite)))
    top_idx = np.argsort(-ite)[:n_top]

    # Precision: fraction of top-k that are responders
    n_responders_in_top = np.sum(is_responder[top_idx])
    precision = n_responders_in_top / n_top

    return round(float(precision), 6)


def compute_recall_at_k(
    ite: np.ndarray,
    T: np.ndarray,
    Y: np.ndarray,
    k: float = 0.10,
) -> float | None:
    """
    Recall@K — coverage of true responders in top K%.

    Of all true positive responders in the dataset, what fraction
    are captured in the top-K% by predicted ITE?

    Args:
        k: fraction of population to consider (0.10 = top 10%)
    """
    if not _validate_inputs(ite, T, Y):
        return None

    # Define positive responders
    y_threshold = np.median(Y)
    is_responder = (T == 1) & (Y > y_threshold)
    total_responders = np.sum(is_responder)

    if total_responders == 0:
        return 0.0

    # Top-k by predicted ITE
    n_top = max(1, int(k * len(ite)))
    top_idx = np.argsort(-ite)[:n_top]

    # Recall: fraction of all responders captured in top-k
    n_responders_in_top = np.sum(is_responder[top_idx])
    recall = n_responders_in_top / total_responders

    return round(float(recall), 6)


# ── Base Classifier AUC ─────────────────────────────────────────────

def compute_base_classifier_auc(
    T: np.ndarray,
    propensity_scores: np.ndarray | None,
) -> float | None:
    """
    ROC AUC of the propensity model's treatment prediction.

    Measures how well the base classifier separates treated from control.
    Higher AUC = features are more predictive of treatment assignment.

    Only available for models with an explicit propensity model
    (DR-Learner, Causal Forest). Returns None for T-Learner and OLS.
    """
    if propensity_scores is None:
        return None

    if len(np.unique(T)) < 2:
        return None

    try:
        auc = roc_auc_score(T, propensity_scores)
        return round(float(auc), 6)
    except Exception as e:
        logger.warning(f"Could not compute propensity AUC: {e}")
        return None


# ── Convenience Wrapper ─────────────────────────────────────────────

def compute_all_metrics(
    ite: np.ndarray,
    T: np.ndarray,
    Y: np.ndarray,
    propensity_scores: np.ndarray | None = None,
    k: float = 0.10,
) -> dict:
    """
    Compute all evaluation metrics at once.

    Returns a dict matching the EvaluationMetrics schema:
      {uplift_auc, qini_auc, precision_at_k, recall_at_k, base_classifier_auc}
    """
    return {
        "uplift_auc": compute_uplift_auc(ite, T, Y),
        "qini_auc": compute_qini_auc(ite, T, Y),
        "precision_at_k": compute_precision_at_k(ite, T, Y, k=k),
        "recall_at_k": compute_recall_at_k(ite, T, Y, k=k),
        "base_classifier_auc": compute_base_classifier_auc(T, propensity_scores),
    }
