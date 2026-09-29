"""
Instrumentation and Tracing Collector for Multi-Agent Workflows.
Captures Agent executions, Tool calls, and LLM generations in standard
Observix-compatible observation format.
"""
import uuid
import time
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional


class TraceCollector:
    """
    In-memory trace collector that records hierarchical observation spans
    (agents, tools, LLMs) matching the Observix evaluation schema.
    """

    def __init__(
        self,
        application_name: str = "multi-agent-system",
        persona: str = "Default",
        organization: str = "Enterprise Corp",
    ):
        self.trace_id = str(uuid.uuid4())
        self.application_name = application_name
        self.persona = persona
        self.organization = organization
        self.start_time = datetime.now(timezone.utc).isoformat()
        self.observations: List[Dict[str, Any]] = []
        self._active_spans: Dict[str, Dict[str, Any]] = {}
        self.input_query: str = ""
        self.output_response: str = ""

    def start_agent(
        self,
        name: str,
        input_data: Any,
        goal: str = "",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Record the start of an agent execution step."""
        obs_id = f"agent_{uuid.uuid4().hex[:8]}"
        meta = metadata.copy() if metadata else {}
        meta["goal"] = goal
        meta["description"] = f"Agent '{name}' executing: {goal}"

        span = {
            "id": obs_id,
            "type": "agent",
            "name": name,
            "start_time": datetime.now(timezone.utc).isoformat(),
            "end_time": None,
            "input": input_data,
            "output": None,
            "status": "in_progress",
            "metadata_json": meta,
        }
        self.observations.append(span)
        self._active_spans[obs_id] = span
        return obs_id

    def end_agent(
        self,
        obs_id: str,
        output_data: Any,
        status: str = "success",
        error: Optional[str] = None,
    ):
        """Record the completion of an agent execution step."""
        span = self._active_spans.get(obs_id)
        if span:
            span["end_time"] = datetime.now(timezone.utc).isoformat()
            span["output"] = output_data
            span["status"] = status
            if error:
                span["error"] = error
            self._active_spans.pop(obs_id, None)

    def record_tool(
        self,
        tool_name: str,
        tool_input: Any,
        tool_output: Any,
        status: str = "success",
        parent_agent_id: Optional[str] = None,
        duration_ms: Optional[float] = None,
    ) -> str:
        """Record a tool execution observation."""
        obs_id = f"tool_{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        span = {
            "id": obs_id,
            "type": "tool",
            "name": tool_name,
            "start_time": now,
            "end_time": now,
            "input": tool_input,
            "output": tool_output,
            "status": status,
            "parent_observation_id": parent_agent_id,
            "metadata_json": {
                "tool": tool_name,
                "duration_ms": duration_ms or 50.0,
            },
        }
        self.observations.append(span)
        return obs_id

    def record_llm(
        self,
        model_name: str,
        prompt: Any,
        response_text: str,
        parent_agent_id: Optional[str] = None,
        tokens: Optional[int] = None,
        duration_ms: Optional[float] = None,
    ) -> str:
        """Record an LLM call observation."""
        obs_id = f"llm_{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        span = {
            "id": obs_id,
            "type": "llm",
            "name": model_name,
            "start_time": now,
            "end_time": now,
            "input": prompt,
            "output": response_text,
            "status": "success",
            "parent_observation_id": parent_agent_id,
            "metadata_json": {
                "model": model_name,
                "tokens": tokens or len(str(response_text).split()) * 2,
                "duration_ms": duration_ms or 350.0,
            },
        }
        self.observations.append(span)
        return obs_id

    def to_trace_dict(self) -> Dict[str, Any]:
        """Convert collected observations to full trace payload."""
        return {
            "trace_id": self.trace_id,
            "application_name": self.application_name,
            "persona": self.persona,
            "organization": self.organization,
            "input": self.input_query,
            "output": self.output_response,
            "start_time": self.start_time,
            "end_time": datetime.now(timezone.utc).isoformat(),
            "observations": self.observations,
        }
