import logging
from fastapi import APIRouter, UploadFile, File, Form
from typing import Optional
import json

from app.schemas.dataset_schema import DatasetUploadResponse
from app.services.dataset_service import parse_and_store_datasets
from app.services.session_service import session_manager
from app.utils.error_handling import handle_route_errors, require_session

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
    )

    # Store the column mapping in the session for later use by the pipeline
    if parsed_mapping:
        session_manager.update_session(
            result.session_id,
            column_mapping=parsed_mapping,
        )
        logger.info(f"Column mapping stored for session {result.session_id[:12]}")

    # Store the role assignments if provided
    if roles:
        try:
            parsed_roles = json.loads(roles)
            session_manager.update_session(
                result.session_id,
                dataset_roles=parsed_roles,
            )
        except json.JSONDecodeError:
            logger.warning("Invalid roles JSON — skipping")

    return result


@router.get("/columns/{session_id}")
@handle_route_errors("Get columns", status_code=404)
async def get_columns(session_id: str):
    """Retrieve column names for a previously uploaded session."""
    session = require_session(session_id)

    return {
        "session_id": session_id,
        "customers_columns": session["customers_df"].columns.tolist(),
        "transactions_columns": session["transactions_df"].columns.tolist(),
        "campaigns_columns": session["campaigns_df"].columns.tolist(),
    }
