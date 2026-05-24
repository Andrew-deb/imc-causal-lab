import asyncio
import uuid
import logging
from fastapi import APIRouter, HTTPException

from app.schemas.modeling_schema import RunPipelineRequest, PipelineResult, ColumnMapping
from app.services.modeling_service import execute_pipeline, execute_evaluation, build_column_mapping
from app.utils.error_handling import handle_route_errors, require_session
from app.services.job_service import job_manager
from app.services.pipeline_queue import pipeline_queue

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/modeling", tags=["Modeling"])


def _is_real_mapping(mapping: ColumnMapping | None) -> bool:
    """
    Return True only if the mapping contains actual column names.
    Swagger auto-fills every string field with the literal value "string",
    so we reject mappings where all required fields are "string".
    """
    if mapping is None:
        return False
    required_values = [
        mapping.customer_id_col,
        mapping.campaign_type_col,
        mapping.campaign_start_col,
        mapping.campaign_end_col,
        mapping.transaction_date_col,
        mapping.transaction_amount_col,
    ]
    # If every required value is the Swagger placeholder, ignore it
    if all(v == "string" for v in required_values):
        return False
    return True


@router.post("/run-pipeline", response_model=PipelineResult)
@handle_route_errors("Pipeline execution")
async def run_pipeline_endpoint(request: RunPipelineRequest):
    """
    Run the full causal inference pipeline.

    Accepts:
      - session_id (required)
      - column_mapping (optional) — pass this when testing from Swagger.
        If omitted (or set to null), the mapping is pulled from the session.
    """
    session = await asyncio.to_thread(require_session, request.session_id)

    # 1. Use inline column_mapping if provided with real values
    if _is_real_mapping(request.column_mapping):
        col_mapping = request.column_mapping
    else:
        # 2. Fall back to session-stored mapping (frontend wizard flow)
        raw_mapping = session.get("column_mapping")
        if not raw_mapping:
            raise HTTPException(
                status_code=400,
                detail="No column mapping found. Either pass column_mapping "
                       "in the request body or ensure the wizard sent it during upload."
            )
        col_mapping = build_column_mapping(raw_mapping)

    result = await execute_pipeline(
        session_id=request.session_id,
        col_mapping=col_mapping,
    )
    return result

@router.post("/run-async")
@handle_route_errors("Pipeline execution (async)")
async def run_pipeline_async_endpoint(request: RunPipelineRequest):
    """
    Run the full causal inference pipeline asynchronously.
    Creates both modeling and evaluation jobs and queues them sequentially.
    Returns the job IDs immediately.
    """
    # Check if queue has space for both jobs (causal + evaluation)
    status = pipeline_queue.get_status()
    if status["queued_count"] + 2 > status["max_queued"]:
        raise HTTPException(
            status_code=429,
            detail=f"The job queue is full ({status['queued_count']}/{status['max_queued']} jobs queued). Please wait for active runs to complete."
        )

    session = await asyncio.to_thread(require_session, request.session_id)

    if _is_real_mapping(request.column_mapping):
        col_mapping = request.column_mapping
    else:
        raw_mapping = session.get("column_mapping")
        if not raw_mapping:
            raise HTTPException(status_code=400, detail="No column mapping found.")
        col_mapping = build_column_mapping(raw_mapping)

    # Generate a unique run ID
    run_id = f"run_{uuid.uuid4()}"

    # 1. Create modeling (causal) job
    modeling_job_id = await asyncio.to_thread(
        job_manager.create_job,
        session_id=request.session_id,
        pipeline_type="causal",
        run_id=run_id,
        config=None
    )

    # 2. Create evaluation job
    evaluation_job_id = await asyncio.to_thread(
        job_manager.create_job,
        session_id=request.session_id,
        pipeline_type="evaluation",
        run_id=run_id,
        config=None
    )

    # Define task wrappers
    async def run_modeling():
        from app.services.session_service import session_manager
        await asyncio.to_thread(session_manager.update_session, request.session_id, status="modeling_in_progress")
        completed = False
        try:
            await execute_pipeline(
                session_id=request.session_id,
                col_mapping=col_mapping,
                job_id=modeling_job_id
            )
            completed = True
        except Exception as e:
            await asyncio.to_thread(session_manager.update_session, request.session_id, status="failed", error=str(e))
            raise
        finally:
            if not completed:
                try:
                    session = await asyncio.to_thread(session_manager.get_session, request.session_id)
                    if session and session.get("status") not in ("completed", "failed"):
                        await asyncio.to_thread(session_manager.update_session, request.session_id, status="failed", error="Execution cancelled or aborted")
                except Exception as ex:
                    logger.error(f"Failed to update session status on cleanup: {ex}")

    async def run_evaluation_task():
        from app.services.session_service import session_manager
        await asyncio.to_thread(session_manager.update_session, request.session_id, status="evaluation_in_progress")
        completed = False
        try:
            await execute_evaluation(
                session_id=request.session_id,
                col_mapping=col_mapping,
                job_id=evaluation_job_id
            )
            await asyncio.to_thread(session_manager.update_session, request.session_id, status="completed")
            completed = True
        except Exception as e:
            await asyncio.to_thread(session_manager.update_session, request.session_id, status="failed", error=str(e))
            raise
        finally:
            if not completed:
                try:
                    session = await asyncio.to_thread(session_manager.get_session, request.session_id)
                    if session and session.get("status") not in ("completed", "failed"):
                        await asyncio.to_thread(session_manager.update_session, request.session_id, status="failed", error="Execution cancelled or aborted")
                except Exception as ex:
                    logger.error(f"Failed to update session status on cleanup: {ex}")

    # 3. Submit both to queue
    pipeline_queue.submit(modeling_job_id, run_modeling)
    pipeline_queue.submit(evaluation_job_id, run_evaluation_task)

    return {
        "status": "queued",
        "session_id": request.session_id,
        "run_id": run_id,
        "modeling_job_id": modeling_job_id,
        "evaluation_job_id": evaluation_job_id
    }
