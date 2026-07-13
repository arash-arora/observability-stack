"""
app/core/evaluation/integrations/deepeval.py

DeepEval-based evaluators for RAG and LLM quality metrics.
Wraps deepeval metrics in the Evaluator interface.
"""
import logging
import inspect
from typing import Optional, List

from app.core.evaluation.core import Evaluator, EvaluationResult

logger = logging.getLogger(__name__)

try:
    import deepeval  # noqa: F401
    from deepeval.models.base_model import DeepEvalBaseLLM
    DEEPEVAL_AVAILABLE = True
except ImportError:
    DEEPEVAL_AVAILABLE = False
    DeepEvalBaseLLM = object


class DeepEvalLLM(DeepEvalBaseLLM):
    def __init__(self, provider: str = "openai", model_name: str = "gpt-4", **kwargs):
        self.provider = provider
        self.model_name = model_name
        self.api_key = kwargs.get("api_key")
        self.azure_endpoint = kwargs.get("azure_endpoint")
        self.api_version = kwargs.get("api_version")
        self.deployment_name = kwargs.get("deployment_name")
        self.temperature = 0.0

    def load_model(self):
        return self

    def _get_litellm_model(self) -> str:
        if self.provider in ("azure",):
            return f"azure/{self.deployment_name or self.model_name}"
        if self.provider == "langchain":
            return f"groq/{self.model_name}"
        return self.model_name

    def generate(self, prompt: str) -> str:
        import litellm
        model = self._get_litellm_model()
        call_kwargs = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": self.temperature,
        }
        if self.api_key:
            call_kwargs["api_key"] = self.api_key
        if self.provider == "azure":
            if self.azure_endpoint:
                call_kwargs["api_base"] = self.azure_endpoint
            if self.api_version:
                call_kwargs["api_version"] = self.api_version
        
        response = litellm.completion(**call_kwargs)
        return response.choices[0].message.content or ""

    async def a_generate(self, prompt: str) -> str:
        import litellm
        model = self._get_litellm_model()
        call_kwargs = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": self.temperature,
        }
        if self.api_key:
            call_kwargs["api_key"] = self.api_key
        if self.provider == "azure":
            if self.azure_endpoint:
                call_kwargs["api_base"] = self.azure_endpoint
            if self.api_version:
                call_kwargs["api_version"] = self.api_version
        
        response = await litellm.acompletion(**call_kwargs)
        return response.choices[0].message.content or ""

    def get_model_name(self) -> str:
        return self.model_name


class MetricEvaluator(Evaluator):
    """
    Base class wrapping a deepeval Metric into the Evaluator interface.
    """

    def __init__(self, provider: str = "openai", model: Optional[str] = None, **kwargs):
        if not DEEPEVAL_AVAILABLE:
            raise ImportError(
                "deepeval is not installed. Install it with: pip install deepeval"
            )
        self.provider = provider
        self.model = model or "gpt-4"
        self.model_instance = DeepEvalLLM(provider=self.provider, model_name=self.model, **kwargs)
        self.invert_score = False
        self._metric = None  # subclasses set this

    @property
    def name(self) -> str:
        return self.__class__.__name__

    def _evaluate(
        self,
        output: str = "",
        expected: Optional[str] = None,
        context: Optional[List] = None,
        input_query: Optional[str] = None,
        **kwargs,
    ) -> EvaluationResult:
        try:
            from deepeval.test_case import LLMTestCase

            context_list = context if isinstance(context, list) else ([context] if context else [])
            context_list = [c for c in context_list if c and str(c).strip()]
            if not context_list:
                context_list = [input_query] if input_query else ["No context provided."]

            test_case = LLMTestCase(
                input=input_query or "",
                actual_output=output or "",
                expected_output=expected,
                retrieval_context=context_list,
                context=context_list,
            )

            metric = self._metric
            if metric is None:
                raise ValueError(f"No deepeval metric configured for {self.name}")

            import concurrent.futures

            def _run():
                res = metric.measure(test_case)
                if inspect.iscoroutine(res):
                    import asyncio
                    return asyncio.run(res)
                return res

            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
                result = executor.submit(_run).result()

            score = float(metric.score or 0.0)
            if self.invert_score:
                score = 1.0 - score
            
            passed = score >= 0.5
            reason = getattr(metric, "reason", "") or ""

            return EvaluationResult(
                metric_name=self.name,
                score=score,
                passed=passed,
                reason=reason,
                metadata={"deepeval_score": score},
            )
        except Exception as e:
            logger.error(f"DeepEval evaluation failed for {self.name}: {e}")
            raise


class AnswerRelevancyEvaluator(MetricEvaluator):
    def __init__(self, provider: str = "openai", model: Optional[str] = None, **kwargs):
        super().__init__(provider=provider, model=model, **kwargs)
        from deepeval.metrics import AnswerRelevancyMetric
        self._metric = AnswerRelevancyMetric(threshold=0.5, model=self.model_instance)

    @property
    def name(self) -> str:
        return "AnswerRelevancy"


class FaithfulnessEvaluator(MetricEvaluator):
    def __init__(self, provider: str = "openai", model: Optional[str] = None, **kwargs):
        super().__init__(provider=provider, model=model, **kwargs)
        from deepeval.metrics import FaithfulnessMetric
        self._metric = FaithfulnessMetric(threshold=0.5, model=self.model_instance)

    @property
    def name(self) -> str:
        return "Faithfulness"


class ContextualPrecisionEvaluator(MetricEvaluator):
    def __init__(self, provider: str = "openai", model: Optional[str] = None, **kwargs):
        super().__init__(provider=provider, model=model, **kwargs)
        from deepeval.metrics import ContextualPrecisionMetric
        self._metric = ContextualPrecisionMetric(threshold=0.5, model=self.model_instance)

    @property
    def name(self) -> str:
        return "ContextualPrecision"


class ContextualRecallEvaluator(MetricEvaluator):
    def __init__(self, provider: str = "openai", model: Optional[str] = None, **kwargs):
        super().__init__(provider=provider, model=model, **kwargs)
        from deepeval.metrics import ContextualRecallMetric
        self._metric = ContextualRecallMetric(threshold=0.5, model=self.model_instance)

    @property
    def name(self) -> str:
        return "ContextualRecall"


class ContextualRelevancyEvaluator(MetricEvaluator):
    def __init__(self, provider: str = "openai", model: Optional[str] = None, **kwargs):
        super().__init__(provider=provider, model=model, **kwargs)
        from deepeval.metrics import ContextualRelevancyMetric
        self._metric = ContextualRelevancyMetric(threshold=0.5, model=self.model_instance)

    @property
    def name(self) -> str:
        return "ContextualRelevancy"


class HallucinationEvaluator(MetricEvaluator):
    def __init__(self, provider: str = "openai", model: Optional[str] = None, **kwargs):
        super().__init__(provider=provider, model=model, **kwargs)
        self.invert_score = True
        from deepeval.metrics import HallucinationMetric
        self._metric = HallucinationMetric(threshold=0.5, model=self.model_instance)

    @property
    def name(self) -> str:
        return "Hallucination"


class TaskCompletionEvaluator(MetricEvaluator):
    def __init__(self, provider: str = "openai", model: Optional[str] = None, **kwargs):
        super().__init__(provider=provider, model=model, **kwargs)
        try:
            from deepeval.metrics import TaskCompletionMetric
            self._metric = TaskCompletionMetric(threshold=0.5, model=self.model_instance)
        except ImportError:
            self._metric = None

    @property
    def name(self) -> str:
        return "TaskCompletion"


class ToolCorrectnessEvaluator(MetricEvaluator):
    def __init__(self, provider: str = "openai", model: Optional[str] = None, **kwargs):
        super().__init__(provider=provider, model=model, **kwargs)
        try:
            from deepeval.metrics import ToolCorrectnessMetric
            self._metric = ToolCorrectnessMetric(threshold=0.5, model=self.model_instance)
        except ImportError:
            self._metric = None

    @property
    def name(self) -> str:
        return "ToolCorrectness"


class ToxicityEvaluator(MetricEvaluator):
    def __init__(self, provider: str = "openai", model: Optional[str] = None, **kwargs):
        super().__init__(provider=provider, model=model, **kwargs)
        self.invert_score = True
        from deepeval.metrics import ToxicityMetric
        self._metric = ToxicityMetric(threshold=0.5, model=self.model_instance)

    @property
    def name(self) -> str:
        return "Toxicity"


class BiasEvaluator(MetricEvaluator):
    def __init__(self, provider: str = "openai", model: Optional[str] = None, **kwargs):
        super().__init__(provider=provider, model=model, **kwargs)
        self.invert_score = True
        from deepeval.metrics import BiasMetric
        self._metric = BiasMetric(threshold=0.5, model=self.model_instance)

    @property
    def name(self) -> str:
        return "Bias"
