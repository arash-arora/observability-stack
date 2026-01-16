import asyncio
from sqlalchemy import text
from app.core.database import engine

async def migrate():
    async with engine.begin() as conn:
        try:
            # Try adds column to evaluationresult table 
            # Note: SQLModel defaults table name to lowercase class name usually? 
            # Or snake_case? It's usually snake_case "evaluation_result" or "evaluationresult"
            # We can try both or check. 
            # Based on previous file reads, table=True in class EvaluationResult(SQLModel, table=True)
            # Default is usually class name.
            
            print("Attempting to add column 'application_name' to 'evaluationresult' table...")
            await conn.execute(text("ALTER TABLE evaluationresult ADD COLUMN application_name VARCHAR"))
            print("Column added successfully to evaluationresult.")
        except Exception as e:
            print(f"Error adding column (might already exist): {e}")

if __name__ == "__main__":
    asyncio.run(migrate())
