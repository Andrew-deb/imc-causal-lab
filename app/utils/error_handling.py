"""
Centralised Error Handling
===========================

Standardised exception handling utilities used across the entire backend.
Provides consistent error responses, logging, and safe-execution wrappers.

Layers:
  1. Route layer:   @handle_route_errors — catches exceptions, returns HTTPException
  2. Service layer: @handle_service_errors — logs and re-raises with context
  3. Pipeline layer: safe_run() — wraps any callable with fallback + logging
"""
import logging
import functools
import traceback
import asyncio
from typing import Callable, TypeVar, Any, Optional
from fastapi import HTTPException

from app.services.session_service import session_manager

logger = logging.getLogger(__name__)

T = TypeVar("T")


# ── Route Layer (API endpoints) ─────────────────────────────────────

def handle_route_errors(
    operation_name: str,
    status_code: int = 500,
):
    """
    Decorator for FastAPI route handlers. Catches unhandled exceptions
    and converts them to a consistent HTTPException response.

    Usage:
        @router.post("/run-pipeline")
        @handle_route_errors("Pipeline execution")
        async def run_pipeline_endpoint(request):
            ...

    On error, returns:
        HTTPException(status_code=500, detail="Pipeline execution failed: <message>")
    """
    def decorator(func):
        if asyncio.iscoroutinefunction(func):
            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                try:
                    return await func(*args, **kwargs)
                except HTTPException:
                    raise  # Don't wrap existing HTTPExceptions
                except Exception as e:
                    logger.error(f"{operation_name} failed: {e}")
                    logger.debug(traceback.format_exc())
                    raise HTTPException(
                        status_code=status_code,
                        detail=f"{operation_name} failed: {e}",
                    )
            return async_wrapper
        else:
            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs):
                try:
                    return func(*args, **kwargs)
                except HTTPException:
                    raise  # Don't wrap existing HTTPExceptions
                except Exception as e:
                    logger.error(f"{operation_name} failed: {e}")
                    logger.debug(traceback.format_exc())
                    raise HTTPException(
                        status_code=status_code,
                        detail=f"{operation_name} failed: {e}",
                    )
            return sync_wrapper
    return decorator


# ── Service Layer ───────────────────────────────────────────────────

def handle_service_errors(operation_name: str):
    """
    Decorator for service functions. Logs errors with context
    and re-raises with a descriptive message.

    Usage:
        @handle_service_errors("Pipeline execution")
        async def execute_pipeline(session_id, col_mapping):
            ...
    """
    def decorator(func):
        if asyncio.iscoroutinefunction(func):
            @functools.wraps(func)
            async def async_wrapper(*args, **kwargs):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    logger.error(f"[{operation_name}] {type(e).__name__}: {e}")
                    logger.debug(traceback.format_exc())
                    raise
            return async_wrapper
        else:
            @functools.wraps(func)
            def sync_wrapper(*args, **kwargs):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    logger.error(f"[{operation_name}] {type(e).__name__}: {e}")
                    logger.debug(traceback.format_exc())
                    raise
            return sync_wrapper
    return decorator


# ── Pipeline Layer (safe execution wrappers) ────────────────────────

def safe_run(
    func: Callable[..., T],
    *args,
    fallback: Any = None,
    error_msg: str = "Operation failed",
    **kwargs,
) -> T:
    """
    Execute a callable with standardised error handling.
    Returns the fallback value on failure instead of raising.

    Usage:
        result = safe_run(
            estimator.run, X, T, Y,
            fallback=ModelResult(model_name="failed", ate=0.0, att=0.0),
            error_msg="DR-Learner fitting",
        )
    """
    try:
        return func(*args, **kwargs)
    except Exception as e:
        logger.error(f"{error_msg}: {type(e).__name__}: {e}")
        logger.debug(traceback.format_exc())
        return fallback


def require_session(session_id: str, include_datasets: bool = False, user_id: Optional[str] = None) -> dict:

    """
    Validate that a session exists and return it.
    Raises HTTPException(404) if not found.

    Usage (in route handlers):
        session = require_session(session_store, request.session_id)
    """
    session = session_manager.get_session(session_id, include_datasets=include_datasets, user_id=user_id)
    if not session:
        raise HTTPException(
            status_code=404,
            detail="Session not found — upload datasets first",
        )
    return session


def require_imc_mapping(session: dict) -> dict:
    """
    Validate that IMC mapping exists in the session.
    Raises HTTPException(400) if not set.

    Usage (in route handlers):
        imc_mapping = require_imc_mapping(session)
    """
    if not session.get("imc_mapping"):
        raise HTTPException(
            status_code=400,
            detail="IMC mapping not set — call /imc/map-campaigns first",
        )
    return session["imc_mapping"]
