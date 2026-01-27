from typing import List, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from app.api.deps import get_session
from app.models.workflow import Agent, AgentBase

router = APIRouter()

@router.get("/", response_model=List[Agent])
async def read_agents(
    session: AsyncSession = Depends(get_session),
    skip: int = 0,
    limit: int = 100
) -> Any:
    """
    Retrieve agents.
    """
    result = await session.execute(select(Agent).offset(skip).limit(limit))
    agents = result.scalars().all()
    return agents

@router.post("/", response_model=Agent)
async def create_agent(
    *,
    session: AsyncSession = Depends(get_session),
    agent_in: AgentBase
) -> Any:
    """
    Create new agent.
    """
    agent = Agent.model_validate(agent_in)
    session.add(agent)
    await session.commit()
    await session.refresh(agent)
    return agent

@router.get("/{agent_id}", response_model=Agent)
async def read_agent(
    *,
    session: AsyncSession = Depends(get_session),
    agent_id: UUID
) -> Any:
    """
    Get agent by ID.
    """
    agent = await session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent

@router.delete("/{agent_id}", response_model=Agent)
async def delete_agent(
    *,
    session: AsyncSession = Depends(get_session),
    agent_id: UUID
) -> Any:
    """
    Delete agent.
    """
    agent = await session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    await session.delete(agent)
    await session.commit()
    return agent
