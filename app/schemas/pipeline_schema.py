from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


class PipelineStepSchema(BaseModel):
    step_number: int
    name: str
    status: str = "pending"  # "pending" | "running" | "completed" | "failed" | "skipped"
    started_at: Optional[datetime] = None
    duration_ms: Optional[float] = None
    detail: Optional[str] = None
    error: Optional[str] = None


class PipelineJobSchema(BaseModel):
    job_id: str
    session_id: str
    run_id: Optional[str] = None
    pipeline_type: str  # "causal" | "evaluation"
    status: str  # "queued" | "running" | "completed" | "failed" | "cancelled" | "interrupted"
    submitted_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[float] = None
    config: Optional[Dict[str, Any]] = None
    steps: List[PipelineStepSchema] = []
    error: Optional[str] = None
    result_snapshot: Optional[Dict[str, Any]] = None


class QueueStatusResponse(BaseModel):
    running_count: int
    queued_count: int
    max_concurrent: int
    max_queued: int


class SubmitJobResponse(BaseModel):
    job_id: str
    session_id: str
    status: str
