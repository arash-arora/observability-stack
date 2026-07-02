import httpx
from app.models.alert import Alert
from app.models.alert_rule import AlertRule


class WebhookNotifier:
    async def send_alert(self, alert: Alert, rule: AlertRule, config: dict):
        """Send generic webhook notification"""
        webhook_url = config.get("webhook_url")
        headers = config.get("headers", {})

        payload = {
            "alert_id": str(alert.id),
            "alert_rule_id": str(alert.alert_rule_id),
            "rule_name": rule.name,
            "state": alert.state,
            "severity": alert.severity,
            "metric_name": alert.metric_name,
            "metric_value": alert.metric_value,
            "threshold": alert.threshold,
            "application_name": alert.application_name,
            "triggered_at": alert.triggered_at.isoformat(),
            "occurrence_count": alert.occurrence_count
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                webhook_url,
                json=payload,
                headers=headers,
                timeout=10.0
            )
            response.raise_for_status()
