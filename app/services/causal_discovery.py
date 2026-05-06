"""
Causal Discovery Service.

Handles LLM-powered DAG discovery. Now supports two modes:
  1. Session mode: Extract variables from uploaded datasets
  2. Studio mode: Variables provided directly by the user
"""
import logging

from app.services.session_service import session_manager
from app.pipelines.dag_generator import run_dag_discovery
from app.schemas.causal_discovery import DAGDiscoveryResponse

logger = logging.getLogger(__name__)


async def execute_dag_discovery(
    session_id: str | None = None,
    variables: list[str] | None = None,
    treatment_col: str | None = None,
    outcome_col: str | None = None,
) -> DAGDiscoveryResponse:
    """
    Run DAG discovery via the LLM pipeline.

    Two modes:
      1. Session mode (session_id provided): auto-extract variables from datasets
      2. Studio mode (variables provided): use the given variable names directly
    """

    # ── Determine treatment ──────────────────────────────────────
    if not treatment_col:
        treatment_col = "IMC_Exposure"
        logger.info(f"Auto-detected treatment: {treatment_col}")

    # ── Mode 1: Studio (variables provided directly) ─────────────
    if variables:
        if not outcome_col:
            raise ValueError("Outcome column is required when providing variables directly")

        all_columns = [v for v in variables if v not in [treatment_col, outcome_col]]

        result = await run_dag_discovery(
            session_id=session_id or "",
            all_columns=all_columns,
            treatment=treatment_col,
            outcome=outcome_col,
        )
        return result

    # ── Mode 2: Session (extract from uploaded datasets) ─────────
    if not session_id:
        raise ValueError("Either session_id or variables must be provided")

    session = session_manager.get_session(session_id)
    if not session:
        raise ValueError(f"Session {session_id} not found")

    if not session.get("imc_mapping"):
        raise ValueError("IMC mapping not set — call /map-campaigns first")

    # Auto-detect outcome variable
    if not outcome_col:
        col_mapping = session.get("column_mapping")
        if col_mapping and hasattr(col_mapping, "transaction_amount_col"):
            outcome_col = col_mapping.transaction_amount_col
        elif isinstance(col_mapping, dict) and "transaction_amount_col" in col_mapping:
            outcome_col = col_mapping["transaction_amount_col"]
        else:
            all_cols = session["transactions_df"].columns.tolist()
            for candidate in ["price", "amount", "transaction_amount", "revenue", "spend"]:
                if candidate in all_cols:
                    outcome_col = candidate
                    break
            if not outcome_col:
                outcome_col = all_cols[-1]
        logger.info(f"Auto-detected outcome: {outcome_col}")

    # Collect all column names from the 3 uploaded datasets
    all_columns = set()
    all_columns.update(session["customers_df"].columns.tolist())
    all_columns.update(session["transactions_df"].columns.tolist())
    all_columns.update(session["campaigns_df"].columns.tolist())
    all_columns = sorted(list(all_columns))

    # Run the discovery pipeline
    result = await run_dag_discovery(
        session_id=session_id,
        all_columns=all_columns,
        treatment=treatment_col,
        outcome=outcome_col,
    )

    return result