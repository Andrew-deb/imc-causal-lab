import io
import logging
import pandas as pd
from azure.storage.blob import BlobServiceClient
from app.configs import settings

logger = logging.getLogger(__name__)

_blob_service_client = None

def get_blob_service_client():
    """Singleton pattern to initialize the Azure Blob client."""
    global _blob_service_client
    if _blob_service_client is None:
        conn_str = settings.AZURE_STORAGE_CONNECTION_STRING
        if not conn_str:
            raise ValueError("AZURE_STORAGE_CONNECTION_STRING is not set in .env")
        
        _blob_service_client = BlobServiceClient.from_connection_string(conn_str)
        logger.info("Connected to Azure Blob Storage")
    return _blob_service_client

def get_container_client():
    """Gets the container client, creating the container if it doesn't exist."""
    client = get_blob_service_client()
    container_name = settings.AZURE_CONTAINER_NAME
    container_client = client.get_container_client(container_name)
    
    if not container_client.exists():
        container_client.create_container()
        logger.info(f"Created Azure container: {container_name}")
        
    return container_client

def upload_dataframe_as_parquet(df: pd.DataFrame, blob_name: str) -> str:
    """Converts a DataFrame to Parquet bytes and uploads directly to Azure."""
    try:
        # Convert df to parquet bytes in memory (no local file needed!)
        parquet_buffer = io.BytesIO()
        df.to_parquet(parquet_buffer, index=False)
        parquet_buffer.seek(0)
        
        container_client = get_container_client()
        blob_client = container_client.get_blob_client(blob_name)
        
        # Upload to cloud
        blob_client.upload_blob(data=parquet_buffer, overwrite=True)
        logger.info(f"Uploaded {blob_name} to Azure")
        
        return blob_name
    except Exception as e:
        logger.error(f"Failed to upload {blob_name} to Azure: {e}")
        raise

def download_parquet_to_dataframe(blob_name: str) -> pd.DataFrame:
    """Downloads a Parquet blob from Azure and converts it back into a DataFrame."""
    try:
        container_client = get_container_client()
        blob_client = container_client.get_blob_client(blob_name)
        
        # Download bytes from cloud
        download_stream = blob_client.download_blob()
        parquet_bytes = download_stream.readall()
        
        # Parse into DataFrame directly from memory
        df = pd.read_parquet(io.BytesIO(parquet_bytes))
        return df
    except Exception as e:
        logger.error(f"Failed to download {blob_name} from Azure: {e}")
        raise

def delete_blob(blob_name: str):
    """Deletes a blob from Azure Blob Storage."""
    try:
        container_client = get_container_client()
        blob_client = container_client.get_blob_client(blob_name)
        if blob_client.exists():
            blob_client.delete_blob()
            logger.info(f"Deleted {blob_name} from Azure")
    except Exception as e:
        logger.warning(f"Failed to delete {blob_name} from Azure: {e}")
