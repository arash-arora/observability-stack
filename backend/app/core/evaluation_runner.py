import importlib
import logging
import inspect
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

logger = logging.getLogger(__name__)

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
            query = trace_data.get("input") or inputs.get("input") or inputs.get("query")
            context = trace_data.get("context") or inputs.get("context")
            output = trace_data.get("output") or inputs.get("output") or inputs.get("response")    
            expected = trace_data.get("expected") or inputs.get("expected")
            target_trace_id = trace_data.get("trace_id")

            for metric_id in metric_ids:
                # Create Initial Evaluation Result (PENDING/RUNNING)
                eval_result = EvaluationResult(
                    trace_id=target_trace_id,
                    metric_id=metric_id,
                    input=str(query) if query else None,
                    output=str(output) if output else None,
                    context=context if isinstance(context, list) else [str(context)] if context else [],
                    expected_output=str(expected) if expected else None,
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

                        async def _execute_eval():
                            res = evaluator.evaluate(
                                input_query=query,
                                output=output,
                                context=context if isinstance(context, list) else [str(context)] if context else [],
                                expected=expected,
                                rubric=rubric_prompt
                            )
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
