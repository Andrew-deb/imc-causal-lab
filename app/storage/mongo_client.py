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


def _configure_dns():
    """
    Override dnspython's default resolver to use Google Public DNS.

    On Windows, dnspython picks up DNS servers from ALL network adapters
    (Ethernet, Wi-Fi, etc.) and may try unreachable ones first, causing
    mongodb+srv:// SRV lookups to time out. Pinning to Google DNS
    (8.8.8.8 / 8.8.4.4) ensures reliable resolution on any connection.
    """
    try:
        import dns.resolver
        resolver = dns.resolver.Resolver()
        resolver.nameservers = ["8.8.8.8", "8.8.4.4"]
        dns.resolver.default_resolver = resolver
        logger.debug("DNS resolver configured to use Google Public DNS")
    except ImportError:
        # dnspython not installed — pymongo will fall back to system DNS
        pass


def get_client() -> MongoClient:
    """Get or create the MongoDB client (singleton)."""
    global _client
    if _client is None:
        # Ensure DNS uses reliable nameservers before SRV lookup
        _configure_dns()
        try:
            # Use shorter timeouts (3s selection, 3s connection, 10s socket) to fail fast on network drops
            # and retryReads/retryWrites for automatic recovery from transient glitches.
            _client = MongoClient(
                settings.MONGODB_URI,
                serverSelectionTimeoutMS=3000,
                connectTimeoutMS=3000,
                socketTimeoutMS=10000,
                retryReads=True,
                retryWrites=True
            )
            # Verify connection
            _client.admin.command("ping")
            logger.info("✅ Connected to MongoDB Atlas")
        except Exception as e:
            _client = None  # Reset so future calls can retry
            logger.error(f"❌ Failed to connect/ping MongoDB Atlas: {e}")
            raise RuntimeError(
                f"Could not connect to MongoDB. Check your MONGODB_URI, "
                f"network/DNS settings, and Atlas IP whitelist. Error: {e}"
            ) from e
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
