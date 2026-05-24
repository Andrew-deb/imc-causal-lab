import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends

from app.schemas.modeling_schema import PipelineResult, EvaluationResponse
from app.utils.error_handling import require_session
from app.utils.auth import get_current_user_optional

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/results/{session_id}", response_model=PipelineResult)
def get_results(session_id: str, user_id: Optional[str] = Depends(get_current_user_optional)):
    """
    Retrieve pipeline results for the dashboard.
    Must have run the pipeline first via POST /modeling/run-pipeline.
    """
    if session_id != "demo_session" and user_id is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    session = require_session(session_id, False, user_id)

    result = session.get("result")
    if not result:
        raise HTTPException(
            status_code=400,
            detail=f"No results yet. Status: {session.get('status', 'unknown')}"
        )

    return result


@router.get("/evaluation/{session_id}", response_model=EvaluationResponse)
def get_evaluation(session_id: str, user_id: Optional[str] = Depends(get_current_user_optional)):
    """
    Retrieve evaluation metrics for the dashboard.
    Must have run the evaluation first via POST /modeling/evaluate.
    """
    if session_id != "demo_session" and user_id is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    session = require_session(session_id, False, user_id)

    eval_result = session.get("evaluation_result")
    if not eval_result:
        raise HTTPException(
            status_code=400,
            detail=f"No evaluation results yet. Status: {session.get('status', 'unknown')}"
        )

    # Handle Pydantic model vs dict
    if hasattr(eval_result, "model_dump"):
        return eval_result.model_dump()
    return eval_result


@router.get("/status/{session_id}")
def get_status(session_id: str, user_id: Optional[str] = Depends(get_current_user_optional)):
    """Check the current status of a session."""
    if session_id != "demo_session" and user_id is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    session = require_session(session_id, False, user_id)

    return {
        "session_id": session_id,
        "status": session.get("status", "unknown"),
        "has_results": session.get("result") is not None,
    }
