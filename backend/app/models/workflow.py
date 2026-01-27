from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlmodel import SQLModel, Field, Column, JSON
from uuid import UUID, uuid4

class ToolBase(SQLModel):
    name: str = Field(index=True)
    description: Optional[str] = None
    type: str = Field(default="custom") # custom, api, mcp
    configuration: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))

class Tool(ToolBase, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class AgentBase(SQLModel):
    name: str = Field(index=True)
    description: Optional[str] = None
    instruction: str # Renamed from system_prompt
    input_key: str = Field(default="input")
    output_key: str = Field(default="output")
    model_config_id: UUID = Field(foreign_key="llmprovider.id") # Link to Model Hub
    tool_ids: List[str] = Field(default=[], sa_column=Column(JSON)) # List of Tool UUIDs

class Agent(AgentBase, table=True):
    __tablename__ = "agents_v2"
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class WorkflowBase(SQLModel):
    name: str = Field(index=True)
    description: Optional[str] = None
    graph_data: Dict[str, Any] = Field(default={}, sa_column=Column(JSON)) # Stores React Flow nodes/edges

class Workflow(WorkflowBase, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
