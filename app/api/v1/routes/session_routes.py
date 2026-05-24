"""
Session API Routes.

Endpoints:
  GET  /sessions              — List all sessions (lightweight metadata)
  GET  /sessions/{session_id} — Get full session detail (metadata + IMC mapping + DAG + results)
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends

from app.services.session_service import session_manager
from app.utils.auth import get_current_user, get_current_user_optional

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sessions", tags=["Sessions"])


@router.get("")
def list_sessions(user_id: Optional[str] = Depends(get_current_user_optional)):
    """
    List all sessions with lightweight metadata.
    Returns session_id, status, created_at, dataset_meta, and flags
    for whether results/evaluation exist.
    """
    if user_id is None:
        return []
    return session_manager.list_sessions(user_id=user_id)


@router.get("/{session_id}")
def get_session_detail(session_id: str, user_id: Optional[str] = Depends(get_current_user_optional)):
    """
    Get detailed session info (excluding raw DataFrames).

    Returns metadata, IMC mapping, column mapping, DAG reference,
    and pipeline results if available.
    """
    if session_id != "demo_session" and user_id is None:
        raise HTTPException(status_code=401, detail="Authentication required to view private sessions")

    session = session_manager.get_session(session_id, user_id=user_id)
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
        "dataset_roles": session.get("dataset_roles"),
        "has_results": session.get("result") is not None,
        "has_evaluation": session.get("evaluation_result") is not None,
    }

    # Include results summary if available
    result = session.get("result")
    if result:
        # If result is a Pydantic model, convert to dict
        if hasattr(result, "model_dump"):
            detail["result"] = result.model_dump()
        else:
            detail["result"] = result

    # Include evaluation results if available
    eval_result = session.get("evaluation_result")
    if eval_result:
        if hasattr(eval_result, "model_dump"):
            detail["evaluation_result"] = eval_result.model_dump()
        else:
            detail["evaluation_result"] = eval_result

    return detail


@router.delete("/{session_id}")
def delete_session(session_id: str, user_id: str = Depends(get_current_user)):
    """
    Delete a session and all its associated data.
    """
    if session_id == "demo_session":
        raise HTTPException(status_code=403, detail="Demo session cannot be deleted")

    try:
        success = session_manager.delete_session(session_id, user_id=user_id)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

    if not success:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    return {"status": "success", "message": f"Session {session_id} deleted successfully"}


@router.get("/{session_id}/treatment-balance")
def get_treatment_balance(session_id: str, user_id: Optional[str] = Depends(get_current_user_optional)):
    """
    Retrieve treatment balance results for a session.
    """
    if session_id != "demo_session" and user_id is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    session = session_manager.get_session(session_id, user_id=user_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    result = session.get("result")
    if not result:
        raise HTTPException(
            status_code=400,
            detail=f"No results yet. Status: {session.get('status', 'unknown')}"
        )

    # Handle Pydantic model vs dict
    if hasattr(result, "model_dump"):
        result_dict = result.model_dump()
    else:
        result_dict = result

    return result_dict.get("balance_results", [])


@router.patch("/{session_id}/attach-dag")
def attach_dag_to_session(session_id: str, payload: dict, user_id: str = Depends(get_current_user)):
    """
    Attach a DAG from the library to a session.

    Accepts: { "dag_id": "..." }
    Updates the session with the DAG reference and transitions status
    to 'discovery_completed'.
    """
    if session_id == "demo_session":
        raise HTTPException(status_code=403, detail="Demo session is read-only")

    dag_id = payload.get("dag_id")
    if not dag_id:
        raise HTTPException(status_code=400, detail="dag_id is required")

    session = session_manager.get_session(session_id, user_id=user_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    session_manager.update_session(
        session_id,
        user_id=user_id,
        dag_id=dag_id,
        status="discovery_completed",
    )
    logger.info(f"DAG {dag_id[:12]} attached to session {session_id[:12]}")

    return {"status": "success", "session_id": session_id, "dag_id": dag_id}


@router.get("/{session_id}/data-preview")
def get_data_preview(session_id: str, rows: int = 5, user_id: Optional[str] = Depends(get_current_user_optional)):
    """
    On-demand data preview — returns the first N rows from each stored dataset.
    Fetches from in-memory or Azure Blob depending on the storage backend.
    """
    if session_id != "demo_session" and user_id is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    session = session_manager.get_session(session_id, include_datasets=True, user_id=user_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    import numpy as np
    preview = {}
    for key, label in [
        ("customers_df", "customers"),
        ("transactions_df", "transactions"),
        ("campaigns_df", "campaigns"),
    ]:
        df = session.get(key)
        if df is not None:
            preview[label] = {
                "headers": df.columns.tolist(),
                "rows": df.head(rows).replace({np.nan: None}).values.tolist(),
                "total_rows": len(df),
            }

    return {"status": "success", "datasets": preview}
