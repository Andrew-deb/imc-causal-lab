import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, Callable, Awaitable, Tuple

from app.services.job_service import job_manager
from app.services.event_service import event_manager

logger = logging.getLogger(__name__)


class PipelineQueue:
    def __init__(self, max_queued: int = 3):
        self.max_queued = max_queued
        self._queue: asyncio.Queue[Tuple[str, Callable[[], Awaitable[None]]]] = asyncio.Queue()
        self._running_task: Optional[asyncio.Task] = None
        self._running_job_id: Optional[str] = None
        self._worker_task: Optional[asyncio.Task] = None
        self._cancelled_jobs: set[str] = set()
        self._queued_jobs: list[str] = []  # list of job_ids currently in queue

    def start(self):
        """Start the background worker and clean up active/queued jobs from previous runs."""
        try:
            from app.services.session_service import session_manager
            now = datetime.now(timezone.utc)
            jobs = job_manager.list_jobs()
            interrupted_count = 0
            completed_count = 0
            for job in jobs:
                if job.get("status") in ("queued", "running"):
                    job_id = job["job_id"]
                    session_id = job.get("session_id")
                    pipeline_type = job.get("pipeline_type")
                    
                    # Check if session has already produced the results for this pipeline type
                    completed_successfully = False
                    if session_id:
                        try:
                            session = session_manager.get_session(session_id)
                            if session:
                                if pipeline_type == "causal" and session.get("result") is not None:
                                    completed_successfully = True
                                elif pipeline_type == "evaluation" and session.get("evaluation_result") is not None:
                                    completed_successfully = True
                        except Exception as e:
                            logger.error(f"Error checking session results for job {job_id}: {e}")

                    if completed_successfully:
                        # Update all steps to completed
                        steps = job.get("steps", [])
                        updated_steps = []
                        for s in steps:
                            new_step = dict(s)
                            if new_step.get("status") in ("pending", "running"):
                                new_step["status"] = "completed"
                                if new_step.get("duration_ms") is None:
                                    new_step["duration_ms"] = 0.0
                            updated_steps.append(new_step)

                        started_at = job.get("started_at")
                        duration_seconds = None
                        if started_at:
                            if isinstance(started_at, str):
                                started_at = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
                            if started_at.tzinfo is None:
                                started_at = started_at.replace(tzinfo=timezone.utc)
                            duration_seconds = (now - started_at).total_seconds()

                        job_manager.update_job(
                            job_id,
                            status="completed",
                            completed_at=now,
                            duration_seconds=duration_seconds,
                            steps=updated_steps
                        )
                        completed_count += 1
                    else:
                        # Reconcile interrupted steps
                        started_at = job.get("started_at")
                        updated_at = job.get("updated_at")
                        duration_seconds = None
                        
                        steps = job.get("steps", [])
                        updated_steps = []
                        for s in steps:
                            new_step = dict(s)
                            if new_step.get("status") == "running":
                                new_step["status"] = "interrupted"
                                step_started_at = new_step.get("started_at")
                                duration_ms = 0.0
                                if step_started_at:
                                    if isinstance(step_started_at, str):
                                        step_started_at = datetime.fromisoformat(step_started_at.replace("Z", "+00:00"))
                                    if step_started_at.tzinfo is None:
                                        step_started_at = step_started_at.replace(tzinfo=timezone.utc)
                                    
                                    end_time = updated_at or now
                                    if isinstance(end_time, str):
                                        end_time = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
                                    if end_time.tzinfo is None:
                                        end_time = end_time.replace(tzinfo=timezone.utc)
                                    
                                    duration_ms = (end_time - step_started_at).total_seconds() * 1000
                                new_step["duration_ms"] = round(duration_ms, 2)
                                new_step["error"] = "Server restarted during execution."
                            elif new_step.get("status") == "pending":
                                new_step["status"] = "interrupted"
                                new_step["duration_ms"] = 0.0
                                new_step["error"] = "Server restarted during execution."
                            updated_steps.append(new_step)

                        if started_at:
                            if isinstance(started_at, str):
                                started_at = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
                            if started_at.tzinfo is None:
                                started_at = started_at.replace(tzinfo=timezone.utc)
                            
                            end_time = updated_at or now
                            if isinstance(end_time, str):
                                end_time = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
                            if end_time.tzinfo is None:
                                end_time = end_time.replace(tzinfo=timezone.utc)
                            
                            duration_seconds = max(0.0, (end_time - started_at).total_seconds())

                        job_manager.update_job(
                            job_id,
                            status="interrupted",
                            completed_at=now,
                            duration_seconds=duration_seconds,
                            steps=updated_steps,
                            error="Server restarted during execution."
                        )
                        event_manager.log(
                            event_type="pipeline_interrupted",
                            severity="warning",
                            session_id=session_id,
                            message=f"Pipeline job {job_id[:8]} interrupted due to server restart",
                            metadata={"job_id": job_id, "duration_seconds": duration_seconds}
                        )
                        interrupted_count += 1
            if interrupted_count > 0 or completed_count > 0:
                logger.info(f"Startup queue cleanup: completed {completed_count} jobs, interrupted {interrupted_count} jobs.")
        except Exception as e:
            logger.error(f"Failed to clean up interrupted/completed jobs on startup: {e}")

        if self._worker_task is None or self._worker_task.done():
            self._worker_task = asyncio.create_task(self._worker())
            logger.info("Pipeline queue worker started.")

    async def stop(self):
        """Stop the background worker."""
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
            self._worker_task = None
            logger.info("Pipeline queue worker stopped.")

    def get_status(self) -> dict:
        """Get current queue metrics."""
        return {
            "running_count": 1 if self._running_job_id else 0,
            "queued_count": len(self._queued_jobs),
            "max_concurrent": 1,
            "max_queued": self.max_queued,
            "running_job_id": self._running_job_id,
            "queued_job_ids": list(self._queued_jobs),
        }

    def submit(self, job_id: str, task_func: Callable[[], Awaitable[None]]) -> bool:
        """
        Submit a job to the queue.
        Returns True if successfully queued, False if queue is full.
        """
        if len(self._queued_jobs) >= self.max_queued:
            logger.warning(f"Queue full: rejected job {job_id[:8]}")
            return False

        self._queued_jobs.append(job_id)
        self._queue.put_nowait((job_id, task_func))
        logger.info(f"Job {job_id[:8]} added to queue (position: {len(self._queued_jobs)})")
        return True

    def cancel(self, job_id: str) -> bool:
        """
        Cancel a job.
        If running, cancels the task.
        If queued, marks it to be skipped.
        """
        logger.info(f"Attempting to cancel job {job_id[:8]}")
        # Case 1: Job is running
        if self._running_job_id == job_id and self._running_task:
            self._running_task.cancel()
            logger.info(f"Cancelled active task for job {job_id[:8]}")
            return True

        # Case 2: Job is in the queue
        if job_id in self._queued_jobs:
            self._cancelled_jobs.add(job_id)
            self._queued_jobs.remove(job_id)
            try:
                job = job_manager.get_job(job_id)
                steps = job.get("steps", []) if job else []
                updated_steps = []
                for s in steps:
                    new_step = dict(s)
                    if new_step.get("status") in ("pending", "running"):
                        new_step["status"] = "cancelled"
                        new_step["duration_ms"] = 0.0
                    updated_steps.append(new_step)

                job_manager.update_job(
                    job_id,
                    status="cancelled",
                    completed_at=datetime.now(timezone.utc),
                    duration_seconds=0.0,
                    steps=updated_steps
                )
                event_manager.log(
                    event_type="job_cancelled",
                    severity="info",
                    session_id=None,
                    message=f"Job {job_id[:8]} cancelled while in queue",
                    metadata={"job_id": job_id}
                )
            except Exception as e:
                logger.error(f"Failed to update job status for cancelled queue job: {e}")
            logger.info(f"Marked queued job {job_id[:8]} as cancelled")
            return True

        return False

    async def _worker(self):
        """Sequential loop to run queued tasks one by one."""
        while True:
            try:
                job_id, task_func = await self._queue.get()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error getting job from queue: {e}")
                continue

            if job_id in self._cancelled_jobs:
                self._cancelled_jobs.remove(job_id)
                self._queue.task_done()
                continue

            # Remove from queued list
            if job_id in self._queued_jobs:
                self._queued_jobs.remove(job_id)

            self._running_job_id = job_id
            
            # Start job execution
            try:
                self._running_task = asyncio.create_task(task_func())
                await self._running_task
            except asyncio.CancelledError:
                logger.info(f"Running task for job {job_id[:8]} was cancelled.")
                try:
                    duration_seconds = None
                    job = job_manager.get_job(job_id)
                    now = datetime.now(timezone.utc)
                    if job and job.get("started_at"):
                        started_at = job["started_at"]
                        if isinstance(started_at, str):
                            started_at = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
                        if started_at.tzinfo is None:
                            started_at = started_at.replace(tzinfo=timezone.utc)
                        duration_seconds = (now - started_at).total_seconds()

                    steps = job.get("steps", []) if job else []
                    updated_steps = []
                    for s in steps:
                        new_step = dict(s)
                        if new_step.get("status") == "running":
                            new_step["status"] = "cancelled"
                            step_started_at = new_step.get("started_at")
                            duration_ms = 0.0
                            if step_started_at:
                                if isinstance(step_started_at, str):
                                    step_started_at = datetime.fromisoformat(step_started_at.replace("Z", "+00:00"))
                                if step_started_at.tzinfo is None:
                                    step_started_at = step_started_at.replace(tzinfo=timezone.utc)
                                duration_ms = (now - step_started_at).total_seconds() * 1000
                            new_step["duration_ms"] = round(duration_ms, 2)
                        elif new_step.get("status") == "pending":
                            new_step["status"] = "cancelled"
                            new_step["duration_ms"] = 0.0
                        updated_steps.append(new_step)

                    job_manager.update_job(
                        job_id,
                        status="cancelled",
                        completed_at=now,
                        duration_seconds=duration_seconds,
                        steps=updated_steps
                    )
                    event_manager.log(
                        event_type="job_cancelled",
                        severity="info",
                        session_id=None,
                        message=f"Job {job_id[:8]} cancelled during execution",
                        metadata={"job_id": job_id, "duration_seconds": duration_seconds}
                    )
                except Exception as e:
                    logger.error(f"Failed to update job cancellation in DB: {e}")
            except Exception as e:
                logger.error(f"Error executing job {job_id[:8]}: {e}", exc_info=True)
                # Check if modeling job failed, and if so, handle cascading cancellations
                try:
                    job = job_manager.get_job(job_id)
                    if job:
                        session_id = job["session_id"]
                        pipeline_type = job["pipeline_type"]
                        # Cascading cancellation: if a causal (modeling) job fails, cancel its corresponding evaluation job
                        if pipeline_type == "causal":
                            self._handle_cascading_failure(session_id, job_id)
                except Exception as ex:
                    logger.error(f"Error handling cascading failure for job {job_id[:8]}: {ex}")
            finally:
                self._running_task = None
                self._running_job_id = None
                self._queue.task_done()

    def _handle_cascading_failure(self, session_id: str, failing_job_id: str):
        """Cancel any queued evaluation jobs for the same session due to modeling failure."""
        logger.info(f"Handling cascading failure for session {session_id[:8]} due to failure of {failing_job_id[:8]}")
        now = datetime.now(timezone.utc)
        to_cancel = []
        for q_job_id in list(self._queued_jobs):
            try:
                job = job_manager.get_job(q_job_id)
                if job and job["session_id"] == session_id and job["pipeline_type"] == "evaluation":
                    to_cancel.append(q_job_id)
            except Exception as e:
                logger.error(f"Error fetching job details during cascade: {e}")

        for job_id in to_cancel:
            if job_id in self._queued_jobs:
                self._queued_jobs.remove(job_id)
            self._cancelled_jobs.add(job_id)
            try:
                job = job_manager.get_job(job_id)
                steps = job.get("steps", []) if job else []
                updated_steps = []
                for s in steps:
                    new_step = dict(s)
                    if new_step.get("status") in ("pending", "running"):
                        new_step["status"] = "cancelled"
                        new_step["duration_ms"] = 0.0
                    updated_steps.append(new_step)

                job_manager.update_job(
                    job_id,
                    status="failed",
                    completed_at=now,
                    duration_seconds=0.0,
                    steps=updated_steps,
                    error=f"Cancelled due to failure of modeling job {failing_job_id}"
                )
                event_manager.log(
                    event_type="job_failed",
                    severity="error",
                    session_id=session_id,
                    message=f"Evaluation job cancelled automatically due to modeling pipeline failure",
                    metadata={"job_id": job_id, "parent_job_id": failing_job_id}
                )
            except Exception as e:
                logger.error(f"Failed to update cascading job failure status: {e}")


# Global singleton
pipeline_queue = PipelineQueue()
