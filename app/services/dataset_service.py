import logging
import uuid
import pandas as pd
from io import BytesIO
from fastapi import UploadFile

from app.schemas.dataset_schema import DatasetUploadResponse

logger = logging.getLogger(__name__)


# ── In-memory session store 
# Keys: session_id → {"customers_df", "transactions_df", "campaigns_df",
#                      "imc_mapping", "column_mapping", "result", "status"}
session_store: dict[str, dict] = {}


async def parse_and_store_datasets(
    customers_file: UploadFile,
    transactions_file: UploadFile,
    campaigns_file: UploadFile,
) -> DatasetUploadResponse:
    """
    Parse uploaded CSV files, store DataFrames in session, return metadata.
    """
    session_id = str(uuid.uuid4())

    # Read CSVs into DataFrames
    customers_df = pd.read_csv(BytesIO(await customers_file.read()))
    transactions_df = pd.read_csv(BytesIO(await transactions_file.read()))
    campaigns_df = pd.read_csv(BytesIO(await campaigns_file.read()))

    # Drop rows with no campaign type (unusable for mapping)
    campaigns_df = campaigns_df.dropna(subset=[
        col for col in campaigns_df.columns
        if "type" in col.lower() or "campaign" in col.lower()
    ][:1] or [campaigns_df.columns[0]])

    logger.info(
        f"Session {session_id[:8]}: "
        f"customers={len(customers_df)}, "
        f"transactions={len(transactions_df)}, "
        f"campaigns={len(campaigns_df)}"
    )

    # Store in session
    session_store[session_id] = {
        "customers_df": customers_df,
        "transactions_df": transactions_df,
        "campaigns_df": campaigns_df,
        "imc_mapping": None,
        "column_mapping": None,
        "result": None,
        "status": "uploaded",
    }

    return DatasetUploadResponse(
        session_id=session_id,
        customers_columns=customers_df.columns.tolist(),
        transactions_columns=transactions_df.columns.tolist(),
        campaigns_columns=campaigns_df.columns.tolist(),
        customers_rows=len(customers_df),
        transactions_rows=len(transactions_df),
        campaigns_rows=len(campaigns_df),
    )


def get_session(session_id: str) -> dict | None:
    """Retrieve session data by ID."""
    return session_store.get(session_id)
