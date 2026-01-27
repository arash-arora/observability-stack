from fastapi import APIRouter
from app.api.v1.endpoints import auth, projects, ingest, analytics, users, evaluations, providers, rules, tools, agents, workflows

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(projects.router, prefix="/management", tags=["management"])
api_router.include_router(ingest.router, prefix="/ingest", tags=["ingest"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(evaluations.router, prefix="/evaluations", tags=["evaluations"])
api_router.include_router(rules.router, prefix="/evaluations/rules", tags=["rules"])
api_router.include_router(providers.router, prefix="/management/providers", tags=["providers"])
api_router.include_router(tools.router, prefix="/tools", tags=["tools"])
api_router.include_router(agents.router, prefix="/agents", tags=["agents"])
api_router.include_router(workflows.router, prefix="/workflows", tags=["workflows"])
