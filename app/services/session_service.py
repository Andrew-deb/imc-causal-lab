import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)


class SessionManager:
    """
    Manages session lifecycle.

    Phase 1: In-memory dict backend (current behavior, wrapped in a clean API).
    Phase 2: MongoDB backend (same interface, persistent storage).
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
