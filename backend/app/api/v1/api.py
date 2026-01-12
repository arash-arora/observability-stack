from fastapi import APIRouter
from app.api.v1.endpoints import auth, projects, ingest, analytics, users, evaluations

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(projects.router, prefix="/management", tags=["management"])
api_router.include_router(ingest.router, prefix="/ingest", tags=["ingest"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(evaluations.router, prefix="/evaluations", tags=["evaluations"])
