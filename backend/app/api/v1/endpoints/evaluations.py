import inspect
import logging
import importlib
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from opentelemetry import trace
from app.core.database import get_session
from app.core.schema import MetricInfo, EvaluationRequest, EvaluationResponse
from app.api.v1.endpoints.data.metric_data import STATIC_METRICS_REGISTRY
from observix.context import observability_context
from observix import init_observability

router = APIRouter()
logger = logging.getLogger(__name__)

# Static Registry to avoid Runtime Import/Dependency Issues in Backend Container
from sqlmodel import select
from app.models.metric import Metric
from app.models.evaluation_result import EvaluationResult

# ... existing imports ...

@router.get("/metrics", response_model=List[Metric])
async def list_metrics(
    db: AsyncSession = Depends(get_session)
):
    """
    List all available metrics from the database.
    Seeds the database with static registry if empty.
    """
    result = await db.execute(select(Metric))
    metrics = result.scalars().all()

    if not metrics:
        logger.info("No metrics found in DB. Seeding from static registry...")
        for metric_info in STATIC_METRICS_REGISTRY:
            metric = Metric(
                id=metric_info.id,
                name=metric_info.name,
                description=metric_info.description,
                provider=metric_info.provider,
                type=metric_info.type,
                tags=metric_info.tags,
                inputs=metric_info.inputs,
                code_snippet=metric_info.code_snippet,
                prompt=metric_info.prompt
            )
            db.add(metric)
        await db.commit()
        
        # Re-fetch
        result = await db.execute(select(Metric))
        metrics = result.scalars().all()
        
    return metrics


@router.post("/run", response_model=EvaluationResponse)
async def run_evaluation(
    request: EvaluationRequest,
    db: AsyncSession = Depends(get_session)
):
    """
    Run an evaluation on-demand using the SDK.
    """
    inputs = request.inputs
    provider = inputs.get("provider", "openai")
    model = inputs.get("model", "gpt-4o")
    
    # Extract Credentials
    api_key = inputs.get("api_key")
    azure_endpoint = inputs.get("azure_endpoint")
    api_version = inputs.get("api_version")
    deployment_name = inputs.get("deployment_name")

    # Observability Configuration
    observe = inputs.get("observe", False)
    user_api_key = inputs.get("user_api_key")
    host = inputs.get("host") or "http://localhost:8000"

    context_api_key = user_api_key if observe else None
    context_host = host if observe and user_api_key else None
    
    # Initialize with request-scoped credentials (idempotent - won't add duplicate processors)
    if context_api_key:
        init_observability(url=context_host, api_key=context_api_key)

    with observability_context(api_key=context_api_key, host=context_host):
        try:
            # 2. Instantiate Evaluator
            # We dynamically import from observix.evaluation
            try:
                eval_module = importlib.import_module("observix.evaluation")
                EvaluatorClass = getattr(eval_module, request.metric_id, None)
                
                if not EvaluatorClass:
                    raise ValueError(f"Evaluator class {request.metric_id} not found in SDK")
                    
                # Initialize Evaluator with LLM
                try:
                    # Pass credentials via kwargs
                    llm_kwargs = {}
                    if api_key:
                        llm_kwargs['api_key'] = api_key
                    if azure_endpoint:
                        llm_kwargs['azure_endpoint'] = azure_endpoint
                    if api_version:
                        llm_kwargs['api_version'] = api_version
                    if deployment_name:
                        llm_kwargs['deployment_name'] = deployment_name

                    evaluator = EvaluatorClass(provider=provider, model=model, **llm_kwargs)
                except TypeError:
                     logger.warning(f"Evaluator {request.metric_id} does not accept llm/kwargs in init. Trying default init.")
                     raise HTTPException(
                        status_code=400,
                        detail=f"Evaluator {request.metric_id} init failed: {str(e)}",
                    )
        
            except Exception as e:
                logger.error(f"Failed to init Evaluator: {e}")
                return EvaluationResponse(score=0.0, passed=False, reason=f"Evaluator Init Failed: {str(e)}")
        
            # 3. Run Evaluation
            try:
                query = inputs.get("input") or inputs.get("query")
                context = inputs.get("context")
                output = inputs.get("output") or inputs.get("response")    
                expected = inputs.get("expected")
                
                trace_id = None
                
                trace_input = inputs.get("trace")

                async def _execute_eval():
                    res = evaluator.evaluate(
                        input_query=query,
                        output=output,
                        context=context if isinstance(context, list) else [str(context)] if context else [],
                        expected=expected,
                        trace=trace_input
                    )
                    if inspect.iscoroutine(res):
                        res = await res
                    return res

                if observe:
                    tracer = trace.get_tracer("observix")
                    with tracer.start_as_current_span(
                        f"evaluation_{request.metric_id}",
                        kind=trace.SpanKind.CLIENT
                    ) as span:
                        trace_id = f"{span.get_span_context().trace_id:032x}"
                        result = await _execute_eval()
                else:
                    result = await _execute_eval()
                    # Fallback if evaluator returns trace_id in metadata
                    trace_id = result.metadata.get("trace_id")
                
                # Save Result to DB (if enabled)
                persist_result = inputs.get("persist_result", True)
                if persist_result:
                    try:
                        eval_result = EvaluationResult(
                            trace_id=trace_id,
                            metric_id=request.metric_id,
                            input=str(query) if query else None,
                            output=str(output) if output else None,
                            context=context if isinstance(context, list) else [str(context)] if context else [],
                            expected_output=str(expected) if expected else None,
                            score=result.score,
                            reason=result.reason,
                            passed=result.passed,
                            metadata_json=result.metadata,
                            application_name=inputs.get("application_name")
                        )
                        db.add(eval_result)
                        await db.commit()
                    except Exception as e:
                        logger.error(f"Failed to save evaluation result to DB: {e}")
                        # Don't fail the request if saving fails, just log it
                
                return EvaluationResponse(
                    score=result.score,
                    reason=result.reason or "Evaluation completed successfully.",
                    passed=result.passed,
                    trace_id=trace_id
                )
                    
            except Exception as e:
                logger.error(f"Evaluation failed: {e}")
                raise HTTPException(status_code=500, detail=str(e))
                
        except Exception as e:
            logger.error(f"Evaluation Execution Failed: {e}")
            return EvaluationResponse(score=0.0, passed=False, reason=f"Execution Failed: {str(e)}")


@router.get("/results", response_model=List[EvaluationResult])
async def list_evaluation_results(
    limit: int = 100,
    offset: int = 0,
    metric_id: str = None,
    db: AsyncSession = Depends(get_session)
):
    """
    List historical evaluation results.
    """
    query = select(EvaluationResult).order_by(EvaluationResult.created_at.desc()).offset(offset).limit(limit)
    if metric_id:
        query = query.where(EvaluationResult.metric_id == metric_id)
        
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/results/{id}", response_model=EvaluationResult)
async def get_evaluation_result(
    id: str,
    db: AsyncSession = Depends(get_session)
):
    """
    Get a single evaluation result by ID.
    """
    try:
        # Validate UUID
        import uuid
        uuid_obj = uuid.UUID(id)
    except ValueError:
         raise HTTPException(status_code=400, detail="Invalid UUID format")

    result = await db.get(EvaluationResult, uuid_obj)
    if not result:
        raise HTTPException(status_code=404, detail="Evaluation result not found")
        
    return result


@router.get("/stats")
async def get_evaluation_stats(
    db: AsyncSession = Depends(get_session)
):
    """
    Get aggregate statistics for evaluations.
    """
    # Total Count
    result = await db.execute(select(EvaluationResult))
    all_results = result.scalars().all()
    total = len(all_results)
    
    if total == 0:
        return {
            "total": 0,
            "pass_rate": 0,
            "avg_score": 0,
            "breakdown": []
        }

    # Pass Rate
    passed = len([r for r in all_results if r.passed])
    pass_rate = (passed / total) * 100
    
    # Average Score
    avg_score = sum([r.score for r in all_results]) / total
    
    # Breakdown by Metric
    # Simple aggregation (in-memory if dataset is small, otherwise use SQL grouping)
    breakdown = {}
    for r in all_results:
        if r.metric_id not in breakdown:
            breakdown[r.metric_id] = {"total": 0, "passed": 0, "score_sum": 0}
        
        breakdown[r.metric_id]["total"] += 1
        breakdown[r.metric_id]["score_sum"] += r.score
        if r.passed:
            breakdown[r.metric_id]["passed"] += 1
            
    breakdown_list = [
        {
            "metric_id": k,
            "total": v["total"],
            "pass_rate": (v["passed"] / v["total"]) * 100,
            "avg_score": v["score_sum"] / v["total"]
        }
        for k, v in breakdown.items()
    ]
    
    return {
        "total": total,
        "pass_rate": pass_rate,
        "avg_score": avg_score,
        "breakdown": breakdown_list
    }
