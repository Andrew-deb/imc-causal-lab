import asyncio
import logging
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from typing import Optional
import json

from app.schemas.dataset_schema import DatasetUploadResponse
from app.services.dataset_service import parse_and_store_datasets
from app.services.session_service import session_manager
from app.utils.error_handling import handle_route_errors, require_session
from app.utils.auth import get_current_user, get_current_user_optional

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/datasets", tags=["Datasets"])


@router.post("/upload", response_model=DatasetUploadResponse)
@handle_route_errors("Dataset upload", status_code=400)
async def upload_datasets(
    customers: UploadFile = File(..., description="Customers CSV"),
    transactions: UploadFile = File(..., description="Transactions CSV"),
    campaigns: UploadFile = File(..., description="Campaigns CSV"),
    column_mapping: Optional[str] = Form(None, description="JSON column mapping from the wizard"),
    roles: Optional[str] = Form(None, description="JSON dataset role assignments"),
    user_id: str = Depends(get_current_user),
):
    """
    Upload 3 CSV files (customers, transactions, campaigns).
    Returns session_id + column names for the mapping step.
    """
    # Parse column_mapping early so we can pass it to the service
    parsed_mapping = None
    if column_mapping:
        try:
            parsed_mapping = json.loads(column_mapping)
        except json.JSONDecodeError:
            logger.warning("Invalid column_mapping JSON — skipping")

    result = await parse_and_store_datasets(
        customers, transactions, campaigns,
        column_mapping=parsed_mapping,
        user_id=user_id,
    )

    # Store the column mapping in the session for later use by the pipeline
    if parsed_mapping:
        await asyncio.to_thread(
            session_manager.update_session,
            result.session_id,
            user_id=user_id,
            column_mapping=parsed_mapping,
        )
        logger.info(f"Column mapping stored for session {result.session_id[:12]}")

    # Store the role assignments if provided
    if roles:
        try:
            parsed_roles = json.loads(roles)
            await asyncio.to_thread(
                session_manager.update_session,
                result.session_id,
                user_id=user_id,
                dataset_roles=parsed_roles,
            )
        except json.JSONDecodeError:
            logger.warning("Invalid roles JSON — skipping")

    return result


@router.get("/columns/{session_id}")
@handle_route_errors("Get columns", status_code=404)
def get_columns(session_id: str, user_id: Optional[str] = Depends(get_current_user_optional)):
    """Retrieve column names for a previously uploaded session."""
    if session_id != "demo_session" and user_id is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    session = require_session(session_id, include_datasets=False, user_id=user_id)

    meta = session.get("dataset_meta", {})
    return {
        "session_id": session_id,
        "customers_columns": meta.get("customers_columns") or (session["customers_df"].columns.tolist() if "customers_df" in session else []),
        "transactions_columns": meta.get("transactions_columns") or (session["transactions_df"].columns.tolist() if "transactions_df" in session else []),
        "campaigns_columns": meta.get("campaigns_columns") or (session["campaigns_df"].columns.tolist() if "campaigns_df" in session else []),
    }
