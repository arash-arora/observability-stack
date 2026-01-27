from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.database import get_session
from app.models.evaluation_rule import EvaluationRule

router = APIRouter()

@router.get("/", response_model=List[EvaluationRule])
async def list_rules(
    application_id: str = None, 
    db: AsyncSession = Depends(get_session)
):
    query = select(EvaluationRule)
    if application_id:
        query = query.where(EvaluationRule.application_id == application_id)
        
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/", response_model=EvaluationRule)
async def create_rule(
    rule: EvaluationRule, 
    db: AsyncSession = Depends(get_session)
):
    # Validate if application exists? (Optional for now)
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule

@router.delete("/{id}")
async def delete_rule(
    id: int, 
    db: AsyncSession = Depends(get_session)
):
    rule = await db.get(EvaluationRule, id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
        
    await db.delete(rule)
    await db.commit()
    return {"status": "success"}

@router.post("/{id}/toggle", response_model=EvaluationRule)
async def toggle_rule(
    id: int,
    active: bool,
    db: AsyncSession = Depends(get_session)
):
    rule = await db.get(EvaluationRule, id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
        
    rule.active = active
    await db.commit()
    await db.refresh(rule)
    return rule
