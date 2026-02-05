from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.core.database import get_session
from app.models.all_models import Role, User
from pydantic import BaseModel

router = APIRouter()


class RoleRead(BaseModel):
    id: Any
    name: str
    permissions: List[str]


class RoleUpdate(BaseModel):
    permissions: List[str]


@router.get("/", response_model=List[RoleRead])
async def list_roles(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    List all roles.
    """
    # Any authenticated user can list roles (needed for UI to show options)
    statement = select(Role)
    result = await session.execute(statement)
    roles = result.scalars().all()
    return roles


@router.put("/{role_id}", response_model=RoleRead)
async def update_role_permissions(
    role_id: str,
    role_in: RoleUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Update permissions for a role. Only superuser can do this.
    """
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    role = await session.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    role.permissions = role_in.permissions
    session.add(role)
    await session.commit()
    await session.refresh(role)
    return role
