import logging
from fastapi import APIRouter, HTTPException

from app.schemas.imc_mapping import IMCMappingRequest, IMCMappingResponse
from app.services.imc_mapping import map_capmpaign_types_to_imc
from app.services.dataset_service import session_store

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/imc", tags=["IMC Mapping"])


@router.post("/map-campaigns", response_model=IMCMappingResponse)
async def map_campaigns(request: IMCMappingRequest):
    """
    Send campaign type values to the LLM for IMC classification.
    Stores the resulting mapping in the session.
    """
    try:
        result = await map_capmpaign_types_to_imc(request)

        # Store mapping in session if session exists
        session = session_store.get(request.session_id)
        if session:
            session["imc_mapping"] = result.mapping
            session["status"] = "mapped"

        return result

    except Exception as e:
        logger.error(f"IMC mapping failed: {e}")
        raise HTTPException(status_code=500, detail=f"LLM mapping failed: {e}")
