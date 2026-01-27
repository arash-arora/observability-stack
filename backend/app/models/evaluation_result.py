from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Column, JSON
import uuid

class EvaluationResult(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    trace_id: Optional[str] = Field(default=None, index=True)
    metric_id: str = Field(index=True)
    input: Optional[str] = None
    output: Optional[str] = None
    context: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))
    expected_output: Optional[str] = None
    score: Optional[float] = None
    reason: Optional[str] = None
    passed: Optional[bool] = None
    status: str = Field(default="COMPLETED") # RUNNING, COMPLETED, FAILED
    metadata_json: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    application_name: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
