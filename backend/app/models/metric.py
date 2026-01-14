from typing import List, Optional
from sqlmodel import SQLModel, Field, Column, JSON

class Metric(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    description: str
    provider: str
    type: str
    tags: List[str] = Field(sa_column=Column(JSON))
    inputs: List[str] = Field(sa_column=Column(JSON))
    code_snippet: str
    prompt: Optional[str] = None
