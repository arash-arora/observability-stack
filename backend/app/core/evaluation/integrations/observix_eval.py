"""
app/core/evaluation/integrations/observix_eval.py

Custom agent/tool evaluators using native LLM clients (litellm).
Replaces the former observix SDK evaluators with zero SDK dependency.
"""
import os
import re
import json
import logging
from typing import Optional, List, Any, Dict

from app.core.evaluation.core import Evaluator, EvaluationResult
from app.core.evaluation.integrations.prompts import (
    STANDARD_EVALUATION_TEMPLATE,
    TOOL_SELECTION_PROMPT,
    TOOL_INPUT_STRUCTURE_PROMPT_TEMPLATE,
    TOOL_SEQUENCE_PROMPT_TEMPLATE,
    AGENT_ROUTING_PROMPT_TEMPLATE,
    HITL_PROMPT_TEMPLATE,
    WORKFLOW_COMPLETION_PROMPT_TEMPLATE,
    CUSTOM_METRIC_PROMPT_TEMPLATE,
)

logger = logging.getLogger(__name__)


class BaseAgentEvaluator(Evaluator):
    """
    Base class for agent/tool evaluators.
    Uses litellm for unified LLM access.
    """

    def __init__(self, provider: str = "openai", model: Optional[str] = None, **kwargs):
        self.provider = provider
        self.model_name = model or "gpt-4"
        self.api_key = kwargs.get("api_key")
        self.azure_endpoint = kwargs.get("azure_endpoint")
        self.api_version = kwargs.get("api_version")
        self.deployment_name = kwargs.get("deployment_name")
        self.temperature = 0.0
        self.prompt_template = STANDARD_EVALUATION_TEMPLATE

    @property
    def name(self) -> str:
        return self.__class__.__name__

    def _get_litellm_model(self) -> str:
        """Build litellm model string from provider/model."""
        if self.provider in ("azure",):
            return f"azure/{self.deployment_name or self.model_name}"
        if self.provider == "langchain":
            return f"groq/{self.model_name}"
        return self.model_name

    def _generate_response(self, prompt: str) -> str:
        """Call LLM via litellm and return the response text."""
        try:
            import litellm

            model = self._get_litellm_model()

            kwargs: Dict[str, Any] = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": self.temperature,
                "response_format": {"type": "json_object"},
            }

            if self.api_key:
                kwargs["api_key"] = self.api_key
            if self.provider == "azure":
                if self.azure_endpoint:
                    kwargs["api_base"] = self.azure_endpoint
                if self.api_version:
                    kwargs["api_version"] = self.api_version

            response = litellm.completion(**kwargs)
            return response.choices[0].message.content or ""
        except Exception as exc:
            logger.error(f"LLM call failed: {exc}")
            raise

    def _parse_score(self, response: str) -> float:
        matches = re.findall(r"[-+]?\d*\.\d+|\d+", response)
        if not matches:
            logger.warning(f"Could not parse score from response: {response[:200]}")
            return 0.0
        try:
            score = float(matches[-1])
            # Auto-detect if score is on a 0-100 scale or 0-1 scale
            if score > 1.0:
                score = score / 100.0
            return min(max(score, 0.0), 1.0)
        except Exception:
            return 0.0

    def _evaluate(
        self,
        output: str = "",
        expected: Optional[str] = None,
        context: Optional[List] = None,
        input_query: Optional[str] = None,
        **kwargs,
    ) -> EvaluationResult:
        try:
            # Extract trace if provided
            trace_input = kwargs.get("trace")
            workflow_details = None
            trace_data_str = ""

            if trace_input:
                if isinstance(trace_input, dict):
                    # Try to import trace optimization helper
                    try:
                        from app.core.evaluation.integrations.trace_optimization import (
                            optimize_trace_structure,
                        )
                        optimized = optimize_trace_structure(trace_input)
                    except Exception:
                        optimized = trace_input

                    obs_list = optimized.get("observations", [])
                    obs = []
                    for o in obs_list:
                        obs.append({
                            "id": o.get("id"),
                            "type": getattr(o, "type", o.get("type")),
                            "name": getattr(o, "name", o.get("name")),
                            "start_time": o.get("start_time"),
                            "input": o.get("input_text") or o.get("input"),
                            "output": o.get("output_text") or o.get("output"),
                            "metadata_json": o.get("metadata_json"),
                            "parent_observation_id": o.get("parent_observation_id"),
                            "error": o.get("error"),
                            "status": o.get("status", "success"),
                        })

                    trace_data = {"observations": obs}

                    # Sanitize if workflow details available
                    agents = kwargs.get("agents", [])
                    tools = kwargs.get("tools", [])
                    if agents or tools:
                        try:
                            from app.core.evaluation.integrations.trace_sanitizer import TraceSanitizer
                            sanitizer = TraceSanitizer(provider=self.provider, model=self.model_name)
                            trace_data = sanitizer.sanitize(trace_data, agents=agents, tools=tools)
                        except Exception as e:
                            logger.warning(f"Trace sanitization failed: {e}")

                    trace_data_str = json.dumps(trace_data, indent=2, default=str)

            # Collect hitl_info if present
            hitl_info = kwargs.get("hitl_info", "None")
            custom_instructions = kwargs.get("custom_instructions") or kwargs.get("criteria", "")

            # Build prompt kwargs
            prompt_kwargs: Dict[str, Any] = {
                "trace_data": trace_data_str,
                "agents": kwargs.get("agents", []),
                "tools": kwargs.get("tools", []),
                "hitl_info": hitl_info,
                "custom_instructions": custom_instructions,
                "question": input_query or "",
                "tool_sequence": kwargs.get("tool_sequence", ""),
                "tool_call": kwargs.get("tool_call", ""),
                "trace": trace_data_str,
                "tool_definitions": kwargs.get("tool_definitions", ""),
                "agent_definitions": kwargs.get("agent_definitions", ""),
                "HITL_INFO": hitl_info,
            }

            # Standard evaluation template substitution
            rubric = kwargs.get("rubric")
            standard_eval_text = ""
            rubric_guidelines = rubric or "Standard 1-100 scale based on effectiveness and correctness."

            # Determine the right prompt template
            if custom_instructions and self.prompt_template == CUSTOM_METRIC_PROMPT_TEMPLATE:
                formatted_prompt = self.prompt_template.format(
                    **{k: v for k, v in prompt_kwargs.items() if k in (
                        "trace_data", "agents", "tools", "custom_instructions"
                    )}
                )
            else:
                try:
                    formatted_prompt = self.prompt_template.format(
                        standard_evaluation=standard_eval_text,
                        rubric_score_guidelines=rubric_guidelines,
                        **prompt_kwargs,
                    )
                except KeyError:
                    formatted_prompt = self.prompt_template

            # LLM call — use JSON mode only for openai/azure
            if self.provider in ("openai", "azure"):
                response_text = self._generate_response(formatted_prompt)
            else:
                # For other providers, call without JSON mode
                try:
                    import litellm
                    model = self._get_litellm_model()
                    call_kwargs: Dict[str, Any] = {
                        "model": model,
                        "messages": [{"role": "user", "content": formatted_prompt}],
                        "temperature": self.temperature,
                    }
                    if self.api_key:
                        call_kwargs["api_key"] = self.api_key
                    resp = litellm.completion(**call_kwargs)
                    response_text = resp.choices[0].message.content or ""
                except Exception as exc:
                    logger.error(f"LLM call failed: {exc}")
                    raise

            # Clean JSON fences
            cleaned_response = response_text.strip()
            if cleaned_response.startswith("```json"):
                cleaned_response = cleaned_response[7:]
            if cleaned_response.startswith("```"):
                cleaned_response = cleaned_response[3:]
            if cleaned_response.endswith("```"):
                cleaned_response = cleaned_response[:-3]
            cleaned_response = cleaned_response.strip()

            try:
                result_json = json.loads(cleaned_response)
                main_data = result_json

                score_raw = main_data.get("score", 0)
                reasoning = main_data.get("reasoning", "")
                
                score = float(score_raw)
                # Auto-detect if score returned in JSON is on a 0-100 scale or 0-1 scale
                if score > 1.0:
                    score = score / 100.0
                score = min(max(score, 0.0), 1.0)
                
                threshold = kwargs.get("threshold", 0.5)
                passed = score >= threshold

                metadata = {
                    "full_evaluation_details": result_json,
                    "evidences": main_data.get("evidences", {}),
                    "feedbacks": main_data.get("feedbacks", main_data.get("feedback", [])),
                    "evaluator_input": input_query,
                    "evaluator_output": output,
                }

                return EvaluationResult(
                    metric_name=self.name,
                    score=score,
                    passed=passed,
                    reason=reasoning,
                    metadata=metadata,
                )

            except json.JSONDecodeError:
                logger.warning(f"Failed to parse JSON evaluation response: {cleaned_response[:300]}")
                score = self._parse_score(cleaned_response)
                return EvaluationResult(
                    metric_name=self.name,
                    score=score,
                    passed=score >= 0.5,
                    reason=cleaned_response[:500],
                    metadata={"raw_response": cleaned_response},
                )

        except Exception as exc:
            logger.error(f"Evaluation failed: {exc}")
            raise


# ---------------------------------------------------------------------------
# Concrete evaluator subclasses
# ---------------------------------------------------------------------------

class ToolSelectionEvaluator(BaseAgentEvaluator):
    def __init__(self, provider: str = "openai", model: Optional[str] = None, **kwargs):
        super().__init__(provider=provider, model=model, **kwargs)
        self.prompt_template = TOOL_SELECTION_PROMPT

    @property
    def name(self) -> str:
        return "ToolSelection"


class ToolInputStructureEvaluator(BaseAgentEvaluator):
    def __init__(self, provider: str = "openai", model: Optional[str] = None, **kwargs):
        super().__init__(provider=provider, model=model, **kwargs)
        self.prompt_template = TOOL_INPUT_STRUCTURE_PROMPT_TEMPLATE

    @property
    def name(self) -> str:
        return "ToolInputStructure"


class ToolSequenceEvaluator(BaseAgentEvaluator):
    def __init__(self, provider: str = "openai", model: Optional[str] = None, **kwargs):
        super().__init__(provider=provider, model=model, **kwargs)
        self.prompt_template = TOOL_SEQUENCE_PROMPT_TEMPLATE

    @property
    def name(self) -> str:
        return "ToolSequence"


class AgentRoutingEvaluator(BaseAgentEvaluator):
    def __init__(self, provider: str = "openai", model: Optional[str] = None, **kwargs):
        super().__init__(provider=provider, model=model, **kwargs)
        self.prompt_template = AGENT_ROUTING_PROMPT_TEMPLATE

    @property
    def name(self) -> str:
        return "AgentRouting"


class HITLEvaluator(BaseAgentEvaluator):
    def __init__(self, provider: str = "openai", model: Optional[str] = None, **kwargs):
        super().__init__(provider=provider, model=model, **kwargs)
        self.prompt_template = HITL_PROMPT_TEMPLATE

    @property
    def name(self) -> str:
        return "HITL"


class WorkflowCompletionEvaluator(BaseAgentEvaluator):
    def __init__(self, provider: str = "openai", model: Optional[str] = None, **kwargs):
        super().__init__(provider=provider, model=model, **kwargs)
        self.prompt_template = WORKFLOW_COMPLETION_PROMPT_TEMPLATE

    @property
    def name(self) -> str:
        return "WorkflowCompletion"


class CustomEvaluator(BaseAgentEvaluator):
    def __init__(self, provider: str = "openai", model: Optional[str] = None, **kwargs):
        super().__init__(provider=provider, model=model, **kwargs)
        self.prompt_template = CUSTOM_METRIC_PROMPT_TEMPLATE

    @property
    def name(self) -> str:
        return "CustomMetric"
