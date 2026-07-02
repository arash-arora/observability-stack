from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    projects,
    ingest,
    analytics,
    users,
    evaluations,
    providers,
    rules,
    admin,
    roles,
    alert_rules,
    alerts,
    system_metrics,
    notification_channels,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(projects.router, prefix="/management", tags=["management"])
api_router.include_router(ingest.router, prefix="/ingest", tags=["ingest"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(
    evaluations.router, prefix="/evaluations", tags=["evaluations"]
)
api_router.include_router(rules.router, prefix="/evaluations/rules", tags=["rules"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(roles.router, prefix="/roles", tags=["roles"])
api_router.include_router(
    providers.router, prefix="/management/providers", tags=["providers"]
)
api_router.include_router(alert_rules.router, tags=["alerts"])
api_router.include_router(alerts.router, tags=["alerts"])
api_router.include_router(system_metrics.router, tags=["metrics"])
api_router.include_router(notification_channels.router, tags=["notifications"])
