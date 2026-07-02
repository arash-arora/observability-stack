import httpx
from app.models.alert import Alert
from app.models.alert_rule import AlertRule


class TeamsNotifier:
    async def send_alert(self, alert: Alert, rule: AlertRule, config: dict):
        """Send Teams adaptive card"""
        webhook_url = config.get("webhook_url")

        color_map = {
            "CRITICAL": "FF0000",
            "HIGH": "FFA500",
            "MEDIUM": "FFFF00",
            "LOW": "00FF00"
        }

        payload = {
            "@type": "MessageCard",
            "@context": "http://schema.org/extensions",
            "themeColor": color_map.get(rule.severity, "808080"),
            "summary": f"Alert: {rule.name}",
            "sections": [
                {
                    "activityTitle": f"🚨 {rule.name}",
                    "activitySubtitle": alert.application_name,
                    "facts": [
                        {"name": "Metric", "value": alert.metric_name},
                        {"name": "Current Value", "value": str(alert.metric_value)},
                        {"name": "Threshold", "value": str(alert.threshold)},
                        {"name": "Severity", "value": rule.severity.upper()}
                    ]
                }
            ]
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(webhook_url, json=payload, timeout=10.0)
            response.raise_for_status()
