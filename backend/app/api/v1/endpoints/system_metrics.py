from fastapi import APIRouter, HTTPException
from app.core.clickhouse import get_clickhouse_client
from typing import List, Optional
import uuid

router = APIRouter(prefix="/system-metrics", tags=["metrics"])


@router.get("/")
async def get_system_metrics(
    project_id: uuid.UUID,
    metric_types: List[str],
    time_range: str = "1h",
    application_name: Optional[str] = None
):
    """Get system metrics from ClickHouse"""
    client = get_clickhouse_client()

    # Parse time range
    if time_range.endswith('h'):
        interval_str = f"{time_range}"
    elif time_range.endswith('d'):
        interval_str = f"{time_range}"
    elif time_range.endswith('m'):
        interval_str = f"{time_range[:-1]} MINUTE"
    else:
        interval_str = "1h"

    # Build query
    metric_types_str = ", ".join([f"'{mt}'" for mt in metric_types])

    query = f"""
    SELECT
        metric_type,
        application_name,
        timestamp,
        value,
        count
    FROM system_metrics
    WHERE project_id = '{project_id}'
      AND metric_type IN ({metric_types_str})
      AND timestamp >= now() - INTERVAL {interval_str}
    """

    if application_name:
        query += f" AND application_name = '{application_name}'"

    query += " ORDER BY timestamp DESC"

    try:
        result = client.query(query)
        rows = result.result_rows

        # Format response
        metrics = []
        for row in rows:
            metrics.append({
                "metric_type": row[0],
                "application_name": row[1],
                "timestamp": row[2],
                "value": row[3],
                "count": row[4]
            })

        return {"metrics": metrics}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch metrics: {str(e)}")


@router.get("/summary")
async def get_metrics_summary(
    project_id: uuid.UUID,
    time_range: str = "1h",
    application_name: Optional[str] = None
):
    """Get aggregated summary of system metrics"""
    client = get_clickhouse_client()

    # Parse time range
    if time_range.endswith('h'):
        interval_str = f"{time_range}"
    elif time_range.endswith('d'):
        interval_str = f"{time_range}"
    elif time_range.endswith('m'):
        interval_str = f"{time_range[:-1]} MINUTE"
    else:
        interval_str = "1h"

    query = f"""
    SELECT
        metric_type,
        application_name,
        avg(value) as avg_value,
        max(value) as max_value,
        min(value) as min_value,
        count() as data_points
    FROM system_metrics
    WHERE project_id = '{project_id}'
      AND timestamp >= now() - INTERVAL {interval_str}
    """

    if application_name:
        query += f" AND application_name = '{application_name}'"

    query += " GROUP BY metric_type, application_name"

    try:
        result = client.query(query)
        rows = result.result_rows

        summary = []
        for row in rows:
            summary.append({
                "metric_type": row[0],
                "application_name": row[1],
                "avg_value": row[2],
                "max_value": row[3],
                "min_value": row[4],
                "data_points": row[5]
            })

        return {"summary": summary}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch summary: {str(e)}")
