"""
Schemas for Causal Discovery (DAG Generation).

Defines the request/response models for the LLM-powered causal graph
discovery pipeline that replicates PyWhy-LLM's prompting strategy.
"""
from pydantic import BaseModel
from typing import Optional


# ── Request 

class DAGDiscoveryRequest(BaseModel):
    """Request body for POST /causal-discovery/discover."""
    session_id: str
    # Optional overrides (auto-detected from session if not provided)
    treatment_col: Optional[str] = None
    outcome_col: Optional[str] = None


# ── Response Components 

class CausalEdge(BaseModel):
    """
    A single directed edge in the causal graph with 90% confidence, and provides the domain-knowledge justification.
    """
    source: str
    target: str
    confidence: float = 1.0
    relationship_type: str = "direct"  # "direct", "confounder", "mediator"
    reasoning: str = ""  # LLM's causal reasoning for why this edge exists


class VariableRoles(BaseModel):
    """
    The LLM-discovered roles of each variable relative to the
    treatment-outcome relationship.

    These map directly to the concepts in causal inference:
    - Confounders: common causes of both treatment AND outcome
    - Mediators: variables on the causal PATH from treatment to outcome
    - Colliders: variables caused by BOTH treatment and outcome
    - Instrumental: variables that affect treatment but NOT outcome directly
    """
    confounders: list[str] = []
    mediators: list[str] = []
    colliders: list[str] = []
    instrumental_variables: list[str] = []


# ── Full Response 

class DAGDiscoveryResponse(BaseModel):
    """Complete response from the causal discovery pipeline."""
    session_id: str
    treatment: str
    outcome: str

    # LLM-suggested domain expertises (e.g., "marketing analytics")
    domain_expertises: list[str] = []

    # The discovered causal graph
    edges: list[CausalEdge] = []
    adjacency_list: dict[str, list[str]] = {}  # {source: [target1, target2]}

    # Variable role classification
    variable_roles: VariableRoles = VariableRoles()

    # All variables that were analyzed
    variables_analyzed: list[str] = []

    # Metadata
    model_used: str = ""
    num_llm_calls: int = 0
