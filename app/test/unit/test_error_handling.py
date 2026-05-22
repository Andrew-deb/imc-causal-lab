import pytest
from fastapi import HTTPException
import asyncio

from app.utils.error_handling import handle_route_errors, handle_service_errors

# ─── handle_route_errors Tests ───

def test_handle_route_errors_sync_success():
    @handle_route_errors("test_op")
    def sync_route():
        return {"status": "ok"}
    
    # Assert it returns a synchronous function (not a coroutine function)
    assert not asyncio.iscoroutinefunction(sync_route)
    
    res = sync_route()
    assert res == {"status": "ok"}

def test_handle_route_errors_sync_failure():
    @handle_route_errors("test_op")
    def sync_route():
        raise ValueError("Something went wrong")
    
    with pytest.raises(HTTPException) as exc_info:
        sync_route()
    
    assert exc_info.value.status_code == 500
    assert "test_op failed: Something went wrong" in exc_info.value.detail

@pytest.mark.asyncio
async def test_handle_route_errors_async_success():
    @handle_route_errors("test_op")
    async def async_route():
        return {"status": "ok"}
    
    # Assert it returns a coroutine function
    assert asyncio.iscoroutinefunction(async_route)
    
    res = await async_route()
    assert res == {"status": "ok"}

@pytest.mark.asyncio
async def test_handle_route_errors_async_failure():
    @handle_route_errors("test_op")
    async def async_route():
        raise ValueError("Something went wrong")
    
    with pytest.raises(HTTPException) as exc_info:
        await async_route()
    
    assert exc_info.value.status_code == 500
    assert "test_op failed: Something went wrong" in exc_info.value.detail


# ─── handle_service_errors Tests ───

def test_handle_service_errors_sync_success():
    @handle_service_errors("test_service")
    def sync_service():
        return "success"
    
    assert not asyncio.iscoroutinefunction(sync_service)
    assert sync_service() == "success"

def test_handle_service_errors_sync_failure():
    @handle_service_errors("test_service")
    def sync_service():
        raise KeyError("missing_key")
    
    with pytest.raises(KeyError):
        sync_service()

@pytest.mark.asyncio
async def test_handle_service_errors_async_success():
    @handle_service_errors("test_service")
    async def async_service():
        return "success"
    
    assert asyncio.iscoroutinefunction(async_service)
    assert await async_service() == "success"

@pytest.mark.asyncio
async def test_handle_service_errors_async_failure():
    @handle_service_errors("test_service")
    async def async_service():
        raise KeyError("missing_key")
    
    with pytest.raises(KeyError):
        await async_service()
