from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.core.database import get_session
from app.models.all_models import User, OrganizationUserLink, Role, Organization
from pydantic import BaseModel
import uuid

router = APIRouter()


class UserReadAdmin(BaseModel):
    id: Any
    email: str
    full_name: str | None = None
    is_superuser: bool
    created_at: Any
    roles: List[str] = []


class AssignRoleRequest(BaseModel):
    organization_id: uuid.UUID
    role_id: uuid.UUID


@router.get("/users", response_model=List[UserReadAdmin])
async def list_users(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    List all users. Only superuser.
    """
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Fetch users
    statement = select(User)
    result = await session.execute(statement)
    users = result.scalars().all()

    # Fetch roles for each user
    user_list = []
    for user in users:
        # Get roles for this user
        # Join OrganizationUserLink, Organization, and Role
        stmt = (
            select(Organization.name, Role.name)
            .join(
                OrganizationUserLink,
                Organization.id == OrganizationUserLink.organization_id,
            )
            .join(Role, Role.id == OrganizationUserLink.role_id)
            .where(OrganizationUserLink.user_id == user.id)
        )
        res = await session.execute(stmt)
        roles_data = res.all()

        roles_formatted = [
            f"{org_name}: {role_name}" for org_name, role_name in roles_data
        ]

        user_read = UserReadAdmin(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            is_superuser=user.is_superuser,
            created_at=user.created_at,
            roles=roles_formatted,
        )
        user_list.append(user_read)

    return user_list


@router.post("/users/{user_id}/assign")
async def assign_user_role(
    user_id: uuid.UUID,
    data: AssignRoleRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Assign a user to an organization with a specific role.
    Only superuser can do this (as per requirements "Admin Panel - from where I can manage users...").
    """
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Check if user exists
    user = await session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if org exists
    org = await session.get(Organization, data.organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Check if role exists
    role = await session.get(Role, data.role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    # Check if link exists
    statement = select(OrganizationUserLink).where(
        OrganizationUserLink.user_id == user_id,
        OrganizationUserLink.organization_id == data.organization_id,
    )
    result = await session.execute(statement)
    link = result.scalars().first()

    if link:
        # Update existing link
        link.role_id = data.role_id
        session.add(link)
    else:
        # Create new link
        link = OrganizationUserLink(
            user_id=user_id, organization_id=data.organization_id, role_id=data.role_id
        )
        session.add(link)

    await session.commit()
    return {"status": "success"}
