"""
app/core/evaluation/integrations/trace_sanitizer.py

Sanitizes raw multi-agent execution trace data for LLM evaluators.
Uses litellm for LLM requests (no observix dependency).
"""
import os
import re
import json
import logging
from typing import List, Dict, Any

from app.core.evaluation.integrations.prompts import TRACE_SANITIZATION_PROMPT

logger = logging.getLogger(__name__)


class TraceSanitizer:
    """
    Sanitizes trace data by extracting only agent execution steps.
    """

    def __init__(self, provider: str = "openai", model: str = "gpt-4", **kwargs):
        self.provider = provider
        self.model_name = model
        self.temperature = 0.0

    def _get_litellm_model(self) -> str:
        if self.provider in ("azure",):
            # Azure deployment fallback
            deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME") or self.model_name
            return f"azure/{deployment}"
        if self.provider == "langchain":
            return f"groq/{self.model_name}"
        return self.model_name

    def _generate_response(self, prompt: str) -> str:
        try:
            import litellm

            model = self._get_litellm_model()

            kwargs: Dict[str, Any] = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": self.temperature,
            }

            # Set response format to json_object for providers supporting it
            if self.provider in ("openai", "azure"):
                kwargs["response_format"] = {"type": "json_object"}

            api_key = os.getenv("OPENAI_API_KEY") or os.getenv("AZURE_OPENAI_KEY") or os.getenv("GROQ_API_KEY")
            if api_key:
                kwargs["api_key"] = api_key

            response = litellm.completion(**kwargs)
            return response.choices[0].message.content or ""
        except Exception as exc:
            logger.error(f"TraceSanitizer LLM call failed: {exc}")
            raise

    def sanitize(self, trace_data: Dict[str, Any], agents: List[str], tools: List[str]) -> Dict[str, Any]:
        """
        Extract only agent execution steps and validate agent count.
        """
        try:
            prompt = TRACE_SANITIZATION_PROMPT.format(
                agents=agents,
                tools=tools,
                trace=json.dumps(trace_data, indent=2, default=str),
            )

            response_text = self._generate_response(prompt)

            # Extract JSON block if response text is fenced
            cleaned_response = response_text.strip()
            if cleaned_response.startswith("```json"):
                cleaned_response = cleaned_response[7:]
            if cleaned_response.startswith("```"):
                cleaned_response = cleaned_response[3:]
            if cleaned_response.endswith("```"):
                cleaned_response = cleaned_response[:-3]
            cleaned_response = cleaned_response.strip()

            try:
                data = json.loads(cleaned_response)
                return data
            except json.JSONDecodeError:
                # Regex search fallback
                match = re.search(r"\{.*\}", cleaned_response, re.DOTALL)
                if match:
                    return json.loads(match.group(0))
                raise ValueError("Could not parse JSON from sanitization response")

        except Exception as e:
            logger.warning(f"Sanitization failed: {e}")
            # Fallback to returning original trace data
            return trace_data
