import inspect
import logging
import importlib
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.schema import MetricInfo, EvaluationRequest, EvaluationResponse
from app.api.v1.endpoints.data.metric_data import STATIC_METRICS_REGISTRY
from observix.context import observability_context
from observix import init_observability

router = APIRouter()
logger = logging.getLogger(__name__)

# Static Registry to avoid Runtime Import/Dependency Issues in Backend Container
@router.get("/metrics", response_model=List[MetricInfo])
async def list_metrics(
    db: AsyncSession = Depends(get_session)
):
    """
    List all available metrics.
    Currently returns a static registry matching the SDK capabilities.
    """
    return STATIC_METRICS_REGISTRY


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
                     evaluator = EvaluatorClass()
        
            except Exception as e:
                logger.error(f"Failed to init Evaluator: {e}")
                return EvaluationResponse(score=0.0, passed=False, reason=f"Evaluator Init Failed: {str(e)}")
        
            # 3. Run Evaluation
            try:
                query = inputs.get("input") or inputs.get("query")
                context = inputs.get("context")
                output = inputs.get("output") or inputs.get("response")    
                expected = inputs.get("expected")
                        
                result = evaluator.evaluate(
                    input_query=query,
                    output=output,
                    context=context if isinstance(context, list) else [str(context)] if context else [],
                    expected=expected
                )
                
                if inspect.iscoroutine(result):
                    result = await result
                    
                return EvaluationResponse(
                    score=result.score,
                    reason=result.reason or "Evaluation completed successfully.",
                    passed=result.passed
                )
                    
            except Exception as e:
                logger.error(f"Evaluation failed: {e}")
                raise HTTPException(status_code=500, detail=str(e))
                
        except Exception as e:
            logger.error(f"Evaluation Execution Failed: {e}")
            return EvaluationResponse(score=0.0, passed=False, reason=f"Execution Failed: {str(e)}")

