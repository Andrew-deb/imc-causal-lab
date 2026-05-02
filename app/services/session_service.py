import logging
import uuid
from datetime import datetime, timezone
from typing import Optional
import pandas as pd
from io import StringIO

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
    ) -> str:
        """Create a new session with uploaded datasets. Returns session_id."""
        session_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        self._store[session_id] = {
            "session_id": session_id,
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

    def get_session(self, session_id: str) -> Optional[dict]:
        """Retrieve full session data by ID."""
        return self._store.get(session_id)

    def update_session(self, session_id: str, **fields) -> None:
        """Update specific fields on a session."""
        session = self._store.get(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        fields["updated_at"] = datetime.now(timezone.utc)
        session.update(fields)

    def delete_session(self, session_id: str) -> bool:
        """Delete a session. Returns True if it existed."""
        if session_id in self._store:
            del self._store[session_id]
            logger.info(f"Session deleted: {session_id[:8]}")
            return True
        return False

    def list_sessions(self) -> list[dict]:
        """List all sessions (lightweight metadata only)."""
        sessions = []
        for sid, data in self._store.items():
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

    def create_session(self, customers_df, transactions_df, campaigns_df, dataset_meta):
        session_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        doc = {
            "session_id": session_id,
            "status": "uploaded",
            "created_at": now,
            "updated_at": now,
            "dataset_meta": dataset_meta,
            # Store DataFrames as CSV strings (compact, reconstructable)
            "datasets": {
                "customers_csv": customers_df.to_csv(index=False),
                "transactions_csv": transactions_df.to_csv(index=False),
                "campaigns_csv": campaigns_df.to_csv(index=False),
            },
            "imc_mapping": None,
            "column_mapping": None,
            "result": None,
            "evaluation_result": None,
        }
        self._col.insert_one(doc)
        logger.info(f"Session created in MongoDB: {session_id[:8]}")
        return session_id

    def get_session(self, session_id):
        doc = self._col.find_one({"session_id": session_id}, {"_id": 0})
        if not doc:
            return None

        # Reconstruct DataFrames from stored CSV strings
        datasets = doc.pop("datasets", {})
        if datasets:
            doc["customers_df"] = pd.read_csv(StringIO(datasets["customers_csv"]))
            doc["transactions_df"] = pd.read_csv(StringIO(datasets["transactions_csv"]))
            doc["campaigns_df"] = pd.read_csv(StringIO(datasets["campaigns_csv"]))

        return doc

    def update_session(self, session_id, **fields):
        fields["updated_at"] = datetime.now(timezone.utc)

        # If updating result/evaluation, convert Pydantic models to dicts
        for key in ("result", "evaluation_result"):
            if key in fields and hasattr(fields[key], "model_dump"):
                fields[key] = fields[key].model_dump()

        self._col.update_one(
            {"session_id": session_id},
            {"$set": fields},
        )

    def delete_session(self, session_id):
        result = self._col.delete_one({"session_id": session_id})
        if result.deleted_count > 0:
            logger.info(f"Session deleted from MongoDB: {session_id[:8]}")
            return True
        return False

    def list_sessions(self):
        docs = self._col.find(
            {},
            {  # Only return lightweight fields (exclude datasets, results)
                "_id": 0,
                "session_id": 1,
                "status": 1,
                "created_at": 1,
                "updated_at": 1,
                "dataset_meta": 1,
                "result": {"$ifNull": [True, False]},  # just check existence
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
        logger.info("Using MongoDB session manager")
        return MongoSessionManager()
    else:
        logger.info("Using in-memory session manager")
        return SessionManager()

session_manager = _create_session_manager()
