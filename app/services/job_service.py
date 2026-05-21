import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from app.configs import settings
from app.storage.mongo_client import get_pipeline_jobs_collection

logger = logging.getLogger(__name__)

CAUSAL_STEPS = [
    "Merging datasets",
    "Checking treatment balance",
    "Temporal alignment (RFM)",
    "Engineering features",
    "Running causal estimators",
    "Ranking channels",
    "Packaging results"
]

EVALUATION_STEPS = [
    "Merging datasets",
    "Balance + temporal alignment",
    "Descriptive statistics",
    "Fitting estimators",
    "Computing uplift metrics",
    "Packaging evaluation results"
]


class JobManager:
    """In-memory pipeline job repository."""

    def __init__(self):
        self._store: dict[str, dict] = {}

    def create_job(self, session_id: str, pipeline_type: str, config: Optional[dict] = None) -> str:
        job_id = f"job_{uuid.uuid4()}"
        now = datetime.now(timezone.utc)

        step_names = CAUSAL_STEPS if pipeline_type == "causal" else EVALUATION_STEPS
        steps = []
        for i, name in enumerate(step_names):
            steps.append({
                "step_number": i + 1,
                "name": name,
                "status": "pending",
                "started_at": None,
                "duration_ms": None,
                "detail": None,
                "error": None
            })

        self._store[job_id] = {
            "job_id": job_id,
            "session_id": session_id,
            "pipeline_type": pipeline_type,
            "status": "queued",
            "submitted_at": now,
            "started_at": None,
            "completed_at": None,
            "duration_seconds": None,
            "config": config,
            "steps": steps,
            "error": None,
            "result_snapshot": None
        }

        logger.info(f"Created in-memory job: {job_id[:8]} ({pipeline_type}) for session {session_id[:8]}")
        return job_id

    def get_job(self, job_id: str) -> Optional[dict]:
        return self._store.get(job_id)

    def update_job(self, job_id: str, **fields) -> None:
        job = self._store.get(job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")

        # Convert timezone-aware datetime to string or keep as datetime?
        # Standard json serialisation works best with string format, but FastAPI Pydantic handles datetimes
        # So we keep datetimes.
        fields["updated_at"] = datetime.now(timezone.utc)
        job.update(fields)

    def update_step(self, job_id: str, step_num: int, **step_fields) -> None:
        job = self._store.get(job_id)
        if not job:
            raise ValueError(f"Job {job_id} not found")

        for step in job["steps"]:
            if step["step_number"] == step_num:
                step.update(step_fields)
                break

    def list_jobs(self, session_id: Optional[str] = None) -> List[dict]:
        jobs = list(self._store.values())
        if session_id:
            jobs = [j for j in jobs if j["session_id"] == session_id]
        
        # Sort by submitted_at descending
        jobs.sort(key=lambda j: j["submitted_at"], reverse=True)
        return jobs

    def cancel_session_jobs(self, session_id: str) -> List[str]:
        cancelled_ids = []
        for job in self._store.values():
            if job["session_id"] == session_id and job["status"] in ("queued", "running"):
                job["status"] = "cancelled"
                job["completed_at"] = datetime.now(timezone.utc)
                cancelled_ids.append(job["job_id"])
        return cancelled_ids


class MongoJobManager:
    """MongoDB-backed pipeline job repository."""

    def __init__(self):
        self._col = get_pipeline_jobs_collection()
        self._col.create_index("job_id", unique=True)
        self._col.create_index("session_id")
        self._col.create_index([("status", 1), ("submitted_at", 1)])
        # 30-day TTL index on completed_at
        self._col.create_index("completed_at", expireAfterSeconds=2592000)

    def create_job(self, session_id: str, pipeline_type: str, config: Optional[dict] = None) -> str:
        job_id = f"job_{uuid.uuid4()}"
        now = datetime.now(timezone.utc)

        step_names = CAUSAL_STEPS if pipeline_type == "causal" else EVALUATION_STEPS
        steps = []
        for i, name in enumerate(step_names):
            steps.append({
                "step_number": i + 1,
                "name": name,
                "status": "pending",
                "started_at": None,
                "duration_ms": None,
                "detail": None,
                "error": None
            })

        doc = {
            "job_id": job_id,
            "session_id": session_id,
            "pipeline_type": pipeline_type,
            "status": "queued",
            "submitted_at": now,
            "started_at": None,
            "completed_at": None,
            "duration_seconds": None,
            "config": config,
            "steps": steps,
            "error": None,
            "result_snapshot": None
        }

        self._col.insert_one(doc)
        logger.info(f"Created MongoDB job: {job_id[:8]} ({pipeline_type}) for session {session_id[:8]}")
        return job_id

    def get_job(self, job_id: str) -> Optional[dict]:
        return self._col.find_one({"job_id": job_id}, {"_id": 0})

    def update_job(self, job_id: str, **fields):
        self._col.update_one(
            {"job_id": job_id},
            {"$set": fields}
        )

    def update_step(self, job_id: str, step_num: int, **step_fields):
        # Update specific fields inside the nested step object
        update_doc = {}
        for k, v in step_fields.items():
            update_doc[f"steps.$.{k}"] = v

        self._col.update_one(
            {"job_id": job_id, "steps.step_number": step_num},
            {"$set": update_doc}
        )

    def list_jobs(self, session_id: Optional[str] = None) -> List[dict]:
        query = {}
        if session_id:
            query["session_id"] = session_id

        cursor = self._col.find(query, {"_id": 0}).sort("submitted_at", -1)
        return list(cursor)

    def cancel_session_jobs(self, session_id: str) -> List[str]:
        now = datetime.now(timezone.utc)
        cursor = self._col.find(
            {"session_id": session_id, "status": {"$in": ["queued", "running"]}},
            {"job_id": 1}
        )
        cancelled_ids = [doc["job_id"] for doc in cursor]

        if cancelled_ids:
            self._col.update_many(
                {"job_id": {"$in": cancelled_ids}},
                {"$set": {"status": "cancelled", "completed_at": now}}
            )
        return cancelled_ids


def _create_job_manager():
    if getattr(settings, "USE_MONGO", False) and settings.MONGODB_URI:
        logger.info("Using MongoDB pipeline job manager")
        return MongoJobManager()
    else:
        logger.info("Using in-memory pipeline job manager")
        return JobManager()


# Singleton instance
job_manager = _create_job_manager()
