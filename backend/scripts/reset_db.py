import asyncio
import sys
import os

# Add backend directory to path so we can import app modules
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel
from app.core.config import settings
from app.models.all_models import *  # Import all models to register them


async def reset_db():
    print(f"Connecting to {settings.DATABASE_URL}")
    engine = create_async_engine(settings.DATABASE_URL, echo=True, future=True)
    async with engine.begin() as conn:
        print("Dropping all tables with CASCADE...")
        # Disable all triggers/constraints temporarily or just cascade drop public schema tables
        await conn.execute(text("DROP SCHEMA public CASCADE;"))
        await conn.execute(text("CREATE SCHEMA public;"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO postgres;"))
        await conn.execute(text("GRANT ALL ON SCHEMA public TO public;"))
        print("Schema reset. Creating all tables...")
        await conn.run_sync(SQLModel.metadata.create_all)

    print("Database reset complete.")
    await engine.dispose()


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(reset_db())
