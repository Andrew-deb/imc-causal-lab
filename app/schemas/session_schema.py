from pydantic import BaseModel
from typing import Optional


class SessionInfo(BaseModel):
    """Lightweight session metadata."""
    session_id: str
    status: str  # "uploaded", "mapped", "running", "complete", "error"
    message: str = ""
    has_results: bool = False