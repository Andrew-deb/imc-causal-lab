from fastapi import APIRouter

from app.api.v1.routes.dataset_routes import router as dataset_router
from app.api.v1.routes.imc_mapping import router as imc_router
from app.api.v1.routes.modeling_routes import router as modeling_router
from app.api.v1.routes.dashboard_routes import router as dashboard_router
from app.api.v1.routes.evaluation_routes import router as evaluation_router
from app.api.v1.routes.causal_discovery import router as discovery_router
from app.api.v1.routes.session_routes import router as session_router
from app.api.v1.routes.pipeline_routes import router as pipeline_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(dataset_router)
api_router.include_router(imc_router)
api_router.include_router(modeling_router)
api_router.include_router(dashboard_router)
api_router.include_router(evaluation_router)
api_router.include_router(discovery_router)
api_router.include_router(session_router)
api_router.include_router(pipeline_router)