from fastapi import APIRouter, Depends, HTTPException
from app.models.notification_channel import NotificationChannel
from app.models.alert import Alert
from app.models.alert_rule import AlertRule
from app.core.database import get_session
from app.services.notifications import NotificationService
from app.api.deps import get_current_user
from app.models.all_models import User
from sqlmodel import select
from typing import List
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notification-channels", tags=["notifications"])


@router.get("/", response_model=List[NotificationChannel])
async def list_notification_channels(
    project_id: uuid.UUID,
    session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List all notification channels for a project"""
    stmt = select(NotificationChannel).where(NotificationChannel.project_id == project_id)
    result = await session.execute(stmt)
    return result.scalars().all()


@router.get("/{channel_id}", response_model=NotificationChannel)
async def get_notification_channel(
    channel_id: str,
    session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get a specific notification channel"""
    stmt = select(NotificationChannel).where(NotificationChannel.id == channel_id)
    result = await session.execute(stmt)
    channel = result.scalar_one_or_none()

    if not channel:
        raise HTTPException(status_code=404, detail="Notification channel not found")

    return channel


@router.post("/", response_model=NotificationChannel)
async def create_notification_channel(
    channel: NotificationChannel,
    session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create new notification channel"""
    # Check if ID already exists
    stmt = select(NotificationChannel).where(NotificationChannel.id == channel.id)
    result = await session.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        raise HTTPException(status_code=400, detail="Channel ID already exists")

    session.add(channel)
    await session.commit()
    await session.refresh(channel)
    return channel


@router.put("/{channel_id}", response_model=NotificationChannel)
async def update_notification_channel(
    channel_id: str,
    channel_update: NotificationChannel,
    session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Update an existing notification channel"""
    stmt = select(NotificationChannel).where(NotificationChannel.id == channel_id)
    result = await session.execute(stmt)
    channel = result.scalar_one_or_none()

    if not channel:
        raise HTTPException(status_code=404, detail="Notification channel not found")

    # Update fields
    for key, value in channel_update.dict(exclude_unset=True).items():
        if key != "id":
            setattr(channel, key, value)

    await session.commit()
    await session.refresh(channel)
    return channel


@router.delete("/{channel_id}")
async def delete_notification_channel(
    channel_id: str,
    session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Delete notification channel"""
    stmt = select(NotificationChannel).where(NotificationChannel.id == channel_id)
    result = await session.execute(stmt)
    channel = result.scalar_one_or_none()

    if not channel:
        raise HTTPException(status_code=404, detail="Notification channel not found")

    await session.delete(channel)
    await session.commit()
    return {"status": "deleted"}


@router.post("/{channel_id}/test")
async def test_notification_channel(
    channel_id: str,
    session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Send a test notification to a channel"""
    stmt = select(NotificationChannel).where(NotificationChannel.id == channel_id)
    result = await session.execute(stmt)
    channel = result.scalar_one_or_none()

    if not channel:
        raise HTTPException(status_code=404, detail="Notification channel not found")

    if not channel.enabled:
        raise HTTPException(status_code=400, detail="Notification channel is disabled")

    # Validate channel configuration
    if not channel.config:
        raise HTTPException(status_code=400, detail="Notification channel has no configuration")

    if not channel.config.get("webhook_url"):
        raise HTTPException(status_code=400, detail="Notification channel is missing webhook URL")

    try:
        # Create a test alert
        test_alert = Alert(
            alert_rule_id=uuid.uuid4(),
            state="TRIGGERED",
            severity="HIGH",
            metric_name="Test Metric",
            metric_value=85.5,
            threshold=80.0,
            application_name="Test Application",
            fingerprint=f"test_{channel_id}_{datetime.now(timezone.utc).timestamp()}",
            context={}
        )

        # Create a test rule
        test_rule = AlertRule(
            id=uuid.uuid4(),
            name="Test Alert",
            description="Test notification",
            project_id=channel.project_id,
            metric_source="SYSTEM_PERFORMANCE",
            metric_filter={},
            threshold_type="STATIC",
            threshold_config={},
            condition="GREATER_THAN",
            severity="HIGH",
            aggregation_window="5m",
            aggregation_function="AVG",
            notification_config={}
        )

        # Send the test notification
        notification_service = NotificationService()
        await notification_service.send_to_channel(test_alert, test_rule, channel)

        return {"status": "test_sent", "channel_id": channel_id, "message": "Test notification sent successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to send test notification to {channel_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to send test notification: {str(e)}")
