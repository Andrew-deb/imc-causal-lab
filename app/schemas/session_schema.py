from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class SessionInfo(BaseModel):
    """Lightweight session metadata for list views."""
    session_id: str
    status: str  # "uploaded", "mapped", "running", "complete", "error"
    created_at: datetime
    updated_at: Optional[datetime] = None
    dataset_meta: Optional[dict] = None  # row/column counts
    has_results: bool = False
    has_evaluation: bool = False


class SessionDetail(SessionInfo):
    """Full session detail including mappings."""
    imc_mapping: Optional[dict] = None
    column_mapping: Optional[dict] = None


class SessionListResponse(BaseModel):
    """Response for GET /sessions."""
    sessions: list[SessionInfo]
    total: int
