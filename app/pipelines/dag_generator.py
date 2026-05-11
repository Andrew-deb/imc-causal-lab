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
    enforce_causal_rules,
)
from app.utils.progress import PipelineTracker

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

    with PipelineTracker("CAUSAL DISCOVERY (DAG)", total_steps=7) as tracker:
        # ── Step 1: Filter variables 
        with tracker.step(1, "Filtering variables") as s:
            # Remove obviously non-causal columns (IDs, dates, etc.)
            skip_patterns = [
                "_id", "session", "transaction_id", "imc_category",
                "email", "phone", "full_name", "name", "campaign_name",
                "registration_date", "start_date", "end_date",
            ]
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
            s.detail(f"{len(variables)} variables")

        # ── Step 2: Domain expertises 
        with tracker.step(2, "Suggesting domain expertises") as s:
            all_vars = [treatment, outcome] + variables
            domain_expertises = await suggest_domain_expertises(all_vars)
            llm_calls += 1
            s.detail(f"{len(domain_expertises)} domains")

        # ── Step 3: Confounder discovery 
        with tracker.step(3, "Classifying confounders & mediators") as s:
            role_suggestions = await suggest_confounders(
                treatment, outcome, variables, domain_expertises
            )
            llm_calls += 1
            s.detail(f"{len(role_suggestions.get('confounders', []))} confounders")

        # ── Step 4: Pairwise relationship discovery 
        with tracker.step(4, "Discovering causal relationships") as s:
            raw_edges = await suggest_relationships(
                treatment, outcome, all_vars, domain_expertises
            )
            llm_calls += 1
            s.detail(f"{len(raw_edges)} raw edges")

        # ── Step 5: Enforce causal structural rules
        with tracker.step(5, "Enforcing causal structural rules") as s:
            # Guarantee correct edge topology per role:
            # Confounders: C→T, C→Y | Mediators: T→M, M→Y
            # Colliders: T→Col, Y→Col | Instruments: Z→T, remove Z→Y
            raw_edges = enforce_causal_rules(raw_edges, role_suggestions, treatment, outcome)
            n_enforced = len(raw_edges)
            s.detail(f"{n_enforced} edges after rule enforcement")

        # ── Step 6: Build and validate DAG 
        with tracker.step(6, "Validating & removing cycles") as s:
            adj = build_adjacency_list(raw_edges, all_vars)
            adj = validate_dag(adj, raw_edges)
            s.detail("DAG valid")

        # ── Step 7: Extract roles from graph topology 
        with tracker.step(7, "Extracting graph topology roles") as s:
            graph_roles = extract_roles(adj, treatment, outcome)

            # Merge LLM-suggested roles with graph-extracted roles
            # (LLM suggestions take priority, graph analysis fills gaps)
            final_confounders = list(set(
                role_suggestions.get("confounders", []) + graph_roles.get("confounders", [])
            ))
            final_mediators = list(set(
                role_suggestions.get("mediators", []) + graph_roles.get("mediators", [])
            ))
            s.detail("Roles merged")

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
                origin="llm", 
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
        
        tracker.complete(f"{len(edges)} causal edges discovered in {llm_calls} LLM calls")

    return response


def _classify_edge(source: str, target: str, confounders: list, mediators: list) -> str:
    """Classify an edge type based on the roles of its source/target nodes."""
    if source in confounders or target in confounders:
        return "confounder"
    if source in mediators or target in mediators:
        return "mediator"
    return "direct"
