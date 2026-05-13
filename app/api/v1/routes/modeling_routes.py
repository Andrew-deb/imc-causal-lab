import logging
from fastapi import APIRouter, HTTPException

from app.schemas.modeling_schema import RunPipelineRequest, PipelineResult, ColumnMapping
from app.services.modeling_service import execute_pipeline, build_column_mapping
from app.utils.error_handling import handle_route_errors, require_session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/modeling", tags=["Modeling"])


def _is_real_mapping(mapping: ColumnMapping | None) -> bool:
    """
    Return True only if the mapping contains actual column names.
    Swagger auto-fills every string field with the literal value "string",
    so we reject mappings where all required fields are "string".
    """
    if mapping is None:
        return False
    required_values = [
        mapping.customer_id_col,
        mapping.campaign_type_col,
        mapping.campaign_start_col,
        mapping.campaign_end_col,
        mapping.transaction_date_col,
        mapping.transaction_amount_col,
    ]
    # If every required value is the Swagger placeholder, ignore it
    if all(v == "string" for v in required_values):
        return False
    return True


@router.post("/run-pipeline", response_model=PipelineResult)
@handle_route_errors("Pipeline execution")
async def run_pipeline_endpoint(request: RunPipelineRequest):
    """
    Run the full causal inference pipeline.

    Accepts:
      - session_id (required)
      - column_mapping (optional) — pass this when testing from Swagger.
        If omitted (or set to null), the mapping is pulled from the session.
    """
    session = require_session(request.session_id)

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

    result = await execute_pipeline(
        session_id=request.session_id,
        col_mapping=col_mapping,
    )
    return result


