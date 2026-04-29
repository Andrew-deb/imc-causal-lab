import logging
from fastapi import APIRouter, HTTPException

from app.schemas.dataset_schema import ColumnMappingRequest
from app.schemas.modeling_schema import ColumnMapping, EvaluationResponse
from app.services.modeling_service import execute_evaluation
from app.services.dataset_service import get_session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/modeling", tags=["Evaluation"])


@router.post("/evaluate", response_model=EvaluationResponse)
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
    session = get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found — upload datasets first")

    if not session.get("imc_mapping"):
        raise HTTPException(
            status_code=400,
            detail="IMC mapping not set — call /imc/map-campaigns first"
        )

    col_mapping = ColumnMapping(
        customer_id_col=request.customer_id_col,
        campaign_type_col=request.campaign_type_col,
        campaign_start_col=request.campaign_start_col,
        campaign_end_col=request.campaign_end_col,
        transaction_date_col=request.transaction_date_col,
        transaction_amount_col=request.transaction_amount_col,
        confounder_cols=request.confounder_cols,
    )

    try:
        result = await execute_evaluation(
            session_id=request.session_id,
            col_mapping=col_mapping,
        )
        return result

    except Exception as e:
        logger.error(f"Evaluation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {e}")
