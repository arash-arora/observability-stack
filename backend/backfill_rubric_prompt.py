import asyncio
from app.core.database import engine
from sqlalchemy import text

DEFAULT_RUBRIC = """CONSISTENT SCORING GUIDELINES:
Score Distribution:
•  90-100 (Exceptional): Top 10% performance, benchmark quality
•  70-80 (Proficient): Top 25% performance, production ready
•  50-60 (Adequate): Meets basic requirements, needs optimization
•  30-40 (Below Standard): Significant issues, requires improvement
•  10-20 (Unacceptable): Critical failures, not functional
Scoring Criteria:
•  Score based on OBJECTIVE evidence from trace data
•  Each score band must have specific, measurable criteria
•  Consistency across all evaluation dimensions
•  No score inflation - use full 1-10 range appropriately"""

async def backfill_rubric():
    async with engine.connect() as conn:
        try:
            print("Backfilling default rubric prompt for existing applications...")
            # Use parametrized query to avoid SQL injection issues with multiline string, 
            # though here it is a constant.
            await conn.execute(
                text("UPDATE application SET rubric_prompt = :prompt WHERE rubric_prompt IS NULL"),
                {"prompt": DEFAULT_RUBRIC}
            )
            await conn.commit()
            print("Backfill successful.")
        except Exception as e:
            print(f"Backfill failed: {e}")

if __name__ == "__main__":
    asyncio.run(backfill_rubric())
