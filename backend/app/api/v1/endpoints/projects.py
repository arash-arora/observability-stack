import secrets
import uuid
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.api import deps
from app.core.database import get_session
from app.models.all_models import ApiKey, Organization, Project, User, OrganizationUserLink
from pydantic import BaseModel

router = APIRouter()

# --- Schemas ---
class OrgCreate(BaseModel):
    name: str

class OrgRead(BaseModel):
    id: uuid.UUID
    name: str

class ProjectCreate(BaseModel):
    name: str
    organization_id: uuid.UUID

class ProjectRead(BaseModel):
    id: uuid.UUID
    name: str
    organization_id: uuid.UUID

class ApiKeyCreate(BaseModel):
    name: str
    project_id: uuid.UUID

class ApiKeyRead(BaseModel):
    id: uuid.UUID
    key: str
    name: str
    project_id: uuid.UUID
    is_active: bool

# --- Endpoints ---

@router.post("/organizations", response_model=OrgRead)
async def create_organization(
    org_in: OrgCreate,
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Any:
    """
    Create new organization.
    """
    org = Organization(name=org_in.name)
    session.add(org)
    await session.commit()
    await session.refresh(org)
    
    # Link user to org
    link = OrganizationUserLink(organization_id=org.id, user_id=current_user.id, role="owner")
    session.add(link)
    await session.commit()
    return org

@router.get("/organizations", response_model=List[OrgRead])
async def read_organizations(
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Any:
    """
    Retrieve organizations for current user.
    """
    # This is a bit complex with SQLModel async relationships, doing a manual join for now
    stmt = select(Organization).join(OrganizationUserLink).where(OrganizationUserLink.user_id == current_user.id)
    result = await session.execute(stmt)
    orgs = result.scalars().all()
    return orgs

@router.post("/projects", response_model=ProjectRead)
async def create_project(
    project_in: ProjectCreate,
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Any:
    """
    Create new project.
    """
    # Verify user belongs to org
    link_stmt = select(OrganizationUserLink).where(
        OrganizationUserLink.user_id == current_user.id,
        OrganizationUserLink.organization_id == project_in.organization_id
    )
    result = await session.execute(link_stmt)
    if not result.scalars().first():
         raise HTTPException(status_code=403, detail="Not a member of this organization")

    project = Project(name=project_in.name, organization_id=project_in.organization_id)
    session.add(project)
    await session.commit()
    await session.refresh(project)
    return project

@router.get("/projects", response_model=List[ProjectRead])
async def read_projects(
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Any:
    """
    Retrieve projects for current user (via their organizations).
    """
    # Join Project -> Organization -> OrganizationUserLink
    stmt = select(Project).join(Organization).join(OrganizationUserLink).where(
        OrganizationUserLink.user_id == current_user.id
    )
    result = await session.execute(stmt)
    projects = result.scalars().all()
    return projects

@router.post("/api-keys", response_model=ApiKeyRead)
async def create_api_key(
    key_in: ApiKeyCreate,
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Any:
    """
    Create new API key for a project.
    """
    # Verify user has access to project (via org)
    project_res = await session.get(Project, key_in.project_id)
    if not project_res:
        raise HTTPException(status_code=404, detail="Project not found")
    
    link_stmt = select(OrganizationUserLink).where(
        OrganizationUserLink.user_id == current_user.id,
        OrganizationUserLink.organization_id == project_res.organization_id
    )
    result = await session.execute(link_stmt)
    if not result.scalars().first():
         raise HTTPException(status_code=403, detail="Not a member of the project's organization")

    new_key = secrets.token_urlsafe(32)
    api_key_obj = ApiKey(key=f"sk-{new_key}", name=key_in.name, project_id=key_in.project_id)
    session.add(api_key_obj)
    await session.commit()
    await session.refresh(api_key_obj)
    return api_key_obj

@router.get("/api-keys", response_model=List[ApiKeyRead])
async def read_api_keys(
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Any:
    """
    Retrieve API keys for projects accessible to the current user.
    """
    # Join ApiKey -> Project -> Organization -> OrganizationUserLink
    stmt = select(ApiKey).join(Project).join(Organization).join(OrganizationUserLink).where(
        OrganizationUserLink.user_id == current_user.id
    )
    result = await session.execute(stmt)
    keys = result.scalars().all()
    return keys
