import inspect
import logging
import importlib
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.schema import MetricInfo, EvaluationRequest, EvaluationResponse
from app.core.security import (
    hash_api_key,
    decrypt_value,
    create_internal_ingest_token,
    resolve_ingest_key_hash,
)
from app.api.v1.endpoints.data.metric_data import STATIC_METRICS_REGISTRY
from app.models.llm_provider import LLMProvider

router = APIRouter()
logger = logging.getLogger(__name__)

# Static Registry to avoid Runtime Import/Dependency Issues in Backend Container
from sqlmodel import select, func, desc
from app.models.metric import Metric
from app.models.evaluation_result import EvaluationResult
from app.models.all_models import Application, ApiKey, Project, OrganizationUserLink
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
    trigger_type: str = "sdk"


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
    request: EvaluationRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
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

    # If a registered provider is referenced, resolve credentials server-side.
    # This avoids relying on masked API keys from frontend provider list responses.
    provider_id = inputs.get("provider_id")
    if provider_id:
        provider_obj = None
        try:
            provider_obj = await db.get(LLMProvider, provider_id)
        except Exception:
            provider_obj = None

        if not provider_obj:
            raise HTTPException(status_code=400, detail="Invalid provider_id")

        provider = provider_obj.provider
        azure_endpoint = provider_obj.base_url
        api_version = provider_obj.api_version
        deployment_name = provider_obj.deployment_name

        if provider == "azure":
            model = provider_obj.deployment_name or provider_obj.model_name
        else:
            model = provider_obj.model_name

        try:
            api_key = decrypt_value(provider_obj.api_key)
        except Exception:
            # Backward compatibility for any rows not yet encrypted.
            api_key = provider_obj.api_key

    # Observability Configuration
    logger.info(f"RUN_EVALUATION INPUTS: {inputs}")
    observe = inputs.get("observe", False)
    logger.info(f"RUN_EVALUATION OBSERVE FLAG: {observe}")
    user_api_key = inputs.get("user_api_key")
    host = inputs.get("host") or "http://localhost:8000"

    # For trace/node evaluations, auto-resolve the ingest key from app context
    # if frontend doesn't provide one explicitly.
    trace_input = inputs.get("trace")
    if observe and not user_api_key:
        app_name = inputs.get("application_name")

        if not app_name and isinstance(trace_input, dict):
            app_name = trace_input.get("application_name")
            if not app_name:
                spans = trace_input.get("spans") if isinstance(trace_input.get("spans"), list) else []
                observations = (
                    trace_input.get("observations")
                    if isinstance(trace_input.get("observations"), list)
                    else []
                )
                if spans:
                    app_name = spans[0].get("application_name")
                if not app_name and observations:
                    app_name = observations[0].get("application_name")

        if app_name:
            app_stmt = (
                select(Application)
                .join(Project, Application.project_id == Project.id)
                .join(
                    OrganizationUserLink,
                    OrganizationUserLink.organization_id == Project.organization_id,
                )
                .where(
                    Application.name == app_name,
                    OrganizationUserLink.user_id == current_user.id,
                )
            )
            app_res = await db.execute(app_stmt)
            app_obj = app_res.scalars().first()

            if app_obj:
                key_stmt = (
                    select(ApiKey)
                    .where(ApiKey.application_id == app_obj.id, ApiKey.is_active == True)
                    .order_by(desc(ApiKey.created_at))
                )
                key_res = await db.execute(key_stmt)
                key_obj = key_res.scalars().first()
                if key_obj:
                    user_api_key = create_internal_ingest_token(key_obj.key)

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
                from app.core.evaluation.integrations.observix_eval import CustomEvaluator
                EvaluatorClass = CustomEvaluator
                evaluator = EvaluatorClass(
                    provider=provider, model=model, **llm_kwargs
                )
            else:
                # We dynamically import from app.core.evaluation
                eval_module = importlib.import_module("app.core.evaluation")
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
            if not query and isinstance(trace_input, dict):
                query = trace_input.get("input")
                if not query:
                    spans = trace_input.get("spans", [])
                    if isinstance(spans, list):
                        root_span = next((s for s in spans if isinstance(s, dict) and not s.get("parent_span_id")), None)
                        if not root_span and spans:
                            root_span = spans[0]
                        if isinstance(root_span, dict):
                            query = root_span.get("input")

            context = inputs.get("context")
            
            output = inputs.get("output") or inputs.get("response")
            if not output and isinstance(trace_input, dict):
                output = trace_input.get("output")
                if not output:
                    spans = trace_input.get("spans", [])
                    if isinstance(spans, list):
                        root_span = next((s for s in spans if isinstance(s, dict) and not s.get("parent_span_id")), None)
                        if not root_span and spans:
                            root_span = spans[0]
                        if isinstance(root_span, dict):
                            output = root_span.get("output")

            expected = inputs.get("expected")

            trace_id = None

            # Fetch Application Rubrics (Application Context)
            rubric_prompt = None

            # Resolving Application to get Rubric
            # Priority 1: user_api_key (Observix API Key) - Most reliable
            api_key_obj = None
            if user_api_key:
                from sqlalchemy.orm import selectinload as sql_selectinload

                key_hash = resolve_ingest_key_hash(user_api_key)

                # Query ApiKey by resolved hash -> Application
                stmt = (
                    select(ApiKey)
                    .options(sql_selectinload(ApiKey.application))
                    .where(ApiKey.key == key_hash)
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
                app_id_val = inputs.get("application_id")
                app_res = await db.get(Application, app_id_val)
                if app_res and app_res.rubric_prompt:
                    rubric_prompt = app_res.rubric_prompt

            async def _execute_eval():
                # Forward any non-standard inputs directly to Evaluator as kwargs
                mapped_keys = {"input", "query", "output", "response", "context", "expected", "trace", "provider", "provider_id", "model", "api_key", "azure_endpoint", "api_version", "deployment_name", "observe", "user_api_key", "host", "custom_prompt"}
                extra_kwargs = {k: v for k, v in inputs.items() if k not in mapped_keys}
                
                if metric_prompt:
                    import re
                    formatted_prompt = metric_prompt
                    variables = set(re.findall(r'\{\{([^}]+)\}\}', metric_prompt))
                    for var in variables:
                        val = inputs.get(var)
                        if val is None:
                            val = inputs.get(var.lower(), "")
                        formatted_prompt = formatted_prompt.replace(f"{{{{{var}}}}}", str(val))
                        
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
                    rubric=rubric_prompt,
                    trace_enabled=False,  # tracing disabled
                    **extra_kwargs
                )
                if inspect.iscoroutine(res):
                    res = await res
                return res

            result = await _execute_eval()
            trace_id = result.metadata.get("trace_id") if result.metadata else None

            # Save Result to DB
            persist_result = inputs.get("persist_result", True)
            if persist_result:
                try:
                    target_trace_id = request.trace_id or inputs.get("trace_id") or (inputs.get("trace") if isinstance(inputs.get("trace"), str) else inputs.get("trace", {}).get("trace_id") if isinstance(inputs.get("trace"), dict) else None)
                    if not target_trace_id:
                        import uuid
                        target_trace_id = f"manual_{uuid.uuid4().hex}"
                    
                    resolved_app_name = None
                    if target_trace_id and not target_trace_id.startswith("manual_"):
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
                        metadata_json=(
                            {**(result.metadata or {}), "workflow_details": inputs["workflow_details"]}
                            if "workflow_details" in inputs and isinstance(result.metadata or {}, dict)
                            else result.metadata
                        ),
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
    limit: int = 50,
    offset: int = 0,
    time_range: str = "24h",
    application_name: Optional[str] = None,
    db: AsyncSession = Depends(get_session)
):
    """
    List evaluation runs grouped by trace_id with optional filters.
    time_range: "24h", "7d", "30d", "all"
    application_name: optional filter by application name
    """
    from datetime import timedelta, datetime as dt

    # Calculate time filter
    now = dt.utcnow()
    if time_range == "24h":
        time_filter = now - timedelta(hours=24)
    elif time_range == "7d":
        time_filter = now - timedelta(days=7)
    elif time_range == "30d":
        time_filter = now - timedelta(days=30)
    else:  # "all"
        time_filter = None

    # Build query with filters
    stmt = (
        select(
            EvaluationResult.trace_id,
            func.max(EvaluationResult.application_name).label("application_name"),
            func.max(EvaluationResult.created_at).label("created_at"),
            func.count(EvaluationResult.id).label("count"),
            func.avg(EvaluationResult.score).label("avg_score"),
            func.bool_and(EvaluationResult.passed).label("all_passed"),
            func.array_agg(EvaluationResult.status).label("statuses"),
            func.json_agg(EvaluationResult.metadata_json).label("metadatas"),
        )
    )

    # Add time filter
    if time_filter:
        stmt = stmt.where(EvaluationResult.created_at >= time_filter)

    # Add application name filter
    if application_name:
        stmt = stmt.where(EvaluationResult.application_name == application_name)

    # Complete the query
    stmt = (
        stmt
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

        metadatas = row[7] or []
        trigger_type = "sdk"
        for meta in metadatas:
            if isinstance(meta, dict) and "trigger_type" in meta:
                trigger_type = meta["trigger_type"]
                break

        runs.append(
            TraceEvaluationSummary(
                trace_id=trace_id,
                application_name=row[1] or "Unknown",
                created_at=row[2],
                status=status,
                passed=row[5] if row[5] is not None else False,
                score_avg=round(row[4], 2) if row[4] is not None else 0.0,
                evaluation_count=row[3],
                trigger_type=trigger_type,
            )
        )

    return runs


@router.get("/results", response_model=List[EvaluationResult])
async def list_evaluation_results(
    limit: int = 100,
    offset: int = 0,
    metric_id: str = None,
    trace_id: str = None,
    batch_id: str = None,
    db: AsyncSession = Depends(get_session),
):
    """
    List historical evaluation results. Optionally filter by metric_id, trace_id, or batch_id.
    """
    from sqlalchemy import cast, String
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
    if batch_id:
        # Filter where metadata_json->>'batch_id' == batch_id (PostgreSQL JSON operator)
        from sqlalchemy import text
        query = query.where(
            text("metadata_json->>'batch_id' = :batch_id")
        ).params(batch_id=batch_id)

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


# ===== BATCH EVALUATION ENDPOINTS =====

from app.models.batch_evaluation import BatchEvaluation
from pydantic import BaseModel
from datetime import datetime, timezone
import random


class BatchEvalCreateRequest(BaseModel):
    application_id: str
    from_date: Optional[datetime] = None
    to_date: Optional[datetime] = None
    use_all_traces: bool = False  # If True, ignore date range and use all available traces
    metric_ids: str  # comma-separated
    traces_to_eval: int
    is_percentage: bool = False
    percentage_value: Optional[float] = None
    provider: str
    model_name: str
    api_key: Optional[str] = None
    provider_id: Optional[uuid.UUID] = None
    base_url: Optional[str] = None
    api_version: Optional[str] = None
    deployment_name: Optional[str] = None


class BatchEvalResponse(BaseModel):
    id: uuid.UUID
    application_id: str
    status: str
    total_traces: int
    traces_to_eval: int
    evaluated_traces: int
    successful_evaluations: int
    failed_evaluations: int
    avg_score: Optional[float]
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


@router.get("/batch", response_model=List[BatchEvalResponse])
async def list_batch_evaluations(
    application_id: Optional[str] = None,
    project_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List all batch evaluations for an application, project, or user"""
    stmt = select(BatchEvaluation).where(
        BatchEvaluation.user_id == current_user.id
    )
    if application_id:
        stmt = stmt.where(BatchEvaluation.application_id == application_id)
    if project_id:
        stmt = stmt.where(BatchEvaluation.project_id == project_id)
        
    stmt = stmt.order_by(desc(BatchEvaluation.created_at))
    result = await db.execute(stmt)
    batch_evals = result.scalars().all()
    return batch_evals


@router.get("/batch/{batch_id}", response_model=BatchEvalResponse)
async def get_batch_evaluation(
    batch_id: uuid.UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get a specific batch evaluation"""
    batch_eval = await db.get(BatchEvaluation, batch_id)
    if not batch_eval:
        raise HTTPException(status_code=404, detail="Batch evaluation not found")

    if batch_eval.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to access this batch evaluation")

    return batch_eval


@router.get("/batch-traces-count")
async def get_traces_count(
    application_id: str,
    from_date: datetime,
    to_date: datetime,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get count of traces in a date range for an application"""
    try:
        from app.core.clickhouse import get_clickhouse_client
        import uuid

        app_obj = await db.get(Application, uuid.UUID(application_id))
        if not app_obj:
            raise HTTPException(status_code=400, detail="Invalid application_id")
        app_name = app_obj.name

        client = get_clickhouse_client()

        # Convert to string format for ClickHouse
        from_timestamp = int(from_date.timestamp() * 1000)
        to_timestamp = int(to_date.timestamp() * 1000)

        query = f"""
        SELECT COUNT(*) as count
        FROM traces
        WHERE application_name = '{app_name}'
        AND start_time >= {from_timestamp}000000
        AND start_time <= {to_timestamp}000000
        """

        result = client.query(query)
        count = result.result_rows[0][0] if result.result_rows else 0

        return {"total_traces": count}
    except Exception as e:
        logger.error(f"Failed to get traces count: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get traces count: {str(e)}")


@router.post("/batch", response_model=BatchEvalResponse)
async def create_batch_evaluation(
    request: BatchEvalCreateRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Create and run a batch evaluation"""
    try:
        from app.core.clickhouse import get_clickhouse_client
        import uuid

        # Resolve Application details from DB
        app_res = await db.get(Application, uuid.UUID(request.application_id))
        if not app_res:
            raise HTTPException(status_code=400, detail="Invalid application_id")
        actual_project_id = app_res.project_id
        app_name = app_res.name

        # Resolve provider configuration
        provider = request.provider
        model_name = request.model_name
        api_key = request.api_key
        base_url = request.base_url
        api_version = request.api_version
        deployment_name = request.deployment_name

        if request.provider_id:
            provider_obj = await db.get(LLMProvider, request.provider_id)
            if not provider_obj:
                raise HTTPException(status_code=400, detail="Invalid provider_id")

            provider = provider_obj.provider
            model_name = provider_obj.model_name
            base_url = provider_obj.base_url
            api_version = provider_obj.api_version
            deployment_name = provider_obj.deployment_name

            try:
                api_key = decrypt_value(provider_obj.api_key)
            except Exception:
                api_key = provider_obj.api_key

        # Get trace IDs from ClickHouse
        client = get_clickhouse_client()

        if request.use_all_traces:
            query = f"""
            SELECT DISTINCT trace_id
            FROM traces
            WHERE application_name = '{app_name}'
            AND attributes['evaluation_trace'] != 'true'
            LIMIT 10000
            """
        else:
            from_timestamp = int(request.from_date.timestamp() * 1000)
            to_timestamp = int(request.to_date.timestamp() * 1000)

            query = f"""
            SELECT DISTINCT trace_id
            FROM traces
            WHERE application_name = '{app_name}'
            AND start_time >= {from_timestamp}000000
            AND start_time <= {to_timestamp}000000
            AND attributes['evaluation_trace'] != 'true'
            LIMIT 10000
            """

        result = client.query(query)
        all_trace_ids = [row[0] for row in result.result_rows]

        # Exclude traces that are themselves evaluation runs (triggered by the evaluator LLM)
        eval_stmt = select(EvaluationResult.trace_id).distinct()
        eval_res = await db.execute(eval_stmt)
        eval_trace_ids = set(str(r) for r in eval_res.scalars().all() if r)
        all_trace_ids = [tid for tid in all_trace_ids if tid not in eval_trace_ids]

        total_traces = len(all_trace_ids)

        if total_traces == 0:
            raise HTTPException(
                status_code=400,
                detail="The selected application has no traces to evaluate in the specified range."
            )

        # Calculate how many traces to evaluate
        if request.is_percentage and request.percentage_value:
            traces_to_eval = max(1, int(total_traces * (request.percentage_value / 100)))
        else:
            traces_to_eval = min(request.traces_to_eval, total_traces)

        # Randomly select traces
        selected_trace_ids = random.sample(all_trace_ids, min(traces_to_eval, len(all_trace_ids)))

        # Convert timezone-aware datetimes to naive for storage
        from_date_naive = None
        to_date_naive = None
        if request.from_date:
            from_date_naive = request.from_date.replace(tzinfo=None) if request.from_date.tzinfo else request.from_date
        if request.to_date:
            to_date_naive = request.to_date.replace(tzinfo=None) if request.to_date.tzinfo else request.to_date

        # Create batch evaluation record
        batch_eval = BatchEvaluation(
            application_id=request.application_id,
            project_id=actual_project_id,
            user_id=current_user.id,
            from_date=from_date_naive,
            to_date=to_date_naive,
            metric_ids=request.metric_ids,
            total_traces=total_traces,
            traces_to_eval=traces_to_eval,
            is_percentage=request.is_percentage,
            percentage_value=request.percentage_value if request.is_percentage else None,
            provider=provider,
            model_name=model_name,
            provider_id=request.provider_id,
            status="RUNNING",
            started_at=datetime.utcnow(),
            selected_trace_ids=selected_trace_ids,
        )

        db.add(batch_eval)
        await db.commit()
        await db.refresh(batch_eval)

        # Trigger batch evaluation runner in a background task
        background_tasks.add_task(run_batch_evaluation_task, batch_eval.id)

        return batch_eval

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create batch evaluation: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create batch evaluation: {str(e)}")


@router.post("/batch/{batch_id}/rerun", response_model=BatchEvalResponse)
async def rerun_batch_evaluation(
    batch_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Rerun a batch evaluation"""
    batch_eval = await db.get(BatchEvaluation, batch_id)
    if not batch_eval:
        raise HTTPException(status_code=404, detail="Batch evaluation not found")

    if batch_eval.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to rerun this batch evaluation")

    # Reset the batch evaluation
    batch_eval.status = "RUNNING"
    batch_eval.started_at = datetime.utcnow()
    batch_eval.evaluated_traces = 0
    batch_eval.successful_evaluations = 0
    batch_eval.failed_evaluations = 0
    batch_eval.avg_score = None
    batch_eval.completed_at = None

    db.add(batch_eval)
    await db.commit()
    await db.refresh(batch_eval)

    # Trigger batch evaluation runner in a background task
    background_tasks.add_task(run_batch_evaluation_task, batch_eval.id)

    return batch_eval


async def fetch_trace_data_from_clickhouse(trace_id: str) -> dict:
    from app.core.clickhouse import get_clickhouse_client
    client = get_clickhouse_client()
    
    # Query application_name from traces table
    app_name = None
    try:
        t_query = f"SELECT application_name FROM traces WHERE trace_id = '{trace_id}' LIMIT 1"
        t_rows = client.query(t_query).result_rows
        if t_rows and t_rows[0][0]:
            app_name = str(t_rows[0][0])
    except Exception as ex:
        logger.error(f"Failed to query trace application_name: {ex}")

    # Query observations
    query = f"""
        SELECT input_text, output_text, metadata_json, type, name, parent_observation_id, error
        FROM observations
        WHERE trace_id = '{trace_id}'
        ORDER BY start_time ASC
    """
    try:
        rows = client.query(query).result_rows
        if not rows:
            return {
                "trace_id": trace_id,
                "application_name": app_name,
            }

        # Find best observation (prefer agent/chain/llm or parent-less)
        best_row = None
        for row in rows:
            parent_id = row[5]
            obs_type = row[3]
            if not parent_id or obs_type in ["agent", "chain", "llm"]:
                best_row = row
                break
        if not best_row:
            best_row = rows[0]

        import json
        metadata = {}
        if best_row[2]:
            try:
                metadata = json.loads(best_row[2])
            except:
                pass

        return {
            "input": best_row[0],
            "output": best_row[1],
            "context": metadata,
            "trace_id": trace_id,
            "observation_name": best_row[4],
            "application_name": app_name,
        }
    except Exception as e:
        logger.error(f"Failed to fetch trace data for batch eval: {e}")
        return None


async def run_batch_evaluation_task(batch_id: uuid.UUID):
    logger.info(f"Starting background batch evaluation task: {batch_id}")
    
    from app.core.database import async_session_factory
    from app.models.batch_evaluation import BatchEvaluation
    from app.models.evaluation_result import EvaluationResult
    from app.models.llm_provider import LLMProvider
    from app.models.metric import Metric as DB_Metric
    from app.models.all_models import Application
    from app.core.security import decrypt_value
    from app.core.evaluation_runner import fetch_retrieval_contexts
    from sqlmodel import select
    import importlib
    import inspect
    from datetime import datetime
    import uuid as py_uuid
    
    async with async_session_factory() as db:
        # Load the BatchEvaluation record
        batch_eval = await db.get(BatchEvaluation, batch_id)
        if not batch_eval:
            logger.error(f"Batch evaluation {batch_id} not found in background task.")
            return

        try:
            # Get selected trace IDs
            trace_ids = batch_eval.selected_trace_ids or []
            metric_ids = [m.strip() for m in (batch_eval.metric_ids or "").split(",") if m.strip()]
            
            if not trace_ids or not metric_ids:
                batch_eval.status = "COMPLETED"
                batch_eval.completed_at = datetime.utcnow()
                db.add(batch_eval)
                await db.commit()
                return

            total_traces_eval = len(trace_ids)
            successful_evals = 0
            failed_evals = 0
            scores = []

            # Resolve credentials & provider
            provider = batch_eval.provider or "openai"
            model = batch_eval.model_name
            api_key = None
            azure_endpoint = None
            api_version = None
            deployment_name = None

            if batch_eval.provider_id:
                provider_obj = await db.get(LLMProvider, batch_eval.provider_id)
                if provider_obj:
                    provider = provider_obj.provider
                    model = provider_obj.model_name
                    azure_endpoint = provider_obj.base_url
                    api_version = provider_obj.api_version
                    deployment_name = provider_obj.deployment_name
                    try:
                        api_key = decrypt_value(provider_obj.api_key)
                    except Exception:
                        api_key = provider_obj.api_key

            # Get rubric prompt if set
            rubric_prompt = None
            if batch_eval.application_id:
                try:
                    app_obj = await db.get(Application, py_uuid.UUID(batch_eval.application_id))
                    if app_obj:
                        rubric_prompt = app_obj.rubric_prompt
                except Exception as ex:
                    logger.error(f"Failed to get rubric for batch eval: {ex}")

            # Instantiate Evaluators
            evaluators = {}
            for m_id in metric_ids:
                try:
                    metric_stmt = select(DB_Metric).where(DB_Metric.id == m_id)
                    metric_res = await db.execute(metric_stmt)
                    metric_row = metric_res.scalars().first()
                    metric_prompt = metric_row.prompt if metric_row else None
                    
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
                        from app.core.evaluation.integrations.observix_eval import CustomEvaluator
                        evaluators[m_id] = {
                            "evaluator": CustomEvaluator(provider=provider, model=model, **llm_kwargs),
                            "prompt": metric_prompt
                        }
                    else:
                        eval_module = importlib.import_module("app.core.evaluation")
                        EvaluatorClass = getattr(eval_module, m_id, None)
                        if EvaluatorClass:
                            evaluators[m_id] = {
                                "evaluator": EvaluatorClass(provider=provider, model=model, **llm_kwargs),
                                "prompt": None
                            }
                except Exception as e:
                    logger.error(f"Failed to initialize evaluator {m_id} for batch eval: {e}")

            # Run evaluation on each trace
            for trace_id in trace_ids:
                trace_data = await fetch_trace_data_from_clickhouse(trace_id)
                if not trace_data:
                    logger.warning(f"Could not load trace data for trace_id {trace_id}, skipping.")
                    continue

                query = trace_data.get("input")
                output = trace_data.get("output")
                context = trace_data.get("context")
                
                # Fetch retrieval contexts if available
                retrieved_contexts = await fetch_retrieval_contexts(trace_id)
                if retrieved_contexts:
                    context = retrieved_contexts

                for m_id, eval_info in evaluators.items():
                    evaluator = eval_info["evaluator"]
                    metric_prompt = eval_info["prompt"]

                    # Skip traces with no actual output (required by metrics like Hallucination)
                    if not output or not str(output).strip():
                        logger.warning(
                            f"Skipping trace {trace_id} for metric {m_id}: no actual_output present."
                        )
                        continue

                    # Create initial EvaluationResult
                    eval_result = EvaluationResult(
                        trace_id=trace_id,
                        metric_id=m_id,
                        input=str(query) if query else None,
                        output=str(output) if output else None,
                        context=context if isinstance(context, list) else [str(context)] if context else [],
                        expected_output=None,
                        status="RUNNING",
                        metadata_json={"trigger_type": "batch_eval", "batch_id": str(batch_id)},
                        application_name=trace_data.get("application_name") or batch_eval.application_id,
                    )
                    db.add(eval_result)
                    await db.commit()
                    await db.refresh(eval_result)

                    last_error = None
                    res = None
                    for attempt in range(1, 4):  # Retry up to 3 times
                        try:
                            extra_kwargs = {}
                            if metric_prompt:
                                import re
                                formatted_prompt = metric_prompt
                                variables = set(re.findall(r'\{\{([^}]+)\}\}', metric_prompt))
                                inputs_dict = {
                                    "input": query,
                                    "query": query,
                                    "output": output,
                                    "response": output,
                                    "context": context,
                                }
                                for var in variables:
                                    val = inputs_dict.get(var)
                                    if val is None:
                                        val = inputs_dict.get(var.lower(), "")
                                    formatted_prompt = formatted_prompt.replace(f"{{{{{var}}}}}", str(val))
                                
                                single_vars = set(re.findall(r'(?<!\{)\{([^}]+)\}(?!\})', formatted_prompt))
                                for var in single_vars:
                                    if var in inputs_dict:
                                        formatted_prompt = formatted_prompt.replace(f"{{{var}}}", str(inputs_dict[var]))
                                extra_kwargs["custom_instructions"] = formatted_prompt

                            # Execute evaluation — run in thread executor to avoid blocking the event loop
                            import asyncio as _asyncio
                            _loop = _asyncio.get_event_loop()

                            def _run_eval():
                                return evaluator.evaluate(
                                    input_query=query,
                                    output=output,
                                    context=context if isinstance(context, list) else [str(context)] if context else [],
                                    expected=None,
                                    rubric=rubric_prompt,
                                    **extra_kwargs
                                )

                            res = await _loop.run_in_executor(None, _run_eval)
                            if inspect.iscoroutine(res):
                                res = await res
                            last_error = None
                            break  # Success — stop retrying

                        except Exception as ex:
                            last_error = ex
                            err_str = str(ex).lower()
                            is_json_error = (
                                "invalid json" in err_str
                                or "json" in err_str
                                or "jsondecodeerror" in err_str
                                or "unexpected token" in err_str
                                or "expecting value" in err_str
                            )
                            if is_json_error and attempt < 3:
                                logger.warning(
                                    f"Attempt {attempt}/3: Invalid JSON from evaluation LLM for trace {trace_id} metric {m_id}. Retrying..."
                                )
                                import asyncio
                                await asyncio.sleep(1)
                                continue
                            else:
                                break  # Non-JSON error or final attempt — stop

                    if res is not None:
                        # Update EvaluationResult
                        eval_result.score = res.score
                        eval_result.reason = res.reason
                        eval_result.passed = res.passed
                        eval_result.status = "COMPLETED"
                        
                        meta = dict(res.metadata) if res.metadata else {}
                        meta["trigger_type"] = "batch_eval"
                        meta["batch_id"] = str(batch_id)
                        eval_result.metadata_json = meta
                        
                        db.add(eval_result)
                        await db.commit()

                        successful_evals += 1
                        if res.score is not None:
                            scores.append(res.score)
                    else:
                        ex = last_error
                        logger.error(f"Error evaluating trace {trace_id} with metric {m_id} after retries: {ex}")
                        eval_result.status = "FAILED"
                        eval_result.reason = str(ex)
                        eval_result.metadata_json = {"trigger_type": "batch_eval", "batch_id": str(batch_id)}
                        db.add(eval_result)
                        await db.commit()
                        failed_evals += 1

                # Update progress on BatchEvaluation periodically
                batch_eval.evaluated_traces = successful_evals + failed_evals
                batch_eval.successful_evaluations = successful_evals
                batch_eval.failed_evaluations = failed_evals
                if scores:
                    batch_eval.avg_score = sum(scores) / len(scores)
                db.add(batch_eval)
                await db.commit()

            # Finalize BatchEvaluation
            batch_eval.status = "COMPLETED"
            batch_eval.completed_at = datetime.utcnow()
            db.add(batch_eval)
            await db.commit()
            logger.info(f"Batch evaluation {batch_id} completed successfully.")

        except Exception as e:
            logger.error(f"Batch evaluation {batch_id} failed in background task: {e}", exc_info=True)
            batch_eval.status = "FAILED"
            batch_eval.error_message = str(e)
            batch_eval.completed_at = datetime.utcnow()
            db.add(batch_eval)
            await db.commit()
