from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api.v1.router import api_router
from app.storage.mongo_client import close_client
from app.configs import settings


from app.services.pipeline_queue import pipeline_queue

def seed_demo_session():
    import logging
    from datetime import datetime, timezone
    import json
    import os
    from app.services.session_service import session_manager

    logger = logging.getLogger(__name__)
    try:
        existing = session_manager.get_session("demo_session")
        if existing:
            logger.info("demo_session already exists")
            return
    except Exception as e:
        logger.warning(f"Error checking for demo_session: {e}")

    logger.info("Seeding demo_session...")
    
    # Load modeling result
    result_path = "previous-conversions-context/results/response_v7.json"
    result_data = None
    if os.path.exists(result_path):
        try:
            with open(result_path, "r", encoding="utf-8") as f:
                result_data = json.load(f)
                result_data["session_id"] = "demo_session"
        except Exception as e:
            logger.error(f"Failed to load response_v7.json: {e}")

    # Load evaluation result
    eval_path = "eval.txt"
    if not os.path.exists(eval_path):
        eval_path = "previous-conversions-context/results/response_v4_evaluation.json"

    eval_data = None
    if os.path.exists(eval_path):
        try:
            with open(eval_path, "r", encoding="utf-8") as f:
                eval_data = json.load(f)
                eval_data["session_id"] = "demo_session"
        except Exception:
            try:
                # Try literal evaluation fallback for python dictionary formatting
                import ast
                with open(eval_path, "r", encoding="utf-8") as f:
                    eval_data = ast.literal_eval(f.read())
                    eval_data["session_id"] = "demo_session"
            except Exception as e:
                logger.error(f"Failed to load/parse evaluation results: {e}")

    now = datetime.now(timezone.utc)
    demo_doc = {
        "session_id": "demo_session",
        "user_id": None,
        "status": "completed",
        "created_at": now,
        "updated_at": now,
        "dataset_meta": {
            "customers_rows": 1000,
            "transactions_rows": 5000,
            "campaigns_rows": 500,
            "customers_columns": ["customer_id", "age", "gender"],
            "transactions_columns": ["customer_id", "transaction_date", "price"],
            "campaigns_columns": ["customer_id", "campaign_type", "start_date", "end_date"]
        },
        "imc_mapping": {
            "Online Display Ads": "advertising",
            "Print Advertisement": "advertising",
            "Search Engine Marketing": "advertising",
            "TV Advertisement": "advertising",
            "Radio Advertisement": "advertising",
            "Email Marketing": "direct_marketing",
            "SMS Marketing": "direct_marketing",
            "Influencer Marketing": "promotion",
            "In-Store Promotion": "promotion",
            "Social Media": "promotion",
        },
        "column_mapping": {
            "customer_id_col": "customer_id",
            "campaign_type_col": "campaign_type",
            "campaign_start_col": "start_date",
            "campaign_end_col": "end_date",
            "transaction_date_col": "transaction_date",
            "transaction_amount_col": "price"
        },
        "result": result_data,
        "evaluation_result": eval_data
    }

    try:
        from app.services.session_service import MongoSessionManager
        if isinstance(session_manager, MongoSessionManager):
            session_manager._col.insert_one(demo_doc)
            logger.info("demo_session seeded in MongoDB successfully.")
        else:
            session_manager._store["demo_session"] = demo_doc
            logger.info("demo_session seeded in-memory successfully.")
    except Exception as e:
        logger.error(f"Failed to insert demo_session: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start the background queue worker
    pipeline_queue.start()
    seed_demo_session()
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
    allow_origins=["http://localhost:3000", "http://localhost:5173", "https://imc-causal-lab.onrender.com", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
