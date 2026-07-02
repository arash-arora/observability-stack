from app.models.drift_metric import DataDriftMetric
from app.core.database import get_session
from app.core.clickhouse import get_clickhouse_client
import numpy as np
import logging

logger = logging.getLogger(__name__)


async def compute_drift_metrics():
    """Scheduled job - compute drift for all active applications"""
    logger.info("Computing drift metrics...")

    try:
        # TODO: Implement drift detection logic
        # 1. Get all active applications
        # 2. For each application, fetch baseline and current data
        # 3. Calculate PSI, KS test, etc.
        # 4. Store results in data_drift_metric table
        pass

    except Exception as e:
        logger.error(f"Drift detection job failed: {e}")


def calculate_psi(baseline: np.ndarray, current: np.ndarray, bins: int = 10) -> float:
    """Calculate Population Stability Index"""
    try:
        baseline_hist, bin_edges = np.histogram(baseline, bins=bins)
        current_hist, _ = np.histogram(current, bins=bin_edges)

        baseline_pct = baseline_hist / len(baseline)
        current_pct = current_hist / len(current)

        # Avoid division by zero
        baseline_pct = np.where(baseline_pct == 0, 0.0001, baseline_pct)
        current_pct = np.where(current_pct == 0, 0.0001, current_pct)

        psi = np.sum((current_pct - baseline_pct) * np.log(current_pct / baseline_pct))
        return float(psi)
    except Exception as e:
        logger.error(f"PSI calculation failed: {e}")
        return 0.0


def calculate_ks_test(baseline: np.ndarray, current: np.ndarray):
    """Kolmogorov-Smirnov test"""
    try:
        from scipy import stats
        statistic, p_value = stats.ks_2samp(baseline, current)
        return statistic, p_value
    except Exception as e:
        logger.error(f"KS test calculation failed: {e}")
        return 0.0, 1.0
