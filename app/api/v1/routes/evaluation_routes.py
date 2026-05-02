import logging
from fastapi import APIRouter

from app.schemas.dataset_schema import ColumnMappingRequest
from app.schemas.modeling_schema import ColumnMapping, EvaluationResponse
from app.services.modeling_service import execute_evaluation
from app.utils.error_handling import handle_route_errors, require_session, require_imc_mapping

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/modeling", tags=["Evaluation"])


@router.post("/evaluate", response_model=EvaluationResponse)
@handle_route_errors("Evaluation")
async def evaluate_models_endpoint(request: ColumnMappingRequest):
    """
    Evaluate causal models — compute uplift metrics + descriptive statistics.

    Returns:
      - Per-model evaluation metrics (Uplift AUC, Qini AUC, Precision@10%, Recall@10%, Base AUC)
      - Per-channel descriptive statistics (Treatment vs Control comparison)
      - Flattened performance summary table

    Requires:
      - Datasets uploaded (POST /datasets/upload)
      - IMC mapping completed (POST /imc/map-campaigns)
      - Column mapping provided in this request
    """
    session = require_session(request.session_id)
    require_imc_mapping(session)

    col_mapping = ColumnMapping(
        customer_id_col=request.customer_id_col,
        campaign_type_col=request.campaign_type_col,
        campaign_start_col=request.campaign_start_col,
        campaign_end_col=request.campaign_end_col,
        transaction_date_col=request.transaction_date_col,
        transaction_amount_col=request.transaction_amount_col,
        confounder_cols=request.confounder_cols,
    )

    result = await execute_evaluation(
        session_id=request.session_id,
        col_mapping=col_mapping,
    )
    return result
