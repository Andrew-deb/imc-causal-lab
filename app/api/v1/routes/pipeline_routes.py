import asyncio
import logging
import json
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse

from app.schemas.pipeline_schema import PipelineJobSchema, QueueStatusResponse
from app.services.job_service import job_manager
from app.services.event_service import event_manager
from app.services.pipeline_queue import pipeline_queue
from app.services.session_service import session_manager
from app.utils.auth import get_current_user, get_current_user_optional

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/pipeline", tags=["Pipeline"])


@router.get("/jobs", response_model=List[PipelineJobSchema])
def get_all_jobs(session_id: Optional[str] = None, user_id: Optional[str] = Depends(get_current_user_optional)):
    """Retrieve all pipeline jobs, optionally filtered by session_id."""
    if user_id is None:
        # Guest user can only view demo session jobs
        if session_id and session_id != "demo_session":
            return []
        return job_manager.list_jobs(session_id="demo_session", user_id=None)
    
    # Authenticated user
    return job_manager.list_jobs(session_id=session_id, user_id=user_id)


@router.get("/jobs/{job_id}", response_model=PipelineJobSchema)
def get_job_details(job_id: str, user_id: Optional[str] = Depends(get_current_user_optional)):
    """Retrieve detailed progress of a specific pipeline job."""
    job = job_manager.get_job(job_id, user_id=user_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.delete("/jobs/{job_id}")
async def cancel_job(job_id: str, user_id: str = Depends(get_current_user)):
    """Cancel a running or queued pipeline job."""
    job = await asyncio.to_thread(job_manager.get_job, job_id, user_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.get("session_id") == "demo_session":
        raise HTTPException(status_code=403, detail="Demo session jobs cannot be cancelled")

    success = pipeline_queue.cancel(job_id)
    if not success:
        if job["status"] in ("completed", "failed", "cancelled", "interrupted"):
            return {
                "status": "already_finished",
                "message": f"Job is in terminal state: {job['status']}"
            }
        # Force cancel in database just in case
        await asyncio.to_thread(
            job_manager.update_job,
            job_id,
            status="cancelled",
            completed_at=datetime.now(timezone.utc)
        )
        await asyncio.to_thread(
            event_manager.log,
            event_type="job_cancelled",
            severity="info",
            session_id=job.get("session_id"),
            message=f"Job {job_id[:8]} force cancelled in database",
            metadata={"job_id": job_id}
        )
    return {"status": "cancelled", "message": f"Job {job_id} cancelled successfully."}


@router.get("/queue/status", response_model=QueueStatusResponse)
def get_queue_status():
    """Retrieve current queue metrics (running/queued job counts)."""
    # Queue status is public/global metrics, does not expose user data.
    return pipeline_queue.get_status()


@router.get("/stream/{job_id}")
async def stream_job_progress(job_id: str, user_id: Optional[str] = Depends(get_current_user_optional)):
    """
    Establish a Server-Sent Events (SSE) connection to stream progress updates
    for a specific job. Closes when the job finishes.
    """
    # Check if the job exists and user has access
    job = await asyncio.to_thread(job_manager.get_job, job_id, user_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    async def event_generator():
        last_state = None
        while True:
            try:
                current_job = await asyncio.to_thread(job_manager.get_job, job_id, user_id)
                if not current_job:
                    yield "data: {\"error\": \"Job not found or access denied\"}\n\n"
                    break

                # Build comparison state to detect meaningful updates
                current_state = {
                    "status": current_job["status"],
                    "steps": [
                        {
                            "step_number": s["step_number"],
                            "status": s["status"],
                            "duration_ms": s["duration_ms"],
                            "detail": s["detail"],
                            "error": s["error"]
                        } for s in current_job["steps"]
                    ]
                }

                if current_state != last_state:
                    # Serialise to schema first to format dates and ensure valid structure
                    job_schema = PipelineJobSchema(**current_job)
                    yield f"data: {job_schema.json()}\n\n"
                    last_state = current_state

                # Exit loop if job reached a terminal state
                if current_job["status"] in ("completed", "failed", "cancelled", "interrupted"):
                    break

                await asyncio.sleep(0.5)
            except asyncio.CancelledError:
                logger.info(f"SSE client disconnected from job {job_id[:8]}")
                break
            except Exception as e:
                logger.error(f"Error in SSE stream for job {job_id[:8]}: {e}")
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                break

    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
    }
    return StreamingResponse(event_generator(), headers=headers)


@router.get("/logs/events")
def get_system_events(
    session_id: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 100,
    user_id: Optional[str] = Depends(get_current_user_optional)
):
    """Retrieve system event logs, optionally filtered by session or severity."""
    if session_id == "demo_session":
        return event_manager.list_events(session_id=session_id, severity=severity, limit=limit)

    if user_id is None:
        # Unauthenticated users can only view demo session logs
        if session_id is not None:
            raise HTTPException(status_code=401, detail="Authentication required")
        return event_manager.list_events(session_id="demo_session", severity=severity, limit=limit)

    if session_id:
        # Check ownership of requested session
        session = session_manager.get_session(session_id, user_id=user_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        return event_manager.list_events(session_id=session_id, severity=severity, limit=limit)
    else:
        # Find all session IDs for the user
        user_sessions = session_manager.list_sessions(user_id=user_id)
        session_ids = list(set(s["session_id"] for s in user_sessions) | {"demo_session"})
        return event_manager.list_events(severity=severity, limit=limit, session_ids=session_ids)



