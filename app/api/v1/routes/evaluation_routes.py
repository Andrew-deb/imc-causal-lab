import logging
from fastapi import APIRouter, HTTPException

from app.schemas.modeling_schema import ColumnMapping, EvaluationResponse, RunPipelineRequest
from app.services.modeling_service import execute_evaluation, build_column_mapping
from app.utils.error_handling import handle_route_errors, require_session, require_imc_mapping
from app.api.v1.routes.modeling_routes import _is_real_mapping

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/modeling", tags=["Evaluation"])


@router.post("/evaluate", response_model=EvaluationResponse)
@handle_route_errors("Evaluation")
async def evaluate_models_endpoint(request: RunPipelineRequest):
    """
    Evaluate causal models — compute uplift metrics + descriptive statistics.

    Accepts:
      - session_id (required)
      - column_mapping (optional) — pass this when testing from Swagger.
        If omitted (or set to null), the mapping is pulled from the session.

    Returns:
      - Per-model evaluation metrics (Uplift AUC, Qini AUC, Precision@10%, Recall@10%, Base AUC)
      - Per-channel descriptive statistics (Treatment vs Control comparison)
      - Flattened performance summary table
    """
    session = require_session(request.session_id)
    require_imc_mapping(session)

    # 1. Use inline column_mapping if provided with real values
    if _is_real_mapping(request.column_mapping):
        col_mapping = request.column_mapping
    else:
        # 2. Fall back to session-stored mapping (frontend wizard flow)
        raw_mapping = session.get("column_mapping")
        if not raw_mapping:
            raise HTTPException(
                status_code=400,
                detail="No column mapping found. Either pass column_mapping "
                       "in the request body or ensure the wizard sent it during upload."
            )
        col_mapping = build_column_mapping(raw_mapping)

    result = await execute_evaluation(
        session_id=request.session_id,
        col_mapping=col_mapping,
    )
    return result


