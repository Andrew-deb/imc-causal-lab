import logging
from fastapi import APIRouter, HTTPException

from app.schemas.imc_mapping import IMCMappingRequest, IMCMappingResponse
from app.services.imc_mapping import map_capmpaign_types_to_imc
from app.services.dataset_service import session_store
from app.configs import settings, DEFAULT_IMC_MAPPING

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/imc", tags=["IMC Mapping"])


@router.post("/map-campaigns", response_model=IMCMappingResponse)
async def map_campaigns(request: IMCMappingRequest):
    """
    Map campaign type values to IMC categories.

    When USE_DEMO_MAPPING=True (default): uses hardcoded Kotler & Keller mapping.
    When USE_DEMO_MAPPING=False: sends to LLM for classification.
    """
    try:
        if settings.USE_DEMO_MAPPING:
            # ── Demo mode: deterministic mapping ──────────────────
            logger.info("Using demo IMC mapping (hardcoded)")
            unique_types = sorted(set(request.campaign_values))
            mapping = {ct: DEFAULT_IMC_MAPPING[ct] for ct in unique_types if ct in DEFAULT_IMC_MAPPING}
            unmapped = [ct for ct in unique_types if ct not in DEFAULT_IMC_MAPPING]
            if unmapped:
                logger.warning(f"Unmapped campaign types (not in demo mapping): {unmapped}")
            result = IMCMappingResponse(
                session_id=request.session_id,
                mapping=mapping,
                unmapped=unmapped,
            )
        else:
            # ── Production mode: LLM classification ───────────────
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

