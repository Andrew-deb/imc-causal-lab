import logging
from fastapi import APIRouter

from app.schemas.dataset_schema import ColumnMappingRequest
from app.schemas.modeling_schema import ColumnMapping, PipelineResult
from app.services.modeling_service import execute_pipeline
from app.utils.error_handling import handle_route_errors, require_session, require_imc_mapping

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/modeling", tags=["Modeling"])


@router.post("/run-pipeline", response_model=PipelineResult)
@handle_route_errors("Pipeline execution")
async def run_pipeline_endpoint(request: ColumnMappingRequest):
    """
    Run the full causal inference pipeline.

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

    result = await execute_pipeline(
        session_id=request.session_id,
        col_mapping=col_mapping,
    )
    return result
