from app.models.alert_rule import AlertRule
from app.models.alert import Alert
from app.core.database import get_session
from app.core.clickhouse import get_clickhouse_client
from sqlmodel import select
from datetime import datetime, timedelta
import hashlib
import logging

logger = logging.getLogger(__name__)


class AlertRunner:
    async def run_alert_check(self, rule: AlertRule):
        """Execute alert check for a single rule"""
        try:
            # 1. Fetch metric value
            if rule.metric_source == "SYSTEM_PERFORMANCE":
                metric_value = await self.get_system_metric(rule)
            elif rule.metric_source == "DATA_DRIFT":
                metric_value = await self.get_drift_metric(rule)
            elif rule.metric_source == "MODEL_QUALITY":
                metric_value = await self.get_quality_metric(rule)
            elif rule.metric_source == "USER_LOGGED":
                metric_value = await self.get_evaluation_metric(rule)
            else:
                logger.warning(f"Unknown metric source: {rule.metric_source}")
                return

            if metric_value is None:
                return  # Insufficient data

            # 2. Evaluate threshold
            breached = self.evaluate_threshold(metric_value, rule)

            if breached:
                await self.trigger_alert(rule, metric_value)
            else:
                await self.resolve_alert(rule)

        except Exception as e:
            logger.error(f"Alert check failed for rule {rule.id}: {e}")

    async def get_system_metric(self, rule: AlertRule) -> float:
        """Query ClickHouse for system metrics"""
        client = get_clickhouse_client()
        metric_type = rule.metric_filter.get("metric_type")

        # Parse aggregation window (e.g., "5m" -> 5 minutes)
        window_minutes = self.parse_window(rule.aggregation_window)

        query = f"""
        SELECT {rule.aggregation_function.lower()}(value) as agg_value
        FROM system_metrics
        WHERE project_id = '{rule.project_id}'
          AND metric_type = '{metric_type}'
          AND timestamp >= now() - INTERVAL {window_minutes} MINUTE
        """

        if rule.application_id:
            app_name = await self.get_application_name(rule.application_id)
            query += f" AND application_name = '{app_name}'"

        result = client.query(query)
        rows = result.result_rows

        if not rows or rows[0][0] is None:
            return None

        return float(rows[0][0])

    async def get_evaluation_metric(self, rule: AlertRule) -> float:
        """Query PostgreSQL for evaluation metrics"""
        async with get_session() as session:
            metric_ids = rule.metric_filter.get("metric_ids", [])
            window_minutes = self.parse_window(rule.aggregation_window)

            from app.models.all_models import EvaluationResult
            from sqlalchemy import func

            stmt = select(func.avg(EvaluationResult.score)).where(
                EvaluationResult.metric_id.in_(metric_ids),
                EvaluationResult.created_at >= datetime.utcnow() - timedelta(minutes=window_minutes)
            )

            if rule.application_id:
                app_name = await self.get_application_name(rule.application_id)
                stmt = stmt.where(EvaluationResult.application_name == app_name)

            result = await session.execute(stmt)
            avg_score = result.scalar()

            return avg_score

    async def get_drift_metric(self, rule: AlertRule) -> float:
        """Query PostgreSQL for drift metrics"""
        async with get_session() as session:
            from app.models.drift_metric import DataDriftMetric
            from sqlalchemy import func

            window_minutes = self.parse_window(rule.aggregation_window)

            stmt = select(func.avg(DataDriftMetric.drift_score)).where(
                DataDriftMetric.project_id == rule.project_id,
                DataDriftMetric.created_at >= datetime.utcnow() - timedelta(minutes=window_minutes)
            )

            if rule.application_id:
                stmt = stmt.where(DataDriftMetric.application_id == rule.application_id)

            result = await session.execute(stmt)
            avg_drift = result.scalar()

            return avg_drift

    async def get_quality_metric(self, rule: AlertRule) -> float:
        """Query PostgreSQL for quality metrics"""
        async with get_session() as session:
            from app.models.quality_metric import ModelQualityMetric
            from sqlalchemy import func

            window_minutes = self.parse_window(rule.aggregation_window)

            stmt = select(func.avg(ModelQualityMetric.score)).where(
                ModelQualityMetric.project_id == rule.project_id,
                ModelQualityMetric.created_at >= datetime.utcnow() - timedelta(minutes=window_minutes)
            )

            if rule.application_id:
                stmt = stmt.where(ModelQualityMetric.application_id == rule.application_id)

            result = await session.execute(stmt)
            avg_quality = result.scalar()

            return avg_quality

    def evaluate_threshold(self, metric_value: float, rule: AlertRule) -> bool:
        """Check if metric breaches threshold"""
        threshold = rule.threshold_config.get("value")

        if rule.condition == "GREATER_THAN":
            return metric_value > threshold
        elif rule.condition == "LESS_THAN":
            return metric_value < threshold
        elif rule.condition == "EQUALS":
            return abs(metric_value - threshold) < 0.001

        return False

    async def trigger_alert(self, rule: AlertRule, metric_value: float):
        """Create or update alert"""
        async with get_session() as session:
            fingerprint = self.generate_fingerprint(rule)

            # Check for existing active alert
            stmt = select(Alert).where(
                Alert.fingerprint == fingerprint,
                Alert.state.in_(["TRIGGERED", "ACKNOWLEDGED"])
            )
            result = await session.execute(stmt)
            alert = result.scalar_one_or_none()

            if alert:
                # Update existing
                alert.occurrence_count += 1
                alert.last_occurrence = datetime.utcnow()
                alert.metric_value = metric_value
            else:
                # Create new
                alert = Alert(
                    alert_rule_id=rule.id,
                    fingerprint=fingerprint,
                    state="TRIGGERED",
                    severity=rule.severity,
                    metric_name=rule.metric_filter.get("metric_type", "unknown"),
                    metric_value=metric_value,
                    threshold=rule.threshold_config.get("value"),
                    application_name=await self.get_application_name(rule.application_id) if rule.application_id else "all",
                    context={}
                )
                session.add(alert)

            await session.commit()
            await session.refresh(alert)

            # Send notifications
            if await self.should_notify(alert, rule):
                await self.send_notifications(alert, rule)

    async def resolve_alert(self, rule: AlertRule):
        """Resolve existing alerts for this rule"""
        async with get_session() as session:
            fingerprint = self.generate_fingerprint(rule)

            stmt = select(Alert).where(
                Alert.fingerprint == fingerprint,
                Alert.state == "TRIGGERED"
            )
            result = await session.execute(stmt)
            alert = result.scalar_one_or_none()

            if alert:
                alert.state = "RESOLVED"
                alert.resolved_at = datetime.utcnow()
                alert.resolved_by = "auto"
                alert.resolution_note = "Metric returned to normal"
                await session.commit()

    def generate_fingerprint(self, rule: AlertRule) -> str:
        """Generate unique fingerprint for deduplication"""
        key = f"{rule.id}:{rule.application_id or 'all'}"
        return hashlib.md5(key.encode()).hexdigest()

    async def should_notify(self, alert: Alert, rule: AlertRule) -> bool:
        """Check cooldown period"""
        if alert.occurrence_count == 1:
            return True

        if not alert.notifications_sent:
            return True

        cooldown_minutes = rule.notification_config.get("cooldown_minutes", 15)
        last_notification = max(n["timestamp"] for n in alert.notifications_sent)

        time_since = datetime.utcnow() - last_notification
        return time_since.total_seconds() >= cooldown_minutes * 60

    async def send_notifications(self, alert: Alert, rule: AlertRule):
        """Send notifications via configured channels"""
        from app.services.notifications import NotificationService

        service = NotificationService()
        await service.send_alert_notifications(alert, rule)

    async def get_application_name(self, application_id) -> str:
        """Get application name from ID"""
        async with get_session() as session:
            from app.models.all_models import Application
            stmt = select(Application.name).where(Application.id == application_id)
            result = await session.execute(stmt)
            name = result.scalar_one_or_none()
            return name or "Unknown"

    def parse_window(self, window: str) -> int:
        """Parse window string to minutes (e.g., '5m' -> 5, '1h' -> 60)"""
        if window.endswith('m'):
            return int(window[:-1])
        elif window.endswith('h'):
            return int(window[:-1]) * 60
        elif window.endswith('d'):
            return int(window[:-1]) * 1440
        return 5  # default
