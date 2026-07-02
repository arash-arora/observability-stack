from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON
from typing import Optional, Dict
from datetime import datetime
import uuid


class ModelQualityMetric(SQLModel, table=True):
    __tablename__ = "model_quality_metric"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    project_id: uuid.UUID = Field(foreign_key="project.id", index=True)
    application_id: uuid.UUID = Field(foreign_key="application.id", index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    evaluation_window_start: datetime
    evaluation_window_end: datetime

    model_name: str = Field(index=True)
    model_version: Optional[str] = None

    metric_type: str  # PREDICTION_DRIFT, CONFIDENCE_DRIFT, FAIRNESS_*, DATA_QUALITY_*

    score: float
    threshold: Optional[float] = None
    passed: Optional[bool] = Field(default=None, index=True)

    segment_breakdown: Optional[Dict] = Field(default=None, sa_column=Column(JSON))
    time_series_data: Optional[Dict] = Field(default=None, sa_column=Column(JSON))

    sample_size: int
    baseline_comparison: Optional[Dict] = Field(default=None, sa_column=Column(JSON))

    metadata: Optional[Dict] = Field(default=None, sa_column=Column(JSON))
