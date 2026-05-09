from pydantic import BaseModel
from typing import Optional


# ── Evaluation Metrics (Marthalia Table 2) ──────────────────────────

class CurveData(BaseModel):
    """X-Y data for plotting uplift or Qini curves."""
    fractions: list[float]   # x-axis: population fraction [0, 1]
    values: list[float]      # y-axis: uplift or qini value at each fraction


class EvaluationMetrics(BaseModel):
    """Per-model uplift evaluation metrics."""
    uplift_auc: Optional[float] = None
    qini_auc: Optional[float] = None
    precision_at_k: Optional[float] = None   # k=10%
    recall_at_k: Optional[float] = None      # k=10%
    base_classifier_auc: Optional[float] = None
    # Curve data for plotting
    uplift_curve: Optional[CurveData] = None
    qini_curve: Optional[CurveData] = None


class DescriptiveStats(BaseModel):
    """Single variable comparison: treated vs control."""
    variable: str
    treated_mean: float
    control_mean: float
    std_diff: float  # Cohen's d standardized difference


class ChannelDescriptiveStats(BaseModel):
    """Descriptive statistics for one IMC channel (Marthalia Table 1)."""
    channel_name: str
    n_treated: int
    n_control: int
    stats: list[DescriptiveStats]

class ColumnMapping(BaseModel):
    
    # Required fields for the uploaded dataset.
    customer_id_col: str
    campaign_type_col: str
    campaign_start_col: str
    campaign_end_col: str
    transaction_date_col: str
    transaction_amount_col: str

    # Optional fields for granular Linkage and PyWhy LLM discovery
    campaign_customer_id_col: Optional[str] = None
    confounder_cols: list[str] = []
    mediator_cols: list[str] = []
    collider_cols: list[str] = []


class RunPipelineRequest(BaseModel):
    """
    Simplified pipeline request — just session_id.
    Column mapping is pulled from the session (stored during upload).
    """
    session_id: str

class ModelingConfig(BaseModel):
    
    outcome_window_days: int = 30
    models_to_run: list[str] =[
        "logistic_regression",
        "t_learner",
        "dr_learner",
        "causal_forest",
    ]
    cross_fitting_folds: int = 5

class TreatmentBalanceResult(BaseModel):

    imc_category: str
    treated_count: int
    control_count: int
    treated_pct: float
    status: str  # "good", "warning", "insufficient", "not_in_dataset"
    message: str = ""

class UpliftSegments(BaseModel):
    """Proportion of customers in each uplift segment."""
    persuadables: float
    sure_things: float
    sleeping_dogs: float
    lost_causes: float

class ModelResult(BaseModel):
    """Results from a single estimator on a single channel."""
    model_name: str
    ate: float
    att: float
    ate_ci: Optional[list[float]] = None
    ite_array: Optional[list[float]] = None
    cate_by_segment: Optional[dict[str, dict[str, float]]] = None
    uplift_segments: Optional[UpliftSegments] = None
    feature_importances: Optional[dict[str, float]] = None

class ChannelResult(BaseModel):
    """Aggregated result for one IMC channel across all models."""
    channel_name: str
    model_results: dict[str, ModelResult]
    consensus_ate: float
    consensus_att: float
    agreement_score: float
    best_model: str
    confidence_level: str

class CrossModelComparison(BaseModel):
    metrics: list[dict]

class AssociativeVsCausalComparison(BaseModel):
    """associative vs causal per channel"""
    estimated_effect: dict[str, str]
    confounding_correction: dict[str, str]
    individual_targeting: dict[str, str]
    interpretation: dict[str, str]

class ChannelSummary(BaseModel):
    """Each row in the cross-channel summary"""
    channel: str
    consensus_ate: float
    best_model: str
    agreement_score: float
    persuadables_pct: float
    confidence_level: str

class PipelineResult(BaseModel):
    """Complete output of the causal pipeline."""
    session_id: str

    # --- Primary Dashboard ---
    channel_ranking: list[dict]
    campaign_type_count: int
    channel_data: dict[str, ChannelResult]

    # --- Treatment Balance ---
    balance_results: list[TreatmentBalanceResult]

    # --- Detailed Comparison ---
    cross_model_comparison: dict[str, CrossModelComparison]
    associative_vs_causal: dict[str, AssociativeVsCausalComparison]
    channel_summary: list[ChannelSummary]

    # --- Metadata ---
    imc_mapping: dict[str, str]


# ── Evaluation Response (separate endpoint) ─────────────────────────

class ModelEvaluationResult(BaseModel):
    """Evaluation metrics for one model on one channel."""
    model_name: str
    metrics: EvaluationMetrics


class ChannelEvaluationResult(BaseModel):
    """All model evaluations for one channel."""
    channel_name: str
    model_evaluations: dict[str, ModelEvaluationResult]


class EvaluationResponse(BaseModel):
    """Complete response for the /evaluate endpoint."""
    session_id: str
    channel_evaluations: dict[str, ChannelEvaluationResult]
    descriptive_statistics: dict[str, ChannelDescriptiveStats]
    model_performance_summary: list[dict]  # flattened table for easy display
    # Evaluation-driven best model (by Uplift AUC) per channel
    best_model_per_channel: dict[str, str] = {}