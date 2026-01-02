import asyncio
import functools
import inspect
import json
import os
import random
import time
from contextvars import ContextVar
from datetime import datetime
from typing import Any, Callable, Dict, Optional

from dotenv import load_dotenv
from opentelemetry import trace
from opentelemetry.context import get_current
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.trace import SpanKind, Status, StatusCode

import observability_stack.exporter as exporter_module
from observability_stack.exporter import HttpObservationExporter, HttpTraceExporter
from observability_stack.schema import Observation

# Load env variables from .env file if present
load_dotenv()

_TRACER_NAME = "obs-sdk"

# ContextVar to track the current observation ID for parent-child relationship
_current_observation_id: ContextVar[Optional[int]] = ContextVar(
    "current_observation_id", default=None
)


def init_observability(
    url: Optional[str] = None,
    api_key: Optional[str] = None
):
    """
    Initialize the observability SDK.
    Configuration can be provided via arguments or environment variables:
    - OBS_HOST or OBS_URL (e.g., http://localhost:8000)
    - OBS_API_KEY
    """
    url = url or os.getenv("OBS_HOST") or os.getenv("OBS_URL")
    api_key = api_key or os.getenv("OBS_API_KEY")

    if not url:
        print("[ObsSDK] Warning: OBS_HOST not found. Observability disabled.")
        return
        
    if not api_key:
        print("[ObsSDK] Warning: OBS_API_KEY not found. Observability disabled.")
        return

    # --- initialize provider only once ---
    provider = trace.get_tracer_provider()
    if (
        isinstance(provider, trace.ProxyTracerProvider) or 
        not isinstance(provider, TracerProvider)
    ):
        provider = TracerProvider()
        trace.set_tracer_provider(provider)

    # Use BatchSpanProcessor for production performance
    exporter = HttpTraceExporter(url, api_key)
    processor = BatchSpanProcessor(exporter)
    provider.add_span_processor(processor)

    # --- initialize observation exporter ---
    exporter_module.observation_exporter_instance = HttpObservationExporter(
        url, api_key
    )
    
    print(f"[ObsSDK] Initialized with Host: {url}")


# Try to auto-initialize if configured
if (os.getenv("OBS_HOST") or os.getenv("OBS_URL")) and os.getenv("OBS_API_KEY"):
    try:
        init_observability()
    except Exception as e:
        print(f"[ObsSDK] Auto-initialization failed: {e}")


def trace_decorator(
    name: Optional[str] = None,
    attributes: Optional[Dict[str, Any]] = None,
    record_observation: bool = True,
):
    def wrapper(func: Callable):
        func_name = name or func.__name__
        tracer = trace.get_tracer(_TRACER_NAME)

        @functools.wraps(func)
        def inner(*args, **kwargs):
            # Capture start time properties
            start_time = time.time()
            
            obs_id = random.getrandbits(63)
            # Get parent observation ID from context
            parent_obs_id = _current_observation_id.get()
            
            # Set current observation ID for children
            token = _current_observation_id.set(obs_id)
            
            # Start Span
            parent_context = get_current()
            
            with tracer.start_as_current_span(
                func_name,
                context=parent_context,
                kind=SpanKind.INTERNAL
            ) as span:
                span.set_attribute("observation_id", str(obs_id))
                if parent_obs_id:
                     span.set_attribute("parent_observation_id", str(parent_obs_id))
                
                if attributes:
                    for k, v in attributes.items(): 
                        span.set_attribute(k, v)

                def create_observation(
                    span, args, kwargs, result=None, exc=None,
                    obs_id=None, parent_obs_id=None
                ):
                    exporter = exporter_module.observation_exporter_instance
                    if not record_observation or exporter is None:
                        return

                    end_time_val = time.time()
                    
                    obs = Observation(
                        id=obs_id or random.getrandbits(63),
                        parent_observation_id=parent_obs_id, # Link to parent
                        name=func_name,
                        type="function",
                        start_time=int(start_time * 1e9),
                        end_time=int(end_time_val * 1e9), # nanoseconds
                        metadata_json=json.dumps(span.attributes, default=str),
                        observation_type="decorator",
                        trace_id=f"{span.get_span_context().trace_id:032x}",
                        created_at=datetime.utcnow(),
                    )
                    
                    # Careful with JSON dumping arbitrary objects
                    try:
                         obs.input_text = json.dumps(
                             {"args": args, "kwargs": kwargs}, default=str
                         )
                    except Exception:
                         obs.input_text = json.dumps(
                             {"args": str(args), "kwargs": str(kwargs)}
                         )
                    
                    if result is not None:
                        try:
                             # Try dumping result
                             obs.output_text = json.dumps(result, default=str)
                        except Exception:
                             obs.output_text = str(result)
                    else:
                        obs.output_text = ""
    
                    obs.token_usage = None
                    obs.model_parameters = None
                    
                    if exc:
                         obs.error = str(exc)
    
                    try:
                        exporter.enqueue(obs)
                    except Exception as obs_exc:
                        # do not break tracing if observation fails
                        print(
                            f"[ObsWarning] Failed to create observation: {obs_exc}"
                        )

                if asyncio.iscoroutinefunction(func):
                    # We need to define an async wrapper to await the function
                    async def async_inner_wrapper(*args, **kwargs):
                        try:
                            result = await func(*args, **kwargs)
                            create_observation(
                                span, args, kwargs, result=result,
                                obs_id=obs_id, parent_obs_id=parent_obs_id
                            )
                            return result
                        except Exception as exc:
                            span.record_exception(exc)
                            span.set_status(Status(StatusCode.ERROR))
                            create_observation(
                                span, args, kwargs, exc=exc,
                                obs_id=obs_id, parent_obs_id=parent_obs_id
                            )
                            raise
                        finally:
                            span.set_attribute(
                                "duration_ms", (time.time() - start_time) * 1000
                            )
                            _current_observation_id.reset(token)
                    
                    return asyncio.run(async_inner_wrapper(*args, **kwargs))
                else:
                    try:
                        result = func(*args, **kwargs)
                        create_observation(
                            span, args, kwargs, result=result,
                            obs_id=obs_id, parent_obs_id=parent_obs_id
                        )
                        return result
                    except Exception as exc:
                        span.record_exception(exc)
                        span.set_status(Status(StatusCode.ERROR))
                        create_observation(
                            span, args, kwargs, exc=exc,
                            obs_id=obs_id, parent_obs_id=parent_obs_id
                        )
                        raise
                    finally:
                        span.set_attribute(
                            "duration_ms", (time.time() - start_time) * 1000
                        )
                        _current_observation_id.reset(token)

        # For async functions, we want to return the async wrapper directly
        # BUT our inner function here is sync because it sets up text context?
        # Actually for async functions, the decorator returns a sync wrapper that
        # returns a coroutine OR it returns an async wrapper.
        # My implementation above `inner` is sync, and it calls `asyncio.run`
        # if the wrapped function is async. This blocks!
        # This is WRONG for async functions. Async functions should return a coroutine.
        
        if inspect.iscoroutinefunction(func):
            @functools.wraps(func)
            async def async_main_wrapper(*args, **kwargs):
                # Capture start time properties
                start_time = time.time()
                
                obs_id = random.getrandbits(63)
                parent_obs_id = _current_observation_id.get()
                token = _current_observation_id.set(obs_id)
                
                # Start Span
                parent_context = get_current()
                
                with tracer.start_as_current_span(
                    func_name,
                    context=parent_context,
                    kind=SpanKind.INTERNAL
                ) as span:
                    span.set_attribute("observation_id", str(obs_id))
                    if parent_obs_id:
                         span.set_attribute(
                             "parent_observation_id", str(parent_obs_id)
                         )
                    
                    if attributes:
                        for k, v in attributes.items(): 
                            span.set_attribute(k, v)

                    def create_observation_async(
                        span, args, kwargs, result=None, exc=None,
                        obs_id=None, parent_obs_id=None
                    ):
                        exporter = exporter_module.observation_exporter_instance
                        if not record_observation or exporter is None:
                            return

                        end_time_val = time.time()
                        
                        obs = Observation(
                            id=obs_id or random.getrandbits(63),
                            parent_observation_id=parent_obs_id,
                            name=func_name,
                            type="function",
                            start_time=int(start_time * 1e9),
                            end_time=int(end_time_val * 1e9),
                            metadata_json=json.dumps(span.attributes, default=str),
                            observation_type="decorator",
                            trace_id=f"{span.get_span_context().trace_id:032x}",
                            created_at=datetime.utcnow(),
                        )
                        
                        try:
                             obs.input_text = json.dumps(
                                 {"args": args, "kwargs": kwargs}, default=str
                             )
                        except Exception:
                             obs.input_text = json.dumps(
                                 {"args": str(args), "kwargs": str(kwargs)}
                             )
                        
                        if result is not None:
                            try:
                                 obs.output_text = json.dumps(result, default=str)
                            except Exception:
                                 obs.output_text = str(result)
                        else:
                            obs.output_text = ""
        
                        obs.token_usage = None
                        obs.model_parameters = None
                        
                        if exc:
                             obs.error = str(exc)
        
                        try:
                            exporter.enqueue(obs)
                        except Exception as obs_exc:
                            print(
                                f"[ObsWarning] Failed to create observation: {obs_exc}"
                            )

                    try:
                        result = await func(*args, **kwargs)
                        create_observation_async(
                            span, args, kwargs, result=result,
                            obs_id=obs_id, parent_obs_id=parent_obs_id
                        )
                        return result
                    except Exception as exc:
                        span.record_exception(exc)
                        span.set_status(Status(StatusCode.ERROR))
                        create_observation_async(
                            span, args, kwargs, exc=exc,
                            obs_id=obs_id, parent_obs_id=parent_obs_id
                        )
                        raise
                    finally:
                        span.set_attribute(
                            "duration_ms", (time.time() - start_time) * 1000
                        )
                        _current_observation_id.reset(token)
            
            return async_main_wrapper
        
        else:
            return inner

    return wrapper
