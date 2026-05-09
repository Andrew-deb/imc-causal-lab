"""
Session API Routes.

Endpoints:
  GET  /sessions              — List all sessions (lightweight metadata)
  GET  /sessions/{session_id} — Get full session detail (metadata + IMC mapping + DAG + results)
"""
import logging
from fastapi import APIRouter, HTTPException

from app.services.session_service import session_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sessions", tags=["Sessions"])


@router.get("")
async def list_sessions():
    """
    List all sessions with lightweight metadata.
    Returns session_id, status, created_at, dataset_meta, and flags
    for whether results/evaluation exist.
    """
    return session_manager.list_sessions()


@router.get("/{session_id}")
async def get_session_detail(session_id: str):
    """
    Get detailed session info (excluding raw DataFrames).

    Returns metadata, IMC mapping, column mapping, DAG reference,
    and pipeline results if available.
    """
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    # Build a serialisable response — exclude raw DataFrames
    detail = {
        "session_id": session.get("session_id"),
        "status": session.get("status", "unknown"),
        "created_at": session.get("created_at"),
        "updated_at": session.get("updated_at"),
        "dataset_meta": session.get("dataset_meta"),
        "imc_mapping": session.get("imc_mapping"),
        "column_mapping": session.get("column_mapping"),
        "dag_id": session.get("dag_id"),
        "has_results": session.get("result") is not None,
    }

    # Include results summary if available
    # Include results summary if available
    result = session.get("result")
    if result:
        # If result is a Pydantic model, convert to dict
        if hasattr(result, "model_dump"):
            detail["result"] = result.model_dump()
        else:
            detail["result"] = result

    return detail

@router.delete("/{session_id}")
async def delete_session(session_id: str):
    """
    Delete a session and all its associated data.
    """
    success = session_manager.delete_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    return {"status": "success", "message": f"Session {session_id} deleted successfully"}
