import logging
from fastapi import APIRouter, HTTPException

from app.schemas.modeling_schema import RunPipelineRequest, PipelineResult
from app.services.modeling_service import execute_pipeline, build_column_mapping
from app.utils.error_handling import handle_route_errors, require_session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/modeling", tags=["Modeling"])


@router.post("/run-pipeline", response_model=PipelineResult)
@handle_route_errors("Pipeline execution")
async def run_pipeline_endpoint(request: RunPipelineRequest):
    """
    Run the full causal inference pipeline.

    Requires:
      - Datasets uploaded (POST /datasets/upload)
      - IMC mapping completed (POST /imc/map-campaigns)
      - Column mapping stored in the session (sent during upload)
    """
    session = require_session(request.session_id)

    # Pull column mapping from session
    raw_mapping = session.get("column_mapping")
    if not raw_mapping:
        raise HTTPException(
            status_code=400,
            detail="No column mapping found in session. "
                   "Ensure the wizard sent column_mapping during dataset upload."
        )

    col_mapping = build_column_mapping(raw_mapping)

    result = await execute_pipeline(
        session_id=request.session_id,
        col_mapping=col_mapping,
    )
    return result
