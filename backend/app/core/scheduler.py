from apscheduler.schedulers.asyncio import AsyncIOScheduler
import logging

logger = logging.getLogger(__name__)
scheduler = None


def init_scheduler():
    global scheduler

    # Use the default in-memory store. SQLAlchemyJobStore expects a sync SQLAlchemy
    # engine/url, while this service uses an async database URL.
    scheduler = AsyncIOScheduler()

    # System metric alert checks - every 1 minute
    scheduler.add_job(
        'app.services.alert_checker:run_all_alert_checks',
        'interval',
        minutes=1,
        id='alert_checker',
        replace_existing=True
    )

    # Drift detection - every hour
    scheduler.add_job(
        'app.services.drift_detector:compute_drift_metrics',
        'interval',
        hours=1,
        id='drift_detector',
        replace_existing=True
    )

    # Model quality metrics - every 6 hours
    scheduler.add_job(
        'app.services.quality_monitor:compute_quality_metrics',
        'interval',
        hours=6,
        id='quality_monitor',
        replace_existing=True
    )

    scheduler.start()
    logger.info("Scheduler started successfully")

    return scheduler


def shutdown_scheduler():
    global scheduler
    if scheduler:
        scheduler.shutdown()
        logger.info("Scheduler shut down")
