from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api.v1.router import api_router
from app.storage.mongo_client import close_client
from app.configs import settings


from app.services.pipeline_queue import pipeline_queue

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start the background queue worker
    pipeline_queue.start()
    yield  # App runs
    # Shutdown: Stop the background queue worker and close connections
    await pipeline_queue.stop()
    if getattr(settings, "USE_MONGO", False):
        close_client()


app = FastAPI(
    title="IMC Causal Lab",
    description="Causal inference pipeline for Integrated Marketing Communications",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/")
def health_check():
    return {"status": "running", "app": "IMC Causal Lab"}
