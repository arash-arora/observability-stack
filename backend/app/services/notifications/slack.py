import httpx
from datetime import datetime
from app.models.alert import Alert
from app.models.alert_rule import AlertRule
from app.core.config import settings


class SlackNotifier:
    async def send_alert(self, alert: Alert, rule: AlertRule, config: dict):
        """Send rich Slack notification"""
        webhook_url = config.get("webhook_url")

        payload = {
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": f"🚨 {rule.severity.upper()}: {rule.name}"
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Application:*\n{alert.application_name}"},
                        {"type": "mrkdwn", "text": f"*Metric:*\n{alert.metric_name}"},
                        {"type": "mrkdwn", "text": f"*Current Value:*\n{alert.metric_value:.2f}"},
                        {"type": "mrkdwn", "text": f"*Threshold:*\n{alert.threshold:.2f}"}
                    ]
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Triggered:* {alert.triggered_at.strftime('%Y-%m-%d %H:%M:%S UTC')}\n*Occurrences:* {alert.occurrence_count}"
                    }
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {"type": "plain_text", "text": "View Dashboard"},
                            "url": self.get_dashboard_url(alert),
                            "style": "primary"
                        }
                    ]
                }
            ]
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(webhook_url, json=payload, timeout=10.0)
            response.raise_for_status()

    def get_dashboard_url(self, alert: Alert) -> str:
        """Generate dashboard link"""
        base_url = getattr(settings, 'FRONTEND_URL', None) or "http://localhost:3000"
        return f"{base_url}/dashboard?alert_id={alert.id}"
