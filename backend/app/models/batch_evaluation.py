from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Column, JSON
import uuid

class BatchEvaluation(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    application_id: str = Field(index=True)
    project_id: uuid.UUID = Field(index=True)
    user_id: uuid.UUID = Field(index=True)

    name: Optional[str] = None
    description: Optional[str] = None

    # Date range (optional if use_all_traces)
    from_date: Optional[datetime] = None
    to_date: Optional[datetime] = None

    # Configuration
    metric_ids: str  # comma-separated
    total_traces: int  # total traces in date range
    traces_to_eval: int  # how many traces to evaluate
    is_percentage: bool = False  # True if traces_to_eval is a percentage
    percentage_value: Optional[float] = None  # percentage (1-100) if is_percentage=True

    # Model configuration
    provider: str  # openai, azure, anthropic, google, etc.
    model_name: str
    provider_id: Optional[uuid.UUID] = None  # if using registered provider

    # Status and results
    status: str = Field(default="PENDING")  # PENDING, RUNNING, COMPLETED, FAILED
    evaluated_traces: int = Field(default=0)
    successful_evaluations: int = Field(default=0)
    failed_evaluations: int = Field(default=0)
    avg_score: Optional[float] = None

    # Trace IDs that were selected for evaluation (stored as JSON)
    selected_trace_ids: Optional[List[str]] = Field(default=None, sa_column=Column(JSON))

    # Error tracking
    error_message: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
