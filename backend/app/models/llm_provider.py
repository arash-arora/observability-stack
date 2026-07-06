from typing import Optional, Dict
from datetime import datetime
import uuid
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON


class LLMProvider(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(index=True)  # User defined alias
    provider: str  # openai, azure, langchain
    model_name: str  # e.g. gpt-4o

    # Credentials (Stored as plaintext for this demo/research app)
    api_key: str
    base_url: Optional[str] = None
    api_version: Optional[str] = None
    deployment_name: Optional[str] = None

    # Provider-specific configuration (for cloud providers like Bedrock, Vertex AI, HuggingFace)
    provider_config: Optional[Dict] = Field(default=None, sa_column=Column(JSON))

    project_id: uuid.UUID = Field(index=True)
    user_id: Optional[uuid.UUID] = Field(default=None, index=True)
    is_public: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
