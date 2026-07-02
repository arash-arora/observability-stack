from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON
from typing import Dict
from datetime import datetime
import uuid


class NotificationChannel(SQLModel, table=True):
    __tablename__ = "notification_channel"

    id: str = Field(primary_key=True)  # e.g., "slack_engineering"
    name: str
    channel_type: str  # slack, teams, email, servicenow, webhook

    project_id: uuid.UUID = Field(foreign_key="project.id", index=True)

    config: Dict = Field(sa_column=Column(JSON))  # webhook_url, etc.
    enabled: bool = Field(default=True)

    created_at: datetime = Field(default_factory=datetime.utcnow)
