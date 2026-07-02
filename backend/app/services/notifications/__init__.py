from app.models.alert import Alert
from app.models.alert_rule import AlertRule
from app.models.notification_channel import NotificationChannel
from app.core.database import get_session
from sqlmodel import select
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class NotificationService:
    async def send_alert_notifications(self, alert: Alert, rule: AlertRule):
        """Send notifications to all configured channels"""
        channel_ids = rule.notification_config.get("channels", [])

        async with get_session() as session:
            stmt = select(NotificationChannel).where(
                NotificationChannel.id.in_(channel_ids),
                NotificationChannel.enabled == True
            )
            result = await session.execute(stmt)
            channels = result.scalars().all()

            for channel in channels:
                try:
                    await self.send_to_channel(alert, rule, channel)
                except Exception as e:
                    logger.error(f"Failed to send notification to {channel.id}: {e}")

    async def send_to_channel(self, alert: Alert, rule: AlertRule, channel: NotificationChannel):
        """Route to appropriate notifier"""
        if channel.channel_type == "slack":
            from .slack import SlackNotifier
            notifier = SlackNotifier()
        elif channel.channel_type == "teams":
            from .teams import TeamsNotifier
            notifier = TeamsNotifier()
        elif channel.channel_type == "webhook":
            from .webhook import WebhookNotifier
            notifier = WebhookNotifier()
        else:
            logger.warning(f"Unknown channel type: {channel.channel_type}")
            return

        await notifier.send_alert(alert, rule, channel.config)

        # Record notification
        alert.notifications_sent.append({
            "channel": channel.id,
            "channel_type": channel.channel_type,
            "status": "sent",
            "timestamp": datetime.utcnow().isoformat()
        })
