"""
app/core/evaluation/__init__.py

Public API for the evaluation module.
Exposes all evaluator classes so that callers can do:
    importlib.import_module("app.core.evaluation").<EvaluatorClassName>
"""
from app.core.evaluation.core import Evaluator, EvaluationResult, EvaluationSuite

from app.core.evaluation.integrations.deepeval import (
    MetricEvaluator,
    AnswerRelevancyEvaluator,
    FaithfulnessEvaluator,
    ContextualPrecisionEvaluator,
    ContextualRecallEvaluator,
    ContextualRelevancyEvaluator,
    HallucinationEvaluator,
    TaskCompletionEvaluator,
    ToolCorrectnessEvaluator,
    ToxicityEvaluator,
    BiasEvaluator,
)

from app.core.evaluation.integrations.observix_eval import (
    ToolSelectionEvaluator,
    ToolInputStructureEvaluator,
    ToolSequenceEvaluator,
    AgentRoutingEvaluator,
    HITLEvaluator,
    WorkflowCompletionEvaluator,
    CustomEvaluator,
)

__all__ = [
    "Evaluator",
    "EvaluationResult",
    "EvaluationSuite",
    "MetricEvaluator",
    "AnswerRelevancyEvaluator",
    "FaithfulnessEvaluator",
    "ContextualPrecisionEvaluator",
    "ContextualRecallEvaluator",
    "ContextualRelevancyEvaluator",
    "HallucinationEvaluator",
    "TaskCompletionEvaluator",
    "ToolCorrectnessEvaluator",
    "ToxicityEvaluator",
    "BiasEvaluator",
    "ToolSelectionEvaluator",
    "ToolInputStructureEvaluator",
    "ToolSequenceEvaluator",
    "AgentRoutingEvaluator",
    "HITLEvaluator",
    "WorkflowCompletionEvaluator",
    "CustomEvaluator",
]
