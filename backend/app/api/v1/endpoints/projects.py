import secrets
import uuid
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.api import deps
from app.core.database import get_session
from app.models.all_models import (
    ApiKey,
    Application,
    Organization,
    Project,
    User,
    OrganizationUserLink,
    Role,
)
from app.core.permissions import Permissions
from pydantic import BaseModel


async def check_permission(
    session: AsyncSession, user_id: uuid.UUID, org_id: uuid.UUID, permission: str
):
    stmt = (
        select(Role)
        .join(OrganizationUserLink)
        .where(
            OrganizationUserLink.user_id == user_id,
            OrganizationUserLink.organization_id == org_id,
        )
    )
    result = await session.execute(stmt)
    role = result.scalars().first()
    if not role or permission not in role.permissions:
        return False
    return True


router = APIRouter()


# --- Schemas ---
class OrgCreate(BaseModel):
    name: str


class OrgRead(BaseModel):
    id: uuid.UUID
    name: str
    current_user_role: str | None = None


class ProjectCreate(BaseModel):
    name: str
    organization_id: uuid.UUID


class ProjectRead(BaseModel):
    id: uuid.UUID
    name: str
    organization_id: uuid.UUID


class ApiKeyCreate(BaseModel):
    name: str
    application_id: uuid.UUID


class ApiKeyRead(BaseModel):
    id: uuid.UUID
    key: str
    name: str
    application_id: uuid.UUID
    is_active: bool


class ApplicationCreate(BaseModel):
    name: str
    project_id: uuid.UUID


class ApplicationUpdate(BaseModel):
    name: str | None = None
    rubric_prompt: str | None = None


class ApplicationRead(BaseModel):
    id: uuid.UUID
    name: str
    project_id: uuid.UUID
    rubric_prompt: str | None = None
    api_key: str | None = None  # Only populated on creation


# --- Endpoints ---


@router.post("/organizations", response_model=OrgRead)
async def create_organization(
    org_in: OrgCreate,
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Any:
    """
    Create new organization.
    Only superusers can create organizations.
    """
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403,
            detail="Only platform administrators can create organizations",
        )

    org = Organization(name=org_in.name)
    session.add(org)
    await session.commit()
    await session.refresh(org)

    # Link user to org with admin role
    role_stmt = select(Role).where(Role.name == "admin")
    role_res = await session.execute(role_stmt)
    admin_role = role_res.scalars().first()

    if not admin_role:
        raise HTTPException(status_code=500, detail="Default admin role not found")

    link = OrganizationUserLink(
        organization_id=org.id, user_id=current_user.id, role_id=admin_role.id
    )
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
    # Join Organization -> OrganizationUserLink -> Role
    stmt = (
        select(Organization, Role.name)
        .select_from(Organization)
        .join(OrganizationUserLink)
        .join(Role)
        .where(OrganizationUserLink.user_id == current_user.id)
    )
    result = await session.execute(stmt)
    rows = result.all()

    orgs_with_role = []
    for org, role_name in rows:
        org_read = OrgRead(id=org.id, name=org.name, current_user_role=role_name)
        orgs_with_role.append(org_read)

    return orgs_with_role


@router.delete("/organizations/{organization_id}")
async def delete_organization(
    organization_id: uuid.UUID,
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Any:
    """
    Delete an organization.
    Requires 'org:delete' permission or superuser status.
    """
    organization = await session.get(Organization, organization_id)
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Access Check
    has_perm = await check_permission(
        session, current_user.id, organization_id, Permissions.ORG_DELETE
    )

    if not current_user.is_superuser and not has_perm:
        raise HTTPException(
            status_code=403, detail="Not authorized to delete this organization"
        )

    # Delete organization (Database cascade should handle children, or we delete manually)
    # Ideally, we should delete projects and apps manually if cascade isn't set up,
    # but for now assuming SQLAlchemy cascade or manual delete.
    # To be safe and explicit let's delete projects first if needed, but let's trust DB cascade for now
    # or just delete the org object.

    await session.delete(organization)
    await session.commit()
    return {"status": "deleted"}


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
    # Verify user has permission
    has_perm = await check_permission(
        session, current_user.id, project_in.organization_id, Permissions.PROJECT_CREATE
    )
    if not has_perm:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to create projects in this organization",
        )

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
    stmt = (
        select(Project)
        .join(Organization)
        .join(OrganizationUserLink)
        .where(OrganizationUserLink.user_id == current_user.id)
    )
    result = await session.execute(stmt)
    projects = result.scalars().all()
    return projects


@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: uuid.UUID,
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Any:
    """
    Delete a project.
    Requires 'project:delete' permission.
    """
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    has_perm = await check_permission(
        session, current_user.id, project.organization_id, Permissions.PROJECT_DELETE
    )
    if not has_perm:
        raise HTTPException(
            status_code=403, detail="Not authorized to delete this project"
        )

    await session.delete(project)
    await session.commit()
    return {"status": "deleted"}


@router.post("/applications", response_model=ApplicationRead)
async def create_application(
    app_in: ApplicationCreate,
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Any:
    """
    Create new application with auto-generated API key.
    """
    # Verify user has access to project (via org)
    project_res = await session.get(Project, app_in.project_id)
    if not project_res:
        raise HTTPException(status_code=404, detail="Project not found")

    link_stmt = select(OrganizationUserLink).where(
        OrganizationUserLink.user_id == current_user.id,
        OrganizationUserLink.organization_id == project_res.organization_id,
    )
    result = await session.execute(link_stmt)
    if not result.scalars().first():
        raise HTTPException(
            status_code=403, detail="Not a member of the project's organization"
        )

    # Check permission
    has_perm = await check_permission(
        session,
        current_user.id,
        project_res.organization_id,
        Permissions.APP_CREATE,
    )
    if not has_perm:
        raise HTTPException(
            status_code=403, detail="Not authorized to create applications"
        )

    # Create Application
    application = Application(name=app_in.name, project_id=app_in.project_id)
    session.add(application)
    await session.commit()
    await session.refresh(application)

    # Auto-generate API key
    new_key = secrets.token_urlsafe(32)
    api_key_obj = ApiKey(
        key=f"sk-{new_key}", name=f"{app_in.name} Key", application_id=application.id
    )
    session.add(api_key_obj)
    await session.commit()

    return ApplicationRead(
        id=application.id,
        name=application.name,
        project_id=application.project_id,
        rubric_prompt=application.rubric_prompt,
        api_key=api_key_obj.key,
    )


@router.get("/applications", response_model=List[ApplicationRead])
async def read_applications(
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Any:
    """
    Retrieve applications for current user (via their projects/organizations).
    """
    # Join Application -> Project -> Organization -> OrganizationUserLink
    # Also eager load api_keys
    from sqlalchemy.orm import selectinload

    stmt = (
        select(Application)
        .options(selectinload(Application.api_keys))
        .join(Project)
        .join(Organization)
        .join(OrganizationUserLink)
        .where(OrganizationUserLink.user_id == current_user.id)
    )
    result = await session.execute(stmt)
    applications = result.scalars().all()

    # Map to ApplicationRead
    return [
        ApplicationRead(
            id=app.id,
            name=app.name,
            project_id=app.project_id,
            rubric_prompt=app.rubric_prompt,
            api_key=app.api_keys[0].key if app.api_keys else None,
        )
        for app in applications
    ]


@router.get("/applications/{application_id}", response_model=ApplicationRead)
async def read_application(
    application_id: uuid.UUID,
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Any:
    """
    Get application by ID.
    """
    from sqlalchemy.orm import selectinload

    # Check access via OrganizationUserLink
    application = await session.get(
        Application, application_id, options=[selectinload(Application.api_keys)]
    )
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    project_res = await session.get(Project, application.project_id)
    if not project_res:
        # Should not happen ideally
        raise HTTPException(status_code=404, detail="Project for application not found")

    link_stmt = select(OrganizationUserLink).where(
        OrganizationUserLink.user_id == current_user.id,
        OrganizationUserLink.organization_id == project_res.organization_id,
    )
    result = await session.execute(link_stmt)
    if not result.scalars().first():
        raise HTTPException(
            status_code=403, detail="Not authorized to access this application"
        )

    return ApplicationRead(
        id=application.id,
        name=application.name,
        project_id=application.project_id,
        rubric_prompt=application.rubric_prompt,
        api_key=application.api_keys[0].key if application.api_keys else None,
    )


@router.patch("/applications/{application_id}", response_model=ApplicationRead)
async def update_application(
    application_id: uuid.UUID,
    app_in: ApplicationUpdate,
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Any:
    """
    Update an application.
    """
    application = await session.get(Application, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Verify access
    project_res = await session.get(Project, application.project_id)
    link_stmt = select(OrganizationUserLink).where(
        OrganizationUserLink.user_id == current_user.id,
        OrganizationUserLink.organization_id == project_res.organization_id,
    )
    result = await session.execute(link_stmt)
    if not result.scalars().first():
        raise HTTPException(
            status_code=403, detail="Not authorized to update this application"
        )

    if app_in.name is not None:
        application.name = app_in.name
    if app_in.rubric_prompt is not None:
        application.rubric_prompt = app_in.rubric_prompt

    session.add(application)
    await session.commit()
    await session.refresh(application)

    # Reload keys for response
    # In a real scenario we might want another DB call or just pass empty if not needed
    # But ApplicationRead structure expects api_key possibly
    # We can just retrieve it again to be safe and consistent with other endpoints
    from sqlalchemy.orm import selectinload

    stmt = (
        select(Application)
        .options(selectinload(Application.api_keys))
        .where(Application.id == application_id)
    )
    result = await session.execute(stmt)
    app_reloaded = result.scalars().first()

    return ApplicationRead(
        id=app_reloaded.id,
        name=app_reloaded.name,
        project_id=app_reloaded.project_id,
        rubric_prompt=app_reloaded.rubric_prompt,
        api_key=app_reloaded.api_keys[0].key if app_reloaded.api_keys else None,
    )


@router.delete("/applications/{application_id}")
async def delete_application(
    application_id: uuid.UUID,
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Any:
    """
    Delete an application and its API keys.
    """
    application = await session.get(Application, application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    # Verify access
    project_res = await session.get(Project, application.project_id)
    link_stmt = select(OrganizationUserLink).where(
        OrganizationUserLink.user_id == current_user.id,
        OrganizationUserLink.organization_id == project_res.organization_id,
    )
    result = await session.execute(link_stmt)
    if not result.scalars().first():
        raise HTTPException(
            status_code=403, detail="Not authorized to delete this application"
        )

    # Check permission
    has_perm = await check_permission(
        session,
        current_user.id,
        project_res.organization_id,
        Permissions.APP_DELETE,
    )
    if not has_perm:
        raise HTTPException(
            status_code=403, detail="Not authorized to delete this application"
        )

    # Delete API keys first
    key_stmt = select(ApiKey).where(ApiKey.application_id == application_id)
    keys = await session.execute(key_stmt)
    for key in keys.scalars().all():
        await session.delete(key)

    await session.delete(application)
    await session.commit()
    return {"status": "deleted"}


@router.post("/api-keys", response_model=ApiKeyRead)
async def create_api_key(
    key_in: ApiKeyCreate,
    current_user: User = Depends(deps.get_current_user),
    session: AsyncSession = Depends(get_session),
) -> Any:
    """
    Create new API key for an application.
    """
    # Verify user has access to application (via project -> org)
    application = await session.get(Application, key_in.application_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    project_res = await session.get(Project, application.project_id)
    link_stmt = select(OrganizationUserLink).where(
        OrganizationUserLink.user_id == current_user.id,
        OrganizationUserLink.organization_id == project_res.organization_id,
    )
    result = await session.execute(link_stmt)
    if not result.scalars().first():
        raise HTTPException(
            status_code=403, detail="Not a member of the application's organization"
        )

    new_key = secrets.token_urlsafe(32)
    api_key_obj = ApiKey(
        key=f"sk-{new_key}", name=key_in.name, application_id=key_in.application_id
    )
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
    Retrieve API keys for applications accessible to the current user.
    """
    # Join ApiKey -> Application -> Project -> Organization -> OrganizationUserLink
    stmt = (
        select(ApiKey)
        .join(Application)
        .join(Project)
        .join(Organization)
        .join(OrganizationUserLink)
        .where(OrganizationUserLink.user_id == current_user.id)
    )
    result = await session.execute(stmt)
    keys = result.scalars().all()
    return keys
