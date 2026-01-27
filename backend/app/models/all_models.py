from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
import uuid
from app.models.metric import Metric
from app.models.metric import Metric
from app.models.evaluation_result import EvaluationResult
from app.models.llm_provider import LLMProvider
from app.models.evaluation_rule import EvaluationRule
from app.models.workflow import Tool, Agent, Workflow


class OrganizationUserLink(SQLModel, table=True):
    organization_id: uuid.UUID = Field(foreign_key="organization.id", primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", primary_key=True)
    role: str = "member"

class User(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(index=True, unique=True)
    hashed_password: str
    full_name: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    organizations: List["Organization"] = Relationship(back_populates="users", link_model=OrganizationUserLink)

class Organization(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    users: List[User] = Relationship(back_populates="organizations", link_model=OrganizationUserLink)
    projects: List["Project"] = Relationship(back_populates="organization")

class Project(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    organization_id: uuid.UUID = Field(foreign_key="organization.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    organization: Organization = Relationship(back_populates="projects")
    applications: List["Application"] = Relationship(back_populates="project")

class Application(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    project_id: uuid.UUID = Field(foreign_key="project.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    project: Project = Relationship(back_populates="applications")
    api_keys: List["ApiKey"] = Relationship(back_populates="application")
    rubric_prompt: Optional[str] = Field(default="""CONSISTENT SCORING GUIDELINES:
Score Distribution:
•  90-100 (Exceptional): Top 10% performance, benchmark quality
•  70-80 (Proficient): Top 25% performance, production ready
•  50-60 (Adequate): Meets basic requirements, needs optimization
•  30-40 (Below Standard): Significant issues, requires improvement
•  10-20 (Unacceptable): Critical failures, not functional
Scoring Criteria:
•  Score based on OBJECTIVE evidence from trace data
•  Each score band must have specific, measurable criteria
•  Consistency across all evaluation dimensions
•  No score inflation - use full 1-10 range appropriately""")

class ApiKey(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    key: str = Field(index=True, unique=True)
    name: str
    application_id: uuid.UUID = Field(foreign_key="application.id")
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    application: Application = Relationship(back_populates="api_keys")
