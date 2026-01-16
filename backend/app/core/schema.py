from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class MetricInfo(BaseModel):
    id: str
    name: str
    description: str
    provider: str
    type: str # LLM, Trace, Session
    tags: List[str]
    inputs: List[str]
    code_snippet: Optional[str] = None
    prompt: Optional[str] = None
    dummy_data: Optional[Dict[str, Any]] = None

class EvaluationRequest(BaseModel):
    metric_id: str
    inputs: Dict[str, Any] 
    trace_id: Optional[str] = None

class EvaluationResponse(BaseModel):
    score: float
    reason: Optional[str] = None
    passed: Optional[bool] = None
    trace_id: Optional[str] = None