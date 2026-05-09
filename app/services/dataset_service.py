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
    column_mapping: dict | None = None,
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
        f"Session {session_id[:12]}: "
        f"customers={len(customers_df)}, "
        f"transactions={len(transactions_df)}, "
        f"campaigns={len(campaigns_df)}"
    )

    # Extract unique campaign type values.
    # Priority 1: Use the user's column mapping (they told us which column is the campaign type)
    # Priority 2: Heuristic fallback (columns containing "type", "channel", etc.)
    campaign_types: list[str] = []
    type_col: str | None = None

    if column_mapping:
        # Frontend sends  { "campaignType": "campaigns.csv::campaign_type", ... }
        raw_val = column_mapping.get("campaignType", "")
        if raw_val and "::" in raw_val:
            col_name = raw_val.split("::", 1)[1].strip()
            if col_name in campaigns_df.columns:
                type_col = col_name
                logger.info(f"Using user-mapped campaign type column: '{type_col}'")

    if not type_col:
        # Fallback: heuristic — prefer exact "type" match over loose "name" match
        candidates = [
            col for col in campaigns_df.columns
            if "type" in col.lower() or "channel" in col.lower() or "medium" in col.lower()
        ]
        if candidates:
            type_col = candidates[0]
            logger.info(f"Auto-detected campaign type column: '{type_col}'")

    if type_col:
        campaign_types = sorted(
            str(v) for v in campaigns_df[type_col].dropna().unique()
        )
        logger.info(f"Found {len(campaign_types)} unique campaign types from '{type_col}'")

    return DatasetUploadResponse(
        session_id=session_id,
        customers_columns=customers_df.columns.tolist(),
        transactions_columns=transactions_df.columns.tolist(),
        campaigns_columns=campaigns_df.columns.tolist(),
        customers_rows=len(customers_df),
        transactions_rows=len(transactions_df),
        campaigns_rows=len(campaigns_df),
        campaign_types=campaign_types,
    )


def get_session(session_id: str) -> dict | None:
    """Retrieve session data by ID."""
    return session_manager.get_session(session_id)

