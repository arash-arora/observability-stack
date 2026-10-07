"""
Streamlit Multi-Agent Chat Application with Persona-Tailored Evaluations.
Built with LangGraph (SupervisorAgent, AnalyticsAgent, ReporterAgent).
Supports:
1. Live streaming responses (real-time LLM streaming and simulated typing)
2. 4 Core Evaluation Metrics with customizable weightages:
   - Answer Relevancy (Default: 30%)
   - Groundedness (Default: 30%)
   - Context Relevancy (Default: 20%)
   - Hallucination / Truthfulness (Default: 20%)
3. "How the LLM Reached the Score": Full step-by-step chain-of-thought, evidence verification, and decision rationale
4. Evidence Tables viewer: Interactive display of SQLite3 tables queried for the answer
5. Chit-chat detection: Automatically skips evaluation for conversational queries
"""
import os
import sys
import json
import time
import pandas as pd
import streamlit as st
from dotenv import load_dotenv

# Configure page
st.set_page_config(
    page_title="Enterprise Multi-Agent Chat & Persona Eval",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Add repository root and backend to sys.path and load environment variables
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
BACKEND_DIR = os.path.join(REPO_ROOT, "backend")
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

load_dotenv(os.path.join(BACKEND_DIR, ".env"))
load_dotenv(os.path.join(REPO_ROOT, ".env"))

try:
    import litellm
    litellm.suppress_debug_info = True
except Exception:
    pass

from agents.langgraph_multi_agent.graph import (
    run_multi_agent_workflow,
    is_chitchat_query,
    get_chitchat_report,
    get_reporter_prompt_and_instruction,
    get_deterministic_report,
)
from agents.langgraph_multi_agent.llm_config import (
    get_active_provider_info,
    call_llm_stream,
    text_stream_generator,
)
from agents.langgraph_multi_agent.eval_client import (
    get_available_personas,
    evaluate_chat_response,
    evaluate_chat_response_stream,
    DEFAULT_METRIC_WEIGHTS,
    AVAILABLE_OBSERVIX_METRICS,
)
USERS_FILE = os.path.join(os.path.dirname(__file__), "users.json")


def load_users_mapping() -> dict:
    """Load email_id to persona mapping directly from JSON file on each execution."""
    if os.path.exists(USERS_FILE):
        try:
            with open(USERS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
        except Exception:
            pass
    # Fallback to 3 canonical personas: sales, marketing, IT
    return {
        "sales@company.com": "sales",
        "marketing@company.com": "marketing",
        "it@company.com": "IT",
    }


# ---------------------------------------------------------------------------
# Persona Metadata Definition & Flexible Lookup
# ---------------------------------------------------------------------------
PERSONA_META = {
    "sales": {
        "title": "Sales & Merchandising",
        "icon": "💼",
        "description": "Apparel sell-through rates, unit gross margins (72-76%), core fabric franchises (Nulu, Luon, Warpstreme), and discount preservation.",
        "example": "Evaluates $76.04M quarterly revenue, 893.1K units sold, Align Pant $10.66M profit, and Everywhere Belt Bag cross-sell attach.",
    },
    "marketing": {
        "title": "Brand & Community Marketing",
        "icon": "📢",
        "description": "Social commerce reach (#LululemonHaul), TikTok/IG viral views, likes, CTR, ad spend efficiency, and community ambassador activations.",
        "example": "Evaluates Everywhere Belt Bag 6.38% CTR, 8.42M views, 4.6x blended ROAS, and $32 customer acquisition cost.",
    },
    "it": {
        "title": "Digital Platform & Dev",
        "icon": "🖥️",
        "description": "E-commerce platform reliability, 28.4ms edge latency, 99.99% uptime SLA, 92.35% CDN cache hit ratio, AI Stylist LLM costs ($3,690), and most viewed SKUs.",
        "example": "Tracks 28.4ms checkout latency, zero P0 drop failures, and most viewed products click-through telemetry.",
    },
}


def get_persona_info(persona_name: str) -> dict:
    """Normalize persona lookup to support any case or custom persona dynamically."""
    key = str(persona_name).strip().lower()
    if key in PERSONA_META:
        return PERSONA_META[key]
    return {
        "title": persona_name,
        "icon": "👤",
        "description": f"Domain-specific operational criteria and performance metrics for {persona_name}.",
        "example": f"Evaluates factual accuracy, directness, and relevance tailored to {persona_name}.",
    }


# ---------------------------------------------------------------------------
# Custom CSS for Premium Design & Observability
# ---------------------------------------------------------------------------
st.markdown(
    """
    <style>
    .main-header {
        font-size: 2.2rem;
        font-weight: 700;
        background: linear-gradient(90deg, #6366F1, #8B5CF6, #EC4899);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0.2rem;
    }
    .persona-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 9999px;
        font-weight: 600;
        font-size: 0.85rem;
        background: rgba(99, 102, 241, 0.15);
        color: #818CF8;
        border: 1px solid rgba(99, 102, 241, 0.3);
    }
    .mode-badge-dummy {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 9999px;
        font-weight: 600;
        font-size: 0.82rem;
        background: rgba(148, 163, 184, 0.15);
        color: #94A3B8;
        border: 1px solid rgba(148, 163, 184, 0.35);
    }
    .mode-badge-realtime {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 9999px;
        font-weight: 600;
        font-size: 0.82rem;
        background: rgba(16, 185, 129, 0.15);
        color: #34D399;
        border: 1px solid rgba(16, 185, 129, 0.4);
    }
    .persona-card {
        padding: 1.5rem;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.1);
        margin-bottom: 0.8rem;
    }
    .score-badge-pass {
        font-size: 1.8rem;
        font-weight: 800;
        color: #34D399;
    }
    .score-badge-fail {
        font-size: 1.8rem;
        font-weight: 800;
        color: #F87171;
    }
    .step-card {
        padding: 0.8rem;
        border-radius: 8px;
        background: rgba(15, 23, 42, 0.6);
        border-left: 3px solid #6366F1;
        margin-bottom: 0.5rem;
        font-size: 0.9rem;
    }
    .metric-card {
        padding: 14px 16px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.09);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        height: 100%;
    }
    .metric-header {
        font-size: 0.85rem;
        font-weight: 700;
        color: #CBD5E1;
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    .metric-score-val {
        font-size: 1.6rem;
        font-weight: 800;
        margin: 4px 0;
    }
    .metric-score-green {
        color: #34D399;
    }
    .metric-score-red {
        color: #F87171;
    }
    .weight-pill {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 9999px;
        font-size: 0.72rem;
        font-weight: 700;
        background: rgba(99, 102, 241, 0.18);
        color: #A5B4FC;
        border: 1px solid rgba(99, 102, 241, 0.35);
    }
    .contrib-pill {
        font-size: 0.75rem;
        color: #94A3B8;
        margin-top: 4px;
    }
    .formula-banner {
        padding: 10px 14px;
        border-radius: 8px;
        background: rgba(15, 23, 42, 0.75);
        border-left: 4px solid #6366F1;
        font-family: monospace;
        font-size: 0.83rem;
        color: #E2E8F0;
        margin: 10px 0 14px 0;
    }
    .thought-step {
        padding: 10px 14px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.025);
        border: 1px solid rgba(255, 255, 255, 0.08);
        margin-bottom: 8px;
        font-size: 0.88rem;
    }
    .thought-step-title {
        font-weight: 700;
        color: #818CF8;
        font-size: 0.9rem;
        margin-bottom: 4px;
    }
    .chitchat-banner {
        padding: 12px 16px;
        border-radius: 10px;
        background: rgba(99, 102, 241, 0.08);
        border: 1px solid rgba(99, 102, 241, 0.25);
        margin-top: 10px;
        font-size: 0.88rem;
        color: #CBD5E1;
    }
    .table-tag {
        display: inline-block;
        padding: 3px 10px;
        border-radius: 6px;
        font-size: 0.8rem;
        font-family: monospace;
        font-weight: 600;
        background: rgba(99, 102, 241, 0.15);
        color: #A5B4FC;
        border: 1px solid rgba(99, 102, 241, 0.35);
        margin-right: 6px;
        margin-bottom: 4px;
    }
    .trace-link-btn {
        text-decoration: none !important;
        padding: 7px 14px;
        border-radius: 8px;
        background: rgba(99, 102, 241, 0.12);
        border: 1px solid rgba(99, 102, 241, 0.35);
        color: #818CF8 !important;
        font-weight: 600;
        font-size: 0.82rem;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.2s ease;
    }
    .trace-link-btn:hover {
        background: rgba(99, 102, 241, 0.25);
        color: #C7D2FE !important;
        border-color: rgba(99, 102, 241, 0.6);
    }
    </style>
    """,
    unsafe_allow_html=True,
)

# ---------------------------------------------------------------------------
# Session State Initialization & Dynamic JSON Sync
# ---------------------------------------------------------------------------
if "logged_in" not in st.session_state:
    st.session_state.logged_in = False

if "user_email" not in st.session_state:
    st.session_state.user_email = ""

if "persona" not in st.session_state:
    st.session_state.persona = "sales"

if "organization" not in st.session_state:
    st.session_state.organization = "Lululemon Athletica"

if "messages" not in st.session_state:
    st.session_state.messages = []

if "backend_url" not in st.session_state:
    st.session_state.backend_url = "http://localhost:8010"

if "realtime_mode" not in st.session_state:
    st.session_state.realtime_mode = True  # Real-time LLM calls active when provider configured in .env

if "metric_weights" not in st.session_state:
    st.session_state.metric_weights = dict(DEFAULT_METRIC_WEIGHTS)

provider_info = get_active_provider_info()
st.session_state.llm_model = provider_info["model_name"]
st.session_state.llm_api_key = provider_info.get("api_key") or ""

# Dynamically load the user mapping on every run
users_mapping = load_users_mapping()

# If user is currently logged in, sync active persona automatically with latest JSON content
if st.session_state.logged_in and st.session_state.user_email:
    clean_user = st.session_state.user_email.strip().lower()
    for u_email, p_name in users_mapping.items():
        if u_email.strip().lower() == clean_user:
            st.session_state.persona = p_name
            break

# ---------------------------------------------------------------------------
# View 1: Login Screen (Shown First When Not Logged In)
# ---------------------------------------------------------------------------
if not st.session_state.logged_in:
    with st.sidebar:
        st.markdown('<div class="main-header" style="font-size: 1.5rem;">🤖 Enterprise Agent</div>', unsafe_allow_html=True)
        st.caption("Please log in to continue")
        st.markdown("---")
        st.markdown("### 🎛️ Execution Engine")
        st.session_state.realtime_mode = st.toggle(
            "⚡ Real-time LLM Calls",
            value=st.session_state.realtime_mode,
            key="login_mode_toggle",
            help="Switch between Simulated responses (no API key needed) and live Real-time LLM calls via .env (Azure OpenAI or Groq).",
        )
        if st.session_state.realtime_mode:
            if provider_info["configured"]:
                st.markdown(
                    f'<div style="padding: 10px 14px; border-radius: 8px; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); margin-bottom: 10px;">'
                    f'<span style="color: #34D399; font-weight: 700; font-size: 0.88rem;">{provider_info["display_badge"]}</span><br>'
                    f'<span style="font-size: 0.73rem; color: #A7F3D0;">Active from <code>.env</code></span>'
                    f'</div>',
                    unsafe_allow_html=True,
                )
            else:
                st.markdown(
                    '<div style="padding: 10px 14px; border-radius: 8px; background: rgba(148, 163, 184, 0.12); border: 1px solid rgba(148, 163, 184, 0.3); margin-bottom: 10px;">'
                    '<span style="color: #94A3B8; font-weight: 700; font-size: 0.85rem;">⚪ Simulated Mode</span><br>'
                    '<span style="font-size: 0.73rem; color: #CBD5E1;">Add <code>AZURE_OPENAI_API_KEY</code> & <code>AZURE_OPENAI_ENDPOINT</code> or <code>GROQ_API_KEY</code> to <code>.env</code>.</span>'
                    '</div>',
                    unsafe_allow_html=True,
                )

    st.markdown('<div class="main-header">🔐 Lululemon Athletica — Enterprise AI Login</div>', unsafe_allow_html=True)
    st.write("Sign in with your corporate email to access your persona-tailored workspace and data access policies.")

    col_l1, col_l2 = st.columns([1.2, 1], gap="large")

    with col_l1:
        st.markdown('<div class="persona-card">', unsafe_allow_html=True)
        st.markdown("### Sign In")
        with st.form("login_form"):
            email_input = st.text_input(
                "Corporate Email ID",
                placeholder="e.g. sales@lululemon.com",
                key="input_email",
            )
            pwd_input = st.text_input(
                "Password",
                type="password",
                placeholder="Enter password (demo mode)",
                key="input_password",
            )
            st.caption("ℹ️ *Password verification bypassed for demo sandbox.*")

            submit_login = st.form_submit_button("🚀 Sign In", type="primary", use_container_width=True)

            if submit_login:
                clean_email = email_input.strip().lower()
                matched_persona = None
                for u_email, p_name in users_mapping.items():
                    if u_email.strip().lower() == clean_email:
                        matched_persona = p_name
                        break

                if matched_persona:
                    st.session_state.logged_in = True
                    st.session_state.user_email = email_input.strip()
                    st.session_state.persona = matched_persona
                    st.session_state.organization = "Lululemon Athletica"
                    p_info = get_persona_info(matched_persona)
                    st.success(f"Welcome! Authenticated as {email_input.strip()} ({p_info['icon']} {matched_persona}).")
                    time.sleep(0.3)
                    st.rerun()
                else:
                    if not clean_email:
                        st.error("Please enter an email address.")
                    else:
                        st.error("Email not recognized. Please use one of the authorized accounts.")
        st.markdown('</div>', unsafe_allow_html=True)

    with col_l2:
        st.markdown("### 👥 Quick Sign-In Accounts")
        st.caption("Click any role to test persona-tailored data access & evaluations:")

        seen_emails = set()
        for u_email, p_name in users_mapping.items():
            if u_email.lower() in seen_emails:
                continue
            seen_emails.add(u_email.lower())
            p_info = get_persona_info(p_name)
            btn_label = f"{p_info['icon']} {p_name} — {u_email}"
            if st.button(btn_label, use_container_width=True, key=f"quick_btn_{u_email}"):
                st.session_state.logged_in = True
                st.session_state.user_email = u_email
                st.session_state.persona = p_name
                st.session_state.organization = "Lululemon Athletica"
                st.rerun()

    st.stop()


# ---------------------------------------------------------------------------
# Sidebar (Left Bar): Logged-in User, Persona, Execution Mode & Metric Weights
# ---------------------------------------------------------------------------
active_p_info = get_persona_info(st.session_state.persona)

with st.sidebar:
    st.markdown('<div class="main-header" style="font-size: 1.5rem;">🤖 Multi-Agent Chat</div>', unsafe_allow_html=True)

    # 1. Logged in user info & Persona
    st.markdown("### 👤 User Profile")
    st.markdown(
        f'<div style="padding: 12px 14px; border-radius: 10px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); margin-bottom: 15px;">'
        f'<div style="font-size: 0.72rem; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Logged in User</div>'
        f'<div style="font-weight: 600; font-size: 0.95rem; color: #F8FAFC; word-break: break-all; margin-top: 2px;">{st.session_state.user_email}</div>'
        f'<div style="margin-top: 8px;">'
        f'<span class="persona-badge">{active_p_info["icon"]} Persona: {st.session_state.persona}</span>'
        f'</div>'
        f'</div>',
        unsafe_allow_html=True,
    )

    # 2. Execution Mode Switcher
    st.markdown("### 🎛️ Execution Engine")
    mode_toggle = st.toggle(
        "⚡ Real-time LLM Calls",
        value=st.session_state.realtime_mode,
        key="mode_toggle_switch",
        help="Switch between Simulated responses & evaluations and live Real-time LLM calls (Azure OpenAI or Groq configured via .env).",
    )
    st.session_state.realtime_mode = mode_toggle

    current_provider = get_active_provider_info()
    if mode_toggle:
        if current_provider["configured"]:
            st.markdown(
                f'<div style="padding: 10px 14px; border-radius: 8px; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); margin-bottom: 10px;">'
                f'<span style="color: #34D399; font-weight: 700; font-size: 0.88rem;">{current_provider["display_badge"]}</span><br>'
                f'<span style="font-weight: 400; font-size: 0.78rem; color: #A7F3D0;">Configured via <code>.env</code></span><br>'
                f'<span style="font-size: 0.73rem; color: #94A3B8;">{current_provider["details"]}</span>'
                f'</div>',
                unsafe_allow_html=True,
            )
        else:
            st.markdown(
                '<div style="padding: 10px 14px; border-radius: 8px; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); margin-bottom: 10px;">'
                '<span style="color: #FBBF24; font-weight: 700; font-size: 0.88rem;">⚠️ No LLM Key in .env</span><br>'
                '<span style="font-weight: 400; font-size: 0.76rem; color: #FDE68A;">Add <code>AZURE_OPENAI_API_KEY</code> & <code>AZURE_OPENAI_ENDPOINT</code> or <code>GROQ_API_KEY</code> to <code>.env</code>. Falling back to deterministic mode.</span>'
                '</div>',
                unsafe_allow_html=True,
            )
    else:
        st.markdown(
            '<div style="padding: 10px 14px; border-radius: 8px; background: rgba(99, 102, 241, 0.12); border: 1px solid rgba(99, 102, 241, 0.35); margin-bottom: 12px;">'
            '<span style="color: #818CF8; font-weight: 700; font-size: 0.88rem;">⚪ Simulated Mode Active</span><br>'
            '<span style="font-weight: 400; font-size: 0.78rem; color: #C7D2FE;">Fast deterministic responses querying SQLite3 <code>enterprise_data.db</code>.</span>'
            '</div>',
            unsafe_allow_html=True,
        )

    # 3. Observix Evaluation Metrics Selector
    st.markdown("### 🎯 Observix Evaluation Metrics")
    st.caption("Select active metrics from the official Observix evaluation suite. Weights are dynamically calculated on the fly by the Weight Decision Agent.")

    available_metric_keys = list(AVAILABLE_OBSERVIX_METRICS.keys())
    default_metric_keys = [k for k, v in AVAILABLE_OBSERVIX_METRICS.items() if v.get("default")]

    if "selected_metrics" not in st.session_state:
        st.session_state.selected_metrics = default_metric_keys

    selected_metrics = st.multiselect(
        "Active Evaluation Metrics:",
        options=available_metric_keys,
        default=st.session_state.selected_metrics,
        format_func=lambda k: f"{AVAILABLE_OBSERVIX_METRICS[k]['icon']} {AVAILABLE_OBSERVIX_METRICS[k]['name']}",
        help="Select which metrics to evaluate. If empty, runs with the default 4 core Observix metrics."
    )
    if not selected_metrics:
        selected_metrics = default_metric_keys
    st.session_state.selected_metrics = selected_metrics

    st.markdown(
        '<div style="padding: 8px 12px; border-radius: 8px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); margin-bottom: 12px; margin-top: 10px;">'
        '<span style="font-size: 0.78rem; color: #94A3B8;">🗄️ Database: <b>SQLite3 (enterprise_data.db)</b></span><br>'
        '<span style="font-size: 0.72rem; color: #64748B;">Core Tables: <code>product_list</code>, <code>sales_data</code>, <code>marketing_data</code>, <code>dev_data</code></span>'
        '</div>',
        unsafe_allow_html=True,
    )

    st.markdown("---")
    if st.button("🚪 Logout", use_container_width=True):
        st.session_state.logged_in = False
        st.session_state.user_email = ""
        st.session_state.messages = []
        st.rerun()

    if st.button("🗑️ Clear Chat History", use_container_width=True):
        st.session_state.messages = []
        st.rerun()


# ---------------------------------------------------------------------------
# Helper: Render Multi-Metric Evaluation & Evidence Inspector
# ---------------------------------------------------------------------------
def get_persona_eval(evaluations: dict, persona: str) -> dict:
    """Safely look up persona evaluation result handling case-insensitivity."""
    if not evaluations or not isinstance(evaluations, dict):
        return None
    if persona in evaluations and evaluations[persona]:
        return evaluations[persona]
    p_lower = str(persona).strip().lower()
    for k, v in evaluations.items():
        if str(k).strip().lower() == p_lower and v:
            return v
    for v in evaluations.values():
        if isinstance(v, dict) and "score" in v:
            return v
    return None


def render_assistant_details(message: dict):
    """Render supervisor decision, evidence table names, direct Observix trace links, and dynamic evaluation."""
    trace = message.get("trace", {})

    # Chit-chat Handling: Skip evaluation notice
    if message.get("is_chitchat"):
        st.markdown(
            """
            <div class="chitchat-banner">
                💬 <b>Conversational Query / Chit-Chat:</b> Automated evaluation is skipped because no database evidence retrieval is required for greetings and pleasantries.
            </div>
            """,
            unsafe_allow_html=True,
        )
        return

    # 1. Supervisor Dynamic Table Selection Reasoning
    plan_obj = trace.get("plan", {}) if isinstance(trace, dict) else {}
    reasoning = plan_obj.get("reasoning")
    llm_used = plan_obj.get("llm_used", False)
    if reasoning:
        badge = "🤖 Supervisor LLM Dynamic Table Selection" if llm_used else "⚙️ Table Selection Decision"
        st.markdown(
            f'<div style="padding: 8px 12px; border-radius: 8px; background: rgba(99, 102, 241, 0.12); border: 1px solid rgba(99, 102, 241, 0.3); margin-top: 10px; margin-bottom: 8px; font-size: 0.85rem;">'
            f'<b>{badge}:</b> {reasoning}'
            f'</div>',
            unsafe_allow_html=True,
        )

    # 2. Evidence Tables Consulted (Names only, directly below the answer)
    evidence_tables = message.get("evidence_tables") or (trace.get("evidence_tables", []) if isinstance(trace, dict) else [])
    table_names = [t.get("display_name") or t.get("table_name") for t in evidence_tables if t.get("table_name")]
    if table_names:
        table_tags = " ".join([f'<span class="table-tag">📁 {t_name}</span>' for t_name in table_names])
        st.markdown(
            f'<div style="margin-top: 6px; margin-bottom: 8px; font-size: 0.86rem; color: #94A3B8;">'
            f'<b>Evidence Tables Consulted:</b> {table_tags}'
            f'</div>',
            unsafe_allow_html=True,
        )

    # 3. Multi-Metric Automated Persona Evaluation
    if "evaluations" not in message or not isinstance(message["evaluations"], dict):
        message["evaluations"] = {}

    eval_persona = st.session_state.persona
    res = get_persona_eval(message["evaluations"], eval_persona)

    if not res:
        with st.spinner(f"Weight Decision Agent & Observix Evaluating for {eval_persona} persona..."):
            res = evaluate_chat_response(
                query=message.get("query", ""),
                output=message.get("content", ""),
                trace=trace,
                persona=eval_persona,
                organization=st.session_state.organization,
                backend_url=st.session_state.backend_url,
                execution_mode="realtime" if st.session_state.realtime_mode else "dummy",
                selected_metrics=st.session_state.get("selected_metrics"),
            )
            message["evaluations"][eval_persona] = res

    # 4. Observix Trace Links (Direct links instead of full trace tree)
    exec_trace_id = trace.get("trace_id", "") if isinstance(trace, dict) else ""
    eval_trace_id = res.get("eval_trace_id", "") if res else ""
    observix_ui = "http://localhost:8011"

    trace_links_html = []
    if exec_trace_id:
        trace_links_html.append(
            f'<a href="{observix_ui}/dashboard/traces?trace_id={exec_trace_id}" target="_blank" class="trace-link-btn">'
            f'⚡ Multi-Agent Execution Trace ({str(exec_trace_id)[:16]}...) ↗</a>'
        )
    if eval_trace_id:
        trace_links_html.append(
            f'<a href="{observix_ui}/dashboard/traces?trace_id={eval_trace_id}" target="_blank" class="trace-link-btn" style="background: rgba(99, 102, 241, 0.18); border-color: rgba(99, 102, 241, 0.45); color: #C7D2FE !important;">'
            f'⚖️ Automated Evaluation Trace ({str(eval_trace_id)[:16]}...) ↗</a>'
        )

    if trace_links_html:
        st.markdown(
            f'<div style="margin-top: 6px; margin-bottom: 12px; display: flex; gap: 10px; flex-wrap: wrap;">'
            + "".join(trace_links_html)
            + '</div>',
            unsafe_allow_html=True,
        )

    # If eval was skipped (e.g. detected as chit-chat)
    if res.get("status") == "skipped" or res.get("is_chitchat"):
        return

    score_val = res.get("score", 0.0)
    passed = res.get("passed", score_val >= 60.0)
    status_text = "PASSED" if passed else "NEEDS REVIEW"
    metrics = res.get("metrics") or {}
    formula_str = res.get("formula", "")
    thought_proc = res.get("thought_process") or {}

    with st.expander(f"⚖️ Automated Persona Evaluation ({eval_persona} Lens — {score_val} / 100 • {status_text})", expanded=True):
        # 1. Weight Decision Agent Card
        weight_decision = res.get("weight_decision") or {}
        agent_reasoning = weight_decision.get("agent_reasoning") or ""
        dynamic_weights = weight_decision.get("weights") or {}
        rationales = weight_decision.get("rationales") or {}

        st.markdown("##### 🤖 Dynamic Weight Decision Agent")
        
        weight_pills_html = []
        for m_key, w_val in dynamic_weights.items():
            m_meta = AVAILABLE_OBSERVIX_METRICS.get(m_key, {})
            m_icon = m_meta.get("icon", "📊")
            m_name = m_meta.get("name", m_key)
            r_text = rationales.get(m_key, "")
            weight_pills_html.append(
                f'<div style="margin-top:6px; font-size:0.83rem; color:#CBD5E1;">'
                f'{m_icon} <b>{m_name}:</b> <span class="weight-pill" style="font-size:0.78rem;">{int(w_val*100)}% Weight</span> — <i>{r_text}</i>'
                f'</div>'
            )

        st.markdown(
            f"""
            <div style="padding: 12px 16px; border-radius: 10px; background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); margin-bottom: 14px;">
                <div style="font-size: 0.85rem; font-weight: 700; color: #38BDF8; margin-bottom: 4px;">
                    🎯 ON-THE-FLY WEIGHT ALLOCATION ({eval_persona} Lens)
                </div>
                <div style="font-size: 0.86rem; color: #E2E8F0; margin-bottom: 8px;">
                    {agent_reasoning}
                </div>
                <div style="font-size: 0.8rem; color: #94A3B8; font-weight: 600;">Calibrated Metric Weights & Rationales:</div>
                {''.join(weight_pills_html)}
            </div>
            """,
            unsafe_allow_html=True,
        )

        # 2. Header Row: Overall Composite Score and Formula Banner
        h_col1, h_col2 = st.columns([1, 3])
        with h_col1:
            badge_class = "score-badge-pass" if passed else "score-badge-fail"
            st.markdown(f'<div class="{badge_class}">{score_val} / 100</div>', unsafe_allow_html=True)
            st.caption(f"Composite Evaluation: **{status_text}**")
            st.caption(f"Lens: **{eval_persona}** ({st.session_state.organization})")
        with h_col2:
            st.markdown(f"**📋 Executive Evaluation Summary ({eval_persona} Perspective):**")
            persona_sum_text = res.get("persona_summary") or res.get("reasoning", "")
            st.markdown(
                f'<div style="padding: 12px 16px; border-radius: 8px; background: rgba(99, 102, 241, 0.12); border-left: 4px solid #818CF8; margin-bottom: 8px; font-size: 0.9rem; color: #F1F5F9; line-height: 1.45;">'
                f'{persona_sum_text}'
                f'</div>',
                unsafe_allow_html=True,
            )
            if formula_str:
                st.markdown(
                    f'<div class="formula-banner">'
                    f'<b>📐 Weighted Formulation:</b><br>{formula_str}'
                    f'</div>',
                    unsafe_allow_html=True,
                )

        # 3. Dynamic Observix Metric Cards (Render in responsive columns of up to 4)
        st.markdown("##### 📊 Observix Evaluator Results:")
        metrics_list = list(metrics.values())
        if metrics_list:
            for i in range(0, len(metrics_list), 4):
                chunk = metrics_list[i : i + 4]
                cols = st.columns(len(chunk))
                for col, m_data in zip(cols, chunk):
                    s_val = m_data.get("score", 0.0)
                    w_val = m_data.get("weight", 0.25)
                    c_val = m_data.get("weighted_score", round(s_val * w_val, 1))
                    p_val = m_data.get("passed", s_val >= 60.0)
                    m_name = m_data.get("name", "Metric")
                    m_icon = m_data.get("icon", "📊")
                    m_thought = m_data.get("reasoning", "")
                    with col:
                        st.markdown(
                            f'<div class="metric-card">'
                            f'<div class="metric-header"><span>{m_icon} {m_name}</span><span class="weight-pill">Weight: {int(w_val*100)}%</span></div>'
                            f'<div class="metric-score-val {"metric-score-green" if p_val else "metric-score-red"}">{s_val} <span style="font-size:0.9rem; font-weight:500;">/ 100</span></div>'
                            f'<div class="contrib-pill">Contribution: <b>+{c_val} pts</b> &bull; Status: <b>{"PASS" if p_val else "FAIL"}</b></div>'
                            f'<div style="font-size:0.78rem; color:#94A3B8; margin-top:6px;">{m_thought}</div>'
                            f'</div>',
                            unsafe_allow_html=True,
                        )

        st.markdown("<br>", unsafe_allow_html=True)

        # 4. "How the LLM Reached the Score" - Chain of Thought and Scoring Decision
        st.markdown("##### 🧠 How the LLM Reached the Score (Evaluation Chain-of-Thought & Decision Process):")
        with st.container():
            st.markdown(
                f"""
                <div class="thought-step">
                    <div class="thought-step-title">🔍 Step 1: Input & Context Audit</div>
                    <div style="color: #CBD5E1;">{thought_proc.get("context_audit", "Analyzed user question intent, target persona criteria, and scope of evidence data.")}</div>
                </div>
                <div class="thought-step">
                    <div class="thought-step-title">📊 Step 2: Ground Truth Evidence Verification</div>
                    <div style="color: #CBD5E1;">{thought_proc.get("evidence_verification", "Cross-checked all response claims and metrics against SQLite3 database tables.")}</div>
                </div>
                <div class="thought-step">
                    <div class="thought-step-title">⚖️ Step 3: Rubric Judgment & Scoring Logic</div>
                    <div style="color: #CBD5E1;">{thought_proc.get("rubric_scoring", "Evaluated selected metrics against persona thresholds.")}</div>
                </div>
                <div class="thought-step">
                    <div class="thought-step-title">🧮 Step 4: Weighted Mathematical Aggregation & Verdict</div>
                    <div style="color: #CBD5E1;">{thought_proc.get("decision_summary", "Final composite score determined using dynamic weighted formula.")}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )

        # 5. Evidences: Supporting vs Contradicting
        evidences = res.get("evidences", {})
        if evidences.get("supporting") or evidences.get("contradicting"):
            e_c1, e_c2 = st.columns(2)
            with e_c1:
                if evidences.get("supporting"):
                    st.markdown("✅ **Supporting Evidence (Verified):**")
                    for item in evidences["supporting"]:
                        st.markdown(f"- {item}")
            with e_c2:
                if evidences.get("contradicting"):
                    st.markdown("⚠️ **Contradicting / Missing Evidence:**")
                    for item in evidences["contradicting"]:
                        st.markdown(f"- {item}")

        # 6. Feedback
        feedbacks = res.get("feedbacks", [])
        if feedbacks:
            st.markdown(f"💡 **Actionable Feedback for {eval_persona}:**")
            for fb in feedbacks:
                st.markdown(f"- {fb}")


def render_assistant_message(message: dict):
    """Render assistant answer, evidence tables, and multi-metric persona evaluation for history."""
    m_mode = message.get("mode", "dummy")
    provider_info = get_active_provider_info()
    tag_badge = (
        f'<span class="mode-badge-realtime" style="font-size:0.75rem;">⚡ Real-time {provider_info["provider_name"]}</span>'
        if m_mode == "realtime"
        else '<span class="mode-badge-dummy" style="font-size:0.75rem;">⚪ Simulated Response (SQLite3)</span>'
    )
    st.markdown(f'<div style="margin-bottom: 6px;">{tag_badge}</div>', unsafe_allow_html=True)
    st.markdown(message.get("content", ""))
    render_assistant_details(message)


# ---------------------------------------------------------------------------
# View 2: Main Active Chat Session
# ---------------------------------------------------------------------------

# Header Banner
col_h1, col_h2 = st.columns([2, 2])
with col_h1:
    st.markdown('<div class="main-header">Enterprise Multi-Agent Chat</div>', unsafe_allow_html=True)
    st.caption(
        f"User: **{st.session_state.user_email}** | Persona: **{st.session_state.persona}** | "
        f"Organization: **{st.session_state.organization}**"
    )
with col_h2:
    provider_info = get_active_provider_info()
    mode_badge_html = (
        f'<span class="mode-badge-realtime">⚡ Live {provider_info["provider_name"]}</span>'
        if st.session_state.realtime_mode
        else '<span class="mode-badge-dummy">⚪ Simulated Mode</span>'
    )
    st.markdown(
        f'<div style="text-align: right; margin-top: 10px;">'
        f'{mode_badge_html} &nbsp; '
        f'<span class="persona-badge">{active_p_info["icon"]} Persona: {st.session_state.persona}</span></div>',
        unsafe_allow_html=True,
    )

st.markdown("---")

# Empty state welcome card and prompt suggestions
if not st.session_state.messages:
    st.markdown(
        f'<div class="persona-card">'
        f'<h4>{active_p_info["icon"]} Welcome, {st.session_state.persona} Perspective!</h4>'
        f'<p style="color: #94A3B8; margin-bottom: 0.8rem;">{active_p_info["description"]}</p>'
        f'<div style="font-size: 0.85rem; color: #818CF8;">🎯 <b>Your Persona Evaluation Standard:</b> {active_p_info["example"]}</div>'
        f'</div>',
        unsafe_allow_html=True,
    )
    st.markdown("##### 💡 Try asking a question (Answers differ by persona):")
    sample_col1, sample_col2, sample_col3, sample_col4 = st.columns(4)
    with sample_col1:
        if st.button("🧘 Apparel Margins", use_container_width=True, help="Margin performance across Align, Scuba, ABC Pant, and Belt Bag"):
            st.session_state.input_prompt = "What is our margin performance across products (Align, Scuba, ABC Pant)?"
            st.rerun()
    with sample_col2:
        if st.button("💼 Sales & Profit", use_container_width=True, help="Total sales units, quarter-wise sales, profit, and traffic by product"):
            st.session_state.input_prompt = "What are our total sales, quarter-wise sales, and profit by product?"
            st.rerun()
    with sample_col3:
        if st.button("📢 Marketing CTR & Views", use_container_width=True, help="Click-through rates, ad budgets, video views, and likes"):
            st.session_state.input_prompt = "Which products had the highest click-through rate, views, and likes?"
            st.rerun()
    with sample_col4:
        if st.button("🖥️ Dev Latency & Most Viewed", use_container_width=True, help="Platform latency, cache hit ratio, LLM token costs, and most viewed products"):
            st.session_state.input_prompt = "What is our platform latency, cache hit ratio, LLM token cost, and most viewed products?"
            st.rerun()

# Render message history
for msg_idx, message in enumerate(st.session_state.messages):
    with st.chat_message(message["role"]):
        if message["role"] == "user":
            st.markdown(message["content"])
        else:
            render_assistant_message(message)

# ---------------------------------------------------------------------------
# Chat Input & Multi-Agent Execution with Streaming & Multi-Metric Evaluation
# ---------------------------------------------------------------------------
user_prompt = st.chat_input("Ask a question (e.g., 'What are our most viewed products and their sales profit?')...")
if "input_prompt" in st.session_state and st.session_state.input_prompt:
    user_prompt = st.session_state.input_prompt
    st.session_state.input_prompt = ""

if user_prompt:
    # 1. Append and display user message
    st.session_state.messages.append({"role": "user", "content": user_prompt})
    with st.chat_message("user"):
        st.markdown(user_prompt)

    # 2. Assistant response with live streaming
    with st.chat_message("assistant"):
        exec_mode = "realtime" if st.session_state.realtime_mode else "dummy"
        active_llm = get_active_provider_info()
        is_chitchat = is_chitchat_query(user_prompt)

        status_label = (
            f"🚀 Executing Multi-Agent Workflow (⚡ {active_llm['provider_name']})..."
            if st.session_state.realtime_mode and active_llm["configured"]
            else "🚀 Executing Multi-Agent Workflow (⚪ Simulated SQLite3 Mode)..."
        )
        status_box = st.status(status_label, expanded=True)

        q_lower = user_prompt.lower()
        is_margin = any(k in q_lower for k in ["margin", "margins", "profitability", "gross margin", "ebitda", "cogs"])
        is_drivers = any(k in q_lower for k in ["driver", "drivers", "causing", "causes", "why sales", "why revenue", "growth driver"])

        with status_box:
            if is_chitchat:
                st.write("🧠 **Step 1 (SupervisorAgent):** Identified conversational greeting. Database retrieval bypassed.")
                st.write("🔬 **Step 2 (AnalyticsAgent):** No quantitative data required for chit-chat greeting.")
                st.write(f"📝 **Step 3 (ReporterAgent):** Preparing greeting tailored for {st.session_state.persona} perspective...")
            else:
                st.write("🧠 **Step 1 (SupervisorAgent):** Selecting required database tables for question and persona...")
                st.write("🔬 **Step 2 (AnalyticsAgent):** Querying SQLite3 `enterprise_data.db` (`product_list`, `sales_data`, `marketing_data`, `dev_data`)...")
                st.write(f"📝 **Step 3 (ReporterAgent):** Synthesizing analytical report tailored to {st.session_state.persona} perspective...")

            # Run LangGraph workflow to obtain plan, analytical data, evidence tables, trace, and verified report
            workflow_res = run_multi_agent_workflow(
                query=user_prompt,
                persona=st.session_state.persona,
                organization=st.session_state.organization,
                execution_mode=exec_mode,
                user_email=st.session_state.user_email,
            )

            status_box.update(
                label="✅ Multi-Agent Planning & Database Retrieval Complete!",
                state="complete",
                expanded=False,
            )

        analytical_data = workflow_res.get("analytical_data", {})
        evidence_tables = workflow_res.get("evidence_tables", [])
        trace = workflow_res.get("trace", {})
        plan = workflow_res.get("plan", {})
        intent = plan.get("intent", "enterprise_performance_analysis")

        # Header tag showing generation mode
        tag_badge = (
            f'<span class="mode-badge-realtime" style="font-size:0.75rem;">⚡ Real-time {active_llm["provider_name"]}</span>'
            if workflow_res.get("mode") == "realtime" and active_llm["configured"]
            else '<span class="mode-badge-dummy" style="font-size:0.75rem;">⚪ Simulated Response (SQLite3)</span>'
        )
        st.markdown(f'<div style="margin-bottom: 6px;">{tag_badge}</div>', unsafe_allow_html=True)

        # 3. Stream Response onto the Screen in Real-Time!
        report_text = workflow_res.get("output")
        if not report_text:
            if is_chitchat:
                report_text = get_chitchat_report(user_prompt, st.session_state.persona, st.session_state.organization)
            else:
                report_text = get_deterministic_report(user_prompt, st.session_state.persona, st.session_state.organization, intent)

        final_answer = st.write_stream(text_stream_generator(report_text, chunk_size=3, delay=0.01))

        # 4. Evaluation Execution: Live Streaming Step-by-Step in Single Trace!
        eval_result = None
        if not is_chitchat:
            eval_status = st.status(f"⚖️ Streaming Evaluation ({st.session_state.persona} Lens)...", expanded=True)
            with eval_status:
                weight_summary_slot = st.empty()
                metric_status_slot = st.empty()
                metric_rows_slot = st.empty()
                streamed_metric_lines = []

                for ev in evaluate_chat_response_stream(
                    query=user_prompt,
                    output=final_answer or report_text,
                    trace=trace,
                    persona=st.session_state.persona,
                    organization=st.session_state.organization,
                    backend_url=st.session_state.backend_url,
                    execution_mode=exec_mode,
                    selected_metrics=st.session_state.get("selected_metrics"),
                ):
                    ev_type = ev.get("event")
                    if ev_type == "weight_start":
                        weight_summary_slot.info(ev.get("message", "🤖 Weight Decision Agent analyzing query intent..."))
                    elif ev_type == "weights_decided":
                        w_map = ev.get("weights", {})
                        a_reason = ev.get("agent_reasoning", "")
                        weight_pills = [f"**{AVAILABLE_OBSERVIX_METRICS.get(k, {}).get('name', k)}**: `{int(v*100)}%`" for k, v in w_map.items()]
                        weight_summary_slot.markdown(
                            f"🤖 **Dynamic Weight Decision Agent:** {a_reason}\n\n"
                            f"🎯 **Allocated Weights:** " + " • ".join(weight_pills)
                        )
                    elif ev_type == "metric_start":
                        m_icon = ev.get("icon", "📊")
                        m_name = ev.get("name")
                        metric_status_slot.markdown(f"🔬 *Evaluating {m_icon} **{m_name}** in Observix...*")
                    elif ev_type == "metric_completed":
                        m_icon = ev.get("icon", "📊")
                        m_name = ev.get("name")
                        m_score = ev.get("score")
                        m_pass = ev.get("passed", True)
                        badge = "✅ PASS" if m_pass else "⚠️ NEEDS REVIEW"
                        streamed_metric_lines.append(f"{m_icon} **{m_name}:** `{m_score}/100` ({badge}) — *{ev.get('reasoning', '')[:90]}*")
                        metric_rows_slot.markdown("\n\n".join(streamed_metric_lines))
                    elif ev_type == "persona_summary_start":
                        metric_status_slot.markdown(f"🤖 *{ev.get('message', 'Synthesizing Executive Evaluation Summary...')}*")
                    elif ev_type == "persona_summary_done":
                        metric_status_slot.empty()
                    elif ev_type == "complete":
                        eval_result = ev.get("result")

                metric_status_slot.empty()
                if eval_result:
                    score_val = eval_result.get("score", 0.0)
                    pass_label = "PASSED" if eval_result.get("passed", True) else "NEEDS REVIEW"
                    eval_status.update(
                        label=f"✅ Evaluation Complete ({score_val}/100 • {pass_label})",
                        state="complete",
                        expanded=False,
                    )

        # 5. Build message object and append to session state
        msg_obj = {
            "role": "assistant",
            "content": final_answer or report_text,
            "query": user_prompt,
            "trace": trace,
            "evidence_tables": evidence_tables,
            "is_chitchat": is_chitchat,
            "mode": workflow_res.get("mode", "dummy"),
            "model": workflow_res.get("model", active_llm.get("model_name")),
            "evaluations": {st.session_state.persona: eval_result} if eval_result else {},
        }
        st.session_state.messages.append(msg_obj)

        # 6. Render Evidence Tables and Evaluation directly right now (No st.rerun needed!)
        render_assistant_details(msg_obj)
