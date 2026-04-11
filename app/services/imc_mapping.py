import logging
from app.llm.imc_mapper import get_mapper
from app.schemas.imc_mapping import IMCMappingRequest, IMCMappingResponse

logger = logging.getLogger(__name__)

async def map_capmpaign_types_to_imc(request: IMCMappingRequest) -> IMCMappingResponse:
    
    mapper = get_mapper()

    unique_types = sorted(set(request.campaign_values))
    logger.info(f"Mapping {len(unique_types)} unique campaign types to IMC categories")

    mapping = await mapper.map_campaign_types(unique_types)

    unmapped = [ct for ct in unique_types if ct not in mapping]
    if unmapped:
        logger.warning(f"Unmapped campaign types: {unmapped}")
        
    return IMCMappingResponse(
        session_id=request.session_id,
        mapping=mapping,
        unmapped=unmapped,
    )

