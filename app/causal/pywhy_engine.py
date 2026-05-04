"""
PyWhy-Inspired LLM Engine for Causal Discovery.

Replicates the prompting strategy from PyWhy-LLM's ModelSuggester
using the existing OpenRouter API infrastructure. This avoids adding
the pywhyllm dependency (which requires the openai SDK) and gives
full control over prompt engineering.

The engine makes 3 sequential LLM calls:
  1. suggest_domain_expertises() — What academic domains are relevant?
  2. suggest_confounders()       — Which variables are confounders?
  3. suggest_relationships()     — What are the pairwise causal edges?

References:
  - PyWhy-LLM: https://github.com/py-why/pywhy-llm
  - Kıcıman et al. (2023): "Causal Reasoning and Large Language Models"
"""
import json
import logging
import httpx

from app.configs import settings

logger = logging.getLogger(__name__)


# ── Shared LLM Caller 

async def _call_llm(prompt: str, system_msg: str = None) -> str:
    """
    Send a prompt to the LLM via OpenRouter and return the raw text response.

    This is the shared utility that all 3 discovery functions use.
    It mirrors the exact same pattern as your imc_mapper.py but uses
    the dedicated DAG_DISCOVERY_MODEL instead of LLM_MODEL.
    """
    if not system_msg:
        system_msg = (
            "You are a causal inference expert with deep knowledge of "
            "marketing analytics, econometrics, and consumer behavior. "
            "Respond with ONLY valid JSON — no explanation, no markdown fences."
        )

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.LLM_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.DAG_DISCOVERY_MODEL,
                "messages": [
                    {"role": "system", "content": system_msg},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.0,
            },
        )
        response.raise_for_status()

    raw = response.json()["choices"][0]["message"]["content"].strip()

    # Strip markdown code fences if the LLM wraps its response
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    if raw.endswith("```"):
        raw = raw[:-3]

    return raw.strip()


# ── 1. Domain Expertise Discovery 

async def suggest_domain_expertises(variables: list[str]) -> list[str]:
    """
    Ask the LLM what academic/professional domains are relevant
    given the variable names in the dataset.

    This context is then passed to subsequent calls so the LLM
    can reason more accurately about causal relationships.

    Example output: ["marketing analytics", "consumer behavior",
                     "retail economics", "digital advertising"]
    """
    prompt = f"""Given the following variables from a marketing dataset:
{json.dumps(variables)}

Identify 3-5 academic or professional domains that would have expertise
about the causal relationships between these variables.

Respond with ONLY a JSON array of domain strings.
Example: ["marketing analytics", "consumer behavior", "econometrics"]
"""
    try:
        raw = await _call_llm(prompt)
        domains = json.loads(raw)
        if isinstance(domains, list):
            logger.info(f"Domain expertises: {domains}")
            return domains
    except Exception as e:
        logger.warning(f"Domain expertise suggestion failed: {e}")

    return ["marketing analytics", "consumer behavior"]


# ── 2. Confounder Discovery 

async def suggest_confounders(
    treatment: str,
    outcome: str,
    variables: list[str],
    domain_expertises: list[str],
) -> dict:
    """
    Ask the LLM to classify variables into causal roles:
    confounders, mediators, colliders, or instrumental variables.

    This replicates PyWhy-LLM's suggest_confounders() +
    suggest_mediators() in a single, more efficient call.

    Returns: {
        "confounders": ["age", "gender", ...],
        "mediators": ["clicks", ...],
        "colliders": [...],
        "instrumental_variables": [...]
    }
    """
    prompt = f"""You are an expert in {', '.join(domain_expertises)}.

In a causal study where:
  - Treatment (T): "{treatment}" (whether a customer was exposed to a marketing campaign)
  - Outcome (Y): "{outcome}" (customer's transaction/purchase amount)

Classify each of the following variables into their causal role relative
to the treatment-outcome relationship:

Variables: {json.dumps(variables)}

Causal role definitions:
1. **Confounders**: Variables that causally affect BOTH the treatment assignment
   AND the outcome. Example: "age" affects both likelihood of seeing an ad AND
   purchase behavior.
2. **Mediators**: Variables that lie ON the causal path FROM treatment TO outcome.
   Example: "clicks" — the campaign causes clicks, and clicks cause purchases.
3. **Colliders**: Variables that are caused BY BOTH treatment AND outcome.
   Example: "customer_satisfaction_survey" might be influenced by both the
   campaign exposure and the purchase experience.
4. **Instrumental Variables**: Variables that affect treatment assignment but
   have NO direct effect on the outcome. Example: "ad_slot_randomizer" affects
   whether someone sees an ad but doesn't directly affect their purchase.
5. **Irrelevant**: Variables that have no meaningful causal relationship with
   either the treatment or outcome.

Respond with ONLY valid JSON in this exact format:
{{
    "confounders": ["var1", "var2"],
    "mediators": ["var3"],
    "colliders": ["var4"],
    "instrumental_variables": ["var5"],
    "irrelevant": ["var6"]
}}
"""
    try:
        raw = await _call_llm(prompt)
        roles = json.loads(raw)
        logger.info(
            f"Variable roles — confounders: {len(roles.get('confounders', []))}, "
            f"mediators: {len(roles.get('mediators', []))}"
        )
        return roles
    except Exception as e:
        logger.error(f"Confounder suggestion failed: {e}")
        return {"confounders": [], "mediators": [], "colliders": [], "instrumental_variables": []}


# ── 3. Pairwise Relationship Discovery 
async def suggest_relationships(
    treatment: str,
    outcome: str,
    variables: list[str],
    domain_expertises: list[str],
) -> list[dict]:
    """
    Ask the LLM to suggest pairwise directed causal relationships
    between all variables, producing the edges of a DAG.

    This replicates PyWhy-LLM's suggest_relationships() with
    RelationshipStrategy.Pairwise.

    Returns a list of edges:
    [
        {
            "source": "age", "target": "purchase_amount", "confidence": 0.9,
            "reasoning": "Older consumers tend to have higher disposable income..."
        },
        ...
    ]
    """
    # Build list of key variables (treatment + outcome + confounders)
    key_vars = [treatment, outcome] + [v for v in variables if v not in [treatment, outcome]]

    # Limit to avoid extremely long prompts (LLMs struggle with >20 variables)
    if len(key_vars) > 15:
        key_vars = key_vars[:15]
        logger.info(f"Trimmed to top 15 variables for relationship discovery")

    prompt = f"""You are an expert in {', '.join(domain_expertises)}.

Given the following variables from a marketing causal study:
{json.dumps(key_vars)}

Where:
  - Treatment: "{treatment}" (marketing campaign exposure)
  - Outcome: "{outcome}" (transaction amount / purchase behavior)

For each pair of variables where you believe a DIRECT causal relationship
exists, specify the direction of causation as a directed edge.

Rules:
1. Only include edges where there is a plausible CAUSAL mechanism (not just correlation).
2. The edge direction matters: "age" → "purchase_amount" means age CAUSES
   changes in purchase amount, not the reverse.
3. Include a confidence score between 0.0 and 1.0 for each edge.
4. For EACH edge, provide a brief "reasoning" field explaining the causal
   mechanism — WHY does this relationship exist? Use domain expertise to
   justify the direction and existence of the edge. This is critical for
   academic validation.
5. Do NOT include edges that would create a cycle in the graph.
6. Be conservative — it's better to miss an edge than to include a spurious one.

Respond with ONLY a JSON array of edge objects:
[
    {{
        "source": "variable_a",
        "target": "variable_b",
        "confidence": 0.9,
        "reasoning": "Brief explanation of the causal mechanism behind this edge"
    }},
    {{
        "source": "variable_c",
        "target": "variable_d",
        "confidence": 0.7,
        "reasoning": "Brief explanation of the causal mechanism behind this edge"
    }}
]
"""
    try:
        raw = await _call_llm(prompt)
        edges = json.loads(raw)
        if isinstance(edges, list):
            # Filter to only edges involving known variables
            valid_set = set(key_vars)
            valid_edges = [
                e for e in edges
                if e.get("source") in valid_set and e.get("target") in valid_set
            ]
            logger.info(f"Discovered {len(valid_edges)} causal edges")
            return valid_edges
    except Exception as e:
        logger.error(f"Relationship suggestion failed: {e}")

    return []
