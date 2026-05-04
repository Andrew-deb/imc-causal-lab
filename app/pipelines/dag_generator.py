"""
DAG Discovery Pipeline Orchestrator.

Coordinates the full causal discovery flow:
  1. Extract variable names from the uploaded session
  2. Identify treatment and outcome from the session context
  3. Call the LLM engine (domain expertises → confounders → relationships)
  4. Build and validate the DAG
  5. Extract variable roles from the graph structure
  6. Return the complete DAGDiscoveryResponse
"""
import logging

from app.configs import settings
from app.schemas.causal_discovery import (
    DAGDiscoveryResponse,
    CausalEdge,
    VariableRoles,
)
from app.causal.pywhy_engine import (
    suggest_domain_expertises,
    suggest_confounders,
    suggest_relationships,
)
from app.causal.dag_generator import (
    build_adjacency_list,
    validate_dag,
    extract_roles,
)

logger = logging.getLogger(__name__)


async def run_dag_discovery(
    session_id: str,
    all_columns: list[str],
    treatment: str,
    outcome: str,
) -> DAGDiscoveryResponse:
    """
    Execute the full causal discovery pipeline.

    Args:
        session_id: The current session ID
        all_columns: All column names from the merged dataset
        treatment: The treatment variable name (e.g., "T_advertising")
        outcome: The outcome variable name (e.g., "price")

    Returns:
        DAGDiscoveryResponse with the complete discovered DAG
    """
    llm_calls = 0

    # ── Step 1: Filter variables 
    # Remove obviously non-causal columns (IDs, dates, etc.)
    skip_patterns = ["_id", "session", "transaction_id", "imc_category"]
    variables = [
        col for col in all_columns
        if not any(pat in col.lower() for pat in skip_patterns)
        and col not in [treatment, outcome]
    ]

    # Limit variables to avoid LLM overload
    if len(variables) > 20:
        logger.info(f"Trimming variables from {len(variables)} to 20 for LLM analysis")
        variables = variables[:20]

    logger.info(f"Starting DAG discovery: treatment={treatment}, outcome={outcome}")
    logger.info(f"Variables to analyze ({len(variables)}): {variables}")

    # ── Step 2: Domain expertises 
    all_vars = [treatment, outcome] + variables
    domain_expertises = await suggest_domain_expertises(all_vars)
    llm_calls += 1

    # ── Step 3: Confounder discovery 
    role_suggestions = await suggest_confounders(
        treatment, outcome, variables, domain_expertises
    )
    llm_calls += 1

    # ── Step 4: Pairwise relationship discovery 
    raw_edges = await suggest_relationships(
        treatment, outcome, all_vars, domain_expertises
    )
    llm_calls += 1

    # ── Step 5: Build and validate DAG 
    adj = build_adjacency_list(raw_edges, all_vars)
    adj = validate_dag(adj, raw_edges)

    # ── Step 6: Extract roles from graph topology 
    graph_roles = extract_roles(adj, treatment, outcome)

    # Merge LLM-suggested roles with graph-extracted roles
    # (LLM suggestions take priority, graph analysis fills gaps)
    final_confounders = list(set(
        role_suggestions.get("confounders", []) + graph_roles.get("confounders", [])
    ))
    final_mediators = list(set(
        role_suggestions.get("mediators", []) + graph_roles.get("mediators", [])
    ))

    # ── Step 7: Build response 
    edges = [
        CausalEdge(
            source=e["source"],
            target=e["target"],
            confidence=e.get("confidence", 0.5),
            relationship_type=_classify_edge(
                e["source"], e["target"],
                final_confounders, final_mediators
            ),
            reasoning=e.get("reasoning", ""),  # Pass through the LLM's causal justification
        )
        for e in raw_edges
        if e["source"] in set(all_vars) and e["target"] in set(all_vars)
    ]

    response = DAGDiscoveryResponse(
        session_id=session_id,
        treatment=treatment,
        outcome=outcome,
        domain_expertises=domain_expertises,
        edges=edges,
        adjacency_list=adj,
        variable_roles=VariableRoles(
            confounders=sorted(final_confounders),
            mediators=sorted(final_mediators),
            colliders=graph_roles.get("colliders", []),
            instrumental_variables=graph_roles.get("instrumental_variables", []),
        ),
        variables_analyzed=all_vars,
        model_used=settings.DAG_DISCOVERY_MODEL,
        num_llm_calls=llm_calls,
    )

    logger.info(
        f"DAG discovery complete: {len(edges)} edges, "
        f"{len(final_confounders)} confounders, "
        f"{len(final_mediators)} mediators, "
        f"{llm_calls} LLM calls"
    )

    return response


def _classify_edge(source: str, target: str, confounders: list, mediators: list) -> str:
    """Classify an edge type based on the roles of its source/target nodes."""
    if source in confounders or target in confounders:
        return "confounder"
    if source in mediators or target in mediators:
        return "mediator"
    return "direct"
