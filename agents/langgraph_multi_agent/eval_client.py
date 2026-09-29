"""
Evaluation Client for Persona-Tailored Agent Evaluations.
Connects to the backend evaluation API or runs local persona evaluation.
"""
import os
import sys
import json
import requests
from typing import Dict, Any, List, Optional

from dotenv import load_dotenv

# Add backend directory to sys.path so we can import app modules if available
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
BACKEND_DIR = os.path.join(REPO_ROOT, "backend")
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

load_dotenv(os.path.join(BACKEND_DIR, ".env"))
load_dotenv(os.path.join(REPO_ROOT, ".env"))

DEFAULT_PERSONAS = ["Default", "Sales", "Marketing", "Developer", "Product team"]
DEFAULT_GROQ_MODEL = "groq/llama-3.3-70b-versatile"


def get_available_personas(backend_url: str = "http://localhost:8000") -> List[str]:
    """Retrieve available persona list from the backend API or fallback to default 5."""
    try:
        resp = requests.get(f"{backend_url}/api/v1/evaluations/personas", timeout=2)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("personas", DEFAULT_PERSONAS)
    except Exception:
        pass

    try:
        resp = requests.get(f"{backend_url}/api/v1/users/personas", timeout=2)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("personas", DEFAULT_PERSONAS)
    except Exception:
        pass

    return DEFAULT_PERSONAS


def evaluate_chat_response(
    query: str,
    output: str,
    trace: Dict[str, Any],
    persona: str = "Default",
    organization: str = "Enterprise Corp",
    backend_url: str = "http://localhost:8000",
    api_key: Optional[str] = None,
    execution_mode: str = "dummy",
    model_name: str = DEFAULT_GROQ_MODEL,
) -> Dict[str, Any]:
    """
    Send evaluation request with persona information and trace observations.
    Supports 'dummy' (fast deterministic mock evaluation) and 'realtime' (live LLM evaluation using defined prompts).
    """
    persona_list = DEFAULT_PERSONAS
    norm_persona = persona.strip() if persona else "Default"

    # If execution mode is dummy, run local deterministic evaluation immediately
    if execution_mode != "realtime":
        return _run_local_persona_evaluation(
            query=query,
            output=output,
            trace=trace,
            persona=norm_persona,
            organization=organization,
            persona_list=persona_list,
        )

    # 1. Attempt Backend API if online
    try:
        payload = {
            "metric_id": "CustomMetric",
            "persona": norm_persona,
            "organization": organization,
            "inputs": {
                "input": query,
                "output": output,
                "trace": trace,
                "persona": norm_persona,
                "organization": organization,
                "persona_list": persona_list,
                "api_key": api_key,
                "model": model_name,
            },
        }
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        resp = requests.post(
            f"{backend_url}/api/v1/evaluations/run",
            json=payload,
            headers=headers,
            timeout=8,
        )
        if resp.status_code == 200:
            data = resp.json()
            score_val = data.get("score", 0.0)
            score_100 = round(score_val * 100 if score_val <= 1.0 else score_val, 1)
            return {
                "status": "success",
                "mode": "realtime_backend_api",
                "model": model_name,
                "persona": norm_persona,
                "organization": organization,
                "score": score_100,
                "passed": data.get("passed", score_100 >= 60.0),
                "reasoning": data.get("reason", "Evaluation completed via Backend API."),
                "feedbacks": data.get("metadata", {}).get("feedbacks", []),
                "evidences": data.get("metadata", {}).get("evidences", {}),
            }
    except Exception:
        pass  # Fallback to direct real-time LLM evaluation below

    # 2. Run Direct Real-Time LLM Evaluation using prompts defined in backend
    return _run_realtime_llm_persona_evaluation(
        query=query,
        output=output,
        trace=trace,
        persona=norm_persona,
        organization=organization,
        model_name=model_name,
        api_key=api_key,
    )


def _run_realtime_llm_persona_evaluation(
    query: str,
    output: str,
    trace: Dict[str, Any],
    persona: str,
    organization: str,
    model_name: str = DEFAULT_GROQ_MODEL,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Execute real-time LLM evaluation using the STANDARD_EVALUATION_TEMPLATE
    and persona context defined in app.core.evaluation.integrations.prompts.
    """
    try:
        from app.core.evaluation.integrations.prompts import (
            format_persona_context,
            normalize_persona,
        )
        canonical_persona = normalize_persona(persona)
        persona_context_str = format_persona_context(canonical_persona, organization)
    except Exception:
        canonical_persona = persona
        persona_context_str = f"Active Persona: {persona}\nTarget Organization: {organization}"

    trace_data_str = json.dumps(trace, indent=2, default=str) if trace else "{}"
    agents_list = ["SupervisorAgent", "AnalyticsAgent", "ReporterAgent"]
    tools_list = ["query_sales_data", "query_system_telemetry", "query_marketing_campaigns", "query_product_metrics"]

    eval_prompt = f"""You are an expert AI evaluation assistant. Your task is to evaluate the quality of an AI system's response based on the provided criteria.

AVAILABLE WORKFLOW RESOURCES:
Available Agents: {json.dumps(agents_list)}
Available Tools: {json.dumps(tools_list)}
Use ONLY these available resources for evaluation. Do not suggest tools or agents not present in this context.

SPECIAL INSTRUCTIONS FOR COMBINED TRACES:
- This trace represents an end-to-end workflow execution across multiple agents/steps
- Evaluate the complete flow from initial request to final output
- Consider inter-agent handoffs and data flow continuity
- Focus on the overall journey effectiveness, not individual trace segments

TRACE DATA TO ANALYZE (If applicable):
{trace_data_str}

{persona_context_str}

USER INQUIRY & AI SYSTEM RESPONSE TO EVALUATE:
[User Query]: {query}
[AI System Response]: {output}

EVALUATION CRITERIA & SCORING GUIDELINES:
Evaluate the response and execution trace strictly through the lens and priorities of the '{canonical_persona}' persona and '{organization}'.
1. Score from 10 to 100 based on how well the response and trace satisfy this persona's specific priorities and standards.
2. Provide a thorough reasoning from this persona's point of view.
3. List concrete supporting evidence (what satisfied this persona) and contradicting/missing evidence (what was missing for this persona).
4. Provide actionable feedback to improve the score for this persona.

Expected JSON Output:
{{
    "score": <int 10-100>,
    "passed": <boolean, true if score >= 60>,
    "reasoning": "<Detailed reasoning evaluating the response specifically through the lens of the target persona and organization>",
    "evidences": {{
        "supporting": ["<evidence_1>", "<evidence_2>"],
        "contradicting": ["<evidence_1>"]
    }},
    "feedbacks": ["<actionable feedback 1 tailored to this persona>", "<actionable feedback 2 tailored to this persona>"]
}}

JSON:"""

    key = api_key or os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY")
    try:
        import litellm
        litellm.suppress_debug_info = True
        call_kwargs: Dict[str, Any] = {
            "model": model_name,
            "messages": [{"role": "user", "content": eval_prompt}],
            "temperature": 0.0,
        }
        if key:
            call_kwargs["api_key"] = key

        resp = litellm.completion(**call_kwargs)
        raw_content = resp.choices[0].message.content or ""

        cleaned = raw_content.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        parsed = json.loads(cleaned)
        score_raw = float(parsed.get("score", 70.0))
        score_100 = round(score_raw * 100 if score_raw <= 1.0 else score_raw, 1)

        return {
            "status": "success",
            "mode": "realtime_llm",
            "model": model_name,
            "persona": canonical_persona,
            "organization": organization,
            "score": score_100,
            "passed": parsed.get("passed", score_100 >= 60.0),
            "reasoning": parsed.get("reasoning", "Real-time LLM evaluation completed successfully."),
            "evidences": parsed.get("evidences", {"supporting": [], "contradicting": []}),
            "feedbacks": parsed.get("feedbacks", []),
        }

    except Exception as exc:
        err_msg = str(exc)
        friendly_err = err_msg
        if "invalid_api_key" in err_msg.lower() or "invalid api key" in err_msg.lower():
            friendly_err = "Invalid Groq API Key: The key provided in .env was rejected by Groq. Please update GROQ_API_KEY in backend/.env or the sidebar."
        return {
            "status": "error",
            "mode": "realtime_llm",
            "model": model_name,
            "persona": canonical_persona,
            "organization": organization,
            "score": 0.0,
            "passed": False,
            "reasoning": f"Real-time Groq LLM evaluation failed: {friendly_err}",
            "evidences": {"supporting": [], "contradicting": [f"Groq API Error: {friendly_err}"]},
            "feedbacks": ["Provide a valid Groq API key in the left bar or update backend/.env."],
            "error": friendly_err,
        }



def _run_local_persona_evaluation(
    query: str,
    output: str,
    trace: Dict[str, Any],
    persona: str,
    organization: str,
    persona_list: List[str],
) -> Dict[str, Any]:
    """
    Produce a persona-tailored evaluation result inspecting the response
    and multi-agent trace observations from that persona's exact perspective.
    """
    text = (output or "").lower()
    observations = trace.get("observations", []) if isinstance(trace, dict) else []

    agent_count = sum(1 for o in observations if o.get("type") == "agent")
    tool_count = sum(1 for o in observations if o.get("type") == "tool")
    llm_count = sum(1 for o in observations if o.get("type") == "llm")

    has_revenue = any(k in text for k in ["$4,850,000", "$4.85m", "revenue", "quota", "pipeline"])
    has_tech = any(k in text for k in ["latency", "p50", "p95", "postgres", "clickhouse", "schema", "api"])
    has_marketing = any(k in text for k in ["mql", "sql", "cac", "campaign", "roas", "channel"])
    has_product = any(k in text for k in ["mau", "dau", "retention", "adoption", "csat"])

    if persona.lower() == "sales":
        if has_revenue:
            score = 94.0
            passed = True
            reasoning = (
                f"From the perspective of the Sales Team at {organization}, this response is outstanding. "
                "It immediately delivers precise revenue figures ($4.85M vs $4.50M target), highlights quota attainment (107.8%), "
                "identifies the top closed deal ($520K Global Logistics Corp), and provides pipeline visibility ($8.2M remaining). "
                "The format is executive-ready, highly actionable for deal velocity, and avoids unnecessary technical friction."
            )
            evidences = {
                "supporting": [
                    "Reported exact quarterly revenue ($4,850,000) and attainment (107.8%)",
                    "Surfaced pipeline forward momentum ($8.20M remaining)",
                    "Highlighted marquee enterprise deal and regional quota breakdown (118% North America)",
                ],
                "contradicting": [],
            }
            feedbacks = [
                "Consider adding salesperson or quota carrier leaderboard rankings to motivate sales reps.",
                "Highlight target close dates for the top 3 deals in the remaining pipeline.",
            ]
        else:
            score = 42.0
            passed = False
            reasoning = "Fails to prioritize clear commercial revenue numbers and actionable pipeline targets needed by the Sales Team."
            evidences = {"supporting": [], "contradicting": ["Missing bottom-line quarterly sales figures"]}
            feedbacks = ["Include exact dollar figures, quota attainment percentages, and key customer deal drivers."]

    elif persona.lower() in ("developer", "dev"):
        if has_tech:
            score = 91.0
            passed = True
            reasoning = (
                f"From the perspective of a Developer/Engineering Team at {organization}, this response demonstrates strong technical rigor. "
                "It explicitly reports system telemetry (p50: 28.4ms, p95: 112.6ms, p99: 245.1ms), error rates (0.02%), "
                "partitioned storage infrastructure (PostgreSQL/ClickHouse), and API endpoint contracts. "
                f"The multi-agent workflow trace confirms {agent_count} agents, {tool_count} tool calls, and {llm_count} LLM steps."
            )
            evidences = {
                "supporting": [
                    "Provided concrete latency percentiles (p50, p95, p99) and uptime error rate (0.02%)",
                    "Disclosed underlying database engine and table partition ('enterprise_orders_partition_2026_q3')",
                    "Documented cache hit ratio (89.4%) and active cloud replicas (6)",
                ],
                "contradicting": [],
            }
            feedbacks = [
                "Include the exact SQL query plan / EXPLAIN output for the quarterly aggregation table.",
                "Provide connection pool saturation and Kafka ingest lag metrics during peak queries.",
            ]
        else:
            score = 38.0
            passed = False
            reasoning = "Lacks technical precision, system telemetry, latency boundaries, or query verification required by developers."
            evidences = {"supporting": [], "contradicting": ["No API latency, database query traces, or schema information provided."]}
            feedbacks = ["Provide concrete endpoint latency percentiles, error rates, and database schema partition details."]

    elif persona.lower() == "marketing":
        if has_marketing:
            score = 88.0
            passed = True
            reasoning = (
                f"From the Marketing Team perspective at {organization}, the output provides valuable demand-generation insights. "
                "It correlates lead generation (3,480 MQLs, 612 SQLs) with blended CAC ($1,420) and ROAS (3.8x). "
                "It highlights key channel performance, demonstrating that Technical Inbound Blog yielded highest ROI."
            )
            evidences = {
                "supporting": [
                    "Detailed MQL and SQL conversion metrics",
                    "Identified top-performing acquisition channels with per-channel CAC breakdown",
                    "Included brand reach (1.4M impressions) and sentiment score (8.7/10)",
                ],
                "contradicting": [],
            }
            feedbacks = [
                "Include month-over-month lead velocity and organic search keyword ranking gains.",
                "Compare webinar lead conversion rate against paid social ad campaigns.",
            ]
        else:
            score = 45.0
            passed = False
            reasoning = "Response lacks marketing context, channel attribution, and lead acquisition metrics."
            evidences = {"supporting": [], "contradicting": ["Missing campaign ROI and MQL/SQL conversion metrics."]}
            feedbacks = ["Incorporate customer acquisition channels, campaign ROI, and brand sentiment data."]

    elif persona.lower() in ("product team", "product"):
        if has_product:
            score = 89.0
            passed = True
            reasoning = (
                f"From the Product Team perspective at {organization}, the response effectively captures user value and platform health. "
                "It highlights strong product adoption (76.5% feature adoption), healthy daily engagement (DAU/MAU 42.9%), "
                "high user retention (88.2% 30-day retention), and overall customer satisfaction (4.6/5.0 CSAT)."
            )
            evidences = {
                "supporting": [
                    "Reported monthly and daily active users (18,450 MAU / 7,920 DAU)",
                    "Tracked feature adoption rate (76.5%) and user satisfaction (4.6 CSAT)",
                    "Flagged user dropoff point (complex SQL export modal) for roadmap optimization",
                ],
                "contradicting": [],
            }
            feedbacks = [
                "Prioritize redesigning the custom SQL export modal in the next product sprint to fix the 11% dropoff.",
                "Break down retention across different user onboarding cohorts.",
            ]
        else:
            score = 48.0
            passed = False
            reasoning = "Response does not provide user journey, feature adoption, or product satisfaction metrics."
            evidences = {"supporting": [], "contradicting": ["Missing user retention, engagement, and CSAT scores."]}
            feedbacks = ["Provide user adoption, retention, and UX friction metrics."]

    else:  # Default Persona
        score = 92.0
        passed = True
        reasoning = (
            f"From the Default / General Evaluator perspective at {organization}, the response is comprehensive, highly accurate, "
            "and directly answers the user's inquiry with structured evidence across commercial, technical, and operational dimensions. "
            f"The underlying multi-agent execution completed successfully across {agent_count} agents and {tool_count} tools."
        )
        evidences = {
            "supporting": [
                "Directly answered the inquiry with structured executive summary",
                "Multi-agent execution verified across SupervisorAgent, AnalyticsAgent, and ReporterAgent",
                "High factual density with verified figures across all key business dimensions",
            ],
            "contradicting": [],
        }
        feedbacks = [
            "Tailor the presentation style if the audience requests a specific departmental focus (e.g. Sales or Developer).",
        ]

    return {
        "status": "success",
        "mode": "dummy",
        "persona": persona,
        "organization": organization,
        "persona_list": persona_list,
        "score": score,
        "passed": passed,
        "reasoning": reasoning,
        "feedbacks": feedbacks,
        "evidences": evidences,
        "agent_count": agent_count,
        "tool_count": tool_count,
        "llm_count": llm_count,
    }
