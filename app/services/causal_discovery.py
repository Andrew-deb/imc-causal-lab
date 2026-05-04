"""
Causal Discovery Service.

Handles session validation, variable extraction, and DAG persistence.
"""
import logging

from app.services.session_service import session_manager
from app.pipelines.dag_generator import run_dag_discovery
from app.schemas.causal_discovery import DAGDiscoveryResponse

logger = logging.getLogger(__name__)


async def execute_dag_discovery(
    session_id: str,
    treatment_col: str | None = None,
    outcome_col: str | None = None,
) -> DAGDiscoveryResponse:
    """
    Run DAG discovery for a session.

    Steps:
      1. Fetch the session from the session manager
      2. Auto-detect treatment and outcome variables if not provided
      3. Collect all column names from the uploaded datasets
      4. Run the discovery pipeline
      5. Store the DAG result back in the session
    """
    session = session_manager.get_session(session_id)
    if not session:
        raise ValueError(f"Session {session_id} not found")

    if not session.get("imc_mapping"):
        raise ValueError("IMC mapping not set — call /map-campaigns first")

    # ── Auto-detect treatment variable ───────────────────────────
    # Use the first mapped IMC category as the treatment
    if not treatment_col:
        imc_mapping = session["imc_mapping"]
        categories = sorted(set(imc_mapping.values()))
        treatment_col = f"T_{categories[0]}" if categories else "T_advertising"
        logger.info(f"Auto-detected treatment: {treatment_col}")

    # ── Auto-detect outcome variable ─────────────────────────────
    if not outcome_col:
        # Check if column_mapping exists in the session
        col_mapping = session.get("column_mapping")
        if col_mapping and hasattr(col_mapping, "transaction_amount_col"):
            outcome_col = col_mapping.transaction_amount_col
        elif isinstance(col_mapping, dict) and "transaction_amount_col" in col_mapping:
            outcome_col = col_mapping["transaction_amount_col"]
        else:
            # Fallback: look for common outcome column names
            all_cols = session["transactions_df"].columns.tolist()
            for candidate in ["price", "amount", "transaction_amount", "revenue", "spend"]:
                if candidate in all_cols:
                    outcome_col = candidate
                    break
            if not outcome_col:
                outcome_col = all_cols[-1]  # last column as fallback
        logger.info(f"Auto-detected outcome: {outcome_col}")

    # ── Collect all column names ─────────────────────────────────
    all_columns = set()
    all_columns.update(session["customers_df"].columns.tolist())
    all_columns.update(session["transactions_df"].columns.tolist())
    all_columns.update(session["campaigns_df"].columns.tolist())
    all_columns = sorted(list(all_columns))

    # ── Run the discovery pipeline ───────────────────────────────
    result = await run_dag_discovery(
        session_id=session_id,
        all_columns=all_columns,
        treatment=treatment_col,
        outcome=outcome_col,
    )

    # ── Store the DAG result in the session ──────────────────────
    session_manager.update_session(session_id, dag_result=result)
    logger.info(f"DAG stored for session {session_id[:8]}")

    return result