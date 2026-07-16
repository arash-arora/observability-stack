import logging

from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.core.database import init_db
from app.core.config import settings
from app.core.logging_config import setup_logging

from app.api.v1.api import api_router
from app.core.clickhouse import init_clickhouse, get_clickhouse_client
from app.core.scheduler import init_scheduler, shutdown_scheduler
from fastapi.middleware.cors import CORSMiddleware

# Configure logging before anything else
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting %s (env=%s)", settings.PROJECT_NAME, settings.ENVIRONMENT)
    await init_db()
    init_clickhouse()
    init_scheduler()
    logger.info("Application startup complete")
    yield
    # Shutdown
    shutdown_scheduler()
    logger.info("Application shutdown complete")


# Disable OpenAPI/Swagger docs in production
openapi_url = (
    f"{settings.API_V1_STR}/openapi.json"
    if settings.ENVIRONMENT != "production"
    else None
)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=openapi_url,
    docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
    lifespan=lifespan,
)

# Set all CORS enabled origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS_LIST,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health")
def health_check():
    """Shallow health check — confirms the process is alive."""
    return {"status": "ok"}


@app.get("/health/ready")
async def readiness_check():
    """
    Deep health check — validates connectivity to Postgres and ClickHouse.
    Use this for container orchestration readiness probes.
    """
    checks = {}

    # Check Postgres
    try:
        from app.core.database import engine
        from sqlalchemy import text

        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["postgres"] = "ok"
    except Exception as e:
        checks["postgres"] = f"error: {str(e)}"

    # Check ClickHouse
    try:
        client = get_clickhouse_client()
        client.command("SELECT 1")
        checks["clickhouse"] = "ok"
    except Exception as e:
        checks["clickhouse"] = f"error: {str(e)}"

    all_ok = all(v == "ok" for v in checks.values())
    return {"status": "ok" if all_ok else "degraded", "checks": checks}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
