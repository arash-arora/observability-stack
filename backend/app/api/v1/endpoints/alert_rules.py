from fastapi import APIRouter, Depends, HTTPException
from app.models.alert_rule import AlertRule
from app.models.alert import Alert
from app.core.database import get_session
from sqlmodel import select
from typing import List
import uuid

router = APIRouter(prefix="/alert-rules", tags=["alerts"])


@router.get("/", response_model=List[AlertRule])
async def list_alert_rules(
    project_id: uuid.UUID,
    session = Depends(get_session)
):
    """List all alert rules for a project"""
    stmt = select(AlertRule).where(AlertRule.project_id == project_id)
    result = await session.execute(stmt)
    return result.scalars().all()


@router.get("/{rule_id}", response_model=AlertRule)
async def get_alert_rule(
    rule_id: uuid.UUID,
    session = Depends(get_session)
):
    """Get a specific alert rule"""
    stmt = select(AlertRule).where(AlertRule.id == rule_id)
    result = await session.execute(stmt)
    rule = result.scalar_one_or_none()

    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")

    return rule


@router.post("/", response_model=AlertRule)
async def create_alert_rule(
    rule: AlertRule,
    session = Depends(get_session)
):
    """Create new alert rule"""
    session.add(rule)
    await session.commit()
    await session.refresh(rule)
    return rule


@router.put("/{rule_id}", response_model=AlertRule)
async def update_alert_rule(
    rule_id: uuid.UUID,
    rule_update: AlertRule,
    session = Depends(get_session)
):
    """Update an existing alert rule"""
    stmt = select(AlertRule).where(AlertRule.id == rule_id)
    result = await session.execute(stmt)
    rule = result.scalar_one_or_none()

    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")

    # Update fields
    for key, value in rule_update.dict(exclude_unset=True).items():
        if key != "id":
            setattr(rule, key, value)

    await session.commit()
    await session.refresh(rule)
    return rule


@router.delete("/{rule_id}")
async def delete_alert_rule(
    rule_id: uuid.UUID,
    session = Depends(get_session)
):
    """Delete alert rule"""
    stmt = select(AlertRule).where(AlertRule.id == rule_id)
    result = await session.execute(stmt)
    rule = result.scalar_one_or_none()

    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")

    await session.delete(rule)
    await session.commit()
    return {"status": "deleted"}


@router.get("/{rule_id}/alerts", response_model=List[Alert])
async def list_rule_alerts(
    rule_id: uuid.UUID,
    session = Depends(get_session)
):
    """List all alerts for a specific rule"""
    stmt = select(Alert).where(Alert.alert_rule_id == rule_id).order_by(Alert.triggered_at.desc())
    result = await session.execute(stmt)
    return result.scalars().all()
