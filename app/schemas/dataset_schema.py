from pydantic import BaseModel


class DatasetUploadResponse(BaseModel):
    """Response after uploading the 3 CSV files."""
    session_id: str
    customers_columns: list[str]
    transactions_columns: list[str]
    campaigns_columns: list[str]
    customers_rows: int
    transactions_rows: int
    campaigns_rows: int
    # Unique campaign type values (for IMC mapping step)
    campaign_types: list[str] = []


class ColumnMappingRequest(BaseModel):
    """Frontend sends the column assignments for the pipeline."""
    session_id: str
    customer_id_col: str
    campaign_type_col: str
    campaign_start_col: str
    campaign_end_col: str
    transaction_date_col: str
    transaction_amount_col: str
    confounder_cols: list[str] = []
