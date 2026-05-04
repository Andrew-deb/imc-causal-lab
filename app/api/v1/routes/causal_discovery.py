"""
Causal Discovery API Routes.

Endpoints:
  POST /causal-discovery/discover — Run LLM-powered DAG discovery
  GET  /causal-discovery/dag/{session_id} — Retrieve a stored DAG
"""
import logging
from fastapi import APIRouter

from app.schemas.causal_discovery import DAGDiscoveryRequest, DAGDiscoveryResponse
from app.services.causal_discovery import execute_dag_discovery
from app.services.session_service import session_manager
from app.utils.error_handling import handle_route_errors, require_session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/causal-discovery", tags=["Causal Discovery"])


@router.post("/discover", response_model=DAGDiscoveryResponse)
@handle_route_errors("DAG Discovery")
async def discover_dag(request: DAGDiscoveryRequest):
    """
    Run LLM-powered causal graph discovery.

    Requires:
      - Datasets uploaded (POST /datasets/upload)
      - IMC mapping completed (POST /imc/map-campaigns)

    The LLM analyzes the variable names and uses domain knowledge
    to suggest a causal DAG structure. This typically takes 10-20
    seconds due to multiple sequential LLM calls.
    """
    require_session(request.session_id)

    result = await execute_dag_discovery(
        session_id=request.session_id,
        treatment_col=request.treatment_col,
        outcome_col=request.outcome_col,
    )
    return result


@router.get("/dag/{session_id}", response_model=DAGDiscoveryResponse)
@handle_route_errors("DAG Retrieval", status_code=404)
async def get_dag(session_id: str):
    """
    Retrieve a previously discovered DAG from the session store.

    Returns the stored DAGDiscoveryResponse if discovery has been
    run for this session. Returns 404 if no DAG exists.
    """
    session = require_session(session_id)
    dag_result = session.get("dag_result")

    if not dag_result:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=404,
            detail="No DAG found — run /causal-discovery/discover first",
        )

    # If stored as dict (from MongoDB), reconstruct the Pydantic model
    if isinstance(dag_result, dict):
        return DAGDiscoveryResponse(**dag_result)

    return dag_result
