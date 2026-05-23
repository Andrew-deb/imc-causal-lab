import asyncio
import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock, AsyncMock, patch, ANY

from app.services.pipeline_queue import PipelineQueue
from app.services.job_service import JobManager
from app.services.event_service import EventManager

@pytest.fixture
def mock_job_manager():
    manager = MagicMock(spec=JobManager)
    manager.list_jobs.return_value = []
    # Mock get_job to return a dictionary representing the job
    manager.get_job.side_effect = lambda jid: {
        "job_id": jid,
        "session_id": "session_test",
        "pipeline_type": "causal" if "causal" in jid else "evaluation",
        "status": "queued",
        "steps": []
    }
    return manager

@pytest.fixture
def mock_event_manager():
    return MagicMock(spec=EventManager)

@pytest.mark.asyncio
async def test_queue_submit_and_execution(mock_job_manager, mock_event_manager):
    with patch("app.services.pipeline_queue.job_manager", mock_job_manager), \
         patch("app.services.pipeline_queue.event_manager", mock_event_manager):
        
        queue = PipelineQueue(max_queued=3)
        queue.start()

        task_run = asyncio.Event()

        async def dummy_task():
            task_run.set()

        # Submit a job
        success = queue.submit("job_causal_1", dummy_task)
        assert success is True

        # Wait for worker to run the task
        await asyncio.wait_for(task_run.wait(), timeout=2.0)
        
        # Stop queue worker
        await queue.stop()

@pytest.mark.asyncio
async def test_queue_capacity_limit(mock_job_manager, mock_event_manager):
    with patch("app.services.pipeline_queue.job_manager", mock_job_manager), \
         patch("app.services.pipeline_queue.event_manager", mock_event_manager):
        
        # Define a queue with max 2 queued items
        queue = PipelineQueue(max_queued=2)
        
        # Do NOT start worker, so jobs stay in the queue
        async def dummy_task():
            pass

        success1 = queue.submit("job_1", dummy_task)
        success2 = queue.submit("job_2", dummy_task)
        success3 = queue.submit("job_3", dummy_task) # Should be rejected

        assert success1 is True
        assert success2 is True
        assert success3 is False
        assert queue.get_status()["queued_count"] == 2

        await queue.stop()

@pytest.mark.asyncio
async def test_cancel_queued_job(mock_job_manager, mock_event_manager):
    with patch("app.services.pipeline_queue.job_manager", mock_job_manager), \
         patch("app.services.pipeline_queue.event_manager", mock_event_manager):
        
        queue = PipelineQueue(max_queued=3)
        
        async def dummy_task():
            pass

        queue.submit("job_1", dummy_task)
        queue.submit("job_2", dummy_task)

        # Cancel job_2 while queued (before worker starts)
        assert "job_2" in queue._queued_jobs
        cancelled = queue.cancel("job_2")
        
        assert cancelled is True
        assert "job_2" not in queue._queued_jobs
        assert "job_2" in queue._cancelled_jobs
        assert any(
            call[0][0] == "job_2" and call[1].get("status") == "cancelled"
            for call in mock_job_manager.update_job.call_args_list
        )

        await queue.stop()

@pytest.mark.asyncio
async def test_cancel_active_job(mock_job_manager, mock_event_manager):
    with patch("app.services.pipeline_queue.job_manager", mock_job_manager), \
         patch("app.services.pipeline_queue.event_manager", mock_event_manager):
        
        queue = PipelineQueue(max_queued=3)
        queue.start()

        started_event = asyncio.Event()
        finish_event = asyncio.Event()

        async def long_running_task():
            started_event.set()
            try:
                await asyncio.sleep(10)
            except asyncio.CancelledError:
                finish_event.set()
                raise

        queue.submit("job_active", long_running_task)

        # Wait until task has started running
        await asyncio.wait_for(started_event.wait(), timeout=2.0)
        assert queue._running_job_id == "job_active"

        # Cancel the running job
        cancelled = queue.cancel("job_active")
        assert cancelled is True

        # Wait for cancellation to propagate inside the task
        await asyncio.wait_for(finish_event.wait(), timeout=2.0)

        # Verify database update for job cancellation
        assert any(
            call[0][0] == "job_active" and call[1].get("status") == "cancelled"
            for call in mock_job_manager.update_job.call_args_list
        )

        await queue.stop()

@pytest.mark.asyncio
async def test_cascading_failure(mock_job_manager, mock_event_manager):
    with patch("app.services.pipeline_queue.job_manager", mock_job_manager), \
         patch("app.services.pipeline_queue.event_manager", mock_event_manager):
        
        queue = PipelineQueue(max_queued=3)
        queue.start()

        # Let mock get_job return causal or evaluation based on string
        mock_job_manager.get_job.side_effect = lambda jid: {
            "job_id": jid,
            "session_id": "session_123",
            "pipeline_type": "causal" if "causal" in jid else "evaluation",
            "status": "queued",
            "steps": []
        }

        async def failing_modeling_task():
            # Raise exception to simulate failure
            raise ValueError("Fit failed due to convergence limits")

        async def evaluation_task():
            pass

        # Submit modeling (causal) and evaluation jobs
        queue.submit("job_causal", failing_modeling_task)
        queue.submit("job_evaluation", evaluation_task)

        # Wait for queue execution to complete
        await asyncio.sleep(0.5)

        # Evaluation job in queue should be automatically cancelled due to cascading modeling failure
        assert "job_evaluation" not in queue._queued_jobs
        assert any(
            call[0][0] == "job_evaluation" and
            call[1].get("status") == "failed" and
            call[1].get("error") == "Cancelled due to failure of modeling job job_causal"
            for call in mock_job_manager.update_job.call_args_list
        )

        await queue.stop()


@pytest.mark.asyncio
async def test_startup_cleans_up_completed_jobs(mock_job_manager, mock_event_manager):
    mock_session_manager = MagicMock()
    
    mock_job_manager.list_jobs.return_value = [
        {
            "job_id": "job_causal",
            "session_id": "session_completed",
            "pipeline_type": "causal",
            "status": "running",
            "steps": [{"step_number": 1, "name": "Step 1", "status": "running"}]
        },
        {
            "job_id": "job_evaluation",
            "session_id": "session_completed",
            "pipeline_type": "evaluation",
            "status": "queued",
            "steps": [{"step_number": 1, "name": "Step 1", "status": "pending"}]
        },
        {
            "job_id": "job_interrupted",
            "session_id": "session_not_completed",
            "pipeline_type": "causal",
            "status": "running",
            "steps": [{"step_number": 1, "name": "Step 1", "status": "running"}]
        }
    ]
    
    def get_session_side_effect(sid):
        if sid == "session_completed":
            return {
                "session_id": "session_completed",
                "result": {"some": "causal_result"},
                "evaluation_result": {"some": "evaluation_result"}
            }
        return {
            "session_id": "session_not_completed",
            "result": None,
            "evaluation_result": None
        }
    mock_session_manager.get_session.side_effect = get_session_side_effect
    
    with patch("app.services.pipeline_queue.job_manager", mock_job_manager), \
         patch("app.services.pipeline_queue.event_manager", mock_event_manager), \
         patch("app.services.session_service.session_manager", mock_session_manager):
         
        queue = PipelineQueue(max_queued=3)
        queue.start()
        
        # Check job_causal update
        assert any(
            call[0][0] == "job_causal" and
            call[1].get("status") == "completed" and
            len(call[1].get("steps", [])) == 1 and
            call[1]["steps"][0]["status"] == "completed"
            for call in mock_job_manager.update_job.call_args_list
        )

        # Check job_evaluation update
        assert any(
            call[0][0] == "job_evaluation" and
            call[1].get("status") == "completed" and
            len(call[1].get("steps", [])) == 1 and
            call[1]["steps"][0]["status"] == "completed"
            for call in mock_job_manager.update_job.call_args_list
        )

        # Check job_interrupted update
        assert any(
            call[0][0] == "job_interrupted" and
            call[1].get("status") == "interrupted" and
            call[1].get("error") == "Server restarted during execution." and
            len(call[1].get("steps", [])) == 1 and
            call[1]["steps"][0]["status"] == "interrupted"
            for call in mock_job_manager.update_job.call_args_list
        )
        
        await queue.stop()


