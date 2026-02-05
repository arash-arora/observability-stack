from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.database import get_session
from app.models.evaluation_rule import EvaluationRule
from app.models.all_models import User, Application, Project
from app.api import deps
from app.core.permissions import Permissions
from app.api.v1.endpoints.projects import check_permission

router = APIRouter()


@router.get("/", response_model=List[EvaluationRule])
async def list_rules(
    application_id: str = None, db: AsyncSession = Depends(get_session)
):
    query = select(EvaluationRule)
    if application_id:
        query = query.where(EvaluationRule.application_id == application_id)

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=EvaluationRule)
async def create_rule(
    rule: EvaluationRule,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_session),
):
    # Retrieve application to get organization_id for permission check
    application = await db.get(Application, rule.application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    project = await db.get(Project, application.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    has_perm = await check_permission(
        session=db,
        user_id=current_user.id,
        org_id=project.organization_id,
        permission=Permissions.EVAL_CREATE,
    )
    if not has_perm:
        raise HTTPException(
            status_code=403, detail="Not authorized to create evaluation rules"
        )

    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.delete("/{id}")
async def delete_rule(id: int, db: AsyncSession = Depends(get_session)):
    rule = await db.get(EvaluationRule, id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    await db.delete(rule)
    await db.commit()
    return {"status": "success"}


@router.post("/{id}/toggle", response_model=EvaluationRule)
async def toggle_rule(id: int, active: bool, db: AsyncSession = Depends(get_session)):
    rule = await db.get(EvaluationRule, id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    rule.active = active
    await db.commit()
    await db.refresh(rule)
    return rule
