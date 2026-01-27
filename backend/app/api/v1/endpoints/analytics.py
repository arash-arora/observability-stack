from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.clickhouse import get_clickhouse_client
from app.core.database import get_session
from app.api.deps import get_current_user
from app.models.all_models import User
from app.models.evaluation_result import EvaluationResult
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/traces")
async def get_traces(
    project_id: str,
    limit: int = 50,
    offset: int = 0,
    search: Optional[str] = None,
    status: Optional[List[str]] = Query(None),
    name: Optional[List[str]] = Query(None),
    application: Optional[List[str]] = Query(None),
    sort_by: Optional[str] = None,
    order: Optional[str] = 'desc',
    from_ts: Optional[float] = None,
    to_ts: Optional[float] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Get list of traces for a project with input/output preview.
    """
    client = get_clickhouse_client()
    
    where_clause = f"t.project_id = '{project_id}' AND t.parent_span_id IS NULL"
    
    if from_ts:
        where_clause += f" AND t.start_time >= toDateTime64({from_ts}, 9)"
    if to_ts:
        where_clause += f" AND t.start_time <= toDateTime64({to_ts}, 9)"

    if search:
        # Simple search on name or trace_id for now
        where_clause += f" AND (t.name ILIKE '%{search}%' OR t.trace_id ILIKE '%{search}%')"

    if status:
        mapped_status = []
        for s in status:
            if s == 'SUCCESS':
                mapped_status.extend(['OK', 'UNSET'])
            elif s == 'ERROR':
                mapped_status.append('ERROR')
            else:
                mapped_status.append(s)
        
        # Remove duplicates
        mapped_status = list(set(mapped_status))
        status_list = "', '".join(mapped_status)
        where_clause += f" AND t.status_code IN ('{status_list}')"
        
    if name:
        name_list = "', '".join(name)
        where_clause += f" AND t.name IN ('{name_list}')"

    if application:
        app_list = "', '".join(application)
        where_clause += f" AND t.application_name IN ('{app_list}')"



    # Sorting Logic
    sort_column_map = {
        'timestamp': 't.start_time',
        'start_time': 't.start_time',
        'name': 't.name',
        'latency': 't.duration_ms',
        'duration': 't.duration_ms',
        'tokens': 'o_metrics.total_tokens'
    }
    
    order_clause = "t.start_time DESC"
    if sort_by and sort_by in sort_column_map:
        col = sort_column_map[sort_by]
        direction = "ASC" if order and order.lower() == 'asc' else "DESC"
        order_clause = f"{col} {direction}"
    
    query = f"""
    SELECT 
        t.trace_id, 
        t.name, 
        t.start_time, 
        t.end_time, 
        t.duration_ms, 
        t.status_code, 
        t.user_id,
        o_first.input_text,
        o_last.output_text,
        o_metrics.total_tokens,
        0.0 as total_cost, -- Placeholder for cost calculation
        t.attributes, -- Metadata
        t.application_name
    FROM traces t
    LEFT JOIN (
        SELECT trace_id, input_text
        FROM observations
        WHERE project_id = '{project_id}'
        ORDER BY start_time ASC
        LIMIT 1 BY trace_id
    ) o_first ON t.trace_id = o_first.trace_id
    LEFT JOIN (
        SELECT trace_id, output_text
        FROM observations
        WHERE project_id = '{project_id}'
        ORDER BY start_time DESC
        LIMIT 1 BY trace_id
    ) o_last ON t.trace_id = o_last.trace_id
    LEFT JOIN (
        SELECT 
            trace_id, 
            sum(
                CASE 
                    WHEN isValidJSON(token_usage) THEN 
                    COALESCE(JSONExtractInt(token_usage, 'total_tokens'), 0)
                    ELSE 0 
                END
            ) as total_tokens
        FROM observations
        WHERE project_id = '{project_id}'
        GROUP BY trace_id
    ) o_metrics ON t.trace_id = o_metrics.trace_id
    WHERE {where_clause} AND (t.parent_span_id IS NULL OR t.parent_span_id = '')
    ORDER BY {order_clause}
    LIMIT {limit} OFFSET {offset}
    """
    
    try:
        result = client.query(query)
        traces = []
        for row in result.result_rows:
            # Estimate cost based on tokens (very rough mock: $0.000002 per token)
            tokens = row[9] or 0
            est_cost = tokens * 0.000002
            
            traces.append({
                "trace_id": row[0],
                "name": row[1],
                "start_time": row[2],
                "end_time": row[3],
                "duration_ms": row[4],
                "status_code": row[5],
                "user_id": row[6],
                "input": row[7],
                "output": row[8],
                "total_tokens": tokens,
                "total_cost": est_cost,
                "metadata": row[11], # Map
                "application_name": row[12]
            })
        return traces
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/traces/applications")
async def get_application_names(
    project_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get unique application names for a project to populate filters.
    """
    client = get_clickhouse_client()
    query = f"""
    SELECT DISTINCT application_name 
    FROM traces 
    WHERE project_id = '{project_id}' AND parent_span_id IS NULL AND application_name IS NOT NULL
    ORDER BY application_name ASC
    """
    try:
        result = client.query(query)
        names = [row[0] for row in result.result_rows]
        return names
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/traces/names")
async def get_trace_names(
    project_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get unique trace names for a project to populate filters.
    """
    client = get_clickhouse_client()
    query = f"""
    SELECT DISTINCT name 
    FROM traces 
    WHERE project_id = '{project_id}' AND parent_span_id IS NULL
    ORDER BY name ASC
    """
    try:
        result = client.query(query)
        names = [row[0] for row in result.result_rows]
        return names
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/traces/{trace_id}")
async def get_trace_details(
    trace_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get full trace details including all spans and observations.
    """
    client = get_clickhouse_client()
    
    # Fetch all spans for this trace
    spans_query = f"""
    SELECT 
        trace_id, span_id, parent_span_id, name, kind, start_time, end_time, 
        status_code, status_message, attributes, events, links, duration_ms, application_name
    FROM traces 
    WHERE trace_id = '{trace_id}'
    ORDER BY start_time ASC
    """
    
    # Fetch all observations for this trace
    # IMPORTANT: Ensure we select all columns needed for the UI
    obs_query = f"""
    SELECT 
        id, parent_observation_id, name, type, model, start_time, end_time, 
        input_text, output_text, token_usage, model_parameters, metadata_json, 
        extra, observation_type, error, total_cost
    FROM observations
    WHERE trace_id = '{trace_id}'
    ORDER BY start_time ASC
    """
    
    try:
        spans_res = client.query(spans_query)
        obs_res = client.query(obs_query)

        contexts = {}
        
        spans = []
        for row in spans_res.result_rows:
            spans.append({
                "trace_id": row[0],
                "span_id": row[1],
                "parent_span_id": row[2],
                "name": row[3],
                "kind": row[4],
                "start_time": row[5],
                "end_time": row[6],
                "status_code": row[7],
                "status_message": row[8],
                "attributes": row[9],
                # "events": row[10], # JSON string, maybe parse if needed
                "duration_ms": row[12],
                "application_name": row[13],
                "type": "span" # UI helper
            })
            
        observations = []
        for row in obs_res.result_rows:
            # Handle potential None for parent_observation_id string conversion
            parent_id = str(row[1]) if row[1] and str(row[1]) != '0' else None
            
            observations.append({
                "id": str(row[0]), 
                "parent_observation_id": parent_id,
                "name": row[2],
                "type": row[3], 
                "model": row[4],
                "start_time": row[5],
                "end_time": row[6],
                "input": row[7],
                "output": row[8],
                "usage": row[9],
                "metadata_json": row[11],
                "error": row[14],
                "total_cost": row[15],
                "is_observation": True
            })
            
        return {
            "spans": spans,
            "observations": observations
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/dashboard")
async def get_dashboard_stats(
    project_id: str,
    from_ts: Optional[float] = None, # Optional timestamp filter
    to_ts: Optional[float] = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Get aggregated dashboard statistics for a project.
    """
    client = get_clickhouse_client()
    
    # Defaults to last 7 days if not provided
    # For now we query everything for simplicity in demo
    where_clause = f"project_id = '{project_id}'"
    
    # 1. Total Traces
    # 1. Total Traces & Tokens over Time
    # We want two series: Traces count and Token usage
    traces_query = f"""
    SELECT 
        count() as trace_count, 
        toStartOfHour(start_time) as time,
        sum(duration_ms) as total_latency
    FROM traces
    WHERE {where_clause} AND (parent_span_id IS NULL OR parent_span_id = '')
    GROUP BY time
    ORDER BY time ASC
    """

    tokens_series_query = f"""
    SELECT 
        toStartOfHour(start_time) as time,
        sum(
            CASE 
                WHEN isValidJSON(token_usage) THEN 
                COALESCE(JSONExtractInt(token_usage, 'total_tokens'), 0)
                ELSE 0 
            END
        ) as total_tokens
    FROM observations
    WHERE {where_clause}
    GROUP BY time
    ORDER BY time ASC
    """
    
    # 2. Total Observations (Scores, Generations)
    scores_query = f"""
    SELECT name, count(), avg(toFloat64OrZero(output_text))
    FROM observations
    WHERE {where_clause} AND type = 'score'
    GROUP BY name
    """
    
    # 3. Model Usage & Cost
    models_query = f"""
    SELECT 
        if(model = '' OR model IS NULL, 'Unknown', model) as model_name, 
        count() as call_count,
        sum(
            CASE 
                WHEN isValidJSON(token_usage) THEN 
                COALESCE(JSONExtractInt(token_usage, 'total_tokens'), 0)
                ELSE 0 
            END
        ) as total_tokens,
        sum(total_cost) as total_cost
    FROM observations
    WHERE {where_clause}
    GROUP BY model_name
    """
    
    # ... (lat queries) ...


    
    # 4. Latency Percentiles
    # Traces
    trace_lat_query = f"""
    SELECT name, 
           quantile(0.50)(duration_ms) as p50, 
           quantile(0.90)(duration_ms) as p90, 
           quantile(0.95)(duration_ms) as p95, 
           quantile(0.99)(duration_ms) as p99
    FROM traces
    WHERE {where_clause} AND parent_span_id IS NULL
    GROUP BY name
    """

    # Traces (Time Series) - Apps
    # We want requests over time grouped by application
    # This might be heavy if many apps. Let's do top 5 apps or just simple aggregation.
    # For stacked bar, we need time buckets and counts per app.
    # ClickHouse can do: group by time, application_name
    app_series_query = f"""
    SELECT 
        toStartOfHour(start_time) as time,
        if(application_name = '' OR application_name IS NULL, 'Unknown', application_name) as app,
        count() as count
    FROM traces
    WHERE {where_clause} AND (parent_span_id IS NULL OR parent_span_id = '')
    GROUP BY time, app
    ORDER BY time ASC
    """

    # 5. Application Metrics (Requests, Latency, Errors)
    apps_query = f"""
    SELECT 
        if(application_name = '' OR application_name IS NULL, 'Unknown', application_name) as app,
        count() as request_count,
        avg(duration_ms) as avg_latency,
        countIf(status_code = 'ERROR') as error_count,
        count() as total_count
    FROM traces
    WHERE {where_clause} AND (parent_span_id IS NULL OR parent_span_id = '')
    GROUP BY app
    """
    
    # 6. App Cost & Tokens (Need to join with observations)
    # Note: ClickHouse JOINs can be tricky. We can try to aggregate obs by trace_id first, then join traces.
    # Or simplified: if trace has app_name, all its obs belong to that app. 
    # But obs table doesn't have app_name usually (unless denormalized).
    # Traces table has app_name. 
    # Let's try a strict join or IN clause if performance allows. 
    # Actually, we can just join ON trace_id.
    app_cost_query = f"""
    SELECT 
        if(t.application_name = '' OR t.application_name IS NULL, 'Unknown', t.application_name) as app,
        sum(o.total_cost) as total_cost,
        sum(
             CASE 
                WHEN isValidJSON(o.token_usage) THEN 
                COALESCE(JSONExtractInt(o.token_usage, 'total_tokens'), 0)
                ELSE 0 
            END
        ) as total_tokens
    FROM traces t
    INNER JOIN observations o ON t.trace_id = o.trace_id
    WHERE {where_clause.replace("project_id", "t.project_id")} 
      AND (t.parent_span_id IS NULL OR t.parent_span_id = '')
    GROUP BY app
    """

    # 7. Global Status Distribution
    status_dist_query = f"""
    SELECT 
        status_code,
        count()
    FROM traces
    WHERE {where_clause} AND (parent_span_id IS NULL OR parent_span_id = '')
    GROUP BY status_code
    """
    
    # 8. Token Split (Prompt vs Completion)
    token_split_query = f"""
    SELECT 
        sum(
             CASE 
                WHEN isValidJSON(token_usage) THEN 
                COALESCE(JSONExtractInt(token_usage, 'prompt_tokens'), 0)
                ELSE 0 
            END
        ) as total_prompt,
        sum(
             CASE 
                WHEN isValidJSON(token_usage) THEN 
                COALESCE(JSONExtractInt(token_usage, 'completion_tokens'), 0)
                ELSE 0 
            END
        ) as total_completion
    FROM observations
    WHERE {where_clause}
    """
    
    # 9. Top Users
    user_vol_query = f"""
    SELECT 
        if(user_id = '' OR user_id IS NULL, 'Unknown', user_id) as user,
        count() as count
    FROM traces
    WHERE {where_clause} AND (parent_span_id IS NULL OR parent_span_id = '') AND user_id != ''
    GROUP BY user
    ORDER BY count DESC
    LIMIT 10
    """
    
    # 10. Generation Speed
    # tokens / duration(s)
    gen_speed_query = f"""
    SELECT
        if(model = '' OR model IS NULL, 'Unknown', model) as model_name,
        avg(
            CASE 
                WHEN (isValidJSON(token_usage) OR token_usage LIKE '{{%') THEN
                     COALESCE(JSONExtractInt(token_usage, 'total_tokens'), 0) / 
                     (GREATEST(dateDiff('millisecond', start_time, end_time), 1) / 1000)
                ELSE 0
            END
        ) as tokens_per_sec
    FROM observations
    WHERE {where_clause} 
      AND (isValidJSON(token_usage) OR token_usage LIKE '{{%')
      AND model != '' AND model IS NOT NULL
    GROUP BY model_name
    """
    
    # Generations (observations type='generation')
    gen_lat_query = f"""
    SELECT model, 
           quantile(0.50)(dateDiff('millisecond', start_time, end_time)) as p50, 
           quantile(0.90)(dateDiff('millisecond', start_time, end_time)) as p90, 
           quantile(0.95)(dateDiff('millisecond', start_time, end_time)) as p95, 
           quantile(0.99)(dateDiff('millisecond', start_time, end_time)) as p99
    FROM observations
    WHERE {where_clause} AND model IS NOT NULL AND model != ''
    GROUP BY model
    """
    
    try:
        # Execute queries
        traces_res = client.query(traces_query)
        tokens_series_res = client.query(tokens_series_query)
        scores_res = client.query(scores_query)
        models_res = client.query(models_query)
        trace_lat_res = client.query(trace_lat_query)
        gen_lat_res = client.query(gen_lat_query)
        
        # New Queries Execution
        app_series_res = client.query(app_series_query)
        apps_res = client.query(apps_query)
        app_cost_res = client.query(app_cost_query)
        status_dist_res = client.query(status_dist_query)
        token_split_res = client.query(token_split_query)
        user_vol_res = client.query(user_vol_query)
        gen_speed_res = client.query(gen_speed_query)
        
        # Process Traces (Time Series)
        trace_series = []
        total_traces = 0
        for row in traces_res.result_rows:
            count = row[0]
            time_bucket = row[1] # datetime object
            total_traces += count
            trace_series.append({
                "time": time_bucket.strftime("%I:%M %p"), # Format 06:30 PM
                "traces": count
            })
            
        # Process App Series
        # Map: time -> { app: count }
        app_series_map = {}
        apps_set = set()
        for row in app_series_res.result_rows:
            time_str = row[0].strftime("%I:%M %p")
            app = row[1]
            count = row[2]
            apps_set.add(app)
            if time_str not in app_series_map:
                app_series_map[time_str] = {}
            app_series_map[time_str][app] = count
            
        app_series = []
        for t, counts in app_series_map.items():
            entry = {"time": t}
            for app in apps_set:
                entry[app] = counts.get(app, 0)
            app_series.append(entry)
        # Sort by time string roughly works for 24h, but ideally sort by original objects. 
        # Since traces_res is sorted, maybe combine logic? 
        # For simple demo, this dictionary iteration order might be roughly insert order (py3.7+).
            
        # Process Tokens Series
        token_series = []
        for row in tokens_series_res.result_rows:
             time_bucket = row[0]
             tokens = row[1]
             token_series.append({
                 "time": time_bucket.strftime("%I:%M %p"),
                 "tokens": tokens
             })

        # Process Scores
        scores_stats = []
        total_scores = 0
        for row in scores_res.result_rows:
             count = row[1]
             total_scores += count
             scores_stats.append({
                 "name": row[0],
                 "count": count,
                 "avg": round(row[2], 2)
             })
             
        # Process Models & Cost
        model_stats = []
        total_cost = 0.0
        total_tokens_sum = 0
        
        for row in models_res.result_rows:
            model_name = row[0] or "unknown"
            call_count = row[1]
            total_tokens = row[2]
            model_cost = row[3] or 0.0 # Use stored cost
            
            # Fallback if stored cost is 0 but we have tokens
            if model_cost == 0 and total_tokens > 0:
                model_cost = total_tokens * 0.000002
            
            total_cost += model_cost
            total_tokens_sum += total_tokens
            
            model_stats.append({
                "model": model_name,
                "count": call_count,
                "tokens": total_tokens,
                "cost": round(model_cost, 4)
            })
            
        # Process Apps Metrics
        apps_metrics_map = {}
        for row in apps_res.result_rows:
            app = row[0]
            apps_metrics_map[app] = {
                "name": app,
                "request_count": row[1],
                "avg_latency": round(row[2], 2),
                "error_count": row[3],
                "total_count": row[4],
                # Derived
                "error_rate": round((row[3] / row[4]) * 100, 2) if row[4] > 0 else 0,
                "total_cost": 0.0,
                "total_tokens": 0
            }
            
        # Merge Cost info into Apps Metrics
        for row in app_cost_res.result_rows:
            app = row[0]
            cost = row[1] or 0.0
            tokens = row[2] or 0
            
            # Fallback estimation
            if cost == 0 and tokens > 0:
                cost = tokens * 0.000002
                
            if app in apps_metrics_map:
                apps_metrics_map[app]["total_cost"] = round(cost, 4)
                apps_metrics_map[app]["total_tokens"] = tokens
            elif app == 'Unknown': 
                 # Handle cases where app wasn't in traces query but is in join? Unlikely.
                 pass

        apps_metrics = list(apps_metrics_map.values())

        # Process Status Distribution
        status_distribution = []
        for row in status_dist_res.result_rows:
            code = row[0] or 'UNSET'
            count = row[1]
            status_distribution.append({"name": code, "value": count})
            
        # Process Token Split
        row = token_split_res.result_rows[0]
        token_split = [
            {"name": "Prompt", "value": row[0]},
            {"name": "Completion", "value": row[1]}
        ]
        
        # Process Top Users
        top_users = []
        for row in user_vol_res.result_rows:
            top_users.append({"user": row[0], "count": row[1]})
            
        # Process Gen Speed
        gen_speed = []
        for row in gen_speed_res.result_rows:
            gen_speed.append({"model": row[0], "tokens_per_sec": round(row[1], 2)})
        
        # Process Latencies
        def process_latencies(rows):
            stats = []
            for row in rows:
                stats.append({
                    "name": row[0],
                    "p50": round(row[1], 2),
                    "p90": round(row[2], 2),
                    "p95": round(row[3], 2),
                    "p99": round(row[4], 2)
                })
            return stats

        trace_latency = process_latencies(trace_lat_res.result_rows)
        generation_latency = process_latencies(gen_lat_res.result_rows)

        # --- Evaluation Trend (Last 30 days) ---
        eval_trend = []
        try:
            # Note: We are not filtering by project_id here as EvaluationResult lacks it currently.
            # This is a known limitation for now.
            # If we wanted to be strict, we'd need to join with Trace via trace_id in Postgres if traces were synced,
            # or add project_id to EvaluationResult.
            trend_stmt = select(
                 func.to_char(EvaluationResult.created_at, 'YYYY-MM-DD').label('day'), 
                 func.avg(EvaluationResult.score)
            ).group_by('day').order_by('day').limit(30)
            
            trend_res = await session.execute(trend_stmt)
            for day, avg in trend_res.all():
                 eval_trend.append({"date": day, "avg_score": round(avg, 2)})
        except Exception as e:
            logger.error(f"Failed to fetch eval trend: {e}")

        return {
            "total_traces": total_traces,
            "total_cost": round(total_cost, 4), 
            "total_tokens": total_tokens_sum,
            "total_scores": total_scores,
            "trace_series": trace_series,
            "token_series": token_series, 
            "model_stats": model_stats,
            "scores_stats": scores_stats,
            "trace_latency": trace_latency,
            "generation_latency": generation_latency,
            "eval_trend": eval_trend,
            "apps_metrics": apps_metrics,
            "app_series": app_series,
            "status_distribution": status_distribution,
            "token_split": token_split,
            "top_users": top_users,
            "gen_speed": gen_speed
        }


    except Exception as e:
        print(f"Analytics Error: {e}")
        # Return empty structure on error to prevent UI crash
        return {
            "total_traces": 0,
            "total_cost": 0,
            "total_scores": 0,
            "trace_series": [],
            "model_stats": [],
            "scores_stats": [],
            "trace_latency": [],
            "generation_latency": [],
            "apps_metrics": [],
            "app_series": [],
            "status_distribution": [],
            "token_split": [],
            "top_users": [],
            "gen_speed": []
        }

@router.get("/evaluation-stats")
async def get_evaluation_stats(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Get aggregated statistics for evaluations (Postgres).
    Excludes RUNNING/FAILED evaluations without scores.
    """
    try:
        # 1. Pass/Fail Ratio
        # Filter where status='COMPLETED' or passed is not null
        pf_stmt = select(EvaluationResult.passed, func.count())\
            .where(EvaluationResult.score != None)\
            .group_by(EvaluationResult.passed)
            
        pf_res = await session.execute(pf_stmt)
        pass_fail_data = []
        for passed, count in pf_res.all():
            if passed is not None:
                label = "Passed" if passed else "Failed"
                pass_fail_data.append({"name": label, "value": count})
            
        # 2. Avg Score by Metric
        metric_stmt = select(EvaluationResult.metric_id, func.avg(EvaluationResult.score))\
            .where(EvaluationResult.score != None)\
            .group_by(EvaluationResult.metric_id)
            
        metric_res = await session.execute(metric_stmt)
        avg_scores = []
        for mid, avg in metric_res.all():
            if avg is not None:
                avg_scores.append({"metric": mid, "score": round(avg, 2)})
            
        # 3. Score Trend (Daily)
        try:
             trend_stmt = select(
                 func.to_char(EvaluationResult.created_at, 'YYYY-MM-DD').label('day'), 
                 func.avg(EvaluationResult.score)
             ).where(EvaluationResult.score != None)\
              .group_by('day').order_by('day')
              
             trend_res = await session.execute(trend_stmt)
             score_trend = []
             for day, avg in trend_res.all():
                 if day and avg is not None:
                    score_trend.append({"date": day, "avg_score": round(avg, 2)})
        except Exception:
             # Fallback
             trend_stmt = select(EvaluationResult.created_at, EvaluationResult.score)\
                .where(EvaluationResult.score != None)\
                .order_by(EvaluationResult.created_at)
             trend_res = await session.execute(trend_stmt)
             # Agg in python
             from collections import defaultdict
             day_map = defaultdict(list)
             for created_at, score in trend_res.all():
                 if score is not None:
                     day = created_at.strftime("%Y-%m-%d")
                     day_map[day].append(score)
             score_trend = [{"date": d, "avg_score": round(sum(s)/len(s), 2)} for d, s in day_map.items()]
             score_trend.sort(key=lambda x: x['date'])
        
        return {
            "pass_fail": pass_fail_data,
            "avg_scores": avg_scores,
            "score_trend": score_trend,
            "total_runs": await session.scalar(select(func.count()).select_from(EvaluationResult))
        }
    except Exception as e:
        print(f"Eval Stats Error: {e}")
        return {
            "pass_fail": [],
            "avg_scores": [],
            "score_trend": []
        }
    except Exception as e:
        print(f"Eval Stats Error: {e}")
        return {}

@router.get("/applications/{app_name}/stats")
async def get_application_stats(
    project_id: str,
    app_name: str,
    from_ts: Optional[float] = None,
    to_ts: Optional[float] = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session)
):
    """
    Get detailed statistics for a specific application.
    """
    client = get_clickhouse_client()
    
    where_clause = f"project_id = '{project_id}' AND application_name = '{app_name}'"
    
    if from_ts:
        where_clause += f" AND start_time >= toDateTime64({from_ts}, 9)"
    if to_ts:
        where_clause += f" AND start_time <= toDateTime64({to_ts}, 9)"

    # 1. Overview Metrics
    overview_query = f"""
    SELECT 
        count() as total_requests,
        sum(duration_ms) as total_duration,
        avg(duration_ms) as avg_latency,
        quantile(0.95)(duration_ms) as p95_latency,
        countIf(status_code = 'ERROR') as error_count
    FROM traces
    WHERE {where_clause} AND (parent_span_id IS NULL OR parent_span_id = '')
    """
    
    # 2. Token & Cost (Joined)
    cost_tokens_query = f"""
    SELECT 
        sum(o.total_cost),
        sum(
             CASE 
                WHEN isValidJSON(o.token_usage) THEN 
                COALESCE(JSONExtractInt(o.token_usage, 'total_tokens'), 0)
                ELSE 0 
            END
        )
    FROM traces t
    INNER JOIN observations o ON t.trace_id = o.trace_id
    WHERE {where_clause.replace("project_id", "t.project_id").replace("application_name", "t.application_name")}
      AND (t.parent_span_id IS NULL OR t.parent_span_id = '')
    """
    
    # 3. Requests & Latency Over Time (Chart 1 & 2)
    series_query = f"""
    SELECT 
        toStartOfHour(start_time) as time,
        count() as count,
        avg(duration_ms) as avg_lat
    FROM traces
    WHERE {where_clause} AND (parent_span_id IS NULL OR parent_span_id = '')
    GROUP BY time
    ORDER BY time ASC
    """
    
    # 4. Status Distribution
    status_query = f"""
    SELECT 
        if(status_code = '' OR status_code IS NULL OR status_code = 'UNSET', 'OK', status_code) as status, 
        count()
    FROM traces
    WHERE {where_clause} AND (parent_span_id IS NULL OR parent_span_id = '')
    GROUP BY status
    """
    
    # 5. Top Models
    models_query = f"""
    SELECT 
        if(o.model = '' OR o.model IS NULL, 'Unknown', o.model) as model_name,
        count() as count
    FROM traces t
    INNER JOIN observations o ON t.trace_id = o.trace_id
    WHERE {where_clause.replace("project_id", "t.project_id").replace("application_name", "t.application_name")}
    GROUP BY model_name
    ORDER BY count DESC
    LIMIT 10
    """
    
    # 6. Top Users
    users_query = f"""
    SELECT 
        if(user_id = '' OR user_id IS NULL, 'Unknown', user_id) as user,
        count()
    FROM traces
    WHERE {where_clause} AND (parent_span_id IS NULL OR parent_span_id = '')
    GROUP BY user
    ORDER BY count() DESC
    LIMIT 10
    """
    
    # New Graph Queries
    
    # 7. Token Usage Over Time
    token_series_query = f"""
    SELECT 
        toStartOfHour(t.start_time) as time,
        sum(
             CASE 
                WHEN isValidJSON(o.token_usage) THEN 
                COALESCE(JSONExtractInt(o.token_usage, 'total_tokens'), 0)
                ELSE 0 
            END
        ) as total_tokens
    FROM traces t
    LEFT JOIN observations o ON t.trace_id = o.trace_id
    WHERE {where_clause.replace("project_id", "t.project_id").replace("application_name", "t.application_name")}
      AND (t.parent_span_id IS NULL OR t.parent_span_id = '')
    GROUP BY time
    ORDER BY time ASC
    """
    
    # 8. Cost Over Time
    cost_series_query = f"""
    SELECT 
        toStartOfHour(t.start_time) as time,
        sum(o.total_cost) as total_cost,
        sum(
             CASE 
                WHEN isValidJSON(o.token_usage) THEN 
                COALESCE(JSONExtractInt(o.token_usage, 'total_tokens'), 0)
                ELSE 0 
            END
        ) as total_tokens
    FROM traces t
    LEFT JOIN observations o ON t.trace_id = o.trace_id
    WHERE {where_clause.replace("project_id", "t.project_id").replace("application_name", "t.application_name")}
      AND (t.parent_span_id IS NULL OR t.parent_span_id = '')
    GROUP BY time
    ORDER BY time ASC
    """

    try:
        overview_res = client.query(overview_query)
        cost_res = client.query(cost_tokens_query)
        series_res = client.query(series_query)
        status_res = client.query(status_query)
        models_res = client.query(models_query)
        users_res = client.query(users_query)
        token_series_res = client.query(token_series_query)
        cost_series_res = client.query(cost_series_query)
        
        # Parse Overview
        row = overview_res.result_rows[0]
        total_requests = row[0]
        total_duration = row[1]
        avg_latency = row[2]
        p95_latency = row[3]
        error_count = row[4]
        error_rate = (error_count / total_requests * 100) if total_requests > 0 else 0
        
        # Parse Cost
        c_row = cost_res.result_rows[0]
        total_cost = c_row[0] or 0.0
        total_tokens = c_row[1] or 0
        
        if total_cost == 0 and total_tokens > 0:
            total_cost = total_tokens * 0.000002
            
        # Helper for date formatting
        def fmt_time(dt):
            return dt.strftime("%b %d, %I:%M %p")

        # Parse Series
        request_series = []
        latency_series = []
        for r in series_res.result_rows:
            t_str = fmt_time(r[0])
            request_series.append({"time": t_str, "requests": r[1]})
            latency_series.append({"time": t_str, "latency": round(r[2], 2)})
            
        # Parse Token & Cost Series
        token_series = []
        for r in token_series_res.result_rows:
            token_series.append({"time": fmt_time(r[0]), "tokens": r[1]})
            
        cost_series = []
        for r in cost_series_res.result_rows:
            # If cost is 0, estimate
            val = r[1] or 0.0
            if val == 0 and r[2] > 0:
                val = r[2] * 0.000002
            cost_series.append({"time": fmt_time(r[0]), "cost": round(val, 5)})
            
        # Parse Status
        status_dist = [{"name": r[0] or 'OK', "value": r[1]} for r in status_res.result_rows]
        
        # Parse Models
        model_usage = [{"name": r[0], "value": r[1]} for r in models_res.result_rows]
        
        # Parse Users
        top_users = [{"user": r[0], "count": r[1]} for r in users_res.result_rows]
        
        # --- Postgres Evaluations for this App ---
        eval_metrics = {
            "total_evals": 0,
            "pass_rate": 0,
            "avg_score": 0,
            "score_trend": [],
            "pass_fail_trend": [] # New Chart
        }
        
        try:
             # Total & Pass Rate
             stmt = select(
                 func.count().label('total'),
                 func.sum(case((EvaluationResult.passed == True, 1), else_=0)).label('passed'),
                 func.avg(EvaluationResult.score).label('avg_score')
             ).where(EvaluationResult.application_name == app_name)
             
             pg_res = await session.execute(stmt)
             pg_row = pg_res.one()
             
             total_evals = pg_row.total or 0
             passed_evals = pg_row.passed or 0
             
             eval_metrics["total_evals"] = total_evals
             eval_metrics["avg_score"] = round(pg_row.avg_score, 2) if pg_row.avg_score else 0
             eval_metrics["pass_rate"] = round((passed_evals / total_evals * 100), 1) if total_evals > 0 else 0
             
             # Eval Trend
             trend_stmt = select(
                 func.to_char(EvaluationResult.created_at, 'YYYY-MM-DD').label('day'), 
                 func.avg(EvaluationResult.score),
                 func.sum(case((EvaluationResult.passed == True, 1), else_=0)).label('passed_count'),
                 func.count().label('total_count')
             ).where(EvaluationResult.application_name == app_name).group_by('day').order_by('day').limit(30)
             
             trend_pg_res = await session.execute(trend_stmt)
             for day, avg, passed, total in trend_pg_res.all():
                 avg = avg or 0
                 # Reformat Day? YYYY-MM-DD is fine for X axis, maybe format in frontend
                 # But let's try to match style if possible. 
                 # Actually simpler to keep YYYY-MM-DD for eval trend usually.
                 eval_metrics["score_trend"].append({"date": day, "score": round(avg, 2)})
                 
                 # Pass/Fail Trend
                 failed = total - passed
                 eval_metrics["pass_fail_trend"].append({
                     "date": day,
                     "passed": passed,
                     "failed": failed
                 })
                 
        except Exception as e:
            print(f"App Eval Stats Error: {e}")
        
        
        return {
            "overview": {
                "total_requests": total_requests,
                "avg_latency": round(avg_latency, 2),
                "p95_latency": round(p95_latency, 2),
                "error_rate": round(error_rate, 2),
                "total_tokens": total_tokens,
                "total_cost": round(total_cost, 4)
            },
            "charts": {
                "requests_over_time": request_series,
                "latency_over_time": latency_series,
                "status_distribution": status_dist,
                "model_usage": model_usage,
                "top_users": top_users,
                "tokens_over_time": token_series, # New
                "cost_over_time": cost_series,    # New
                "pass_fail_trend": eval_metrics["pass_fail_trend"] # New
            },
            "evaluations": eval_metrics
        }
        
    except Exception as e:
        print(f"App Stats Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        print(f"Eval Stats Error: {e}")
        return {
            "pass_fail": [],
            "avg_scores": [],
            "score_trend": []
        }
