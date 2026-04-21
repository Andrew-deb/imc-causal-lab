import logging
from fastapi import APIRouter, UploadFile, File, HTTPException

from app.schemas.dataset_schema import DatasetUploadResponse
from app.services.dataset_service import parse_and_store_datasets, get_session

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/datasets", tags=["Datasets"])


@router.post("/upload", response_model=DatasetUploadResponse)
async def upload_datasets(
    customers: UploadFile = File(..., description="Customers CSV"),
    transactions: UploadFile = File(..., description="Transactions CSV"),
    campaigns: UploadFile = File(..., description="Campaigns CSV"),
):
    """
    Upload 3 CSV files (customers, transactions, campaigns).
    Returns session_id + column names for the mapping step.
    """
    try:
        result = await parse_and_store_datasets(customers, transactions, campaigns)
        return result
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV files: {e}")


@router.get("/columns/{session_id}")
async def get_columns(session_id: str):
    """Retrieve column names for a previously uploaded session."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session_id": session_id,
        "customers_columns": session["customers_df"].columns.tolist(),
        "transactions_columns": session["transactions_df"].columns.tolist(),
        "campaigns_columns": session["campaigns_df"].columns.tolist(),
    }
