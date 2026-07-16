from typing import List, Optional, Any, Dict
import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select, Session
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_session
from app.core.security import encrypt_value, decrypt_value
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
    provider_config: Optional[Dict] = None
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
    provider_config: Optional[Dict] = None
    is_public: Optional[bool] = None


from datetime import datetime

class LLMProviderRead(BaseModel):
    """Response model that never exposes the raw api_key."""
    id: uuid.UUID
    name: str
    provider: str
    model_name: str
    api_key: str          # Always masked in responses
    base_url: Optional[str] = None
    api_version: Optional[str] = None
    deployment_name: Optional[str] = None
    project_id: uuid.UUID
    user_id: Optional[uuid.UUID] = None
    is_public: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_db(cls, p: LLMProvider) -> "LLMProviderRead":
        return cls(
            id=p.id,
            name=p.name,
            provider=p.provider,
            model_name=p.model_name,
            api_key="sk-***...",  # Never return the encrypted blob
            base_url=p.base_url,
            api_version=p.api_version,
            deployment_name=p.deployment_name,
            project_id=p.project_id,
            user_id=p.user_id,
            is_public=p.is_public,
            created_at=p.created_at,
        )


@router.get("", response_model=List[LLMProviderRead])
async def list_providers(
    project_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    List configured providers, filtered by the current user.
    Optionally filters by project_id if provided.
    The api_key field is always masked in the response.
    """
    if project_id:
        stmt = select(LLMProvider).where(
            LLMProvider.project_id == project_id,
            (LLMProvider.user_id == current_user.id) | (LLMProvider.is_public == True),
        )
    else:
        stmt = select(LLMProvider).where(
            (LLMProvider.user_id == current_user.id) | (LLMProvider.is_public == True),
        )
    result = await db.execute(stmt)
    return [LLMProviderRead.from_db(p) for p in result.scalars().all()]


@router.post("", response_model=LLMProviderRead)
async def create_provider(
    provider_in: CreateProviderRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new LLM provider configuration for the current user.
    The api_key is encrypted before being stored.
    """
    provider_data = provider_in.dict()
    provider_data["user_id"] = current_user.id
    provider_data["api_key"] = encrypt_value(provider_in.api_key)

    provider = LLMProvider(**provider_data)
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    return LLMProviderRead.from_db(provider)


@router.patch("/{id}", response_model=LLMProviderRead)
async def update_provider(
    id: uuid.UUID,
    provider_in: UpdateProviderRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Update a provider configuration.
    If api_key is supplied it will be encrypted before storage.
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
    if "api_key" in update_data and update_data["api_key"]:
        update_data["api_key"] = encrypt_value(update_data["api_key"])

    for key, value in update_data.items():
        setattr(provider, key, value)

    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    return LLMProviderRead.from_db(provider)


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


@router.get("/supported-for-custom-config")
async def get_supported_providers():
    """
    Get the list of LLM providers supported for custom configuration.
    Returns provider names and display labels.
    """
    return {
        "providers": [
            {"name": "OpenAI", "value": "openai"},
            {"name": "Azure OpenAI", "value": "azure"},
            {"name": "Langchain (Groq)", "value": "langchain"},
            {"name": "Anthropic", "value": "anthropic"},
            {"name": "Google", "value": "google"},
        ]
    }


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
        # Decrypt the stored api_key before using it
        plaintext_api_key = decrypt_value(provider_config.api_key)

        # Determine provider type and call via LiteLLM
        import litellm

        if provider_config.provider == "openai":
            response = await litellm.acompletion(
                model=provider_config.model_name,
                messages=[{"role": "user", "content": request.input_text}],
                api_key=plaintext_api_key,
            )
            return {"output": response.choices[0].message.content}

        elif provider_config.provider == "azure":
            model_str = f"azure/{provider_config.deployment_name or provider_config.model_name}"
            response = await litellm.acompletion(
                model=model_str,
                messages=[{"role": "user", "content": request.input_text}],
                api_key=plaintext_api_key,
                api_base=provider_config.base_url,
                api_version=provider_config.api_version,
            )
            return {"output": response.choices[0].message.content}

        elif provider_config.provider == "langchain":
            model_str = provider_config.model_name
            if not model_str.startswith("groq/"):
                model_str = f"groq/{model_str}"
            response = await litellm.acompletion(
                model=model_str,
                messages=[{"role": "user", "content": request.input_text}],
                api_key=plaintext_api_key,
            )
            return {"output": response.choices[0].message.content}

        elif provider_config.provider == "huggingface":
            config_data = provider_config.provider_config or {}
            endpoint = config_data.get('inference_endpoint')
            
            call_kwargs = {
                "model": f"huggingface/{provider_config.model_name}",
                "messages": [{"role": "user", "content": request.input_text}],
                "api_key": plaintext_api_key,
            }
            if endpoint:
                call_kwargs["api_base"] = endpoint

            response = await litellm.acompletion(**call_kwargs)
            return {"output": response.choices[0].message.content}

        elif provider_config.provider == "bedrock":
            config_data = provider_config.provider_config or {}
            model_str = provider_config.model_name
            if not model_str.startswith("bedrock/"):
                model_str = f"bedrock/{model_str}"

            response = await litellm.acompletion(
                model=model_str,
                messages=[{"role": "user", "content": request.input_text}],
                aws_access_key_id=config_data.get('aws_access_key_id'),
                aws_secret_access_key=config_data.get('aws_secret_access_key'),
                aws_session_token=config_data.get('aws_session_token'),
                aws_region_name=config_data.get('aws_region'),
            )
            return {"output": response.choices[0].message.content}

        elif provider_config.provider == "vertexai":
            import json
            config_data = provider_config.provider_config or {}
            credentials_json = config_data.get('gcp_credentials', '{}')
            if isinstance(credentials_json, str):
                try:
                    credentials_dict = json.loads(credentials_json)
                except:
                    credentials_dict = {}
            else:
                credentials_dict = credentials_json

            model_str = provider_config.model_name
            if not model_str.startswith("vertex_ai/"):
                model_str = f"vertex_ai/{model_str}"

            response = await litellm.acompletion(
                model=model_str,
                messages=[{"role": "user", "content": request.input_text}],
                vertex_credentials=credentials_dict,
                vertex_project=config_data.get('gcp_project_id'),
                vertex_location=config_data.get('gcp_location'),
            )
            return {"output": response.choices[0].message.content}

        elif provider_config.provider == "anthropic":
            model_str = provider_config.model_name
            if not model_str.startswith("anthropic/"):
                model_str = f"anthropic/{model_str}"
            response = await litellm.acompletion(
                model=model_str,
                messages=[{"role": "user", "content": request.input_text}],
                api_key=plaintext_api_key,
            )
            return {"output": response.choices[0].message.content}

        elif provider_config.provider == "google":
            model_str = provider_config.model_name
            if not model_str.startswith("gemini/"):
                model_str = f"gemini/{model_str}"
            response = await litellm.acompletion(
                model=model_str,
                messages=[{"role": "user", "content": request.input_text}],
                api_key=plaintext_api_key,
            )
            return {"output": response.choices[0].message.content}

        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported provider type: {provider_config.provider}",
            )

    except Exception as e:
        logger.error(f"Provider Test Failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
