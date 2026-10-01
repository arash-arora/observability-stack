"""
Observix Instrumentation Interface.
Powered directly by the Observix SDK (/Users/aarora/dev/research/observix).
"""
import os
from observix import (
    init_observability,
    observe,
    flush,
    shutdown,
    capture_context,
    capture_tools,
    capture_candidate_agents,
    record_score,
)
from observix.llm.openai import OpenAI

DEFAULT_OBSERVIX_URL = os.getenv("OBSERVIX_URL", "http://localhost:8010")
DEFAULT_OBSERVIX_API_KEY = os.getenv("OBSERVIX_API_KEY", "sk-cortex-live-key-9f8a12bc34de56fa78bc90de")
DEFAULT_FRONTEND_URL = os.getenv("OBSERVIX_FRONTEND_URL", "http://localhost:8011")

__all__ = [
    "init_observability",
    "observe",
    "flush",
    "shutdown",
    "capture_context",
    "capture_tools",
    "capture_candidate_agents",
    "record_score",
    "OpenAI",
    "DEFAULT_OBSERVIX_URL",
    "DEFAULT_OBSERVIX_API_KEY",
]

