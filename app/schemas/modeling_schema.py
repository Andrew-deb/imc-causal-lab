from pydantic import BaseModel
from typing import Optional

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
    qini_score: Optional[float] = None
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