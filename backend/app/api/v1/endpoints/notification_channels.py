from fastapi import APIRouter, Depends, HTTPException
from app.models.notification_channel import NotificationChannel
from app.core.database import get_session
from sqlmodel import select
from typing import List
import uuid

router = APIRouter(prefix="/notification-channels", tags=["notifications"])


@router.get("/", response_model=List[NotificationChannel])
async def list_notification_channels(
    project_id: uuid.UUID,
    session = Depends(get_session)
):
    """List all notification channels for a project"""
    stmt = select(NotificationChannel).where(NotificationChannel.project_id == project_id)
    result = await session.execute(stmt)
    return result.scalars().all()


@router.get("/{channel_id}", response_model=NotificationChannel)
async def get_notification_channel(
    channel_id: str,
    session = Depends(get_session)
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
    session = Depends(get_session)
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
    session = Depends(get_session)
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
    session = Depends(get_session)
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
    session = Depends(get_session)
):
    """Send a test notification to a channel"""
    stmt = select(NotificationChannel).where(NotificationChannel.id == channel_id)
    result = await session.execute(stmt)
    channel = result.scalar_one_or_none()

    if not channel:
        raise HTTPException(status_code=404, detail="Notification channel not found")

    # TODO: Implement test notification
    # This would send a test alert to verify the channel is configured correctly

    return {"status": "test_sent", "channel_id": channel_id}
