from typing import List, Optional, Any, Dict
import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select, Session
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_session
from app.models.llm_provider import LLMProvider
from app.api.deps import get_current_user
from app.models.all_models import User
import importlib

router = APIRouter()
logger = logging.getLogger(__name__)


# Schema for Test Request
class TestProviderRequest(BaseModel):
    provider_id: uuid.UUID
    input_text: str


class CreateProviderRequest(BaseModel):
    name: str
    provider: str
    model_name: str
    api_key: str
    base_url: Optional[str] = None
    api_version: Optional[str] = None
    deployment_name: Optional[str] = None
    deployment_name: Optional[str] = None
    project_id: uuid.UUID
    is_public: bool = False


class UpdateProviderRequest(BaseModel):
    name: Optional[str] = None
    provider: Optional[str] = None
    model_name: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    api_version: Optional[str] = None
    deployment_name: Optional[str] = None
    is_public: Optional[bool] = None


@router.get("/", response_model=List[LLMProvider])
async def list_providers(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    List configured providers for a project, filtered by the current user.
    """
    stmt = select(LLMProvider).where(
        LLMProvider.project_id == project_id,
        (LLMProvider.user_id == current_user.id) | (LLMProvider.is_public == True),
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/", response_model=LLMProvider)
async def create_provider(
    provider_in: CreateProviderRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new LLM provider configuration for the current user.
    """
    provider_data = provider_in.dict()
    provider_data["user_id"] = current_user.id

    provider = LLMProvider(**provider_data)
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    await db.refresh(provider)
    return provider


@router.patch("/{id}", response_model=LLMProvider)
async def update_provider(
    id: uuid.UUID,
    provider_in: UpdateProviderRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Update a provider configuration.
    """
    provider = await db.get(LLMProvider, id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    # Check ownership
    if provider.user_id and provider.user_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to update this provider"
        )

    update_data = provider_in.dict(exclude_unset=True)

    for key, value in update_data.items():
        setattr(provider, key, value)

    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    return provider


@router.delete("/{id}")
async def delete_provider(
    id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a provider configuration.
    """
    provider = await db.get(LLMProvider, id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    # Check ownership
    if provider.user_id and provider.user_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to delete this provider"
        )

    await db.delete(provider)
    await db.commit()
    return {"status": "success"}


@router.post("/test")
async def test_provider(
    request: TestProviderRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Test a provider configuration by sending a test message.
    """
    provider_config = await db.get(LLMProvider, request.provider_id)
    if not provider_config:
        raise HTTPException(status_code=404, detail="Provider configuration not found")

    try:
        # Dynamic import to avoid heavy dependencies if unused
        from observix import llm

        # Determine provider type and instantiate client
        client = None

        if provider_config.provider == "openai":
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=provider_config.api_key)

            response = await client.chat.completions.create(
                model=provider_config.model_name,
                messages=[{"role": "user", "content": request.input_text}],
            )
            return {"output": response.choices[0].message.content}

        elif provider_config.provider == "azure":
            from openai import AsyncAzureOpenAI

            client = AsyncAzureOpenAI(
                api_key=provider_config.api_key,
                azure_endpoint=provider_config.base_url,
                api_version=provider_config.api_version,
                azure_deployment=provider_config.deployment_name,
            )

            # Use deployment name as model if not specified, or model_name if deployment is separate
            # Usually in Azure SDK, model kwarg is ignored or same as deployment
            response = await client.chat.completions.create(
                model=provider_config.deployment_name or provider_config.model_name,
                messages=[{"role": "user", "content": request.input_text}],
            )
            return {"output": response.choices[0].message.content}

        elif provider_config.provider == "langchain":
            from langchain_groq import ChatGroq

            # Assuming Langchain == Groq based on user request "Langchain - only groq"
            # But "langchain" suggests generic.
            # User requirement: "1. Langchain - only groq -> only api key is required and model name"

            chat = ChatGroq(
                api_key=provider_config.api_key, model_name=provider_config.model_name
            )
            from langchain_core.messages import HumanMessage

            response = await chat.ainvoke([HumanMessage(content=request.input_text)])
            return {"output": response.content}

        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported provider type: {provider_config.provider}",
            )

    except Exception as e:
        logger.error(f"Provider Test Failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
