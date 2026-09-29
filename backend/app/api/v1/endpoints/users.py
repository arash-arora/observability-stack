from typing import Any, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.core import security
from app.core.database import get_session
from app.models.all_models import User
from pydantic import BaseModel

router = APIRouter()

AVAILABLE_PERSONAS = ["Default", "Sales", "Marketing", "Developer", "Product team"]


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    password: Optional[str] = None
    persona: Optional[str] = None
    organization: Optional[str] = None


class UserRead(BaseModel):
    id: Any
    email: str
    full_name: Optional[str] = None
    is_superuser: bool = False
    persona: Optional[str] = "Default"
    organization: Optional[str] = None


@router.get("/personas")
async def list_available_personas() -> Any:
    """
    List supported evaluation personas and descriptions.
    """
    from app.core.evaluation.integrations.prompts import PERSONA_PERSPECTIVES
    return {
        "personas": AVAILABLE_PERSONAS,
        "default": "Default",
        "details": {
            k: {
                "title": v.get("title"),
                "description": v.get("description"),
                "focus_areas": v.get("focus_areas"),
            }
            for k, v in PERSONA_PERSPECTIVES.items()
        },
    }


@router.get("/me", response_model=UserRead)
async def read_user_me(
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Any:
    """
    Get current user details including persona and organization.
    """
    org_name = current_user.organization
    if not org_name:
        # Check linked organization
        from app.models.all_models import OrganizationUserLink, Organization
        from sqlmodel import select
        stmt = (
            select(Organization.name)
            .join(OrganizationUserLink, Organization.id == OrganizationUserLink.organization_id)
            .where(OrganizationUserLink.user_id == current_user.id)
        )
        res = await session.execute(stmt)
        first_org = res.scalars().first()
        if first_org:
            org_name = first_org

    return UserRead(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        is_superuser=current_user.is_superuser,
        persona=current_user.persona or "Default",
        organization=org_name,
    )


@router.put("/me", response_model=UserRead)
async def update_user_me(
    user_in: UserUpdate,
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Any:
    """
    Update own user profile including persona and organization.
    """
    if user_in.full_name is not None:
        current_user.full_name = user_in.full_name

    if user_in.password is not None:
        current_user.hashed_password = security.get_password_hash(user_in.password)

    if user_in.persona is not None:
        current_user.persona = user_in.persona or "Default"

    if user_in.organization is not None:
        current_user.organization = user_in.organization

    session.add(current_user)
    await session.commit()
    await session.refresh(current_user)

    org_name = current_user.organization
    if not org_name:
        from app.models.all_models import OrganizationUserLink, Organization
        from sqlmodel import select
        stmt = (
            select(Organization.name)
            .join(OrganizationUserLink, Organization.id == OrganizationUserLink.organization_id)
            .where(OrganizationUserLink.user_id == current_user.id)
        )
        res = await session.execute(stmt)
        first_org = res.scalars().first()
        if first_org:
            org_name = first_org

    return UserRead(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        is_superuser=current_user.is_superuser,
        persona=current_user.persona or "Default",
        organization=org_name,
    )


@router.delete("/me")
async def delete_user_me(
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Any:
    """
    Delete own user profile.
    """
    # 1. Update Metrics associated with user to have user_id = None
    from app.models.metric import Metric
    from sqlmodel import select
    stmt = select(Metric).where(Metric.user_id == current_user.id)
    res = await session.execute(stmt)
    user_metrics = res.scalars().all()
    for m in user_metrics:
        m.user_id = None
        session.add(m)
        
    # 2. Delete Organization User links
    from app.models.all_models import OrganizationUserLink
    stmt_link = select(OrganizationUserLink).where(OrganizationUserLink.user_id == current_user.id)
    res_link = await session.execute(stmt_link)
    links = res_link.scalars().all()
    for link in links:
        await session.delete(link)

    # 3. Delete user
    await session.delete(current_user)
    await session.commit()

    return {"status": "success", "message": "Account deleted successfully"}
