import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from app.configs import settings
from app.storage.mongo_client import get_events_collection

logger = logging.getLogger(__name__)


class EventManager:
    """In-memory event repository."""

    def __init__(self):
        self._store: List[dict] = []

    def log(
        self,
        event_type: str,
        severity: str,
        session_id: Optional[str],
        message: str,
        metadata: Optional[dict] = None
    ) -> dict:
        event = {
            "event_id": str(uuid.uuid4()),
            "event_type": event_type,
            "severity": severity,  # "info" | "warning" | "error"
            "session_id": session_id,
            "message": message,
            "metadata": metadata or {},
            "timestamp": datetime.now(timezone.utc)
        }
        self._store.append(event)
        # Limit store size in-memory to prevent bloating
        if len(self._store) > 1000:
            self._store.pop(0)
        return event

    def list_events(
        self,
        session_id: Optional[str] = None,
        severity: Optional[str] = None,
        limit: int = 100
    ) -> List[dict]:
        events = self._store
        if session_id:
            events = [e for e in events if e["session_id"] == session_id]
        if severity:
            events = [e for e in events if e["severity"] == severity]
        
        events = sorted(events, key=lambda e: e["timestamp"], reverse=True)
        return events[:limit]


class MongoEventManager:
    """MongoDB-backed event repository."""

    def __init__(self):
        self._col = get_events_collection()
        self._col.create_index([("timestamp", -1)])
        self._col.create_index("session_id")
        self._col.create_index("timestamp", expireAfterSeconds=2592000)

    def log(
        self,
        event_type: str,
        severity: str,
        session_id: Optional[str],
        message: str,
        metadata: Optional[dict] = None
    ) -> dict:
        doc = {
            "event_id": str(uuid.uuid4()),
            "event_type": event_type,
            "severity": severity,
            "session_id": session_id,
            "message": message,
            "metadata": metadata or {},
            "timestamp": datetime.now(timezone.utc)
        }
        
        self._col.insert_one(doc)
        doc.pop("_id", None)
        return doc

    def list_events(
        self,
        session_id: Optional[str] = None,
        severity: Optional[str] = None,
        limit: int = 100
    ) -> List[dict]:
        query = {}
        if session_id:
            query["session_id"] = session_id
        if severity:
            query["severity"] = severity

        cursor = self._col.find(query, {"_id": 0}).sort("timestamp", -1).limit(limit)
        return list(cursor)


def _create_event_manager():
    if getattr(settings, "USE_MONGO", False) and settings.MONGODB_URI:
        logger.info("Using MongoDB event manager")
        return MongoEventManager()
    else:
        logger.info("Using in-memory event manager")
        return EventManager()


event_manager = _create_event_manager()
