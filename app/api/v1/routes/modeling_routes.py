import logging
from fastapi import APIRouter, HTTPException

from app.schemas.dataset_schema import ColumnMappingRequest
from app.schemas.modeling_schema import ColumnMapping, ModelingConfig, PipelineResult
from app.services.modeling_service import execute_pipeline
from app.services.dataset_service import get_session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/modeling", tags=["Modeling"])


@router.post("/run-pipeline", response_model=PipelineResult)
async def run_pipeline_endpoint(request: ColumnMappingRequest):
    """
    Run the full causal inference pipeline.

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
        result = await execute_pipeline(
            session_id=request.session_id,
            col_mapping=col_mapping,
        )
        return result

    except Exception as e:
        logger.error(f"Pipeline execution failed: {e}")
        raise HTTPException(status_code=500, detail=f"Pipeline failed: {e}")
