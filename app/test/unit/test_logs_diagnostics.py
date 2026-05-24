import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch, ANY
from fastapi.testclient import TestClient

from app.app import app
from app.services.event_service import EventManager, MongoEventManager
from app.api.v1.routes.pipeline_routes import event_manager

# ─── 1. In-Memory EventManager Tests ───

def test_event_manager_log_and_list():
    base_time = datetime(2026, 5, 21, 12, 0, 0, tzinfo=timezone.utc)
    time_increments = [base_time + timedelta(seconds=i) for i in range(10)]
    
    with patch("app.services.event_service.datetime") as mock_datetime:
        # Mock now() to return successive values
        mock_datetime.now.side_effect = time_increments
        
        manager = EventManager()
        
        # Log info event
        evt1 = manager.log(
            event_type="test_event",
            severity="info",
            session_id="session_123",
            message="A test log entry",
            metadata={"foo": "bar"}
        )
        
        assert evt1["event_id"] is not None
        assert evt1["event_type"] == "test_event"
        assert evt1["severity"] == "info"
        assert evt1["session_id"] == "session_123"
        assert evt1["message"] == "A test log entry"
        assert evt1["metadata"] == {"foo": "bar"}
        assert isinstance(evt1["timestamp"], datetime)

        # Log warning event
        evt2 = manager.log(
            event_type="model_warning",
            severity="warning",
            session_id="session_123",
            message="Model is close to limit"
        )

        # Log other session event
        evt3 = manager.log(
            event_type="test_event",
            severity="error",
            session_id="session_other",
            message="Fatal model error"
        )

        # Test listing all (should sort descending by timestamp, so evt3 (t+2) first, then evt2 (t+1), then evt1 (t+0))
        all_events = manager.list_events()
        assert len(all_events) == 3
        assert all_events[0]["event_id"] == evt3["event_id"]
        assert all_events[1]["event_id"] == evt2["event_id"]
        assert all_events[2]["event_id"] == evt1["event_id"]

        # Filter by session_id
        sess_events = manager.list_events(session_id="session_123")
        assert len(sess_events) == 2
        assert evt3["event_id"] not in [e["event_id"] for e in sess_events]

        # Filter by severity
        warn_events = manager.list_events(severity="warning")
        assert len(warn_events) == 1
        assert warn_events[0]["event_id"] == evt2["event_id"]

        # Filter by both
        err_other = manager.list_events(session_id="session_other", severity="error")
        assert len(err_other) == 1
        assert err_other[0]["event_id"] == evt3["event_id"]


def test_event_manager_capacity_limit():
    base_time = datetime(2026, 5, 21, 12, 0, 0, tzinfo=timezone.utc)
    # Generate 1005 increments
    time_increments = [base_time + timedelta(seconds=i) for i in range(1005)]
    
    with patch("app.services.event_service.datetime") as mock_datetime:
        mock_datetime.now.side_effect = time_increments
        
        manager = EventManager()
        
        # Log 1005 items
        for i in range(1005):
            manager.log(
                event_type="spam",
                severity="info",
                session_id="session_spam",
                message=f"Spam message {i}"
            )
        
        events = manager.list_events(limit=2000)
        assert len(events) == 1000
        # The oldest (0 to 4) should have been trimmed.
        # list_events returns sorted DESCENDING, so the latest logged (Spam message 1004) is first, 
        # and the oldest remaining (Spam message 5) is last.
        assert events[0]["message"] == "Spam message 1004"
        assert events[-1]["message"] == "Spam message 5"


# ─── 2. MongoEventManager Tests under Mock ───

def test_mongo_event_manager():
    mock_col = MagicMock()
    
    with patch("app.services.event_service.get_events_collection", return_value=mock_col):
        manager = MongoEventManager()
        
        # Verify index creation in constructor
        mock_col.create_index.assert_any_call([("timestamp", -1)])
        mock_col.create_index.assert_any_call("session_id")
        mock_col.create_index.assert_any_call("timestamp", expireAfterSeconds=2592000)
        
        # Test logging
        evt = manager.log(
            event_type="mongo_event",
            severity="info",
            session_id="sess_mongo",
            message="Logging to mongo mock",
            metadata={"db": "atlas"}
        )
        
        assert evt["event_id"] is not None
        mock_col.insert_one.assert_called_once_with(ANY)
        
        # Test query listing mapping
        mock_cursor = MagicMock()
        mock_cursor.sort.return_value = mock_cursor
        mock_cursor.limit.return_value = [
            {"event_id": "1", "severity": "info", "session_id": "sess_mongo", "message": "hello", "timestamp": datetime.now()}
        ]
        mock_col.find.return_value = mock_cursor
        
        results = manager.list_events(session_id="sess_mongo", severity="info", limit=10)
        
        mock_col.find.assert_called_once_with({"session_id": "sess_mongo", "severity": "info"}, {"_id": 0})
        mock_cursor.sort.assert_called_once_with("timestamp", -1)
        mock_cursor.limit.assert_called_once_with(10)
        assert len(results) == 1
        assert results[0]["event_id"] == "1"


# ─── 3. Event Routing / TestClient Tests ───

def test_logs_endpoint():
    from app.utils.auth import get_current_user_optional
    app.dependency_overrides[get_current_user_optional] = lambda: "test_user"

    client = TestClient(app)
    
    # We patch the event_manager instance used in the pipeline routes
    mock_manager = MagicMock()
    mock_manager.list_events.return_value = [
        {
            "event_id": "evt_abc",
            "event_type": "api_test",
            "severity": "warning",
            "session_id": "sess_api",
            "message": "API endpoint called",
            "metadata": {},
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    ]

    mock_session_manager = MagicMock()
    mock_session_manager.get_session.return_value = {"session_id": "sess_api", "user_id": "test_user"}

    with patch("app.api.v1.routes.pipeline_routes.event_manager", mock_manager), \
         patch("app.api.v1.routes.pipeline_routes.session_manager", mock_session_manager):
        response = client.get("/api/v1/pipeline/logs/events?session_id=sess_api&severity=warning&limit=5")
        
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["event_id"] == "evt_abc"
        
        # Verify arguments passed to service manager
        mock_manager.list_events.assert_called_once_with(
            session_id="sess_api",
            severity="warning",
            limit=5
        )
    app.dependency_overrides.clear()
