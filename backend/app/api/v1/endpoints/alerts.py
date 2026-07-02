from fastapi import APIRouter, Depends, HTTPException
from app.models.alert import Alert
from app.core.database import get_session
from sqlmodel import select
from typing import List, Optional
from datetime import datetime
import uuid

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("/", response_model=List[Alert])
async def list_alerts(
    project_id: Optional[uuid.UUID] = None,
    state: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 100,
    session = Depends(get_session)
):
    """List alerts with optional filters"""
    from app.models.alert_rule import AlertRule

    stmt = select(Alert).join(AlertRule)

    if project_id:
        stmt = stmt.where(AlertRule.project_id == project_id)

    if state:
        stmt = stmt.where(Alert.state == state)

    if severity:
        stmt = stmt.where(Alert.severity == severity)

    stmt = stmt.order_by(Alert.triggered_at.desc()).limit(limit)

    result = await session.execute(stmt)
    return result.scalars().all()


@router.get("/{alert_id}", response_model=Alert)
async def get_alert(
    alert_id: uuid.UUID,
    session = Depends(get_session)
):
    """Get a specific alert"""
    stmt = select(Alert).where(Alert.id == alert_id)
    result = await session.execute(stmt)
    alert = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    return alert


@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: uuid.UUID,
    session = Depends(get_session)
):
    """Acknowledge an alert"""
    stmt = select(Alert).where(Alert.id == alert_id)
    result = await session.execute(stmt)
    alert = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.state = "ACKNOWLEDGED"
    alert.acknowledged_at = datetime.utcnow()

    await session.commit()
    await session.refresh(alert)
    return alert


@router.post("/{alert_id}/resolve")
async def resolve_alert(
    alert_id: uuid.UUID,
    resolved_by: str,
    resolution_note: Optional[str] = None,
    session = Depends(get_session)
):
    """Manually resolve an alert"""
    stmt = select(Alert).where(Alert.id == alert_id)
    result = await session.execute(stmt)
    alert = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.state = "RESOLVED"
    alert.resolved_at = datetime.utcnow()
    alert.resolved_by = resolved_by
    alert.resolution_note = resolution_note

    await session.commit()
    await session.refresh(alert)
    return alert


@router.post("/{alert_id}/mute")
async def mute_alert(
    alert_id: uuid.UUID,
    session = Depends(get_session)
):
    """Mute an alert"""
    stmt = select(Alert).where(Alert.id == alert_id)
    result = await session.execute(stmt)
    alert = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.state = "MUTED"

    await session.commit()
    await session.refresh(alert)
    return alert
