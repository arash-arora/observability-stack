#!/usr/bin/env python3
"""
Clear all evaluations from the PostgreSQL database.
"""

import asyncio
from sqlalchemy import delete
from sqlmodel import select
from app.core.database import engine, AsyncSession
from app.models.evaluation_result import EvaluationResult


async def clear_evaluations():
    """Delete all records from the EvaluationResult table."""
    async_session = AsyncSession(bind=engine)
    
    try:
        # Count before deletion
        result = await async_session.execute(select(EvaluationResult))
        count_before = len(result.scalars().all())
        print(f"📊 Evaluations before deletion: {count_before}")
        
        # Delete all evaluations
        stmt = delete(EvaluationResult)
        await async_session.execute(stmt)
        await async_session.commit()
        
        # Count after deletion
        result = await async_session.execute(select(EvaluationResult))
        count_after = len(result.scalars().all())
        print(f"✅ Evaluations after deletion: {count_after}")
        
        if count_before > 0:
            print(f"🗑️  Deleted {count_before} evaluation(s)")
        else:
            print("ℹ️  No evaluations to delete")
            
    except Exception as e:
        print(f"❌ Error clearing evaluations: {e}")
        raise
    finally:
        await async_session.close()


if __name__ == "__main__":
    asyncio.run(clear_evaluations())
