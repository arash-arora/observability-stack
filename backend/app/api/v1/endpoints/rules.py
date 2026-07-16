import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.database import get_session
from app.models.evaluation_rule import EvaluationRule
from app.models.all_models import User, Application, Project
from app.api import deps
from app.core.permissions import Permissions
from app.api.v1.endpoints.projects import (
    check_permission,
    check_app_permission_by_id,
    get_allowed_application_names,
)

router = APIRouter()


@router.get("/", response_model=List[EvaluationRule])
async def list_rules(
    application_id: str = None,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(deps.get_current_user),
):
    query = select(EvaluationRule)
    if application_id:
        import uuid
        has_perm = await check_app_permission_by_id(
            db, current_user, uuid.UUID(application_id), Permissions.EVAL_READ
        )
        if not has_perm:
            raise HTTPException(
                status_code=403,
                detail="Not authorized to view evaluation rules for this application",
            )
        query = query.where(EvaluationRule.application_id == application_id)
    else:
        if not current_user.is_superuser:
            allowed_apps = await get_allowed_application_names(
                db, current_user, Permissions.EVAL_READ
            )
            if not allowed_apps:
                return []
            stmt_app_ids = select(Application.id).where(Application.name.in_(allowed_apps))
            res_app_ids = await db.execute(stmt_app_ids)
            allowed_app_ids_str = [str(aid) for aid in res_app_ids.scalars().all()]
            query = query.where(EvaluationRule.application_id.in_(allowed_app_ids_str))

    result = await db.execute(query)
    return result.scalars().all()


@router.post("/", response_model=EvaluationRule)
async def create_rule(
    rule: EvaluationRule,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(get_session),
):
    # Retrieve application to get organization_id for permission check
    application = await db.get(Application, uuid.UUID(rule.application_id) if isinstance(rule.application_id, str) else rule.application_id)
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
async def delete_rule(
    id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(deps.get_current_user),
):
    rule = await db.get(EvaluationRule, id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    if not current_user.is_superuser:
        import uuid
        has_perm = await check_app_permission_by_id(
            db, current_user, uuid.UUID(rule.application_id), Permissions.EVAL_CREATE
        )
        if not has_perm:
            raise HTTPException(
                status_code=403,
                detail="Not authorized to delete evaluation rules for this application",
            )

    await db.delete(rule)
    await db.commit()
    return {"status": "success"}


@router.post("/{id}/toggle", response_model=EvaluationRule)
async def toggle_rule(
    id: int,
    active: bool,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(deps.get_current_user),
):
    rule = await db.get(EvaluationRule, id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    if not current_user.is_superuser:
        import uuid
        has_perm = await check_app_permission_by_id(
            db, current_user, uuid.UUID(rule.application_id), Permissions.EVAL_CREATE
        )
        if not has_perm:
            raise HTTPException(
                status_code=403,
                detail="Not authorized to toggle evaluation rules for this application",
            )

    rule.active = active
    await db.commit()
    await db.refresh(rule)
    return rule

