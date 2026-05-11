import logging
from fastapi import APIRouter

from app.schemas.modeling_schema import ColumnMapping, EvaluationResponse, RunPipelineRequest
from app.services.modeling_service import execute_evaluation, build_column_mapping
from app.utils.error_handling import handle_route_errors, require_session, require_imc_mapping

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/modeling", tags=["Evaluation"])


@router.post("/evaluate", response_model=EvaluationResponse)
@handle_route_errors("Evaluation")
async def evaluate_models_endpoint(request: RunPipelineRequest):
    """
    Evaluate causal models — compute uplift metrics + descriptive statistics.

    Returns:
      - Per-model evaluation metrics (Uplift AUC, Qini AUC, Precision@10%, Recall@10%, Base AUC)
      - Per-channel descriptive statistics (Treatment vs Control comparison)
      - Flattened performance summary table

    Requires:
      - Datasets uploaded (POST /datasets/upload)
      - IMC mapping completed (POST /imc/map-campaigns)
      - Column mapping stored in the session
    """
    session = require_session(request.session_id)
    require_imc_mapping(session)

    raw_mapping = session.get("column_mapping")
    if not raw_mapping:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail="No column mapping found in session. Ensure datasets were uploaded."
        )

    col_mapping = build_column_mapping(raw_mapping)

    result = await execute_evaluation(
        session_id=request.session_id,
        col_mapping=col_mapping,
    )
    return result
