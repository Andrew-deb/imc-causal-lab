import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, patch

from app.utils.progress import PipelineTracker

@patch("app.utils.progress.job_manager")
@patch("app.utils.progress.event_manager")
def test_pipeline_tracker_complete_naive_datetime(mock_event_manager, mock_job_manager):
    # Mock job manager return value with offset-naive datetime
    naive_started_at = datetime(2026, 5, 22, 3, 0, 0)  # naive representation
    mock_job_manager.get_job.return_value = {
        "job_id": "job_123",
        "started_at": naive_started_at
    }

    tracker = PipelineTracker(name="Test Pipeline", total_steps=3, job_id="job_123", session_id="sess_123")
    
    # This should complete without throwing a TypeError
    tracker.complete("Evaluation complete")

    # Assert job_manager was called to update status and duration
    mock_job_manager.get_job.assert_called_once_with("job_123")
    mock_job_manager.update_job.assert_called_once()
    
    args, kwargs = mock_job_manager.update_job.call_args
    assert args[0] == "job_123"
    assert kwargs["status"] == "completed"
    assert isinstance(kwargs["duration_seconds"], float)
    assert kwargs["duration_seconds"] > 0

@patch("app.utils.progress.job_manager")
@patch("app.utils.progress.event_manager")
def test_pipeline_tracker_complete_aware_datetime(mock_event_manager, mock_job_manager):
    # Mock job manager return value with offset-aware datetime
    aware_started_at = datetime(2026, 5, 22, 3, 0, 0, tzinfo=timezone.utc)
    mock_job_manager.get_job.return_value = {
        "job_id": "job_123",
        "started_at": aware_started_at
    }

    tracker = PipelineTracker(name="Test Pipeline", total_steps=3, job_id="job_123", session_id="sess_123")
    tracker.complete("Evaluation complete")

    mock_job_manager.update_job.assert_called_once()
    args, kwargs = mock_job_manager.update_job.call_args
    assert kwargs["status"] == "completed"
    assert isinstance(kwargs["duration_seconds"], float)

@patch("app.utils.progress.job_manager")
@patch("app.utils.progress.event_manager")
def test_pipeline_tracker_complete_string_datetime(mock_event_manager, mock_job_manager):
    # Mock job manager return value with ISO string datetime
    string_started_at = "2026-05-22T03:00:00Z"
    mock_job_manager.get_job.return_value = {
        "job_id": "job_123",
        "started_at": string_started_at
    }

    tracker = PipelineTracker(name="Test Pipeline", total_steps=3, job_id="job_123", session_id="sess_123")
    tracker.complete("Evaluation complete")

    mock_job_manager.update_job.assert_called_once()
    args, kwargs = mock_job_manager.update_job.call_args
    assert kwargs["status"] == "completed"
    assert isinstance(kwargs["duration_seconds"], float)
