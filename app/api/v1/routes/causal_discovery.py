"""
Causal Discovery API Routes.

Endpoints:
  POST /causal-discovery/discover             — Run LLM-powered DAG discovery
  GET  /causal-discovery/dags                 — List all saved DAGs
  GET  /causal-discovery/dags/{dag_id}        — Get a specific DAG
  POST /causal-discovery/dags                 — Save a manually built DAG
  POST /causal-discovery/dags/verify-and-save — Validate + save after LLM review
  PUT  /causal-discovery/dags/{dag_id}        — Update a saved DAG
  DELETE /causal-discovery/dags/{dag_id}      — Delete a saved DAG
"""
import asyncio
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends

from app.schemas.causal_discovery import (
    DAGDiscoveryRequest,
    DAGDiscoveryResponse,
    DAGCreateRequest,
    DAGVerifyAndSaveRequest,
    DAGUpdateRequest,
    SavedDAG,
    DAGListItem,
)
from app.services.causal_discovery import execute_dag_discovery
from app.services import dag_library
from app.utils.error_handling import handle_route_errors, require_session
from app.utils.auth import get_current_user, get_current_user_optional

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/causal-discovery", tags=["Causal Discovery"])


# ── LLM Discovery ───────────────────────────────────────────────────

@router.post("/discover", response_model=DAGDiscoveryResponse)
@handle_route_errors("DAG Discovery")
async def discover_dag(request: DAGDiscoveryRequest, user_id: str = Depends(get_current_user)):
    """
    Run LLM-powered causal graph discovery.

    Two modes:
      - Session mode: provide session_id (requires datasets + IMC mapping)
      - Studio mode: provide variables list directly (no session needed)

    Returns a PROPOSED DAG. The user should review it and then
    call /dags/verify-and-save to persist it to the library.
    """
    if request.session_id:
        if request.session_id == "demo_session":
            raise HTTPException(status_code=403, detail="Demo session is read-only")
        await asyncio.to_thread(require_session, request.session_id, False, user_id)

    result = await execute_dag_discovery(
        session_id=request.session_id,
        variables=request.variables,
        treatment_col=request.treatment_col,
        outcome_col=request.outcome_col,
    )
    return result


# ── DAG Library CRUD ─────────────────────────────────────────────────

@router.get("/dags", response_model=list[DAGListItem])
@handle_route_errors("List DAGs")
def list_dags(user_id: Optional[str] = Depends(get_current_user_optional)):
    """List all saved DAGs in the library."""
    # Since DAGs are global / shared for discovery in the library, we allow read-only
    # access for anyone, but require a user for writes.
    return dag_library.list_dags()


@router.get("/dags/{dag_id}", response_model=SavedDAG)
@handle_route_errors("Get DAG", status_code=404)
def get_dag(dag_id: str, user_id: Optional[str] = Depends(get_current_user_optional)):
    """Get a specific saved DAG by ID."""
    dag = dag_library.get_dag(dag_id)
    if not dag:
        raise HTTPException(status_code=404, detail="DAG not found")
    return dag


@router.post("/dags", response_model=SavedDAG, status_code=201)
@handle_route_errors("Create DAG")
def create_dag(request: DAGCreateRequest, user_id: str = Depends(get_current_user)):
    """
    Save a manually built DAG to the library.

    The edges are validated (cycle detection) before saving.
    If cycles are found, the weakest edges are automatically removed.
    """
    return dag_library.create_dag(request)


@router.post("/dags/verify-and-save", response_model=SavedDAG, status_code=201)
@handle_route_errors("Verify & Save DAG")
def verify_and_save_dag(request: DAGVerifyAndSaveRequest, user_id: str = Depends(get_current_user)):
    """
    Validate and save a DAG after LLM discovery + human verification.

    The user may have edited the LLM's proposed graph (added/removed edges).
    This endpoint re-runs cycle detection before saving to ensure validity.

    If session_id is provided, the DAG is automatically attached to that session.
    """
    if request.session_id:
        if request.session_id == "demo_session":
            raise HTTPException(status_code=403, detail="Demo session is read-only")
        require_session(request.session_id, False, user_id)

    return dag_library.verify_and_save_dag(request)


@router.put("/dags/{dag_id}", response_model=SavedDAG)
@handle_route_errors("Update DAG", status_code=404)
def update_dag(dag_id: str, request: DAGUpdateRequest, user_id: str = Depends(get_current_user)):
    """Update an existing DAG's name, description, edges, or roles."""
    dag = dag_library.update_dag(dag_id, request)
    if not dag:
        raise HTTPException(status_code=404, detail="DAG not found")
    return dag


@router.delete("/dags/{dag_id}", status_code=204)
@handle_route_errors("Delete DAG", status_code=404)
def delete_dag(dag_id: str, user_id: str = Depends(get_current_user)):
    """Delete a DAG from the library."""
    if not dag_library.delete_dag(dag_id):
        raise HTTPException(status_code=404, detail="DAG not found")
    return None
