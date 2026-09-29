"""
LangGraph Multi-Agent Workflow with 3 Instrumented Agents:
1. SupervisorAgent (Planning & Orchestration)
2. AnalyticsAgent (Tool Execution & Quantitative Research)
3. ReporterAgent (Executive Synthesis & Domain Formatting)

Instruments Agents, Tools, and LLMs into an Observix-compatible Trace.
"""
import os
import json
import time
from typing import Dict, Any, List, Optional, TypedDict
from langgraph.graph import StateGraph, START, END

from dotenv import load_dotenv

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
BACKEND_DIR = os.path.join(REPO_ROOT, "backend")
load_dotenv(os.path.join(BACKEND_DIR, ".env"))
load_dotenv(os.path.join(REPO_ROOT, ".env"))

from agents.langgraph_multi_agent.instrumentation import TraceCollector
from agents.langgraph_multi_agent.tools import (
    query_sales_data,
    query_system_telemetry,
    query_marketing_campaigns,
    query_product_metrics,
)

DEFAULT_GROQ_MODEL = "groq/llama-3.3-70b-versatile"


class MultiAgentState(TypedDict):
    query: str
    persona: str
    organization: str
    execution_mode: str  # "dummy" or "realtime"
    model_name: str
    api_key: Optional[str]
    plan: Dict[str, Any]
    analytical_data: Dict[str, Any]
    final_output: str
    error: Optional[str]
    tracer: Any  # TraceCollector


def _call_llm(
    prompt: str,
    model_name: str = DEFAULT_GROQ_MODEL,
    api_key: Optional[str] = None,
    system_instruction: str = "",
    execution_mode: str = "dummy",
) -> str:
    """Execute LLM call using litellm if execution_mode is 'realtime', else return empty string for dummy fallback."""
    if execution_mode != "realtime":
        return ""

    key = api_key or os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY")
    try:
        import litellm
        litellm.suppress_debug_info = True
        messages = []
        if system_instruction:
            messages.append({"role": "system", "content": system_instruction})
        messages.append({"role": "user", "content": prompt})

        call_kwargs: Dict[str, Any] = {
            "model": model_name,
            "messages": messages,
            "temperature": 0.2,
        }
        if key:
            call_kwargs["api_key"] = key

        resp = litellm.completion(**call_kwargs)
        return resp.choices[0].message.content or ""
    except Exception as exc:
        err_msg = str(exc)
        if "invalid_api_key" in err_msg.lower() or "invalid api key" in err_msg.lower():
            raise RuntimeError("Invalid Groq API Key: The key provided in .env was rejected by Groq. Please update GROQ_API_KEY in backend/.env or the sidebar.") from exc
        raise exc


# ---------------------------------------------------------------------------
# Node 1: SupervisorAgent
# ---------------------------------------------------------------------------

def supervisor_node(state: MultiAgentState) -> Dict[str, Any]:
    tracer: TraceCollector = state.get("tracer")
    query = state.get("query", "")
    persona = state.get("persona", "Default")
    org = state.get("organization", "Enterprise Corp")
    execution_mode = state.get("execution_mode", "dummy")
    model_name = state.get("model_name", "gpt-4o")
    api_key = state.get("api_key")

    agent_id = ""
    if tracer:
        agent_id = tracer.start_agent(
            name="SupervisorAgent",
            input_data={"query": query, "persona": persona, "organization": org, "mode": execution_mode},
            goal="Analyze user inquiry, determine intent, formulate plan and delegate research tasks.",
        )

    t0 = time.time()
    prompt = f"""You are the SupervisorAgent coordinating an enterprise multi-agent system for {org}.
User Query: "{query}"
Target Persona: "{persona}"

Formulate an execution plan specifying required tools, key dimensions to analyze, and downstream requirements."""

    llm_output = ""
    llm_error = None
    if execution_mode == "realtime":
        try:
            llm_output = _call_llm(
                prompt=prompt,
                model_name=model_name,
                api_key=api_key,
                system_instruction="You are a senior supervisor agent orchestrating complex analytical tasks.",
                execution_mode="realtime",
            )
        except Exception as exc:
            llm_error = str(exc)

    if not llm_output:
        q_lower = query.lower()
        if any(k in q_lower for k in ["latency", "telemetry", "p50", "p95", "tech", "performance", "api", "query"]):
            llm_output = (
                f"Execution Plan for '{query}':\n"
                f"1. Query system telemetry service ('core-sales-service') for p50/p95/p99 latency, error rates, and uptime.\n"
                f"2. Inspect database partition query timings (`enterprise_orders_partition_2026_q3`).\n"
                f"3. Check replica health and cache hit ratio across cloud clusters.\n"
                f"4. Forward technical telemetry to AnalyticsAgent and ReporterAgent."
            )
        elif any(k in q_lower for k in ["marketing", "cac", "mql", "sql", "roas", "channel", "campaign"]):
            llm_output = (
                f"Execution Plan for '{query}':\n"
                f"1. Query marketing campaign attribution database for Q3 2026.\n"
                f"2. Extract MQL and SQL conversion volumes and blended CAC.\n"
                f"3. Analyze channel ROI (Technical Inbound Blog vs Enterprise Webinars vs Paid Social).\n"
                f"4. Delegate to AnalyticsAgent and format for ReporterAgent."
            )
        elif any(k in q_lower for k in ["dau", "mau", "retention", "adoption", "product", "csat"]):
            llm_output = (
                f"Execution Plan for '{query}':\n"
                f"1. Query product analytics platform for active user metrics (MAU/DAU).\n"
                f"2. Pull 30-day cohort retention curve and monthly customer churn rate.\n"
                f"3. Retrieve feature adoption data for quarterly reporting modal and CSAT ratings.\n"
                f"4. Synthesize findings via AnalyticsAgent and ReporterAgent."
            )
        else:
            llm_output = (
                f"Execution Plan for '{query}':\n"
                f"1. Query commercial sales database (actual vs target, quota attainment, pipeline).\n"
                f"2. Pull system telemetry (API latency, query duration, schema contracts) for verification.\n"
                f"3. Retrieve marketing acquisition data (CAC, conversion rates, channel ROI).\n"
                f"4. Delegate to AnalyticsAgent for data extraction and forward to ReporterAgent."
            )

    duration_ms = (time.time() - t0) * 1000
    if tracer:
        tracer.record_llm(
            model_name=model_name if execution_mode == "realtime" and not llm_error else "dummy-simulator",
            prompt=prompt,
            response_text=llm_output,
            parent_agent_id=agent_id,
            duration_ms=duration_ms,
        )

    plan = {
        "status": "planned",
        "intent": "enterprise_performance_analysis",
        "required_tools": ["query_sales_data", "query_system_telemetry", "query_marketing_campaigns", "query_product_metrics"],
        "plan_summary": llm_output,
        "mode": execution_mode,
    }

    if tracer:
        tracer.end_agent(agent_id, output_data=plan)

    return {"plan": plan, "error": llm_error if llm_error else state.get("error")}


# ---------------------------------------------------------------------------
# Node 2: AnalyticsAgent
# ---------------------------------------------------------------------------

def analytics_node(state: MultiAgentState) -> Dict[str, Any]:
    tracer: TraceCollector = state.get("tracer")
    query = state.get("query", "")
    plan = state.get("plan", {})
    execution_mode = state.get("execution_mode", "dummy")
    model_name = state.get("model_name", "gpt-4o")
    api_key = state.get("api_key")

    agent_id = ""
    if tracer:
        agent_id = tracer.start_agent(
            name="AnalyticsAgent",
            input_data={"plan": plan, "query": query, "mode": execution_mode},
            goal="Execute data retrieval tools and extract quantitative facts, logs, and business numbers.",
        )

    # 1. Execute Sales Tool (Instrumented)
    sales_data = query_sales_data(quarter="Q3 2026", tracer=tracer, parent_id=agent_id)

    # 2. Execute System Telemetry Tool (Instrumented)
    tech_data = query_system_telemetry(service="core-sales-service", tracer=tracer, parent_id=agent_id)

    # 3. Execute Marketing Tool (Instrumented)
    marketing_data = query_marketing_campaigns(quarter="Q3 2026", tracer=tracer, parent_id=agent_id)

    # 4. Execute Product Tool (Instrumented)
    product_data = query_product_metrics(feature="quarterly_reporting", tracer=tracer, parent_id=agent_id)

    # LLM Synthesis of raw tool data
    t0 = time.time()
    prompt = f"""Summarize and validate the retrieved quantitative data from tools:
Sales: {json.dumps(sales_data)}
Tech: {json.dumps(tech_data)}
Marketing: {json.dumps(marketing_data)}
Product: {json.dumps(product_data)}
Identify core metrics, verified data points, and operational anomalies."""

    llm_output = ""
    llm_error = None
    if execution_mode == "realtime":
        try:
            llm_output = _call_llm(
                prompt=prompt,
                model_name=model_name,
                api_key=api_key,
                system_instruction="You are a data validation and quantitative research agent.",
                execution_mode="realtime",
            )
        except Exception as exc:
            llm_error = str(exc)

    if not llm_output:
        llm_output = (
            "Data Extraction Summary:\n"
            "- Sales: $4.85M revenue vs $4.50M target (107.8% quota, +24.3% YoY). 142 deals closed, $8.2M pipeline.\n"
            "- Tech: Core sales API p50=28.4ms, p95=112.6ms, 0.02% error rate. Postgres/ClickHouse partitioned query time 14.8ms.\n"
            "- Marketing: 3,480 MQLs, 612 SQLs, blended CAC $1,420, ROAS 3.8x, brand reach 1.4M impressions.\n"
            "- Product: 18,450 MAU, 7,920 DAU, 76.5% feature adoption, 88.2% 30d retention."
        )

    duration_ms = (time.time() - t0) * 1000
    if tracer:
        tracer.record_llm(
            model_name=model_name if execution_mode == "realtime" and not llm_error else "dummy-simulator",
            prompt=prompt,
            response_text=llm_output,
            parent_agent_id=agent_id,
            duration_ms=duration_ms,
        )

    analytical_data = {
        "sales": sales_data,
        "technology": tech_data,
        "marketing": marketing_data,
        "product": product_data,
        "synthesis": llm_output,
    }

    if tracer:
        tracer.end_agent(agent_id, output_data=analytical_data)

    current_err = state.get("error") or llm_error
    return {"analytical_data": analytical_data, "error": current_err}


# ---------------------------------------------------------------------------
# Node 3: ReporterAgent
# ---------------------------------------------------------------------------

def reporter_node(state: MultiAgentState) -> Dict[str, Any]:
    tracer: TraceCollector = state.get("tracer")
    query = state.get("query", "")
    persona = state.get("persona", "Default")
    org = state.get("organization", "Enterprise Corp")
    data = state.get("analytical_data", {})
    execution_mode = state.get("execution_mode", "dummy")
    model_name = state.get("model_name", "gpt-4o")
    api_key = state.get("api_key")

    agent_id = ""
    if tracer:
        agent_id = tracer.start_agent(
            name="ReporterAgent",
            input_data={"query": query, "persona": persona, "analytical_data_keys": list(data.keys()), "mode": execution_mode},
            goal="Synthesize structured comprehensive response answering the user query with multi-domain rigor.",
        )

    t0 = time.time()
    prompt = f"""You are the ReporterAgent delivering the final answer to the user query for {org}.
User Query: "{query}"
Target Persona: "{persona}"

Analytical Data:
{json.dumps(data, default=str)}

Deliver a clear, factual, and well-structured answer addressing the user query."""

    llm_output = ""
    llm_error = None
    if execution_mode == "realtime":
        try:
            llm_output = _call_llm(
                prompt=prompt,
                model_name=model_name,
                api_key=api_key,
                system_instruction=f"You are a professional executive reporting agent tailoring responses to the {persona} perspective.",
                execution_mode="realtime",
            )
        except Exception as exc:
            llm_error = str(exc)

    if not llm_output:
        q_lower = query.lower()
        if any(k in q_lower for k in ["latency", "telemetry", "p50", "p95", "tech", "performance", "api", "query"]):
            llm_output = f"""### System Telemetry & Query Performance Report — {org}

**Executive Summary:**
The core infrastructure supporting {org} demonstrated outstanding performance and reliability during the evaluated period.

---

### Technical Performance Breakdown:

#### 1. Latency Percentiles & Throughput
- **p50 Latency:** **28.4ms** (Well within the 50ms SLA)
- **p95 Latency:** **112.6ms** (Target: <150ms)
- **p99 Latency:** **245.1ms**
- **Availability & Uptime:** **99.98%** with an error rate of just **0.02%**

#### 2. Database & Data Storage Engine
- **Engine:** PostgreSQL 16.2 & ClickHouse 24.3
- **Table Queried:** `enterprise_orders_partition_2026_q3`
- **Average Query Execution Time:** **14.8ms**
- **Indexes Utilized:** `idx_quarter_status_amount`, `idx_org_timestamp`
- **Cache Hit Ratio:** **89.4%** across 6 active cloud replicas

#### 3. Endpoint Contract
- **Service Monitored:** `core-sales-service`
- **Primary Endpoint:** `GET /api/v2/analytics/quarterly-metrics`

---
*Report generated and validated by Multi-Agent Workflow (SupervisorAgent, AnalyticsAgent, ReporterAgent).*"""

        elif any(k in q_lower for k in ["marketing", "cac", "mql", "sql", "roas", "channel", "campaign"]):
            llm_output = f"""### Marketing & Customer Acquisition Report (Q3 2026) — {org}

**Executive Summary:**
In Q3 2026, demand generation campaigns for {org} delivered exceptional pipeline velocity with strong capital efficiency and high return on ad spend.

---

### Key Marketing Metrics:

#### 1. Lead Generation & Conversion Funnel
- **Marketing Qualified Leads (MQLs):** **3,480 leads**
- **Sales Qualified Leads (SQLs):** **612 opportunities** (Conversion rate: **17.6%**)
- **Brand Reach:** **1,420,000 impressions** with a brand sentiment score of **8.7 / 10**

#### 2. Efficiency & Financial Return
- **Blended Customer Acquisition Cost (CAC):** **$1,420** per customer
- **Blended ROAS:** **3.8x return on ad spend**

#### 3. Top Acquisition Channels
1. **Inbound Organic / Technical Blog:** 240 conversions at **$780 CAC** (Highest ROI channel)
2. **Enterprise Product Webinars:** 195 conversions at **$1,120 CAC**
3. **Paid Search & LinkedIn Ads:** 177 conversions at **$2,240 CAC**

---
*Report generated and validated by Multi-Agent Workflow (SupervisorAgent, AnalyticsAgent, ReporterAgent).*"""

        elif any(k in q_lower for k in ["dau", "mau", "retention", "adoption", "product", "csat"]):
            llm_output = f"""### Product Adoption & User Retention Report — {org}

**Executive Summary:**
User engagement and product stickiness across {org}'s platform remain strong, driven by high adoption of quarterly reporting capabilities.

---

### Key Product Metrics:

#### 1. User Engagement & Activity
- **Monthly Active Users (MAU):** **18,450 users**
- **Daily Active Users (DAU):** **7,920 users**
- **DAU / MAU Ratio:** **42.9%** (Strong enterprise engagement benchmark)

#### 2. Retention & Satisfaction
- **30-Day Cohort Retention:** **88.2%**
- **Monthly Customer Churn:** **1.4%**
- **Customer Satisfaction (CSAT):** **4.6 / 5.0**

#### 3. Feature Adoption & UX
- **Feature Adoption Rate:** **76.5%** for quarterly reporting modules
- **Identified UX Optimization:** Minor dropoff (11%) identified on complex custom SQL export modal

---
*Report generated and validated by Multi-Agent Workflow (SupervisorAgent, AnalyticsAgent, ReporterAgent).*"""

        else:
            llm_output = f"""### Quarterly Performance Report (Q3 2026) — {org}

**Executive Summary:**
In Q3 2026, {org} generated **$4,850,000** in total sales revenue, exceeding the quarterly target of **$4,500,000** by **7.8%** (**107.8% quota attainment**), representing an outstanding **+24.3% Year-over-Year growth**.

---

### Key Performance Dimensions:

#### 1. Commercial & Sales Performance
- **Total Revenue:** **$4.85M** (Target: $4.50M, Attainment: 107.8%)
- **Deals Closed:** **142 enterprise deals** with an average contract value of **$34,154**
- **Marquee Deal:** Global Logistics Corp Enterprise License (**$520,000**)
- **Remaining Active Pipeline:** **$8.20M** heading into the next quarter
- **Regional Leader:** North America leading at **118% quota** with a **31.4% win rate**

#### 2. Technical Infrastructure & Telemetry
- **API Performance:** Core analytics API running at **p50: 28.4ms**, **p95: 112.6ms**, **p99: 245.1ms**
- **Reliability:** **99.98% uptime** (Error rate: 0.02%) across 6 active cloud replicas
- **Database Query Latency:** Average **14.8ms** execution time using optimized ClickHouse/PostgreSQL partitions (`enterprise_orders_partition_2026_q3`)
- **Cache Hit Ratio:** **89.4%**

#### 3. Growth & Customer Acquisition
- **Lead Generation:** **3,480 MQLs** generated leading to **612 Sales Qualified Leads (SQLs)**
- **Customer Acquisition Cost (CAC):** Blended CAC of **$1,420** with a **3.8x ROAS**
- **Top Channel:** Technical Inbound Blog (240 conversions at $780 CAC) followed by Enterprise Product Webinars

#### 4. Product Adoption & Retention
- **Active Users:** **18,450 MAU** / **7,920 DAU** (DAU/MAU ratio of 42.9%)
- **Product Retention:** **88.2% 30-day retention** with low 1.4% monthly customer churn
- **Customer Satisfaction:** **4.6 / 5.0 CSAT**

---
*Report generated and validated by Multi-Agent Workflow (SupervisorAgent, AnalyticsAgent, ReporterAgent).*"""

    duration_ms = (time.time() - t0) * 1000
    if tracer:
        tracer.record_llm(
            model_name=model_name if execution_mode == "realtime" and not llm_error else "dummy-simulator",
            prompt=prompt,
            response_text=llm_output,
            parent_agent_id=agent_id,
            duration_ms=duration_ms,
        )

    if tracer:
        tracer.end_agent(agent_id, output_data={"response_preview": llm_output[:120]})
        tracer.output_response = llm_output

    final_err = state.get("error") or llm_error
    return {"final_output": llm_output, "error": final_err}


# ---------------------------------------------------------------------------
# Build & Compile Graph
# ---------------------------------------------------------------------------

def build_multi_agent_graph():
    """Build the compiled LangGraph workflow connecting the 3 agents."""
    builder = StateGraph(MultiAgentState)

    builder.add_node("SupervisorAgent", supervisor_node)
    builder.add_node("AnalyticsAgent", analytics_node)
    builder.add_node("ReporterAgent", reporter_node)

    builder.add_edge(START, "SupervisorAgent")
    builder.add_edge("SupervisorAgent", "AnalyticsAgent")
    builder.add_edge("AnalyticsAgent", "ReporterAgent")
    builder.add_edge("ReporterAgent", END)

    return builder.compile()


def run_multi_agent_workflow(
    query: str,
    persona: str = "Default",
    organization: str = "Enterprise Corp",
    application_name: str = "langgraph-crm-app",
    execution_mode: str = "dummy",
    model_name: str = DEFAULT_GROQ_MODEL,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Run the 3-agent instrumented LangGraph workflow.
    Supports both 'dummy' (mock/deterministic) and 'realtime' (live LLM calls) execution modes.
    Returns:
        {
            "output": <final_string>,
            "plan": <plan_dict>,
            "analytical_data": <data_dict>,
            "trace": <trace_dict_with_observations>,
            "mode": <"dummy" | "realtime">,
            "model": <model_name>,
            "error": <error_str_or_None>
        }
    """
    tracer = TraceCollector(
        application_name=application_name,
        persona=persona,
        organization=organization,
    )
    tracer.input_query = query

    graph = build_multi_agent_graph()
    initial_state: MultiAgentState = {
        "query": query,
        "persona": persona,
        "organization": organization,
        "execution_mode": execution_mode,
        "model_name": model_name,
        "api_key": api_key,
        "plan": {},
        "analytical_data": {},
        "final_output": "",
        "error": None,
        "tracer": tracer,
    }

    result = graph.invoke(initial_state)

    trace_dict = tracer.to_trace_dict()
    return {
        "output": result.get("final_output", ""),
        "plan": result.get("plan", {}),
        "analytical_data": result.get("analytical_data", {}),
        "trace": trace_dict,
        "mode": execution_mode,
        "model": model_name,
        "error": result.get("error"),
    }

