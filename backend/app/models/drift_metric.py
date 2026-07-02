from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON
from typing import Optional, Dict
from datetime import datetime
import uuid


class DataDriftMetric(SQLModel, table=True):
    __tablename__ = "data_drift_metric"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    project_id: uuid.UUID = Field(foreign_key="project.id", index=True)
    application_id: uuid.UUID = Field(foreign_key="application.id", index=True)

    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    baseline_start: datetime
    baseline_end: datetime
    comparison_start: datetime
    comparison_end: datetime

    drift_type: str  # PSI, KS_TEST, JENSEN_SHANNON, CHI_SQUARE
    feature_name: str = Field(index=True)
    feature_type: str  # NUMERICAL, CATEGORICAL, TEXT_EMBEDDING

    drift_score: float
    p_value: Optional[float] = None
    threshold: float
    is_drifted: bool = Field(index=True)

    baseline_sample_size: int
    comparison_sample_size: int
    baseline_statistics: Dict = Field(sa_column=Column(JSON))
    comparison_statistics: Dict = Field(sa_column=Column(JSON))

    model_name: Optional[str] = None
    metadata: Optional[Dict] = Field(default=None, sa_column=Column(JSON))
