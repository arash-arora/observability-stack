"""
app/core/evaluation/integrations/ragas.py

Ragas-based evaluators for RAG quality metrics.
"""
import os
import logging
import inspect
from typing import Optional, List

from app.core.evaluation.core import Evaluator, EvaluationResult
from app.core.evaluation.trace_utils import extract_eval_params

logger = logging.getLogger(__name__)

try:
    from ragas.metrics.base import Metric
    RAGAS_AVAILABLE = True
except ImportError:
    RAGAS_AVAILABLE = False
    Metric = None


class RagasMetricEvaluator(Evaluator):
    """
    Async evaluator using Ragas metrics (single-turn).
    """

    def __init__(self, metric=None, provider: str = "openai", model: Optional[str] = None, **kwargs):
        if not RAGAS_AVAILABLE:
            raise ImportError(
                "ragas is not installed. Please install it with `pip install ragas`."
            )
        self.provider = provider
        self.model = model
        self.llm = self._get_llm(metric_name=getattr(metric, "name", ""))
        self.metric = metric
        if self.llm:
            self.metric.llm = self.llm

    @property
    def name(self) -> str:
        return getattr(self.metric, "name", self.__class__.__name__)

    def _get_llm(self, metric_name: str = ""):
        if not RAGAS_AVAILABLE:
            return None
        try:
            from ragas.llms import llm_factory
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                return None
            return llm_factory(model=self.model or "gpt-4")
        except Exception as exc:
            logger.warning(f"Failed to build Ragas LLM: {exc}")
            return None

    def _evaluate(
        self,
        output: str = "",
        expected: Optional[str] = None,
        context: Optional[List] = None,
        input_query: Optional[str] = None,
        **kwargs,
    ) -> EvaluationResult:
        try:
            from ragas import EvaluationDataset, SingleTurnSample

            sample = SingleTurnSample(
                user_input=input_query or "",
                response=output or "",
                reference=expected,
                retrieved_contexts=context if isinstance(context, list) else ([context] if context else []),
            )

            metric = self.metric
            sig = inspect.signature(metric.ascore)
            result = metric.ascore(sample)
            if inspect.iscoroutine(result):
                import asyncio
                score = asyncio.run(result)
            else:
                score = result

            return EvaluationResult(
                metric_name=self.name,
                score=float(score or 0.0) * 100,
                passed=float(score or 0.0) >= 0.5,
                reason=f"Ragas {self.name} score: {score:.4f}",
                metadata={},
            )
        except Exception as exc:
            logger.exception(f"Ragas evaluation failed for {self.name}: {exc}")
            raise


class RagasFaithfulnessEvaluator(RagasMetricEvaluator):
    def __init__(self, provider: str = "openai", model: Optional[str] = None, **kwargs):
        from ragas.metrics.collections import Faithfulness
        super().__init__(metric=Faithfulness(), provider=provider, model=model, **kwargs)


class RagasContextPrecisionEvaluator(RagasMetricEvaluator):
    def __init__(self, provider: str = "openai", model: Optional[str] = None, **kwargs):
        from ragas.metrics.collections import ContextPrecision
        super().__init__(metric=ContextPrecision(), provider=provider, model=model, **kwargs)


class RagasContextRecallEvaluator(RagasMetricEvaluator):
    def __init__(self, provider: str = "openai", model: Optional[str] = None, **kwargs):
        from ragas.metrics.collections import ContextRecall
        super().__init__(metric=ContextRecall(), provider=provider, model=model, **kwargs)


class RagasNoiseSensitivityEvaluator(RagasMetricEvaluator):
    def __init__(self, provider: str = "openai", model: Optional[str] = None, **kwargs):
        from ragas.metrics.collections import NoiseSensitivity
        super().__init__(metric=NoiseSensitivity(), provider=provider, model=model, **kwargs)


class RagasAnswerRelevancyEvaluator(RagasMetricEvaluator):
    def __init__(self, provider: str = "openai", model: Optional[str] = None, **kwargs):
        from ragas.metrics.collections import AnswerRelevancy
        super().__init__(metric=AnswerRelevancy(), provider=provider, model=model, **kwargs)
        raise NotImplementedError("Embedding model not yet integrated")
