"""
MongoDB connection manager.

Uses pymongo (synchronous) for simplicity. Can be swapped to motor (async)
later for better FastAPI integration at scale.
"""
import logging
from pymongo import MongoClient
from pymongo.database import Database
from app.configs import settings

logger = logging.getLogger(__name__)

_client: MongoClient | None = None


def get_client() -> MongoClient:
    """Get or create the MongoDB client (singleton)."""
    global _client
    if _client is None:
        _client = MongoClient(settings.MONGODB_URI)
        # Verify connection
        _client.admin.command("ping")
        logger.info("✅ Connected to MongoDB Atlas")
    return _client


def get_database() -> Database:
    """Get the application database."""
    return get_client()[settings.MONGODB_DATABASE]


def get_sessions_collection():
    """Get the sessions collection."""
    return get_database()["sessions"]


def get_dags_collection():
    """Get the causal_dags collection for the DAG library."""
    return get_database()["causal_dags"]


def get_pipeline_jobs_collection():
    """Get the pipeline_jobs collection for status tracking."""
    return get_database()["pipeline_jobs"]


def get_events_collection():
    """Get the events collection for logging system events."""
    return get_database()["events"]



def close_client():
    """Close the MongoDB connection (call on app shutdown)."""
    global _client
    if _client:
        _client.close()
        _client = None
        logger.info("MongoDB connection closed")
