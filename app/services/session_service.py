import logging
import uuid
from datetime import datetime, timezone
from typing import Optional
import pandas as pd
from io import StringIO
import os

from app.configs import settings
from app.storage.mongo_client import get_sessions_collection

logger = logging.getLogger(__name__)


class SessionManager:
    """
    Manages session lifecycle.
    In-memory dict backend db.
    """

    def __init__(self):
        self._store: dict[str, dict] = {}

    def create_session(
        self,
        customers_df,
        transactions_df,
        campaigns_df,
        dataset_meta: dict,
        user_id: Optional[str] = None,
    ) -> str:
        """Create a new session with uploaded datasets. Returns session_id."""
        session_id = f"session_{uuid.uuid4()}"
        now = datetime.now(timezone.utc)

        self._store[session_id] = {
            "session_id": session_id,
            "user_id": user_id,
            "status": "uploaded",
            "created_at": now,
            "updated_at": now,
            "dataset_meta": dataset_meta,
            "customers_df": customers_df,
            "transactions_df": transactions_df,
            "campaigns_df": campaigns_df,
            "imc_mapping": None,
            "column_mapping": None,
            "result": None,
            "evaluation_result": None,
        }

        logger.info(f"Session created: {session_id[:8]}")
        return session_id

    def get_session(self, session_id: str, include_datasets: bool = False, user_id: Optional[str] = None) -> Optional[dict]:
        """Retrieve full session data by ID."""
        session = self._store.get(session_id)
        if not session:
            return None
        if session_id != "demo_session" and user_id is not None:
            if session.get("user_id") != user_id:
                return None
        return session

    def update_session(self, session_id: str, user_id: Optional[str] = None, **fields) -> None:
        """Update specific fields on a session."""
        session = self._store.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")
        if session_id == "demo_session" and user_id is not None:
            raise ValueError("Demo session is read-only")
        if user_id is not None and session.get("user_id") != user_id:
            raise ValueError("Unauthorized access to session")

        fields["updated_at"] = datetime.now(timezone.utc)
        session.update(fields)

    def delete_session(self, session_id: str, user_id: Optional[str] = None) -> bool:
        """Delete a session. Returns True if it existed."""
        session = self._store.get(session_id)
        if not session:
            return False
        if session_id != "demo_session" and user_id is not None and session.get("user_id") != user_id:
            raise ValueError("Unauthorized access to session")
        
        del self._store[session_id]
        logger.info(f"Session deleted: {session_id[:8]}")
        return True

    def list_sessions(self, user_id: Optional[str] = None) -> list[dict]:
        """List all sessions (lightweight metadata only)."""
        sessions = []
        for sid, data in self._store.items():
            if user_id is not None and data.get("user_id") != user_id:
                continue
            sessions.append({
                "session_id": sid,
                "status": data.get("status", "unknown"),
                "created_at": data.get("created_at"),
                "updated_at": data.get("updated_at"),
                "dataset_meta": data.get("dataset_meta"),
                "has_results": data.get("result") is not None,
                "has_evaluation": data.get("evaluation_result") is not None,
            })
        # Most recent first
        sessions.sort(key=lambda s: s.get("created_at") or "", reverse=True)
        return sessions


# ── Global singleton ────────────────────────────────────────────────
# All routes and services import this single instance.
session_manager = SessionManager()



class MongoSessionManager:
    """
    MongoDB-backed session manager.
    Stores session metadata + datasets + results as a single document.
    """

    def __init__(self):
        self._col = get_sessions_collection()
        # Create index on session_id for fast lookups
        self._col.create_index("session_id", unique=True)

    def create_session(self, customers_df, transactions_df, campaigns_df, dataset_meta, user_id: Optional[str] = None):
        session_id = f"session_{uuid.uuid4()}"
        now = datetime.now(timezone.utc)

        # Import our new Azure helpers
        from app.storage.blob_client import upload_dataframe_as_parquet

        # Generate unique blob names using a folder structure for cleaner organization
        cust_blob = f"session_{session_id}/customers.parquet"
        txn_blob = f"session_{session_id}/transactions.parquet"
        camp_blob = f"session_{session_id}/campaigns.parquet"

        # Upload the dataframes to Azure (they never touch the local disk!)
        upload_dataframe_as_parquet(customers_df, cust_blob)
        upload_dataframe_as_parquet(transactions_df, txn_blob)
        upload_dataframe_as_parquet(campaigns_df, camp_blob)

        doc = {
            "session_id": session_id,
            "user_id": user_id,
            "status": "uploaded",
            "created_at": now,
            "updated_at": now,
            "dataset_meta": dataset_meta,
            # Store just the blob names in MongoDB, NOT the massive datasets
            "datasets": {
                "customers_blob": cust_blob,
                "transactions_blob": txn_blob,
                "campaigns_blob": camp_blob,
            },
            "imc_mapping": None,
            "column_mapping": None,
            "result": None,
            "evaluation_result": None,
        }
        self._col.insert_one(doc)
        logger.info(f"Session created in MongoDB: {session_id[:8]}")
        return session_id


    def get_session(self, session_id, include_datasets: bool = False, user_id: Optional[str] = None):
        doc = self._col.find_one({"session_id": session_id}, {"_id": 0})
        if not doc:
            return None

        if session_id != "demo_session" and user_id is not None:
            if doc.get("user_id") != user_id:
                return None

        # Reconstruct DataFrames by downloading them from Azure only if requested
        datasets = doc.pop("datasets", {})
        if include_datasets and datasets:
            from app.storage.blob_client import download_parquet_to_dataframe
            
            doc["customers_df"] = download_parquet_to_dataframe(datasets["customers_blob"])
            doc["transactions_df"] = download_parquet_to_dataframe(datasets["transactions_blob"])
            doc["campaigns_df"] = download_parquet_to_dataframe(datasets["campaigns_blob"])

        return doc


    def update_session(self, session_id, user_id: Optional[str] = None, **fields):
        if session_id == "demo_session" and user_id is not None:
            raise ValueError("Demo session is read-only")
        if user_id is not None:
            existing = self._col.find_one({"session_id": session_id})
            if not existing or existing.get("user_id") != user_id:
                raise ValueError("Unauthorized access to session")

        fields["updated_at"] = datetime.now(timezone.utc)

        # FIX: Loop through ALL fields and convert any Pydantic models to dictionaries
        for key, value in fields.items():
            if hasattr(value, "model_dump"):
                fields[key] = value.model_dump()

        self._col.update_one(
            {"session_id": session_id},
            {"$set": fields},
        )


    def delete_session(self, session_id, user_id: Optional[str] = None):
        if user_id is not None and session_id != "demo_session":
            existing = self._col.find_one({"session_id": session_id})
            if not existing or existing.get("user_id") != user_id:
                raise ValueError("Unauthorized access to session")

        # Clean up Azure blobs first to save space
        doc = self._col.find_one({"session_id": session_id})
        if doc and "datasets" in doc:
            from app.storage.blob_client import delete_blob
            for blob_name in doc["datasets"].values():
                delete_blob(blob_name)

        # Delete the metadata document from MongoDB
        result = self._col.delete_one({"session_id": session_id})
        if result.deleted_count > 0:
            logger.info(f"Session deleted from MongoDB: {session_id[:8]}")
            return True
        return False


    def list_sessions(self, user_id: Optional[str] = None):
        query = {}
        if user_id is not None:
            query["user_id"] = user_id

        docs = self._col.find(
            query,
            {  # Only return lightweight fields (exclude datasets, results)
                "_id": 0,
                "session_id": 1,
                "status": 1,
                "created_at": 1,
                "updated_at": 1,
                "dataset_meta": 1,
                "result.session_id": 1,
                "evaluation_result.session_id": 1,
            },
        ).sort("created_at", -1)

        sessions = []
        for doc in docs:
            sessions.append({
                "session_id": doc["session_id"],
                "status": doc.get("status", "unknown"),
                "created_at": doc.get("created_at"),
                "updated_at": doc.get("updated_at"),
                "dataset_meta": doc.get("dataset_meta"),
                "has_results": doc.get("result") is not None,
                "has_evaluation": doc.get("evaluation_result") is not None,
            })
        return sessions


# ── Factory: choose backend based on config

def _create_session_manager():
    """Create the appropriate session manager based on config."""
    if getattr(settings, "USE_MONGO", False) and settings.MONGODB_URI:
        try:
            logger.info("Using MongoDB session manager")
            return MongoSessionManager()
        except Exception as e:
            logger.warning(
                f"⚠️ MongoDB unavailable — falling back to in-memory sessions. "
                f"Data will NOT persist across restarts. Error: {e}"
            )
            return SessionManager()
    else:
        logger.info("Using in-memory session manager")
        return SessionManager()

session_manager = _create_session_manager()

