import logging
import pandas as pd
from io import BytesIO
from fastapi import UploadFile

from app.schemas.dataset_schema import DatasetUploadResponse
from app.services.session_service import session_manager

logger = logging.getLogger(__name__)


async def parse_and_store_datasets(
    customers_file: UploadFile,
    transactions_file: UploadFile,
    campaigns_file: UploadFile,
) -> DatasetUploadResponse:
    """Parse uploaded CSV files, store in session manager, return metadata."""
    customers_df = pd.read_csv(BytesIO(await customers_file.read()))
    transactions_df = pd.read_csv(BytesIO(await transactions_file.read()))
    campaigns_df = pd.read_csv(BytesIO(await campaigns_file.read()))

    # Drop rows with no campaign type
    campaigns_df = campaigns_df.dropna(subset=[
        col for col in campaigns_df.columns
        if "type" in col.lower() or "campaign" in col.lower()
    ][:1] or [campaigns_df.columns[0]])

    dataset_meta = {
        "customers_rows": len(customers_df),
        "transactions_rows": len(transactions_df),
        "campaigns_rows": len(campaigns_df),
        "customers_columns": customers_df.columns.tolist(),
        "transactions_columns": transactions_df.columns.tolist(),
        "campaigns_columns": campaigns_df.columns.tolist(),
    }

    session_id = session_manager.create_session(
        customers_df=customers_df,
        transactions_df=transactions_df,
        campaigns_df=campaigns_df,
        dataset_meta=dataset_meta,
    )

    logger.info(
        f"Session {session_id[:8]}: "
        f"customers={len(customers_df)}, "
        f"transactions={len(transactions_df)}, "
        f"campaigns={len(campaigns_df)}"
    )

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
    return session_manager.get_session(session_id)
