import asyncio
import sys
import os

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlmodel import select, delete, text

# We assume we are running this as a module or with PYTHONPATH set to /app
from app.core.database import engine, init_db
from app.models.metric import Metric
from app.api.v1.endpoints.data.metric_data import STATIC_METRICS_REGISTRY

async def sync_metrics():
    print("Starting metrics synchronization...")
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as session:
        # 1. Drop existing table to force schema update
        print("Dropping metric table to ensure schema update...")
        await session.execute(text("DROP TABLE IF EXISTS metric"))
        await session.commit()
    
    # 2. Re-initialize DB (recreates table with new schema)
    print("Re-initializing database...")
    await init_db()
    
    async with async_session() as session:
        created_count = 0
        
        # 3. Add metrics from registry
        print("Populating metrics...")
        for info in STATIC_METRICS_REGISTRY:
            metric_data = {
                "id": info.id,
                "name": info.name,
                "description": info.description,
                "provider": info.provider,
                "type": info.type,
                "tags": info.tags,
                "inputs": info.inputs,
                "code_snippet": info.code_snippet,
                "prompt": info.prompt,
                "dummy_data": info.dummy_data
            }
            
            new_metric = Metric(**metric_data)
            session.add(new_metric)
            created_count += 1
            print(f"Created: {info.id}")
        
        await session.commit()
        print(f"Done. Created: {created_count}")

if __name__ == "__main__":
    asyncio.run(sync_metrics())
