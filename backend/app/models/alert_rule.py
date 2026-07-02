from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON
from typing import Optional, Dict
from datetime import datetime
import uuid


class AlertRule(SQLModel, table=True):
    __tablename__ = "alert_rule"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(index=True)
    description: Optional[str] = None

    # Scoping
    project_id: uuid.UUID = Field(foreign_key="project.id", index=True)
    application_id: Optional[uuid.UUID] = Field(default=None, foreign_key="application.id", index=True)

    # Metric source
    metric_source: str = Field(index=True)  # USER_LOGGED, SYSTEM_PERFORMANCE, DATA_DRIFT, MODEL_QUALITY
    metric_filter: Dict = Field(sa_column=Column(JSON))

    # Threshold configuration
    threshold_type: str  # STATIC, DYNAMIC, PERCENTILE
    threshold_config: Dict = Field(sa_column=Column(JSON))
    condition: str  # GREATER_THAN, LESS_THAN, EQUALS
    severity: str  # CRITICAL, HIGH, MEDIUM, LOW, INFO

    # Aggregation
    aggregation_window: str  # "5m", "1h", "1d"
    aggregation_function: str  # AVG, MAX, MIN, P95, COUNT

    # Notification
    notification_config: Dict = Field(sa_column=Column(JSON))

    # State
    active: bool = Field(default=True, index=True)
    sample_rate: float = Field(default=1.0)

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
