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
async def delete_session(session_id: str):
    """
    Delete a session and all its associated data.
    """
    success = session_manager.delete_session(session_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    return {"status": "success", "message": f"Session {session_id} deleted successfully"}


@router.get("/{session_id}/treatment-balance")
async def get_treatment_balance(session_id: str):
    """
    Retrieve treatment balance results for a session.
    """
    session = session_manager.get_session(session_id)
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
async def attach_dag_to_session(session_id: str, payload: dict):
    """
    Attach a DAG from the library to a session.

    Accepts: { "dag_id": "..." }
    Updates the session with the DAG reference and transitions status
    to 'discovery_completed'.
    """
    dag_id = payload.get("dag_id")
    if not dag_id:
        raise HTTPException(status_code=400, detail="dag_id is required")

    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

    session_manager.update_session(
        session_id,
        dag_id=dag_id,
        status="discovery_completed",
    )
    logger.info(f"DAG {dag_id[:12]} attached to session {session_id[:12]}")

    return {"status": "success", "session_id": session_id, "dag_id": dag_id}


@router.get("/{session_id}/data-preview")
async def get_data_preview(session_id: str, rows: int = 5):
    """
    On-demand data preview — returns the first N rows from each stored dataset.
    Fetches from in-memory or Azure Blob depending on the storage backend.
    """
    session = session_manager.get_session(session_id)
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
