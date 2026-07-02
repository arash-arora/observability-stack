from app.models.alert_rule import AlertRule
from app.services.alert_runner import AlertRunner
from app.core.database import get_session_ctx
from sqlmodel import select
import asyncio
import logging

logger = logging.getLogger(__name__)


async def run_all_alert_checks():
    """Scheduled job - runs every minute"""
    logger.info("Running alert checks...")

    try:
        async with get_session_ctx() as session:
            stmt = select(AlertRule).where(AlertRule.active == True)
            result = await session.execute(stmt)
            rules = result.scalars().all()

            logger.info(f"Checking {len(rules)} active alert rules")

            # Run checks in parallel
            runner = AlertRunner()
            tasks = [runner.run_alert_check(rule) for rule in rules]
            await asyncio.gather(*tasks, return_exceptions=True)

    except Exception as e:
        logger.error(f"Alert check job failed: {e}")
