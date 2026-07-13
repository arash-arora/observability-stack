"""
app/core/evaluation/trace_utils.py

Utility helpers for extracting evaluation parameters from trace objects.
"""
from typing import Any, Optional, List


def extract_eval_params(trace) -> dict:
    """
    Extract input_query, output, context, and expected from a Trace-like object or dict.
    """
    if trace is None:
        return {}
    if isinstance(trace, dict):
        return {
            "input_query": trace.get("input") or trace.get("input_query") or trace.get("question"),
            "output": trace.get("output") or trace.get("response"),
            "context": trace.get("context"),
            "expected": trace.get("expected") or trace.get("reference"),
        }
    return {
        "input_query": getattr(trace, "input", None) or getattr(trace, "input_query", None),
        "output": getattr(trace, "output", None) or getattr(trace, "response", None),
        "context": getattr(trace, "context", None),
        "expected": getattr(trace, "expected", None),
    }
