"""
DAG Library Service.

Handles CRUD operations for the causal_dags MongoDB collection.
DAGs are standalone, reusable entities that can be attached to sessions.
"""
import uuid
import logging
from datetime import datetime, timezone

from app.storage.mongo_client import get_dags_collection
from app.causal.dag_generator import build_adjacency_list, validate_dag
from app.configs import settings
from app.schemas.causal_discovery import (
    SavedDAG,
    DAGCreateRequest,
    DAGVerifyAndSaveRequest,
    DAGUpdateRequest,
    DAGListItem,
    CausalEdge,
)
logger = logging.getLogger(__name__)

# Sandbox in-memory store used when USE_MONGO=False
_in_memory_dags: dict[str, dict] = {}


def _collection():
    """Get the causal_dags collection."""
    return get_dags_collection()


def _extract_variables(edges: list[CausalEdge], treatment: str, outcome: str) -> list[str]:
    """Extract all unique variable names from edges + treatment/outcome."""
    variables = {treatment, outcome}
    for edge in edges:
        variables.add(edge.source)
        variables.add(edge.target)
    return sorted(list(variables))


# ── CREATE ───────────────────────────────────────────────────────────

def create_dag(request: DAGCreateRequest) -> SavedDAG:
    """Save a manually built DAG to the library (MongoDB or In-Memory sandbox)."""
    dag_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    edge_dicts = [e.model_dump() for e in request.edges]
    variables = _extract_variables(request.edges, request.treatment, request.outcome)

    adj = build_adjacency_list(edge_dicts, variables)
    adj = validate_dag(adj, edge_dicts)

    doc = {
        "dag_id": dag_id,
        "name": request.name,
        "description": request.description,
        "treatment": request.treatment,
        "outcome": request.outcome,
        "variables": variables,
        "edges": edge_dicts,
        "adjacency_list": adj,
        "variable_roles": request.variable_roles.model_dump(),
        "creation_mode": "manual",
        "model_used": "",
        "domain_expertises": [],
        "created_at": now,
        "updated_at": now,
    }

    if settings.USE_MONGO and settings.MONGODB_URI:
        _collection().insert_one(doc)
        logger.info(f"DAG created in MongoDB: {dag_id[:8]} — '{request.name}'")
    else:
        _in_memory_dags[dag_id] = doc
        logger.info(f"DAG created in in-memory sandbox: {dag_id[:8]} — '{request.name}'")

    doc_copy = doc.copy()
    doc_copy.pop("_id", None)
    return SavedDAG(**doc_copy)


def verify_and_save_dag(request: DAGVerifyAndSaveRequest) -> SavedDAG:
    """Validate and save a DAG after LLM discovery + human verification."""
    dag_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    edge_dicts = [e.model_dump() for e in request.edges]
    variables = _extract_variables(request.edges, request.treatment, request.outcome)

    adj = build_adjacency_list(edge_dicts, variables)
    adj = validate_dag(adj, edge_dicts)

    doc = {
        "dag_id": dag_id,
        "name": request.name,
        "description": request.description,
        "treatment": request.treatment,
        "outcome": request.outcome,
        "variables": variables,
        "edges": edge_dicts,
        "adjacency_list": adj,
        "variable_roles": request.variable_roles.model_dump(),
        "creation_mode": "llm_assisted",
        "model_used": request.model_used or settings.DAG_DISCOVERY_MODEL,
        "domain_expertises": request.domain_expertises,
        "created_at": now,
        "updated_at": now,
    }

    if settings.USE_MONGO and settings.MONGODB_URI:
        _collection().insert_one(doc)
        logger.info(f"DAG verified & saved in MongoDB: {dag_id[:8]} — '{request.name}'")
    else:
        _in_memory_dags[dag_id] = doc
        logger.info(f"DAG verified & saved in in-memory sandbox: {dag_id[:8]} — '{request.name}'")

    # Attach to session if requested
    if request.session_id:
        from app.services.session_service import session_manager
        # Let ValueError or connection errors propagate naturally
        session_manager.update_session(
            request.session_id, 
            dag_id=dag_id,
            status="discovery_completed"
        )
        logger.info(f"DAG {dag_id[:12]} attached to session {request.session_id[:12]}")

    doc_copy = doc.copy()
    doc_copy.pop("_id", None)
    return SavedDAG(**doc_copy)


# ── READ ─────────────────────────────────────────────────────────────

def list_dags() -> list[DAGListItem]:
    """List all saved DAGs (lightweight summaries)."""
    items = []

    if settings.USE_MONGO and settings.MONGODB_URI:
        docs = list(_collection().find(
            {},
            {
                "dag_id": 1, "name": 1, "treatment": 1, "outcome": 1,
                "edges": 1, "variables": 1, "creation_mode": 1,
                "created_at": 1, "_id": 0,
            }
        ).sort("created_at", -1))

        for doc in docs:
            items.append(DAGListItem(
                dag_id=doc["dag_id"],
                name=doc["name"],
                treatment=doc.get("treatment", ""),
                outcome=doc.get("outcome", ""),
                edge_count=len(doc.get("edges", [])),
                variable_count=len(doc.get("variables", [])),
                creation_mode=doc.get("creation_mode", "manual"),
                created_at=doc.get("created_at"),
            ))
        return items
    
    # In-memory sandbox fallback
    sandbox_docs = sorted(
        _in_memory_dags.values(),
        key=lambda d: d.get("created_at") or datetime.min,
        reverse=True
    )
    for doc in sandbox_docs:
        items.append(DAGListItem(
            dag_id=doc["dag_id"],
            name=doc["name"],
            treatment=doc.get("treatment", ""),
            outcome=doc.get("outcome", ""),
            edge_count=len(doc.get("edges", [])),
            variable_count=len(doc.get("variables", [])),
            creation_mode=doc.get("creation_mode", "manual"),
            created_at=doc.get("created_at"),
        ))
    return items


def get_dag(dag_id: str) -> SavedDAG | None:
    """Get a single DAG by ID."""
    if settings.USE_MONGO and settings.MONGODB_URI:
        doc = _collection().find_one({"dag_id": dag_id}, {"_id": 0})
        if not doc:
            return None
        return SavedDAG(**doc)

    doc = _in_memory_dags.get(dag_id)
    if not doc:
        return None
    doc_copy = doc.copy()
    doc_copy.pop("_id", None)
    return SavedDAG(**doc_copy)


# ── UPDATE ───────────────────────────────────────────────────────────

def update_dag(dag_id: str, request: DAGUpdateRequest) -> SavedDAG | None:
    """Update an existing DAG's name, description, edges, or roles."""
    existing = get_dag(dag_id)
    if not existing:
        return None

    existing_dict = existing.model_dump()
    updates = {"updated_at": datetime.now(timezone.utc)}

    if request.name is not None:
        updates["name"] = request.name
    if request.description is not None:
        updates["description"] = request.description
    if request.variable_roles is not None:
        updates["variable_roles"] = request.variable_roles.model_dump()

    if request.edges is not None:
        edge_dicts = [e.model_dump() for e in request.edges]
        treatment = existing_dict["treatment"]
        outcome = existing_dict["outcome"]
        variables = _extract_variables(request.edges, treatment, outcome)

        adj = build_adjacency_list(edge_dicts, variables)
        adj = validate_dag(adj, edge_dicts)

        updates["edges"] = edge_dicts
        updates["adjacency_list"] = adj
        updates["variables"] = variables

    if settings.USE_MONGO and settings.MONGODB_URI:
        _collection().update_one({"dag_id": dag_id}, {"$set": updates})
        logger.info(f"DAG updated in MongoDB: {dag_id[:8]}")
        # Fetch fresh copy from MongoDB
        return get_dag(dag_id)
    else:
        for k, v in updates.items():
            existing_dict[k] = v
        _in_memory_dags[dag_id] = existing_dict
        logger.info(f"DAG updated in in-memory sandbox: {dag_id[:8]}")
        
        doc_copy = existing_dict.copy()
        doc_copy.pop("_id", None)
        return SavedDAG(**doc_copy)


# ── DELETE ───────────────────────────────────────────────────────────

def delete_dag(dag_id: str) -> bool:
    """Delete a DAG from the library."""
    if settings.USE_MONGO and settings.MONGODB_URI:
        result = _collection().delete_one({"dag_id": dag_id})
        if result.deleted_count > 0:
            logger.info(f"DAG deleted from MongoDB: {dag_id[:8]}")
            return True
        return False

    if dag_id in _in_memory_dags:
        del _in_memory_dags[dag_id]
        logger.info(f"DAG deleted from in-memory sandbox: {dag_id[:8]}")
        return True
    return False
