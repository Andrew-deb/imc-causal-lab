"""
Pipeline Progress Tracker
==========================

Reusable progress tracking for pipeline execution.
Provides clean, readable terminal output with step checkmarks
and a tqdm progress bar for long-running model loops.

Usage:
    with PipelineTracker("CAUSAL PIPELINE", total_steps=7) as tracker:
        with tracker.step(1, "Merging datasets") as s:
            result = merge_datasets(...)
            s.detail(f"{len(result):,} rows")

        pbar = tracker.model_loop(total=12)
        for model in models:
            pbar.set_postfix_str(f"fitting {model.name}")
            pbar.update(1)
        pbar.close()

        tracker.complete("3 channels analysed | Top: promotion")
"""
import warnings
import time
import logging
from datetime import datetime, timezone
from typing import Optional
from tqdm import tqdm

from app.services.job_service import job_manager
from app.services.event_service import event_manager

logger = logging.getLogger(__name__)


class StepContext:
    """Context manager for a single pipeline step. Prints ✅ on exit."""

    def __init__(
        self,
        step_num: int,
        total: int,
        description: str,
        job_id: Optional[str] = None,
        session_id: Optional[str] = None
    ):
        self._step_num = step_num
        self._total = total
        self._desc = description
        self._job_id = job_id
        self._session_id = session_id
        self._detail_text = ""
        self._start_time = None
        print(f"\n  Step {step_num}/{total}: {description}...", end="", flush=True)

    def detail(self, text: str):
        """Set detail text shown after the checkmark."""
        self._detail_text = text

    def __enter__(self):
        self._start_time = time.time()
        if self._job_id:
            try:
                job_manager.update_step(
                    self._job_id,
                    self._step_num,
                    status="running",
                    started_at=datetime.now(timezone.utc)
                )
                event_manager.log(
                    event_type="step_started",
                    severity="info",
                    session_id=self._session_id,
                    message=f"Started step {self._step_num}/{self._total}: {self._desc}",
                    metadata={"job_id": self._job_id, "step_number": self._step_num}
                )
            except Exception as e:
                logger.error(f"Failed to update step start in DB: {e}")
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        duration_ms = 0.0
        if self._start_time:
            duration_ms = (time.time() - self._start_time) * 1000

        status = "completed" if exc_type is None else "failed"

        if exc_type is None:
            suffix = f"  ({self._detail_text})" if self._detail_text else ""
            print(f"  ✅{suffix}")
        else:
            print(f"  ❌  ({exc_val})")

        if self._job_id:
            try:
                job_manager.update_step(
                    self._job_id,
                    self._step_num,
                    status=status,
                    duration_ms=round(duration_ms, 2),
                    detail=self._detail_text or None,
                    error=str(exc_val) if exc_val else None
                )
                severity = "info" if status == "completed" else "error"
                msg = f"Completed step {self._step_num}/{self._total}: {self._desc}"
                if status == "failed":
                    msg = f"Failed step {self._step_num}/{self._total}: {self._desc} - {exc_val}"
                event_manager.log(
                    event_type=f"step_{status}",
                    severity=severity,
                    session_id=self._session_id,
                    message=msg,
                    metadata={
                        "job_id": self._job_id,
                        "step_number": self._step_num,
                        "duration_ms": duration_ms,
                        "detail": self._detail_text
                    }
                )
            except Exception as e:
                logger.error(f"Failed to update step end in DB: {e}")

        # Don't suppress exceptions — let them propagate
        return False


class PipelineTracker:
    """
    Reusable progress tracker for pipeline execution.

    Provides:
      - Banner with pipeline name
      - Step-by-step logging with ✅/❌ checkmarks
      - Pre-configured tqdm bar for model loops
      - Completion summary banner
      - Automatic FutureWarning suppression
    """

    def __init__(
        self,
        name: str,
        total_steps: int,
        job_id: Optional[str] = None,
        session_id: Optional[str] = None
    ):
        self.name = name
        self.total_steps = total_steps
        self.job_id = job_id
        self.session_id = session_id

    def __enter__(self):
        # Suppress sklearn FutureWarnings that garble terminal output
        warnings.filterwarnings("ignore", category=FutureWarning)

        print("\n" + "=" * 60)
        print(f"  {self.name}")
        print("=" * 60)

        if self.job_id:
            try:
                job_manager.update_job(
                    self.job_id,
                    status="running",
                    started_at=datetime.now(timezone.utc)
                )
                event_manager.log(
                    event_type="pipeline_started",
                    severity="info",
                    session_id=self.session_id,
                    message=f"Pipeline started: {self.name}",
                    metadata={"job_id": self.job_id}
                )
            except Exception as e:
                logger.error(f"Failed to update job start in DB: {e}")

        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            print(f"\n  ❌ Pipeline failed: {exc_val}")
            print("=" * 60 + "\n")

            if self.job_id:
                try:
                    job_manager.update_job(
                        self.job_id,
                        status="failed",
                        completed_at=datetime.now(timezone.utc),
                        error=str(exc_val)
                    )
                    event_manager.log(
                        event_type="pipeline_failed",
                        severity="error",
                        session_id=self.session_id,
                        message=f"Pipeline failed: {self.name} - {exc_val}",
                        metadata={"job_id": self.job_id, "error": str(exc_val)}
                    )
                except Exception as e:
                    logger.error(f"Failed to update job failure in DB: {e}")
        return False

    def step(self, step_num: int, description: str) -> StepContext:
        """
        Context manager for a single pipeline step.
        """
        return StepContext(
            step_num=step_num,
            total=self.total_steps,
            description=description,
            job_id=self.job_id,
            session_id=self.session_id
        )

    def model_loop(self, total: int, colour: str = "green") -> tqdm:
        """Create a pre-configured tqdm bar for the estimator/model loop."""
        return tqdm(
            total=total,
            desc="     Models",
            bar_format="     {l_bar}{bar:30}{r_bar}",
            colour=colour,
        )

    def complete(self, summary: str):
        """Print the completion banner."""
        print("\n" + "=" * 60)
        print(f"  ✅ {summary}")
        print("=" * 60 + "\n")

        if self.job_id:
            try:
                duration_seconds = None
                job = job_manager.get_job(self.job_id)
                if job and job["started_at"]:
                    started_at = job["started_at"]
                    if isinstance(started_at, str):
                        started_at = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
                    if started_at.tzinfo is None:
                        started_at = started_at.replace(tzinfo=timezone.utc)
                    now = datetime.now(timezone.utc)
                    duration_seconds = (now - started_at).total_seconds()

                job_manager.update_job(
                    self.job_id,
                    status="completed",
                    completed_at=datetime.now(timezone.utc),
                    duration_seconds=duration_seconds,
                    result_snapshot={"summary": summary}
                )
                event_manager.log(
                    event_type="pipeline_completed",
                    severity="info",
                    session_id=self.session_id,
                    message=f"Pipeline completed: {self.name} - {summary}",
                    metadata={"job_id": self.job_id, "summary": summary, "duration_seconds": duration_seconds}
                )
            except Exception as e:
                logger.error(f"Failed to update job completion in DB: {e}")

