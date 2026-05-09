from pydantic import BaseModel
from enum import Enum


class IMCCategory(str, Enum):
    """The four IMC categories from Kotler & Keller."""
    ADVERTISING = "advertising"
    DIRECT_MARKETING = "direct_marketing"
    PROMOTION = "promotion"
    PUBLIC_RELATIONS = "public_relations"


class IMCMappingRequest(BaseModel):
    """Request to map campaign types to IMC categories via LLM."""
    session_id: str
    campaign_values: list[str]


class IMCMappingResponse(BaseModel):
    """Response from the LLM mapping service."""
    session_id: str
    mapping: dict[str, str]
    unmapped: list[str] = []

class IMCConfirmRequest(BaseModel):
    """Request to explicitly save/confirm an IMC mapping."""
    session_id: str
    mapping: dict[str, str]