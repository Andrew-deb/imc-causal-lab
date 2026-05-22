import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone

from app.services import dag_library
from app.schemas.causal_discovery import (
    DAGCreateRequest,
    DAGVerifyAndSaveRequest,
    DAGUpdateRequest,
    CausalEdge,
    VariableRoles,
)

@pytest.fixture(autouse=True)
def clear_sandbox_cache():
    """Clear the local sandbox cache before every test."""
    dag_library._in_memory_dags.clear()


def test_dag_library_in_memory_mode():
    """Verify CRUD operates in in-memory sandbox mode when USE_MONGO is False."""
    with patch("app.services.dag_library.settings") as mock_settings:
        mock_settings.USE_MONGO = False
        mock_settings.MONGODB_URI = ""

        # Create
        req = DAGCreateRequest(
            name="Test Sandbox DAG",
            treatment="A",
            outcome="B",
            edges=[CausalEdge(source="A", target="B")]
        )
        saved = dag_library.create_dag(req)
        assert saved.name == "Test Sandbox DAG"
        assert saved.dag_id in dag_library._in_memory_dags

        # List
        items = dag_library.list_dags()
        assert len(items) == 1
        assert items[0].name == "Test Sandbox DAG"

        # Get
        retrieved = dag_library.get_dag(saved.dag_id)
        assert retrieved is not None
        assert retrieved.name == saved.name

        # Update
        up_req = DAGUpdateRequest(name="Updated Sandbox DAG")
        updated = dag_library.update_dag(saved.dag_id, up_req)
        assert updated is not None
        assert updated.name == "Updated Sandbox DAG"

        # Delete
        success = dag_library.delete_dag(saved.dag_id)
        assert success is True
        assert len(dag_library.list_dags()) == 0


def test_dag_library_mongo_exception_propagation():
    """Verify that when USE_MONGO is True, database operations propagate exceptions normally."""
    with patch("app.services.dag_library.settings") as mock_settings, \
         patch("app.services.dag_library._collection") as mock_col_func:
        
        mock_settings.USE_MONGO = True
        mock_settings.MONGODB_URI = "mongodb+srv://mock-atlas"
        mock_settings.DAG_DISCOVERY_MODEL = "openai/gpt-oss-120b:free"

        # Mock database collection to raise exceptions
        mock_col = MagicMock()
        mock_col.insert_one.side_effect = Exception("Atlas cluster offline / network timeout")
        mock_col.find.side_effect = Exception("Atlas cluster offline / network timeout")
        mock_col.find_one.side_effect = Exception("Atlas cluster offline / network timeout")
        mock_col.update_one.side_effect = Exception("Atlas cluster offline / network timeout")
        mock_col.delete_one.side_effect = Exception("Atlas cluster offline / network timeout")
        mock_col_func.return_value = mock_col

        req = DAGCreateRequest(
            name="Resilient DAG",
            treatment="A",
            outcome="B",
            edges=[]
        )
        
        # In Mongo mode, operations should propagate exceptions instead of swallowing them with fallbacks
        with pytest.raises(Exception) as exc:
            dag_library.create_dag(req)
        assert "Atlas cluster offline" in str(exc.value)

        # Get should raise exception
        with pytest.raises(Exception):
            dag_library.get_dag("some-id")

        # List should raise exception
        with pytest.raises(Exception):
            dag_library.list_dags()
