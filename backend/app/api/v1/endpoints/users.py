from typing import Any, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.core import security
from app.core.database import get_session
from app.models.all_models import User
from pydantic import BaseModel

router = APIRouter()


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    password: Optional[str] = None


class UserRead(BaseModel):
    id: Any
    email: str
    full_name: Optional[str] = None
    is_superuser: bool = False


@router.get("/me", response_model=UserRead)
async def read_user_me(
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get current user.
    """
    return current_user


@router.put("/me", response_model=UserUpdate)
async def update_user_me(
    user_in: UserUpdate,
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Any:
    """
    Update own user profile.
    """
    if user_in.full_name is not None:
        current_user.full_name = user_in.full_name

    if user_in.password is not None:
        current_user.hashed_password = security.get_password_hash(user_in.password)

    session.add(current_user)
    await session.commit()
    await session.refresh(current_user)

    return UserUpdate(full_name=current_user.full_name)  # Don't return password


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
