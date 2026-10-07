"""
Unified LLM Configuration & Client Resolver.
Supports:
1. Azure OpenAI (when AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT are set in .env)
2. Groq (when GROQ_API_KEY is set in .env)
3. Simulated / Dummy Mode (fallback when no API key is available or realtime is toggled off)

No API keys are exposed to or required by the Streamlit frontend.
"""
import os
import time
from typing import Dict, Any, Optional
from dotenv import load_dotenv

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
BACKEND_DIR = os.path.join(REPO_ROOT, "backend")

# Ensure environment variables are loaded
load_dotenv(os.path.join(BACKEND_DIR, ".env"))
load_dotenv(os.path.join(REPO_ROOT, ".env"))


def get_active_provider_info() -> Dict[str, Any]:
    """
    Inspect environment variables to determine the active LLM provider.
    Priority: Azure OpenAI > Groq > Simulated/Dummy.
    """
    # 1. Check Azure OpenAI configuration
    azure_key = (
        os.getenv("AZURE_OPENAI_API_KEY")
        or os.getenv("AZURE_API_KEY")
        or os.getenv("AZURE_OPENAI_KEY")
    )
    azure_endpoint = (
        os.getenv("AZURE_OPENAI_ENDPOINT")
        or os.getenv("AZURE_ENDPOINT")
        or os.getenv("AZURE_OPENAI_BASE_URL")
    )

    if azure_key and azure_endpoint:
        deployment = (
            os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")
            or os.getenv("AZURE_DEPLOYMENT_NAME")
            or os.getenv("AZURE_OPENAI_MODEL")
            or "gpt-4o"
        )
        api_version = (
            os.getenv("AZURE_OPENAI_API_VERSION")
            or os.getenv("OPENAI_API_VERSION")
            or "2024-02-15-preview"
        )
        return {
            "provider": "azure",
            "provider_name": "Azure OpenAI",
            "model_name": f"azure/{deployment}",
            "deployment": deployment,
            "api_key": azure_key,
            "endpoint": azure_endpoint.rstrip("/"),
            "api_version": api_version,
            "configured": True,
            "display_badge": f"🟢 Azure OpenAI ({deployment})",
            "details": f"Endpoint: {azure_endpoint} • Version: {api_version}",
        }

    # 2. Check Groq configuration
    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key:
        groq_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
        return {
            "provider": "groq",
            "provider_name": "Groq",
            "model_name": f"groq/{groq_model}",
            "deployment": groq_model,
            "api_key": groq_key,
            "endpoint": "https://api.groq.com/openai/v1",
            "api_version": "",
            "configured": True,
            "display_badge": f"🟢 Groq ({groq_model})",
            "details": f"Model: {groq_model} (Loaded from .env)",
        }

    # 3. Simulated / Dummy fallback
    return {
        "provider": "dummy",
        "provider_name": "Simulated (Dummy)",
        "model_name": "simulated/multi-agent",
        "deployment": "simulated",
        "api_key": None,
        "endpoint": None,
        "api_version": "",
        "configured": False,
        "display_badge": "⚪ Simulated Mode",
        "details": "Deterministic multi-agent responses & SQLite3 data querying",
    }


def call_llm(
    prompt: str,
    system_instruction: str = "",
    execution_mode: str = "dummy",
    instrumented: bool = True,
) -> str:
    """
    Execute real-time LLM inference using the active provider configured in .env (Azure OpenAI or Groq).
    Falls back gracefully if execution_mode is 'dummy' or if real-time provider calls fail.

    When instrumented=False (e.g. for evaluators/graders), uses standard openai client without Observix tracing,
    preventing duplicate/stray root traces in the dashboard.
    """
    if execution_mode != "realtime":
        return ""

    provider_info = get_active_provider_info()
    if not provider_info.get("configured"):
        return ""

    provider = provider_info["provider"]

    # --- Call Azure OpenAI ---
    if provider == "azure":
        if instrumented:
            try:
                from observix.llm.openai import AzureOpenAI
            except ImportError:
                from openai import AzureOpenAI
        else:
            from openai import AzureOpenAI

        for attempt in range(3):
            try:
                client_kwargs = {
                    "azure_endpoint": provider_info["endpoint"],
                    "api_key": provider_info["api_key"],
                    "api_version": provider_info["api_version"],
                }
                if instrumented:
                    client_kwargs["name"] = f"azure/{provider_info['deployment']}"
                client = AzureOpenAI(**client_kwargs)
                messages = []
                if system_instruction:
                    messages.append({"role": "system", "content": system_instruction})
                messages.append({"role": "user", "content": prompt})

                resp = client.chat.completions.create(
                    model=provider_info["deployment"],
                    messages=messages,
                    temperature=0.2,
                )
                choice = resp.choices[0]
                content = choice.message.content or getattr(choice.message, "reasoning", "") or ""
                return content.strip()
            except Exception as exc:
                if attempt < 2 and ("rate_limit" in str(exc).lower() or "429" in str(exc) or "timeout" in str(exc).lower()):
                    time.sleep(1.0)
                    continue
                err_msg = str(exc)
                if "invalid_api_key" in err_msg.lower() or "access denied" in err_msg.lower():
                    raise RuntimeError(f"Azure OpenAI Error: {err_msg}. Please check AZURE_OPENAI_API_KEY in .env.") from exc
                raise exc

    # --- Call Groq ---
    elif provider == "groq":
        if instrumented:
            try:
                from observix.llm.openai import OpenAI
            except ImportError:
                from openai import OpenAI
        else:
            from openai import OpenAI

        groq_model = provider_info["deployment"].replace("groq/", "")
        for attempt in range(3):
            try:
                client_kwargs = {
                    "base_url": provider_info["endpoint"],
                    "api_key": provider_info["api_key"],
                }
                if instrumented:
                    client_kwargs["name"] = f"groq/{groq_model}"
                client = OpenAI(**client_kwargs)
                messages = []
                if system_instruction:
                    messages.append({"role": "system", "content": system_instruction})
                messages.append({"role": "user", "content": prompt})

                resp = client.chat.completions.create(
                    model=groq_model,
                    messages=messages,
                    temperature=0.2,
                )
                choice = resp.choices[0]
                content = choice.message.content or getattr(choice.message, "reasoning", "") or ""
                return content.strip()
            except Exception as exc:
                if attempt < 2 and ("rate_limit" in str(exc).lower() or "429" in str(exc) or "timeout" in str(exc).lower()):
                    time.sleep(1.0)
                    continue
                err_msg = str(exc)
                if "invalid_api_key" in err_msg.lower() or "invalid api key" in err_msg.lower():
                    raise RuntimeError(f"Groq API Error: {err_msg}. Please check GROQ_API_KEY in .env.") from exc
                raise exc

    return ""


def call_llm_stream(
    prompt: str,
    system_instruction: str = "",
    execution_mode: str = "dummy",
):
    """
    Execute streaming LLM inference using active provider configured in .env (Azure OpenAI or Groq).
    Yields string chunks as they arrive.
    """
    if execution_mode != "realtime":
        return

    provider_info = get_active_provider_info()
    if not provider_info.get("configured"):
        return

    provider = provider_info["provider"]

    if provider == "azure":
        try:
            from observix.llm.openai import AzureOpenAI
        except ImportError:
            from openai import AzureOpenAI

        client = AzureOpenAI(
            azure_endpoint=provider_info["endpoint"],
            api_key=provider_info["api_key"],
            api_version=provider_info["api_version"],
            name=f"azure/{provider_info['deployment']}",
        )
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        resp = client.chat.completions.create(
            model=provider_info["deployment"],
            messages=messages,
            temperature=0.2,
            stream=True,
        )
        for chunk in resp:
            if chunk.choices and chunk.choices[0].delta:
                content = chunk.choices[0].delta.content or ""
                if content:
                    yield content

    elif provider == "groq":
        try:
            from observix.llm.openai import OpenAI
        except ImportError:
            from openai import OpenAI

        groq_model = provider_info["deployment"].replace("groq/", "")
        client = OpenAI(
            base_url=provider_info["endpoint"],
            api_key=provider_info["api_key"],
            name=f"groq/{groq_model}",
        )
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        resp = client.chat.completions.create(
            model=groq_model,
            messages=messages,
            temperature=0.2,
            stream=True,
        )
        for chunk in resp:
            if chunk.choices and chunk.choices[0].delta:
                content = chunk.choices[0].delta.content or ""
                if content:
                    yield content


def text_stream_generator(text: str, chunk_size: int = 3, delay: float = 0.015):
    """
    Yield chunks of text with a tiny delay to simulate smooth live streaming.
    """
    words = text.split(" ")
    for i in range(0, len(words), chunk_size):
        chunk = " ".join(words[i : i + chunk_size])
        if i + chunk_size < len(words):
            chunk += " "
        yield chunk
        time.sleep(delay)
