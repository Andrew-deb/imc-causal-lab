import logging

from app.schemas.modeling_schema import ColumnMapping, ModelingConfig, PipelineResult
from app.pipelines.causal_pipeline import run_pipeline
from app.services.dataset_service import session_store

logger = logging.getLogger(__name__)


async def execute_pipeline(
    session_id: str,
    col_mapping: ColumnMapping,
    config: ModelingConfig | None = None,
) -> PipelineResult:
    """
    Run the full causal pipeline for a session.

    Retrieves stored DataFrames + IMC mapping from the session,
    calls run_pipeline(), stores the result back in the session.
    """
    session = session_store.get(session_id)
    if not session:
        raise ValueError(f"Session {session_id} not found")

    if not session.get("imc_mapping"):
        raise ValueError("IMC mapping not set — call /map-campaigns first")

    session["status"] = "running"
    session["column_mapping"] = col_mapping

    try:
        result = run_pipeline(
            customers_df=session["customers_df"],
            transactions_df=session["transactions_df"],
            campaigns_df=session["campaigns_df"],
            imc_mapping=session["imc_mapping"],
            col_mapping=col_mapping,
            config=config,
        )

        # Override session_id to match the upload session
        result.session_id = session_id
        session["result"] = result
        session["status"] = "complete"

        logger.info(f"Pipeline complete for session {session_id[:8]}")
        return result

    except Exception as e:
        session["status"] = "error"
        logger.error(f"Pipeline failed for session {session_id[:8]}: {e}")
        raise


async def execute_evaluation(
    session_id: str,
    col_mapping: ColumnMapping,
    config: ModelingConfig | None = None,
):
    """
    Run the evaluation pipeline for a session.

    Requires that datasets + IMC mapping are already stored in the session.
    Returns EvaluationResponse with metrics + descriptive statistics.
    """
    from app.pipelines.causal_pipeline import run_evaluation

    session = session_store.get(session_id)
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
        )
        result.session_id = session_id
        session["evaluation_result"] = result
        logger.info(f"Evaluation complete for session {session_id[:8]}")
        return result

    except Exception as e:
        logger.error(f"Evaluation failed for session {session_id[:8]}: {e}")
        raise

