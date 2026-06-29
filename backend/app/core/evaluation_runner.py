import importlib
import logging
import inspect
import json
import re
from datetime import datetime
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.database import engine
from app.models.evaluation_rule import EvaluationRule
from app.models.evaluation_result import EvaluationResult
from app.models.all_models import ApiKey, Application
from app.models.llm_provider import LLMProvider
from observix.context import observability_context
from observix import init_observability
from opentelemetry import trace, context as otel_context

# Workflow-aware evaluators that require the full trace with agents/tools
_WORKFLOW_METRIC_IDS = {
    "AgentRoutingEvaluator",
    "ToolSequenceEvaluator",
    "WorkflowCompletionEvaluator",
    "HITLEvaluator",
}


def _fetch_trace_for_evaluation(trace_id: str, project_id) -> dict:
    """
    Fetches all observations for a trace from ClickHouse and extracts
    agents and tools for workflow-type evaluations.
    Returns a dict with keys: 'trace' (list of obs dicts), 'context' (agents/tools).
    """
    try:
        from app.core.clickhouse import get_clickhouse_client
        client = get_clickhouse_client()

        obs_query = f"""
        SELECT
            id, name, type, observation_type, input_text, output_text,
            metadata_json, extra, start_time, end_time, error
        FROM observations
        WHERE trace_id = '{trace_id}' AND project_id = '{project_id}'
        ORDER BY start_time ASC
        """
        result = client.query(obs_query)

        observations = []
        agents = []
        tools = []

        for row in result.result_rows:
            obs = {
                "id": str(row[0]),
                "name": row[1],
                "type": row[2],
                "observation_type": row[3],
                "input_text": row[4],
                "output_text": row[5],
                "metadata_json": row[6],
                "extra": row[7],
                "start_time": str(row[8]),
                "end_time": str(row[9]),
                "error": row[10],
            }
            observations.append(obs)

            # Extract candidate_agents and tools from metadata_json / extra
            for field in (row[6], row[7]):  # metadata_json, extra
                if not field:
                    continue
                try:
                    parsed = json.loads(field) if isinstance(field, str) else field
                    if isinstance(parsed, dict):
                        if parsed.get("candidate_agents") and not agents:
                            raw = parsed["candidate_agents"]
                            agents = json.loads(raw) if isinstance(raw, str) else raw
                        if parsed.get("tools") and not tools:
                            raw = parsed["tools"]
                            tools = json.loads(raw) if isinstance(raw, str) else raw
                except Exception:
                    pass

        # Fallback: derive agents/tools from observation type/name heuristics
        if not agents:
            for obs in observations:
                name_lower = (obs.get("name") or "").lower()
                type_lower = (obs.get("type") or "").lower()
                obs_type_lower = (obs.get("observation_type") or "").lower()
                if type_lower == "agent" or obs_type_lower == "agent" or "agent" in name_lower:
                    agents.append({"name": obs["name"]})

        if not tools:
            for obs in observations:
                name_lower = (obs.get("name") or "").lower()
                type_lower = (obs.get("type") or "").lower()
                obs_type_lower = (obs.get("observation_type") or "").lower()
                if (
                    type_lower == "tool"
                    or obs_type_lower == "tool"
                    or "tool" in name_lower
                    or "source" in name_lower
                ):
                    tools.append({"name": obs["name"]})

        return {
            "trace": observations,
            "context": {"agents": agents, "tools": tools},
        }
    except Exception as e:
        logger.warning(f"Failed to fetch trace {trace_id} for evaluation: {e}")
        return {"trace": [], "context": {"agents": [], "tools": []}}

logger = logging.getLogger(__name__)


def _strip_wrappers(text: str) -> str:
    text = text.strip()
    # Remove optional Python triple-quote wrappers first.
    if text.startswith('"""') and text.endswith('"""') and len(text) >= 6:
        text = text[3:-3].strip()

    # Remove fenced markdown blocks if present.
    fenced = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.DOTALL)
    if fenced:
        text = fenced.group(1).strip()
    return text


def _extract_text(value):
    if value is None:
        return None

    if isinstance(value, dict):
        for key in ("output", "response", "answer", "report", "content", "text"):
            if key in value and value[key] is not None:
                extracted = _extract_text(value[key])
                if extracted:
                    return extracted

        messages = value.get("messages")
        if isinstance(messages, list):
            for msg in reversed(messages):
                if isinstance(msg, dict) and msg.get("content"):
                    extracted = _extract_text(msg.get("content"))
                    if extracted:
                        return extracted
        return json.dumps(value, ensure_ascii=False)

    if isinstance(value, list):
        return "\n".join(str(v) for v in value if v is not None)

    text = _strip_wrappers(str(value))
    if text.startswith("{") or text.startswith("["):
        try:
            parsed = json.loads(text)
            extracted = _extract_text(parsed)
            if extracted:
                return extracted
        except Exception:
            pass
    return text


def _normalize_context(value):
    if value is None:
        return []
    if isinstance(value, list):
        return [str(v) for v in value if v is not None]
    if isinstance(value, dict):
        return [json.dumps(value, ensure_ascii=False)]

    text = _strip_wrappers(str(value))
    if text.startswith("{") or text.startswith("["):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(v) for v in parsed if v is not None]
            if isinstance(parsed, dict):
                embedded = parsed.get("context")
                if isinstance(embedded, list):
                    return [str(v) for v in embedded if v is not None]
                return [json.dumps(parsed, ensure_ascii=False)]
        except Exception:
            pass
    return [text] if text else []


def _truncate(value, max_chars: int):
    if not value:
        return value
    text = str(value)
    if len(text) <= max_chars:
        return text
    return f"{text[:max_chars]}\n...[truncated {len(text) - max_chars} chars]"


def _as_int(value, default_value: int) -> int:
    try:
        return int(value)
    except Exception:
        return default_value

async def run_triggered_evaluation(rule_id: int, trace_data: dict):
    """
    Run evaluation based on a triggered rule and trace data.
    trace_data should look like { "input": ..., "output": ..., "context": ..., "trace_id": ... }
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
            
            # Prepare Inputs
            # Prioritize trace_data, then rule inputs
            query = _extract_text(trace_data.get("input") or inputs.get("input") or inputs.get("query"))
            context = _normalize_context(trace_data.get("context") or inputs.get("context"))
            output = _extract_text(trace_data.get("output") or inputs.get("output") or inputs.get("response"))
            expected = _extract_text(trace_data.get("expected") or inputs.get("expected") or inputs.get("expected_output"))

            minimize_io = bool(inputs.get("minimize_io", False))
            max_input_chars = _as_int(inputs.get("max_input_chars", 500), 500)
            max_output_chars = _as_int(inputs.get("max_output_chars", 2000), 2000)

            query_eval = _truncate(query, max_input_chars) if minimize_io else query
            output_eval = _truncate(output, max_output_chars) if minimize_io else output
            query_store = _truncate(query, max_input_chars) if minimize_io else query
            output_store = _truncate(output, max_output_chars) if minimize_io else output
            target_trace_id = trace_data.get("trace_id")

            for metric_id in metric_ids:
                expected_eval = expected
                # DeepEval Contextual Recall requires expected_output; synthesize a fallback if absent.
                if metric_id in {"ContextualRecallEvaluator", "ContextualPrecisionEvaluator"} and not expected_eval:
                    expected_eval = output_eval or query_eval or "N/A"

                # Create Initial Evaluation Result (PENDING/RUNNING)
                eval_result = EvaluationResult(
                    trace_id=target_trace_id,
                    metric_id=metric_id,
                    input=str(query_store) if query_store else None,
                    output=str(output_store) if output_store else None,
                    context=context,
                    expected_output=str(expected_eval) if expected_eval else None,
                    status="RUNNING",
                    application_name=trace_data.get("application_name") or inputs.get("application_name")
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
                         app_id = rule.application_id
                         if app_id:
                             app_res = await session.get(Application, app_id)
                             if app_res:
                                 # Find Provider for Project
                                 stmt = select(LLMProvider).where(
                                     LLMProvider.project_id == app_res.project_id,
                                     LLMProvider.provider == provider
                                 )
                                 # If multiple, maybe pick first or exact model match? 
                                 # For now, simplistic: match provider
                                 prov_res = await session.execute(stmt)
                                 provider_obj = prov_res.scalars().first()
                                 
                                 if provider_obj:
                                     api_key = provider_obj.api_key
                                     if not model: model = provider_obj.model_name
                                     if not azure_endpoint: azure_endpoint = provider_obj.base_url
                                     if not api_version: api_version = provider_obj.api_version
                                     if not deployment_name: deployment_name = provider_obj.deployment_name

                    if not model:
                        model = "gpt-4o"

                    # Observability Config
                    observe = inputs.get("observe", False)
                    user_api_key = inputs.get("user_api_key")
                    host = inputs.get("host") or "http://localhost:8000"
                    
                    context_api_key = user_api_key if observe else None
                    context_host = host if observe and user_api_key else None
                    
                    if context_api_key:
                        init_observability(url=context_host, api_key=context_api_key)

                    with observability_context(api_key=context_api_key, host=context_host):
                        # 1. Instantiate Evaluator
                        try:
                            eval_module = importlib.import_module("observix.evaluation")
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

                        # 2. Run Evaluation
                        # Fetch Rubric
                        rubric_prompt = None
                        app_id = rule.application_id
                        if app_id:
                             app_res = await session.get(Application, app_id)
                             if app_res and app_res.rubric_prompt:
                                  rubric_prompt = app_res.rubric_prompt

                        # For workflow-aware evaluators, fetch full trace observations
                        # so agents/tools are available in the prompt
                        workflow_trace_payload = None
                        if metric_id in _WORKFLOW_METRIC_IDS and target_trace_id:
                            project_id = None
                            app_id = rule.application_id
                            if app_id:
                                app_res = await session.get(Application, app_id)
                                if app_res:
                                    project_id = app_res.project_id
                            if project_id:
                                workflow_trace_payload = _fetch_trace_for_evaluation(
                                    target_trace_id, project_id
                                )

                        async def _execute_eval():
                            eval_kwargs = dict(
                                input_query=query_eval,
                                output=output_eval,
                                context=context,
                                expected=expected_eval,
                                rubric=rubric_prompt,
                            )
                            if workflow_trace_payload is not None:
                                eval_kwargs["trace"] = workflow_trace_payload
                            res = evaluator.evaluate(**eval_kwargs)
                            if inspect.iscoroutine(res):
                                res = await res
                            return res

                        # Trace execution
                        execution_trace_id = None
                        if observe:
                            tracer = trace.get_tracer("observix")
                            # Force root span by using empty context
                            root_context = otel_context.Context()
                            with tracer.start_as_current_span(
                                f"trigger_eval_{metric_id}",
                                kind=trace.SpanKind.CLIENT,
                                context=root_context
                            ) as span:

                                execution_trace_id = f"{span.get_span_context().trace_id:032x}"
                                result = await _execute_eval()
                        else:
                            result = await _execute_eval()
                            execution_trace_id = result.metadata.get("trace_id")

                        # 3. Update Result
                        eval_result.score = result.score
                        eval_result.reason = result.reason
                        eval_result.passed = result.passed
                        
                        # Add agent details to metadata
                        metadata = dict(result.metadata) if result.metadata else {}
                        if trace_data.get("observation_name"):
                            metadata["agent_name"] = trace_data.get("observation_name")
                        
                        eval_result.metadata_json = metadata
                        # If we have an execution trace ID, we might want to store it in metadata maybe?
                        # or if target_trace_id was none, use execution_trace_id
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
