import importlib
import logging
import inspect
from datetime import datetime
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.database import engine
from app.core.security import decrypt_value, hash_api_key
from app.models.evaluation_rule import EvaluationRule
from app.models.evaluation_result import EvaluationResult
from app.models.all_models import ApiKey, Application
from app.models.llm_provider import LLMProvider

import json

logger = logging.getLogger(__name__)

def extract_clean_param(val: str, param_type: str) -> str:
    if not val:
        return ""
    if not isinstance(val, str):
        val = str(val)
        
    val_trimmed = val.strip()
    if not (val_trimmed.startswith("{") or val_trimmed.startswith("[")):
        return val
        
    try:
        data = json.loads(val_trimmed)
    except:
        try:
            json_str = val_trimmed.replace("'", '"').replace("True", "true").replace("False", "false").replace("None", "null")
            data = json.loads(json_str)
        except:
            return val
            
    def extract_from_messages(msgs):
        if not isinstance(msgs, list):
            return ""
        # Support simple list of string messages (flat array format)
        if msgs and all(isinstance(m, str) for m in msgs):
            return "\n\n".join(msgs).strip()
            
        for m in reversed(msgs):
            if not isinstance(m, dict):
                continue
            role = str(m.get("role") or m.get("type") or "").lower()
            content = m.get("content") or m.get("text") or m.get("message")
            if content:
                if param_type == "input" and ("user" in role or "human" in role):
                    return str(content)
                elif param_type == "output" and ("ai" in role or "assistant" in role or "model" in role or "output" in role):
                    return str(content)
        for m in reversed(msgs):
            if isinstance(m, dict):
                content = m.get("content") or m.get("text") or m.get("message")
                if content:
                    return str(content)
        return ""

    if isinstance(data, dict):
        keys = ["input", "query", "question", "prompt"] if param_type == "input" else ["output", "response", "completion", "result", "text"]
        for k in keys:
            if k in data and data[k]:
                if isinstance(data[k], str):
                    return data[k]
                elif isinstance(data[k], list):
                    res = extract_from_messages(data[k])
                    if res: return res
                    
        if "messages" in data and isinstance(data["messages"], list):
            res = extract_from_messages(data["messages"])
            if res: return res
            
        if "args" in data and isinstance(data["args"], list) and data["args"]:
            # 1. Scan for any list element containing message structures
            found_msg = False
            for arg in data["args"]:
                if isinstance(arg, list):
                    res = extract_from_messages(arg)
                    if res:
                        return res
            # 2. Join all string arguments found in args
            string_args = [arg for arg in data["args"] if isinstance(arg, str) and arg.strip()]
            if string_args:
                return "\n\n".join(string_args)
            # 3. Fallback to first argument if it's a string
            first_arg = data["args"][0]
            if isinstance(first_arg, str):
                return first_arg
                
        if "kwargs" in data and isinstance(data["kwargs"], dict):
            kwargs_data = data["kwargs"]
            for k in (["input", "query", "question", "prompt"] if param_type == "input" else ["output", "response", "completion", "result", "text"]):
                if k in kwargs_data and kwargs_data[k]:
                    if isinstance(kwargs_data[k], str):
                        return kwargs_data[k]
                    elif isinstance(kwargs_data[k], list):
                        res = extract_from_messages(kwargs_data[k])
                        if res: return res
            if "messages" in kwargs_data and isinstance(kwargs_data["messages"], list):
                res = extract_from_messages(kwargs_data["messages"])
                if res: return res
                
        if param_type == "output" and "choices" in data and isinstance(data["choices"], list) and data["choices"]:
            first_choice = data["choices"][0]
            if isinstance(first_choice, dict):
                msg = first_choice.get("message")
                if isinstance(msg, dict) and msg.get("content"):
                    return str(msg["content"])
                    
    elif isinstance(data, list):
        res = extract_from_messages(data)
        if res: 
            return res
        # Scan for any string elements at the root level of the list
        strings = [item for item in data if isinstance(item, str) and item.strip()]
        if strings:
            return "\n\n".join(strings).strip()
        
    return val


async def fetch_retrieval_contexts(trace_id: str) -> list:
    if not trace_id:
        return []
    from app.core.clickhouse import get_clickhouse_client
    try:
        ch_client = get_clickhouse_client()
        query = f"""
            SELECT output_text 
            FROM observations 
            WHERE trace_id = '{trace_id}'
              AND (type = 'retrieval' OR name LIKE '%retriev%' OR name LIKE '%search%')
        """
        rows = ch_client.query(query).result_rows
        return [row[0] for row in rows if row[0]]
    except Exception as ex:
        logger.error(f"Failed to fetch retrieval contexts from ClickHouse: {ex}")
        return []



async def fetch_complete_trace(trace_id: str) -> dict:
    """
    Fetch all spans and observations for a trace from ClickHouse
    and format it as {"spans": [...], "observations": [...], "trace_id": trace_id}
    """
    from app.core.clickhouse import get_clickhouse_client
    client = get_clickhouse_client()
    
    # 1. Fetch Spans
    spans_query = f"""
        SELECT 
            trace_id, span_id, parent_span_id, name, kind, start_time, end_time, 
            status_code, status_message, attributes, events, links, duration_ms, application_name
        FROM traces 
        WHERE trace_id = '{trace_id}'
        ORDER BY start_time ASC
    """
    
    # 2. Fetch Observations
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
        spans_res = client.query(spans_query).result_rows
        obs_res = client.query(obs_query).result_rows
        
        spans = []
        for row in spans_res:
            spans.append({
                "trace_id": row[0],
                "span_id": row[1],
                "parent_span_id": row[2],
                "name": row[3],
                "kind": row[4],
                "start_time": str(row[5]),
                "end_time": str(row[6]),
                "status_code": row[7],
                "status_message": row[8],
                "attributes": row[9],
                "events": json.loads(row[10]) if row[10] else [],
                "duration_ms": row[12],
                "application_name": row[13],
                "type": "span",
            })
            
        observations = []
        for row in obs_res:
            parent_id = str(row[1]) if row[1] and str(row[1]) != "0" else None
            obs_meta = {}
            if row[11]:
                try:
                    obs_meta = json.loads(row[11]) if isinstance(row[11], str) else row[11]
                except:
                    obs_meta = {}
            observations.append({
                "id": str(row[0]),
                "parent_observation_id": parent_id,
                "name": row[2],
                "type": row[3],
                "model": row[4],
                "start_time": str(row[5]),
                "end_time": str(row[6]),
                "input_text": row[7],
                "input": row[7],
                "output_text": row[8],
                "output": row[8],
                "token_usage": json.loads(row[9]) if row[9] else {},
                "model_parameters": json.loads(row[10]) if row[10] else {},
                "metadata_json": obs_meta,
                "extra": row[12],
                "observation_type": row[13],
                "error": row[14],
                "total_cost": row[15],
            })
            
        return {
            "trace_id": trace_id,
            "spans": spans,
            "observations": observations
        }
    except Exception as e:
        logger.error(f"Failed to fetch complete trace {trace_id} from ClickHouse: {e}")
        return {"trace_id": trace_id, "spans": [], "observations": []}


def extract_workflow_details(trace: dict) -> dict:
    """
    Extract workflow details (evaluated agents and tools) from the trace.
    """
    agents = []
    tools = []
    
    seen_agents = set()
    for obs in trace.get("observations", []):
        if obs.get("type") in ["agent", "chain"]:
            name = obs.get("name")
            if name and name not in seen_agents:
                seen_agents.add(name)
                meta = obs.get("metadata_json") or {}
                if isinstance(meta, str):
                    try: meta = json.loads(meta)
                    except: meta = {}
                desc = meta.get("description") or ""
                agents.append(f"{name}: {desc}" if desc else name)
                
    seen_tools = set()
    for obs in trace.get("observations", []):
        if obs.get("type") == "tool":
            name = obs.get("name")
            if name and name not in seen_tools:
                seen_tools.add(name)
                meta = obs.get("metadata_json") or {}
                if isinstance(meta, str):
                    try: meta = json.loads(meta)
                    except: meta = {}
                desc = meta.get("description") or ""
                tools.append(f"{name}: {desc}" if desc else name)
                
    return {"agents": agents, "tools": tools}


async def run_triggered_evaluation(rule_id: int, trace_data: dict):
    """
    Run evaluation based on a triggered rule and trace data.
    trace_data should look like { "input": ..., "output": ..., "context": ..., "trace_id": ... }
    Evaluations are executed directly — no OTel instrumentation.
    """
    logger.info(f"Starting triggered evaluation for Rule ID: {rule_id}")
    
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as session:
        # Fetch Rule
        rule = await session.get(EvaluationRule, rule_id)
        if not rule or not rule.active:
            logger.warning(f"Rule {rule_id} not found or inactive.")
            return

        try:
            metric_ids_str = rule.metric_ids or ""
            metric_ids = [m.strip() for m in metric_ids_str.split(",") if m.strip()]
            
            if not metric_ids:
                logger.warning(f"Rule {rule_id} has no metrics.")
                return

            inputs = rule.inputs or {}
            target_trace_id = trace_data.get("trace_id")
            
            # Fetch complete trace and workflow details if agentic evaluation
            is_agentic = trace_data.get("is_agentic", False)
            trace = None
            workflow_details = None
            if is_agentic and target_trace_id:
                import asyncio
                await asyncio.sleep(0.05)
                trace = await fetch_complete_trace(target_trace_id)
                workflow_details = extract_workflow_details(trace)
            
            # Prepare Inputs
            raw_query = trace_data.get("input") or inputs.get("input") or inputs.get("query")
            query = extract_clean_param(raw_query, "input")
            
            # Automatically fetch context from ClickHouse retrieval observations if available
            retrieved_contexts = []
            if target_trace_id:
                retrieved_contexts = await fetch_retrieval_contexts(target_trace_id)
                
            if retrieved_contexts:
                context = retrieved_contexts
            else:
                context = trace_data.get("context") or inputs.get("context")
                
            resolved_app_name = trace_data.get("application_name")
            if not resolved_app_name and target_trace_id:
                try:
                    from app.core.clickhouse import get_clickhouse_client
                    ch_client = get_clickhouse_client()
                    ch_res = ch_client.query(f"SELECT application_name FROM traces WHERE trace_id = '{target_trace_id}' LIMIT 1").result_rows
                    if ch_res and ch_res[0][0]:
                        resolved_app_name = str(ch_res[0][0])
                except Exception as ex:
                    logger.error(f"Failed to query trace application_name in runner: {ex}")

            raw_output = trace_data.get("output") or inputs.get("output") or inputs.get("response")    
            output = extract_clean_param(raw_output, "output")
            
            expected = trace_data.get("expected") or inputs.get("expected")

            for metric_id in metric_ids:
                # Check for duplicate evaluations to prevent double runs
                if target_trace_id:
                    dup_stmt = select(EvaluationResult).where(
                        EvaluationResult.trace_id == target_trace_id,
                        EvaluationResult.metric_id == metric_id
                    )
                    dup_res = await session.execute(dup_stmt)
                    if dup_res.scalars().first():
                        logger.info(f"Evaluation for trace {target_trace_id} and metric {metric_id} already exists. Skipping.")
                        continue

                # Create Initial Evaluation Result (PENDING/RUNNING)
                eval_result = EvaluationResult(
                    trace_id=target_trace_id,
                    metric_id=metric_id,
                    input=str(query) if query else None,
                    output=str(output) if output else None,
                    context=context if isinstance(context, list) else [str(context)] if context else [],
                    expected_output=str(expected) if expected else None,
                    status="RUNNING",
                    application_name=resolved_app_name or inputs.get("application_name")
                )
                session.add(eval_result)
                await session.commit()
                await session.refresh(eval_result)
                
                try:
                    provider = inputs.get("provider", "openai")
                    model = inputs.get("model")
                    
                    # Credentials
                    api_key = inputs.get("api_key")
                    azure_endpoint = inputs.get("azure_endpoint")
                    api_version = inputs.get("api_version")
                    deployment_name = inputs.get("deployment_name")

                    # Fallback to Stored Provider if keys not in inputs
                    if not api_key:
                        provider_id = inputs.get("provider_id")
                        app_id = rule.application_id
                        provider_obj = None
                        
                        # If provider_id is specified, fetch exact provider
                        if provider_id:
                            try:
                                provider_obj = await session.get(LLMProvider, provider_id)
                            except Exception as e:
                                logger.error(f"Failed to fetch provider {provider_id}: {e}")
                                provider_obj = None
                        
                        # Fallback: search by provider type if no exact match
                        if not provider_obj and app_id:
                            app_res = await session.get(Application, app_id)
                            if app_res:
                                stmt = select(LLMProvider).where(
                                    LLMProvider.project_id == app_res.project_id,
                                    LLMProvider.provider == provider
                                )
                                prov_res = await session.execute(stmt)
                                provider_obj = prov_res.scalars().first()
                        
                        if provider_obj:
                            api_key = decrypt_value(provider_obj.api_key)
                            if not model: model = provider_obj.model_name
                            if not azure_endpoint: azure_endpoint = provider_obj.base_url
                            if not api_version: api_version = provider_obj.api_version
                            if not deployment_name: deployment_name = provider_obj.deployment_name

                    if not model:
                        model = deployment_name

                    # 1. Instantiate Evaluator
                    try:
                        eval_module = importlib.import_module("app.core.evaluation")
                        EvaluatorClass = getattr(eval_module, metric_id, None)
                        
                        if not EvaluatorClass:
                            raise ValueError(f"Evaluator class {metric_id} not found in SDK")

                        llm_kwargs = {}
                        if api_key: llm_kwargs['api_key'] = api_key
                        if azure_endpoint: llm_kwargs['azure_endpoint'] = azure_endpoint
                        if api_version: llm_kwargs['api_version'] = api_version
                        if deployment_name: llm_kwargs['deployment_name'] = deployment_name

                        evaluator = EvaluatorClass(provider=provider, model=model, **llm_kwargs)
                    except Exception as e:
                        raise ValueError(f"Failed to init Evaluator: {e}")

                    # 2. Run Evaluation (no OTel tracing)
                    rubric_prompt = None
                    app_id = rule.application_id
                    if app_id:
                        app_res = await session.get(Application, app_id)
                        if app_res and app_res.rubric_prompt:
                            rubric_prompt = app_res.rubric_prompt

                    async def _execute_eval():
                        res = evaluator.evaluate(
                            input_query=query,
                            output=output,
                            context=context if isinstance(context, list) else [str(context)] if context else [],
                            expected=expected,
                            rubric=rubric_prompt,
                            trace=trace,
                            agents=workflow_details.get("agents", []) if workflow_details else [],
                            tools=workflow_details.get("tools", []) if workflow_details else [],
                            workflow_details=workflow_details
                        )
                        if inspect.iscoroutine(res):
                            res = await res
                        return res

                    result = await _execute_eval()
                    execution_trace_id = result.metadata.get("trace_id") if result.metadata else None

                    # 3. Update Result
                    eval_result.score = result.score
                    eval_result.reason = result.reason
                    eval_result.passed = result.passed
                    
                    # Add agent details to metadata
                    metadata = dict(result.metadata) if result.metadata else {}
                    metadata["trigger_type"] = "auto_eval"
                    metadata["rule_id"] = rule_id
                    if trace_data.get("observation_name"):
                        metadata["agent_name"] = trace_data.get("observation_name")
                    if workflow_details:
                        metadata["workflow_details"] = workflow_details
                    # For agentic evals, store trace observations so the frontend can render the full trace
                    if is_agentic and trace and trace.get("observations"):
                        metadata["trace_observations"] = [
                            {
                                "id": o.get("id"),
                                "name": o.get("name"),
                                "type": o.get("type"),
                                "input": o.get("input_text") or o.get("input"),
                                "output": o.get("output_text") or o.get("output"),
                                "parent_observation_id": o.get("parent_observation_id"),
                                "start_time": o.get("start_time"),
                            }
                            for o in trace["observations"]
                        ]
                    
                    eval_result.metadata_json = metadata
                    if not eval_result.trace_id:
                        eval_result.trace_id = execution_trace_id
                        
                    eval_result.status = "COMPLETED"
                    
                    session.add(eval_result)
                    await session.commit()
                    logger.info(f"Metric {metric_id} for Rule {rule_id} completed successfully.")

                except Exception as e:
                    logger.error(f"Metric {metric_id} for Rule {rule_id} failed: {e}")
                    eval_result.status = "FAILED"
                    eval_result.reason = str(e)
                    session.add(eval_result)
                    try:
                        await session.commit()
                    except:
                        pass

        except Exception as e:
            logger.error(f"Triggered evaluation {rule_id} failed: {e}")
