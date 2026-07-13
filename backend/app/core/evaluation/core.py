"""
app/core/evaluation/core.py

Base evaluation classes — vendored from the former observix SDK.
No dependency on the observix package.
"""
import time
import inspect
import asyncio
from abc import ABC, abstractmethod
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional


class EvaluationResult(BaseModel):
    """
    Standardized result from an evaluation run.
    """
    metric_name: str
    score: float
    passed: Optional[bool]
    reason: Optional[str]
    metadata: Dict[str, Any] = Field(default_factory=dict)


class Evaluator(ABC):
    """
    Abstract base class for all evaluators.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        ...

    def evaluate(
        self,
        output: str = "",
        expected: Optional[str] = None,
        context: Optional[List] = None,
        input_query: Optional[str] = None,
        trace_enabled: bool = False,
        **kwargs,
    ) -> EvaluationResult:
        """
        Run the evaluation. Tracing is disabled; calls _evaluate directly.
        """
        result = self._evaluate(
            output=output,
            expected=expected,
            context=context,
            input_query=input_query,
            **kwargs,
        )

        def resolve_result(res):
            if inspect.iscoroutine(res):
                try:
                    loop = asyncio.get_running_loop()
                    if loop.is_running():
                        raise RuntimeError(
                            "Cannot call async evaluator from sync context with a running loop."
                        )
                except RuntimeError:
                    pass
                return asyncio.run(res)
            return res

        return resolve_result(result)

    @abstractmethod
    def _evaluate(
        self,
        output: str = "",
        expected: Optional[str] = None,
        context: Optional[List] = None,
        input_query: Optional[str] = None,
    ) -> EvaluationResult:
        """
        Internal evaluation logic to be implemented by subclasses.
        """
        ...


class EvaluationSuite:
    """
    A suite to run multiple evaluators on the same dataset item.
    """

    def __init__(self, evaluators: List[Evaluator]):
        self.evaluators = evaluators

    def run(
        self,
        output: str = "",
        expected: Optional[str] = None,
        context: Optional[List] = None,
        input_query: Optional[str] = None,
        delay: float = 0.0,
    ) -> List[EvaluationResult]:
        results = []
        for ev in self.evaluators:
            if delay > 0.0:
                time.sleep(delay)
            try:
                res = ev.evaluate(
                    output=output,
                    expected=expected,
                    context=context,
                    input_query=input_query,
                )
                results.append(res)
            except Exception as e:
                results.append(
                    EvaluationResult(
                        metric_name=ev.name,
                        score=0.0,
                        passed=False,
                        reason=f"Error during evaluation: {str(e)}",
                    )
                )
        return results
