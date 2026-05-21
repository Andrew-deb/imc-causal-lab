import logging

from app.schemas.modeling_schema import ColumnMapping, ModelingConfig, PipelineResult
from app.pipelines.causal_pipeline import run_pipeline
from app.services.session_service import session_manager

logger = logging.getLogger(__name__)


# ── Column Mapping Conversion ────────────────────────────────────────
# Translates the frontend wizard's column mapping format into the
# backend's ColumnMapping schema.
#
# Frontend sends:  { "campaignType": "campaigns.csv::campaign_type", ... }
# Backend expects:  { "campaign_type_col": "campaign_type", ... }

FRONTEND_TO_BACKEND_KEY = {
    "campaignType": "campaign_type_col",
    "campaignStartDate": "campaign_start_col",
    "campaignEndDate": "campaign_end_col",
    "transactionCustomerId": "customer_id_col",
    "transactionDate": "transaction_date_col",
    "transactionAmount": "transaction_amount_col",
    "campaignCustomerId": "campaign_customer_id_col",
}


def extract_column_name(value: str) -> str:
    """
    Frontend stores column refs as 'filename.csv::column_name'.
    Strip the file prefix to get just the column name.
    """
    if "::" in value:
        return value.split("::", 1)[1].strip()
    return value.strip()


def build_column_mapping(raw: dict) -> ColumnMapping:
    """
    Convert a column mapping dict into the backend ColumnMapping.

    Supports two formats:
      - Frontend wizard format:  {"campaignType": "campaigns.csv::campaign_type", ...}
      - Backend / Swagger format: {"customer_id_col": "customer_id", ...}

    Raises ValueError if required fields are missing.
    """
    required = [
        "customer_id_col", "campaign_type_col",
        "campaign_start_col", "campaign_end_col",
        "transaction_date_col", "transaction_amount_col",
    ]

    # Check if the raw dict already uses backend keys
    if any(k in raw for k in required):
        # Already in backend format — pass through directly
        missing = [k for k in required if not raw.get(k)]
        if missing:
            raise ValueError(f"Missing required column mappings: {missing}")
        return ColumnMapping(**{k: v for k, v in raw.items() if v})

    # Otherwise, translate from frontend format
    mapped = {}
    for frontend_key, backend_key in FRONTEND_TO_BACKEND_KEY.items():
        value = raw.get(frontend_key, "")
        if value and value != "__none__":
            mapped[backend_key] = extract_column_name(value)

    missing = [k for k in required if not mapped.get(k)]
    if missing:
        raise ValueError(f"Missing required column mappings: {missing}")

    return ColumnMapping(**mapped)


async def execute_pipeline(
    session_id: str,
    col_mapping: ColumnMapping,
    config: ModelingConfig | None = None,
    job_id: str | None = None,
) -> PipelineResult:
    """
    Run the full causal pipeline for a session.

    Retrieves stored DataFrames + IMC mapping from the session,
    calls run_pipeline(), stores the result back in the session.
    """
    session = session_manager.get_session(session_id)
    if not session:
        raise ValueError(f"Session {session_id} not found")

    if not session.get("imc_mapping"):
        raise ValueError("IMC mapping not set — call /map-campaigns first")

    try:
        result = run_pipeline(
            customers_df=session["customers_df"],
            transactions_df=session["transactions_df"],
            campaigns_df=session["campaigns_df"],
            imc_mapping=session["imc_mapping"],
            col_mapping=col_mapping,
            config=config,
            job_id=job_id,
            session_id=session_id,
        )

        # Override session_id to match the upload session
        result.session_id = session_id
        session_manager.update_session(session_id, result=result)

        logger.info(f"Pipeline complete for session {session_id[:8]}")
        return result

    except Exception as e:

        logger.error(f"Pipeline failed for session {session_id[:8]}: {e}")
        raise


async def execute_evaluation(
    session_id: str,
    col_mapping: ColumnMapping,
    config: ModelingConfig | None = None,
    job_id: str | None = None,
):
    """
    Run the evaluation pipeline for a session.

    Requires that datasets + IMC mapping are already stored in the session.
    Returns EvaluationResponse with metrics + descriptive statistics.
    """
    from app.pipelines.causal_pipeline import run_evaluation

    session = session_manager.get_session(session_id)
    if not session:
        raise ValueError(f"Session {session_id} not found")

    if not session.get("imc_mapping"):
        raise ValueError("IMC mapping not set — call /map-campaigns first")

    try:
        result = run_evaluation(
            customers_df=session["customers_df"],
            transactions_df=session["transactions_df"],
            campaigns_df=session["campaigns_df"],
            imc_mapping=session["imc_mapping"],
            col_mapping=col_mapping,
            config=config,
            job_id=job_id,
            session_id=session_id,
        )
        # result is a dict (EvaluationResponse format)
        if isinstance(result, dict):
            # run_evaluation returns a dict, but we should make sure it has session_id
            result["session_id"] = session_id
        else:
            result.session_id = session_id
        session_manager.update_session(session_id, evaluation_result=result)
        logger.info(f"Evaluation complete for session {session_id[:8]}")
        return result
    except Exception as e:
        logger.error(f"Evaluation failed for session {session_id[:8]}: {e}")
        raise


async def run_causal_analysis_task(
    session_id: str,
    col_mapping: ColumnMapping,
    config: ModelingConfig | None = None,
):
    """
    Background task wrapper that sequentially runs the modeling and evaluation pipelines.
    Updates the session status to reflect progress and handles errors gracefully.
    """
    try:
        # Step 1: Modeling
        session_manager.update_session(session_id, status="modeling_in_progress")
        await execute_pipeline(session_id, col_mapping, config)
        
        # Step 2: Evaluation
        session_manager.update_session(session_id, status="evaluation_in_progress")
        await execute_evaluation(session_id, col_mapping, config)
        
        # Step 3: Complete
        session_manager.update_session(session_id, status="completed")
        logger.info(f"Full causal analysis completed for session {session_id[:8]}")
        
    except Exception as e:
        logger.error(f"Background task failed for session {session_id[:8]}: {e}")
        session_manager.update_session(session_id, status="failed", error=str(e))


