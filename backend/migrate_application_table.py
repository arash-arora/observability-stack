import asyncio
from app.core.database import engine
from sqlalchemy import text

async def migrate():
    async with engine.connect() as conn:
        try:
            # Check if column exists
            print("Checking if column exists...")
            result = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='application' AND column_name='rubric_prompt'"))
            if result.fetchone():
                print("Column 'rubric_prompt' already exists.")
            else:
                print("Adding 'rubric_prompt' column to 'application' table...")
                await conn.execute(text("ALTER TABLE application ADD COLUMN rubric_prompt TEXT"))
                await conn.commit()
                print("Migration successful.")
        except Exception as e:
            print(f"Migration failed: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())
