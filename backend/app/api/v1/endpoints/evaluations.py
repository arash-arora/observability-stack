import inspect
import logging
import importlib
from typing import List, Optional
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
from sqlmodel import select, func, desc
from app.models.metric import Metric
from app.models.evaluation_result import EvaluationResult
from pydantic import BaseModel
from datetime import datetime
import uuid
from app.api.deps import get_current_user
from app.models.all_models import User

class TraceEvaluationSummary(BaseModel):
    trace_id: str
    application_name: str = None
    created_at: datetime
    status: str
    passed: bool
    score_avg: float
    evaluation_count: int


# ... existing imports ...


@router.get("/metrics", response_model=List[Metric])
async def list_metrics(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
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
                prompt=metric_info.prompt,
            )
            db.add(metric)
        await db.commit()

        # Re-fetch
        result = await db.execute(select(Metric))
        result = await db.execute(select(Metric))
        metrics = result.scalars().all()

    # Filter metrics: user can see all static metrics + their own custom metrics
    filtered_metrics = []
    for m in metrics:
        if m.type == "custom":
            if m.user_id == current_user.id:
                filtered_metrics.append(m)
        else:
            filtered_metrics.append(m)

    return filtered_metrics


class MetricCreate(BaseModel):
    name: str
    description: str
    provider: str = "openai"
    type: str = "custom"
    tags: List[str] = ["custom"]
    inputs: List[str] = []
    code_snippet: Optional[str] = None
    prompt: Optional[str] = None
    dummy_data: Optional[dict] = None

@router.post("/metrics", response_model=Metric)
async def create_metric(
    metric_data: MetricCreate, 
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new custom metric in the database.
    """
    metric_id = f"custom-{uuid.uuid4()}"
    metric = Metric(
        id=metric_id,
        name=metric_data.name,
        description=metric_data.description,
        provider=metric_data.provider,
        type=metric_data.type,
        tags=metric_data.tags,
        inputs=metric_data.inputs,
        code_snippet=metric_data.code_snippet or "",
        prompt=metric_data.prompt,
        dummy_data=metric_data.dummy_data,
        user_id=current_user.id
    )
    db.add(metric)
    await db.commit()
    await db.refresh(metric)
    return metric

@router.put("/metrics/{metric_id}", response_model=Metric)
async def update_metric(
    metric_id: str,
    metric_data: MetricCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Update a custom metric by ID.
    """
    result = await db.execute(select(Metric).where(Metric.id == metric_id))
    metric = result.scalars().first()
    
    if not metric:
        raise HTTPException(status_code=404, detail="Metric not found")
        
    if metric.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this metric")

    metric.name = metric_data.name
    metric.description = metric_data.description
    metric.provider = metric_data.provider
    metric.type = metric_data.type
    metric.tags = metric_data.tags
    metric.inputs = metric_data.inputs
    metric.code_snippet = metric_data.code_snippet or ""
    metric.prompt = metric_data.prompt
    metric.dummy_data = metric_data.dummy_data

    await db.commit()
    await db.refresh(metric)
    return metric

@router.delete("/metrics/{metric_id}")
async def delete_metric(
    metric_id: str,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a custom metric by ID.
    """
    result = await db.execute(select(Metric).where(Metric.id == metric_id))
    metric = result.scalars().first()
    
    if not metric:
        raise HTTPException(status_code=404, detail="Metric not found")
        
    if metric.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this metric")

    await db.delete(metric)
    await db.commit()
    return {"status": "success"}


@router.post("/run", response_model=EvaluationResponse)
async def run_evaluation(
    request: EvaluationRequest, db: AsyncSession = Depends(get_session)
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
    logger.info(f"RUN_EVALUATION INPUTS: {inputs}")
    observe = inputs.get("observe", False)
    logger.info(f"RUN_EVALUATION OBSERVE FLAG: {observe}")
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
            custom_prompt = inputs.get("custom_prompt")
            metric_prompt = custom_prompt
            
            if not metric_prompt and request.metric_id:
                # Let's try to get it from DB
                from app.models.metric import Metric
                metric_row = await db.get(Metric, request.metric_id)
                if metric_row and metric_row.prompt:
                    metric_prompt = metric_row.prompt
            
            try:
                llm_kwargs = {}
                if api_key:
                    llm_kwargs["api_key"] = api_key
                if azure_endpoint:
                    llm_kwargs["azure_endpoint"] = azure_endpoint
                if api_version:
                    llm_kwargs["api_version"] = api_version
                if deployment_name:
                    llm_kwargs["deployment_name"] = deployment_name

                if metric_prompt:
                    from observix.evaluation.integrations.observix_eval import CustomEvaluator
                    EvaluatorClass = CustomEvaluator
                    evaluator = EvaluatorClass(
                        provider=provider, model=model, **llm_kwargs
                    )
                else:
                    # We dynamically import from observix.evaluation
                    eval_module = importlib.import_module("observix.evaluation")
                    EvaluatorClass = getattr(eval_module, request.metric_id, None)

                    if not EvaluatorClass:
                        raise ValueError(
                            f"Evaluator class {request.metric_id} not found in SDK"
                        )

                    # Initialize Evaluator with LLM
                    try:
                        evaluator = EvaluatorClass(
                            provider=provider, model=model, **llm_kwargs
                        )
                    except TypeError:
                        logger.warning(
                            f"Evaluator {request.metric_id} does not accept llm/kwargs in init. Trying default init."
                        )
                        try:
                            evaluator = EvaluatorClass()
                        except Exception as e:
                            raise HTTPException(
                                status_code=400,
                                detail=f"Evaluator {request.metric_id} init failed even with default init: {str(e)}",
                            )

            except Exception as e:
                logger.error(f"Failed to init Evaluator: {e}")
                return EvaluationResponse(
                    score=0.0, passed=False, reason=f"Evaluator Init Failed: {str(e)}"
                )

            # 3. Run Evaluation
            try:
                query = inputs.get("input") or inputs.get("query")
                context = inputs.get("context")
                output = inputs.get("output") or inputs.get("response")
                expected = inputs.get("expected")

                trace_id = None

                trace_input = inputs.get("trace")

                # Fetch Application Rubrics (Application Context)
                rubric_prompt = None

                # Resolving Application to get Rubric
                # Priority 1: user_api_key (Observix API Key) - Most reliable
                api_key_obj = None
                if user_api_key:
                    from app.models.all_models import ApiKey
                    from sqlalchemy.orm import selectinload as sql_selectinload

                    # Query ApiKey -> Application
                    stmt = (
                        select(ApiKey)
                        .options(sql_selectinload(ApiKey.application))
                        .where(ApiKey.key == user_api_key)
                    )
                    ak_result = await db.execute(stmt)
                    api_key_obj = ak_result.scalars().first()

                    if (
                        api_key_obj
                        and api_key_obj.application
                        and api_key_obj.application.rubric_prompt
                    ):
                        rubric_prompt = api_key_obj.application.rubric_prompt

                # Priority 2: application_id in inputs (if API key not provided or failed)
                if not rubric_prompt and inputs.get("application_id"):
                    from app.models.all_models import Application

                    app_id_val = inputs.get("application_id")

                    # Validate usage permissions/auth if strictly needed,
                    # but here we assume the runner has access if they can trigger eval
                    app_res = await db.get(Application, app_id_val)
                    if app_res and app_res.rubric_prompt:
                        rubric_prompt = app_res.rubric_prompt

                async def _execute_eval():
                    # Forward any non-standard inputs directly to Evaluator as kwargs
                    mapped_keys = {"input", "query", "output", "response", "context", "expected", "trace", "provider", "model", "api_key", "azure_endpoint", "api_version", "deployment_name", "observe", "user_api_key", "host", "custom_prompt"}
                    extra_kwargs = {k: v for k, v in inputs.items() if k not in mapped_keys}
                    
                    if metric_prompt:
                        import re
                        formatted_prompt = metric_prompt
                        # Frontend creates variables with {{var_name}}
                        variables = set(re.findall(r'\{\{([^}]+)\}\}', metric_prompt))
                        for var in variables:
                            # Map standard expected variables differently if they are mapped to input keys
                            val = inputs.get(var)
                            if val is None:
                                # fallback to lower
                                val = inputs.get(var.lower(), "")
                                
                            formatted_prompt = formatted_prompt.replace(f"{{{{{var}}}}}", str(val))
                            
                        # Format any single braced variables if the user mixed them up (only if exist in inputs)
                        single_vars = set(re.findall(r'(?<!\{)\{([^}]+)\}(?!\})', formatted_prompt))
                        for var in single_vars:
                            if var in inputs:
                                formatted_prompt = formatted_prompt.replace(f"{{{var}}}", str(inputs[var]))
                                
                        extra_kwargs["custom_instructions"] = formatted_prompt

                    res = evaluator.evaluate(
                        input_query=query,
                        output=output,
                        context=(
                            context
                            if isinstance(context, list)
                            else [str(context)] if context else []
                        ),
                        expected=expected,
                        trace=trace_input,
                        rubric=rubric_prompt,  # Pass the rubric to SDK
                        trace_enabled=observe,  # Pass tracing flag
                        **extra_kwargs
                    )
                    if inspect.iscoroutine(res):
                        res = await res
                    return res

                if observe:
                    tracer = trace.get_tracer("observix")
                    with tracer.start_as_current_span(
                        f"{request.metric_id}", kind=trace.SpanKind.CLIENT
                    ) as span:
                        trace_id = f"{span.get_span_context().trace_id:032x}"
                        result = await _execute_eval()
                else:
                    result = await _execute_eval()
                    # Fallback if evaluator returns trace_id in metadata
                    trace_id = result.metadata.get("trace_id")

                # Save Result to DB (if enabled AND observed)
                # User req: Only save if being traced/observed
                persist_result = inputs.get("persist_result", True)
                if persist_result and observe:
                    try:
                        target_trace_id = request.trace_id or inputs.get("trace_id") or (inputs.get("trace") if isinstance(inputs.get("trace"), str) else inputs.get("trace", {}).get("trace_id") if isinstance(inputs.get("trace"), dict) else None)
                        
                        resolved_app_name = None
                        if target_trace_id:
                            try:
                                from app.core.clickhouse import get_clickhouse_client
                                ch_client = get_clickhouse_client()
                                ch_res = ch_client.query(f"SELECT application_name FROM traces WHERE trace_id = '{target_trace_id}' LIMIT 1").result_rows
                                if ch_res and ch_res[0][0]:
                                    resolved_app_name = str(ch_res[0][0])
                            except Exception as ex:
                                logger.error(f"Failed to query trace application_name: {ex}")
                        
                        eval_result = EvaluationResult(
                            trace_id=target_trace_id or trace_id,
                            metric_id=request.metric_id,
                            input=str(query) if query else None,
                            output=str(output) if output else None,
                            context=(
                                context
                                if isinstance(context, list)
                                else [str(context)] if context else []
                            ),
                            expected_output=str(expected) if expected else None,
                            score=result.score,
                            reason=result.reason,
                            passed=result.passed,
                            status="COMPLETED",
                            metadata_json=result.metadata,
                            application_name=resolved_app_name or inputs.get("application_name")
                            or (
                                api_key_obj.application.name
                                if api_key_obj and api_key_obj.application
                                else None
                            ),
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
                    trace_id=trace_id,
                )

            except Exception as e:
                logger.error(f"Evaluation failed: {e}")
                raise HTTPException(status_code=500, detail=str(e))

        except Exception as e:
            logger.error(f"Evaluation Execution Failed: {e}")
            return EvaluationResponse(
                score=0.0, passed=False, reason=f"Execution Failed: {str(e)}"
            )


@router.get("/runs", response_model=List[TraceEvaluationSummary])
async def list_evaluation_runs(
    limit: int = 50, offset: int = 0, db: AsyncSession = Depends(get_session)
):
    """
    List evaluation runs grouped by trace_id.
    """
    # Group by trace_id
    stmt = (
        select(
            EvaluationResult.trace_id,
            func.max(EvaluationResult.application_name).label("application_name"),
            func.max(EvaluationResult.created_at).label("created_at"),
            func.count(EvaluationResult.id).label("count"),
            func.avg(EvaluationResult.score).label("avg_score"),
            func.bool_and(EvaluationResult.passed).label("all_passed"),
            func.array_agg(EvaluationResult.status).label("statuses"),
        )
        .group_by(EvaluationResult.trace_id)
        .order_by(desc("created_at"))
        .offset(offset)
        .limit(limit)
    )

    results = await db.execute(stmt)
    runs = []

    for row in results.all():
        trace_id = row[0]
        # Skip if trace_id is None (shouldn't happen for valid runs but good safeguard)
        if not trace_id:
            continue

        statuses = row[6]
        status = "COMPLETED"
        if "FAILED" in statuses:
            status = "FAILED"
        elif "RUNNING" in statuses:
            status = "RUNNING"

        runs.append(
            TraceEvaluationSummary(
                trace_id=trace_id,
                application_name=row[1] or "Unknown",
                created_at=row[2],
                status=status,
                passed=row[5] if row[5] is not None else False,
                score_avg=round(row[4], 2) if row[4] is not None else 0.0,
                evaluation_count=row[3],
            )
        )

    return runs


@router.get("/results", response_model=List[EvaluationResult])
async def list_evaluation_results(
    limit: int = 100,
    offset: int = 0,
    metric_id: str = None,
    trace_id: str = None,
    db: AsyncSession = Depends(get_session),
):
    """
    List historical evaluation results.
    """
    query = (
        select(EvaluationResult)
        .order_by(EvaluationResult.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    if metric_id:
        query = query.where(EvaluationResult.metric_id == metric_id)
    if trace_id:
        query = query.where(EvaluationResult.trace_id == trace_id)

    result = await db.execute(query)
    return result.scalars().all()


@router.get("/results/{id}", response_model=EvaluationResult)
async def get_evaluation_result(id: str, db: AsyncSession = Depends(get_session)):
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
async def get_evaluation_stats(db: AsyncSession = Depends(get_session)):
    """
    Get aggregate statistics for evaluations (Completed only).
    """
    # Total Count
    result = await db.execute(select(EvaluationResult))
    all_results = result.scalars().all()

    # Filter for completed only for stats
    completed_results = [
        r for r in all_results if r.status == "COMPLETED" and r.score is not None
    ]
    total = len(completed_results)

    if total == 0:
        return {"total": 0, "pass_rate": 0, "avg_score": 0, "breakdown": []}

    # Pass Rate
    passed = len([r for r in completed_results if r.passed])
    pass_rate = (passed / total) * 100

    # Average Score
    avg_score = sum([r.score for r in completed_results]) / total

    # Breakdown by Metric
    # Simple aggregation (in-memory if dataset is small, otherwise use SQL grouping)
    breakdown = {}
    for r in completed_results:
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
            "avg_score": v["score_sum"] / v["total"],
        }
        for k, v in breakdown.items()
    ]

    return {
        "total": total,
        "pass_rate": pass_rate,
        "avg_score": avg_score,
        "breakdown": breakdown_list,
    }
