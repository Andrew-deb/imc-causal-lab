import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException

from app.schemas.imc_mapping import IMCMappingRequest, IMCMappingResponse, IMCConfirmRequest
from app.services.imc_mapping import map_capmpaign_types_to_imc
from app.configs import settings, DEFAULT_IMC_MAPPING
from app.utils.error_handling import handle_route_errors, require_session
from app.utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/imc", tags=["IMC Mapping"])


@router.post("/map-campaigns", response_model=IMCMappingResponse)
@handle_route_errors("IMC mapping")
async def map_campaigns(request: IMCMappingRequest, user_id: str = Depends(get_current_user)):
    """
    Map campaign type values to IMC categories.

    When USE_DEMO_MAPPING=True (default): uses hardcoded Kotler & Keller mapping.
    When USE_DEMO_MAPPING=False: sends to LLM for classification.
    """
    if request.session_id == "demo_session":
        raise HTTPException(status_code=403, detail="Demo session is read-only")

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
    session = await asyncio.to_thread(require_session, request.session_id, False, user_id)
    if session:
        from app.services.session_service import session_manager
        await asyncio.to_thread(
            session_manager.update_session,
            request.session_id,
            user_id=user_id,
            imc_mapping=result.mapping,
            status="mapped"
        )

    return result

@router.post("/confirm-mapping")
@handle_route_errors("IMC confirm mapping")
def confirm_mapping(request: IMCConfirmRequest, user_id: str = Depends(get_current_user)):
    """
    Explicitly save the confirmed IMC mapping to the session.
    Used when the user edits the AI mapping or resumes a session.
    """
    if request.session_id == "demo_session":
        raise HTTPException(status_code=403, detail="Demo session is read-only")

    session = require_session(request.session_id, False, user_id)
    if session:
        from app.services.session_service import session_manager
        session_manager.update_session(
            request.session_id, 
            user_id=user_id,
            imc_mapping=request.mapping, 
            status="mapped"
        )
        logger.info(f"Session {request.session_id[:12]}: IMC mapping confirmed ({len(request.mapping)} categories)")
    return {"status": "success", "session_id": request.session_id}

