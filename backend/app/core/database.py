from sqlmodel import SQLModel
from app.core.config import settings
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

engine = create_async_engine(settings.DATABASE_URL, echo=True, future=True)

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

    # Seed roles
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        await seed_roles(session)


async def get_session() -> AsyncSession:
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        yield session
