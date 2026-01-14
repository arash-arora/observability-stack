from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from app.core.clickhouse import get_clickhouse_client
from app.api.deps import get_current_user
from app.models.all_models import User

router = APIRouter()

@router.get("/traces")
async def get_traces(
    project_id: str,
    limit: int = 50,
    offset: int = 0,
    search: Optional[str] = None,
    status: Optional[List[str]] = Query(None),
    name: Optional[List[str]] = Query(None),
    sort_by: Optional[str] = None,
    order: Optional[str] = 'desc',
    current_user: User = Depends(get_current_user)
):
    """
    Get list of traces for a project with input/output preview.
    """
    client = get_clickhouse_client()
    
    where_clause = f"t.project_id = '{project_id}' AND t.parent_span_id IS NULL"
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
        t.attributes -- Metadata
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
                "metadata": row[11] # Map
            })
        return traces
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
        status_code, status_message, attributes, events, links, duration_ms
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
    current_user: User = Depends(get_current_user)
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

        return {
            "total_traces": total_traces,
            "total_cost": round(total_cost, 4), # Valid round
            "total_tokens": total_tokens_sum,   # New
            "total_scores": total_scores,
            "trace_series": trace_series,
            "token_series": token_series, 
            "model_stats": model_stats,
            "scores_stats": scores_stats,
            "trace_latency": trace_latency,
            "generation_latency": generation_latency
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
            "generation_latency": []
        }
