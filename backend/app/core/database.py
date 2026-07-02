from sqlmodel import SQLModel
from app.core.config import settings
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy import text
from contextlib import asynccontextmanager

engine = create_async_engine(settings.DATABASE_URL, echo=True, future=True)
async_session_factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

from app.models.all_models import Role
from app.core.permissions import DEFAULT_PERMISSIONS
from sqlalchemy import select


async def seed_roles(session: AsyncSession):
    for role_name, permissions in DEFAULT_PERMISSIONS.items():
        result = await session.execute(select(Role).where(Role.name == role_name))
        role = result.scalars().first()
        if not role:
            role = Role(name=role_name, permissions=permissions)
            session.add(role)
        else:
            role.permissions = permissions
            session.add(role)
    await session.commit()


async def init_db():
    async with engine.begin() as conn:
        # await conn.run_sync(SQLModel.metadata.drop_all)
        await conn.run_sync(SQLModel.metadata.create_all)
        # Backward-compatible schema patch for older deployments where `metric.user_id`
        # does not exist yet but is now required by the ORM model.
        await conn.execute(text("ALTER TABLE metric ADD COLUMN IF NOT EXISTS user_id UUID"))

    # Seed roles
    async with async_session_factory() as session:
        await seed_roles(session)


async def get_session() -> AsyncSession:
    async with async_session_factory() as session:
        yield session


@asynccontextmanager
async def get_session_ctx():
    async with async_session_factory() as session:
        yield session
