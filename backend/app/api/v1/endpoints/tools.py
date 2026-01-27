from typing import List, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from app.api.deps import get_session
from app.models.workflow import Tool, ToolBase

router = APIRouter()

@router.get("/", response_model=List[Tool])
async def read_tools(
    session: AsyncSession = Depends(get_session),
    skip: int = 0,
    limit: int = 100
) -> Any:
    """
    Retrieve tools.
    """
    result = await session.execute(select(Tool).offset(skip).limit(limit))
    tools = result.scalars().all()
    return tools

@router.post("/", response_model=Tool)
async def create_tool(
    *,
    session: AsyncSession = Depends(get_session),
    tool_in: ToolBase
) -> Any:
    """
    Create new tool.
    """
    tool = Tool.model_validate(tool_in)
    session.add(tool)
    await session.commit()
    await session.refresh(tool)
    return tool

@router.get("/{tool_id}", response_model=Tool)
async def read_tool(
    *,
    session: AsyncSession = Depends(get_session),
    tool_id: UUID
) -> Any:
    """
    Get tool by ID.
    """
    tool = await session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    return tool

@router.delete("/{tool_id}", response_model=Tool)
async def delete_tool(
    *,
    session: AsyncSession = Depends(get_session),
    tool_id: UUID
) -> Any:
    """
    Delete tool.
    """
    tool = await session.get(Tool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    await session.delete(tool)
    await session.commit()
    return tool
