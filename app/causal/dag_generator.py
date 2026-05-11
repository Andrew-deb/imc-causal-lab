"""
DAG Generator — Graph Construction & Validation.

Takes the raw edges from the LLM engine and produces a valid,
cycle-free Directed Acyclic Graph (DAG). Also extracts variable
roles (confounder, mediator, etc.) based on graph topology.

Key concepts:
  - A DAG cannot have cycles (A→B→C→A is invalid)
  - Confounders: nodes with paths to BOTH treatment and outcome
  - Mediators: nodes on a directed path FROM treatment TO outcome
  - Colliders: nodes with edges FROM both treatment and outcome
"""
import logging
from collections import defaultdict

logger = logging.getLogger(__name__)


def enforce_causal_rules(
    edges: list[dict], 
    roles: dict, 
    treatment: str, 
    outcome: str
) -> list[dict]:
    """
    Programmatically enforce causal graph rules based on variable roles.
    This guarantees that the structural definitions of confounders, mediators, 
    colliders, and instrumental variables are strictly obeyed.
    """
    
    # Helper to check if edge exists
    def _edge_exists(src: str, tgt: str) -> bool:
        return any(e.get("source") == src and e.get("target") == tgt for e in edges)

    # Helper to add mandatory edge
    def _add_edge(src: str, tgt: str, reason: str):
        if not _edge_exists(src, tgt):
            edges.append({
                "source": src,
                "target": tgt,
                "confidence": 1.0,
                "reasoning": reason
            })
            
    # Helper to remove forbidden edge
    def _remove_edge(src: str, tgt: str):
        nonlocal edges
        edges = [e for e in edges if not (e.get("source") == src and e.get("target") == tgt)]

    confounders = roles.get("confounders", [])
    mediators = roles.get("mediators", [])
    colliders = roles.get("colliders", [])
    instrumentals = roles.get("instrumental_variables", [])

    # 1. Confounders: C -> T and C -> Y
    for c in confounders:
        _add_edge(c, treatment, "Programmatically enforced: Confounder must affect treatment.")
        _add_edge(c, outcome, "Programmatically enforced: Confounder must affect outcome.")

    # 2. Mediators: T -> M and M -> Y
    for m in mediators:
        _add_edge(treatment, m, "Programmatically enforced: Treatment must affect mediator.")
        _add_edge(m, outcome, "Programmatically enforced: Mediator must affect outcome.")

    # 3. Colliders: T -> Col and Y -> Col
    for col in colliders:
        _add_edge(treatment, col, "Programmatically enforced: Treatment must affect collider.")
        _add_edge(outcome, col, "Programmatically enforced: Outcome must affect collider.")

    # 4. Instrumental Variables: Z -> T and Z -/-> Y
    for z in instrumentals:
        _add_edge(z, treatment, "Programmatically enforced: Instrument must affect treatment.")
        _remove_edge(z, outcome)

    return edges



def build_adjacency_list(edges: list[dict], variables: list[str]) -> dict[str, list[str]]:
    """
    Convert a list of edge dicts into an adjacency list.

    Input:  [{"source": "age", "target": "spend", "confidence": 0.9}, ...]
    Output: {"age": ["spend"], ...}

    Only includes edges where both source and target are in the
    known variables list (filters out any hallucinated variables).
    """
    valid_set = set(variables)
    adj = defaultdict(list)

    for edge in edges:
        src = edge.get("source", "")
        tgt = edge.get("target", "")
        if src in valid_set and tgt in valid_set and src != tgt:
            if tgt not in adj[src]:  # avoid duplicate edges
                adj[src].append(tgt)

    # Ensure all variables appear in the adjacency list (even if isolated)
    for v in variables:
        if v not in adj:
            adj[v] = []

    return dict(adj)


def _has_cycle(adj: dict[str, list[str]]) -> bool:
    """
    Detect cycles using DFS-based topological sort.

    A DAG (Directed Acyclic Graph) CANNOT have cycles.
    If the LLM accidentally suggested A→B→C→A, we need to detect that.

    Colors:
      WHITE (0) = unvisited
      GRAY  (1) = currently being explored (in the recursion stack)
      BLACK (2) = fully explored

    If we encounter a GRAY node during DFS, we found a back-edge → cycle!
    """
    WHITE, GRAY, BLACK = 0, 1, 2
    color = {v: WHITE for v in adj}

    def dfs(node):
        color[node] = GRAY
        for neighbor in adj.get(node, []):
            if color.get(neighbor, WHITE) == GRAY:
                return True  # Back edge found → cycle!
            if color.get(neighbor, WHITE) == WHITE:
                if dfs(neighbor):
                    return True
        color[node] = BLACK
        return False

    for node in adj:
        if color[node] == WHITE:
            if dfs(node):
                return True
    return False


def _remove_cycles(adj: dict[str, list[str]], edges: list[dict]) -> dict[str, list[str]]:
    """
    Remove edges one by one (lowest confidence first) until the graph is cycle-free.

    Strategy: Sort edges by confidence ascending. Remove the weakest edge,
    rebuild the adjacency list, and check again. Repeat until no cycles remain.
    """
    sorted_edges = sorted(edges, key=lambda e: e.get("confidence", 0.5))

    while _has_cycle(adj) and sorted_edges:
        weakest = sorted_edges.pop(0)
        src, tgt = weakest["source"], weakest["target"]
        if src in adj and tgt in adj[src]:
            adj[src].remove(tgt)
            logger.warning(
                f"Removed cycle-causing edge: {src} → {tgt} "
                f"(confidence: {weakest.get('confidence', '?')})"
            )

    return adj


def validate_dag(adj: dict[str, list[str]], edges: list[dict]) -> dict[str, list[str]]:
    """
    Validate that the graph is a proper DAG (no cycles).
    If cycles exist, remove the weakest edges until the graph is valid.
    """
    if _has_cycle(adj):
        logger.warning("Cycle detected in LLM-suggested graph — removing weakest edges")
        adj = _remove_cycles(adj, edges)

    if _has_cycle(adj):
        logger.error("Could not remove all cycles — returning empty graph")
        return {v: [] for v in adj}

    logger.info(f"DAG validated: {sum(len(v) for v in adj.values())} edges, {len(adj)} nodes")
    return adj


def _get_ancestors(node: str, adj: dict[str, list[str]], reverse_adj: dict[str, list[str]]) -> set[str]:
    """Get all ancestors (parents, grandparents, ...) of a node using reverse adjacency."""
    visited = set()
    stack = [node]
    while stack:
        current = stack.pop()
        for parent in reverse_adj.get(current, []):
            if parent not in visited:
                visited.add(parent)
                stack.append(parent)
    return visited


def _get_descendants(node: str, adj: dict[str, list[str]]) -> set[str]:
    """Get all descendants (children, grandchildren, ...) of a node."""
    visited = set()
    stack = [node]
    while stack:
        current = stack.pop()
        for child in adj.get(current, []):
            if child not in visited:
                visited.add(child)
                stack.append(child)
    return visited


def extract_roles(
    adj: dict[str, list[str]],
    treatment: str,
    outcome: str,
) -> dict:
    """
    Classify each variable based on its position in the DAG
    relative to the treatment and outcome nodes.

    Definitions:
      - Confounder: has a directed path to BOTH treatment and outcome
      - Mediator: is a descendant of treatment AND an ancestor of outcome
        (i.e., on the causal path: Treatment → Mediator → Outcome)
      - Collider: has edges FROM both treatment and outcome pointing INTO it
      - Instrumental: ancestor of treatment but NOT of outcome
    """
    # Build reverse adjacency for ancestor lookups
    reverse_adj = defaultdict(list)
    for src, targets in adj.items():
        for tgt in targets:
            reverse_adj[tgt].append(src)

    treatment_ancestors = _get_ancestors(treatment, adj, reverse_adj)
    outcome_ancestors = _get_ancestors(outcome, adj, reverse_adj)
    treatment_descendants = _get_descendants(treatment, adj)
    outcome_descendants = _get_descendants(outcome, adj)

    confounders = []
    mediators = []
    colliders = []
    instrumental = []

    all_vars = set(adj.keys())
    for var in all_vars:
        if var in (treatment, outcome):
            continue

        var_descendants = _get_descendants(var, adj)
        is_ancestor_of_treatment = treatment in var_descendants
        is_ancestor_of_outcome = outcome in var_descendants
        is_descendant_of_treatment = var in treatment_descendants
        is_descendant_of_outcome = var in outcome_descendants

        # Confounder: causes both T and Y
        if is_ancestor_of_treatment and is_ancestor_of_outcome:
            confounders.append(var)
        # Mediator: on the path T → M → Y
        elif is_descendant_of_treatment and is_ancestor_of_outcome:
            mediators.append(var)
        # Collider: caused by both T and Y (T → C ← Y)
        elif is_descendant_of_treatment and is_descendant_of_outcome:
            colliders.append(var)
        # Instrumental: causes T but not Y directly
        elif is_ancestor_of_treatment and not is_ancestor_of_outcome:
            instrumental.append(var)

    roles = {
        "confounders": sorted(confounders),
        "mediators": sorted(mediators),
        "colliders": sorted(colliders),
        "instrumental_variables": sorted(instrumental),
    }

    logger.info(
        f"Extracted roles — confounders: {len(confounders)}, "
        f"mediators: {len(mediators)}, colliders: {len(colliders)}, "
        f"instrumental: {len(instrumental)}"
    )
    return roles
