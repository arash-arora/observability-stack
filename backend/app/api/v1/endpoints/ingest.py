from typing import Any, Dict, List
from fastapi import APIRouter, Header, HTTPException, Depends, Body, BackgroundTasks
from app.core.evaluation_runner import run_triggered_evaluation
from app.models.evaluation_rule import EvaluationRule
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_session
from app.core.security import resolve_ingest_key_hash
from app.models.all_models import ApiKey
from app.core.clickhouse import get_clickhouse_client
import json
import logging
from datetime import datetime
from sqlalchemy.orm import selectinload

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/traces")
async def ingest_traces(
    payload: Any = Body(...),
    x_api_key: str = Header(...),
    session: AsyncSession = Depends(get_session)
):
    """
    Ingest traces.
    """
    try:
        # 1. Validate API Key
        key_hash = resolve_ingest_key_hash(x_api_key)
        if not key_hash:
            raise HTTPException(status_code=403, detail="Invalid API Key")

        result = await session.execute(
            select(ApiKey).options(selectinload(ApiKey.application)).where(ApiKey.key == key_hash)
        )
        api_key_obj = result.scalars().first()
        
        if not api_key_obj:
            raise HTTPException(status_code=403, detail="Invalid API Key")
        
        if not api_key_obj.is_active:
            raise HTTPException(status_code=403, detail="API Key is inactive")
            
        project_id = api_key_obj.application.project_id
        application_name = api_key_obj.application.name
        
        # 2. Process data
        spans = payload
        if isinstance(payload, dict):
            spans = payload.get("spans", [])
            
        if not isinstance(spans, list):
            spans = [spans]

        client = get_clickhouse_client()
        data = []
        
        for span in spans:
            start_str = span.get("start_time")
            end_str = span.get("end_time")
            if not start_str or not end_str:
                continue

            start_t = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
            end_t = datetime.fromisoformat(end_str.replace("Z", "+00:00"))
            duration = (end_t - start_t).total_seconds() * 1000

            row = [
                span.get("trace_id"),
                span.get("span_id"),
                span.get("parent_span_id", ""),
                span.get("name"),
                span.get("kind", "INTERNAL"),
                start_t,
                end_t,
                span.get("status", {}).get("code", "UNSET"),
                span.get("status", {}).get("message", ""),
                span.get("attributes", {}),
                json.dumps(span.get("events", [])),
                json.dumps(span.get("links", [])),
                span.get("resource", {}).get("attributes", {}),
                duration,
                project_id,
                span.get("attributes", {}).get("enduser.id", ""),
                application_name
            ]
            data.append(row)
            
        if data:
            client.insert("traces", data, column_names=[
                "trace_id", "span_id", "parent_span_id", "name", "kind", 
                "start_time", "end_time", "status_code", "status_message", 
                "attributes", "events", "links", "resource_attributes", "duration_ms", "project_id", "user_id", "application_name"
            ])
        
        return {"status": "success", "count": len(data)}
    except Exception as e:
        import traceback
        logger.error("Traces ingestion error: %s\n%s", str(e), traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/observations")
async def ingest_observations(
    payload: Any = Body(...),
    x_api_key: str = Header(...),
    session: AsyncSession = Depends(get_session),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    """
    Ingest observations.
    """
    try:
        # 1. Validate API Key
        key_hash = resolve_ingest_key_hash(x_api_key)
        if not key_hash:
            raise HTTPException(status_code=403, detail="Invalid API Key")

        result = await session.execute(
            select(ApiKey).options(selectinload(ApiKey.application)).where(ApiKey.key == key_hash)
        )
        api_key_obj = result.scalars().first()
        
        if not api_key_obj:
            raise HTTPException(status_code=403, detail="Invalid API Key")
        
        if not api_key_obj.is_active:
            raise HTTPException(status_code=403, detail="API Key is inactive")
            
        project_id = api_key_obj.application.project_id
        application_name = api_key_obj.application.name
        
        # 2. Process data
        observations = payload
        if isinstance(payload, dict):
            observations = payload.get("observations", [])
            
        if not isinstance(observations, list):
            observations = [observations]
            
        client = get_clickhouse_client()
        data = []
        
        for obs in observations:
            start_t = datetime.fromtimestamp(obs.get("start_time") / 1e9)
            end_t = datetime.fromtimestamp(obs.get("end_time") / 1e9)
            
            row = [
                obs.get("id"),
                obs.get("trace_id"),
                obs.get("parent_observation_id"),
                obs.get("name"),
                obs.get("type"),
                obs.get("model"),
                start_t,
                end_t,
                obs.get("input_text"),
                obs.get("output_text"),
                json.dumps(obs.get("token_usage")) if obs.get("token_usage") else None,
                json.dumps(obs.get("model_parameters")) if obs.get("model_parameters") else None,
                json.dumps(obs.get("metadata_json")) if not isinstance(obs.get("metadata_json"), str) and obs.get("metadata_json") else obs.get("metadata_json"),
                obs.get("extra"),
                obs.get("observation_type"),
                obs.get("error"),
                obs.get("total_cost"),
                start_t, # created_at
                project_id,
                obs.get("user_id")
            ]
            data.append(row)
            
        if data:
            client.insert("observations", data, column_names=[
                "id", "trace_id", "parent_observation_id", "name", "type", "model",
                "start_time", "end_time", "input_text", "output_text", "token_usage",
                "model_parameters", "metadata_json", "extra", "observation_type", "error",
                "total_cost", "created_at", "project_id", "user_id"
            ])

            # --- Auto-Evaluation Logic ---
            # Group observations by trace_id to support multi-trace ingestion batches cleanly
            obs_by_trace = {}
            for obs in observations:
                tid = obs.get("trace_id")
                if tid:
                    if tid not in obs_by_trace:
                        obs_by_trace[tid] = []
                    obs_by_trace[tid].append(obs)

            # Fetch Rules for this Application
            app_id = api_key_obj.application_id
            rules_res = await session.execute(
                select(EvaluationRule)
                .where(EvaluationRule.application_id == str(app_id))
                .where(EvaluationRule.active == True)
            )
            rules = rules_res.scalars().all()

            AGENTIC_METRICS = {
                "ToolSelectionEvaluator",
                "ToolInputStructureEvaluator",
                "ToolSequenceEvaluator",
                "AgentRoutingEvaluator",
                "HITLEvaluator",
                "WorkflowCompletionEvaluator"
            }

            if rules and obs_by_trace:
                for tid, trace_obs_list in obs_by_trace.items():
                    for rule in rules:
                        rule_metrics = [m.strip() for m in (rule.metric_ids or "").split(",") if m.strip()]
                        is_agentic_rule = any(m in AGENTIC_METRICS for m in rule_metrics)
                        
                        if is_agentic_rule:
                            # Agentic rule: evaluate the complete trace exactly ONCE.
                            # We find the root-most node in the ingested list to act as the primary evaluation anchor.
                            root_obs = next(
                                (o for o in trace_obs_list if not o.get("parent_observation_id")),
                                None
                            )
                            if root_obs:
                                trace_data = {
                                    "input": root_obs.get("input_text"),
                                    "output": root_obs.get("output_text"),
                                    "context": root_obs.get("metadata_json"),
                                    "trace_id": root_obs.get("trace_id"),
                                    "observation_id": root_obs.get("id"),
                                    "observation_name": root_obs.get("name"),
                                    "application_name": application_name,
                                    "is_agentic": True
                                }
                                background_tasks.add_task(run_triggered_evaluation, rule.id, trace_data)
                        else:
                            # Non-agentic rule: evaluate individual nodes that contain input/output data.
                            for obs in trace_obs_list:
                                if obs.get("input_text") or obs.get("output_text"):
                                    trace_data = {
                                        "input": obs.get("input_text"),
                                        "output": obs.get("output_text"),
                                        "context": obs.get("metadata_json"),
                                        "trace_id": obs.get("trace_id"),
                                        "observation_id": obs.get("id"),
                                        "observation_name": obs.get("name"),
                                        "application_name": application_name,
                                        "is_agentic": False
                                    }
                                    background_tasks.add_task(run_triggered_evaluation, rule.id, trace_data)

        return {"status": "success", "count": len(data)}
    except Exception as e:
        import traceback
        logger.error("Observations ingestion error: %s\n%s", str(e), traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
