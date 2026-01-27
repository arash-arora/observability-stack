from sqlmodel import SQLModel, Field
from datetime import datetime
from typing import Optional, Dict
from sqlalchemy import Column, JSON

class EvaluationRule(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str # e.g. "RAG Faithfulness"
    
    application_id: str = Field(index=True) # Link to Application
    metric_ids: str # Comma-separated list of metric IDs
    
    # Eval Configuration
    inputs: Dict = Field(default={}, sa_column=Column(JSON))
    
    active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Sampling (0.0 to 1.0) - optional for later
    percentage: float = 100.0 
