from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON
from typing import Optional, Dict, List
from datetime import datetime
import uuid


class Alert(SQLModel, table=True):
    __tablename__ = "alert"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    alert_rule_id: uuid.UUID = Field(foreign_key="alert_rule.id", index=True)

    # State
    state: str = Field(index=True)  # TRIGGERED, ACKNOWLEDGED, RESOLVED, MUTED
    severity: str

    # Context
    metric_name: str
    metric_value: float
    threshold: float
    application_name: str

    # Lifecycle
    triggered_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    # Deduplication
    fingerprint: str = Field(index=True)
    occurrence_count: int = Field(default=1)
    last_occurrence: datetime = Field(default_factory=datetime.utcnow)

    # Notification tracking
    notifications_sent: List[Dict] = Field(default=[], sa_column=Column(JSON))

    # Context
    context: Dict = Field(sa_column=Column(JSON))

    # Resolution
    resolved_by: Optional[str] = None
    resolution_note: Optional[str] = None
