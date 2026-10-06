"""
Streamlit Multi-Agent Chat Application with Persona-Tailored Evaluations.
Built with LangGraph (SupervisorAgent, AnalyticsAgent, ReporterAgent).
Supports authentication via dynamic user JSON (email_id: persona mapping), automated per-persona evaluations,
and toggling between Dummy Responses/Evaluations and Real-time Groq LLM Calls.
"""
import os
import sys
import json
import time
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
)
from agents.langgraph_multi_agent.llm_config import (
    get_active_provider_info,
)
from agents.langgraph_multi_agent.eval_client import (
    get_available_personas,
    evaluate_chat_response,
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
        "title": "Sales",
        "icon": "💼",
        "description": "Commercial viability, quarterly revenue, quota attainment, pipeline velocity, client-ready clarity.",
        "example": "Highlights $4.85M revenue, 107.8% quota, $8.2M pipeline, and deal momentum.",
    },
    "marketing": {
        "title": "Marketing",
        "icon": "📢",
        "description": "Audience engagement, campaign performance, lead acquisition channels, brand reach, CAC/ROAS.",
        "example": "Evaluates MQL/SQL counts, channel attribution, and demand generation ROI.",
    },
    "it": {
        "title": "IT",
        "icon": "🖥️",
        "description": "System architecture, infrastructure reliability, database performance, latency (p50/p95), error rates, API contracts.",
        "example": "Demands p50/p95 latency metrics, database partitions, and query reproducibility.",
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
# Custom CSS for Premium Design
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
    st.session_state.organization = "Acme Global"

if "messages" not in st.session_state:
    st.session_state.messages = []

if "backend_url" not in st.session_state:
    st.session_state.backend_url = "http://localhost:8010"

if "realtime_mode" not in st.session_state:
    st.session_state.realtime_mode = True  # Real-time LLM calls active when provider configured in .env

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
    # Login View Left Sidebar
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

    st.markdown('<div class="main-header">🔐 Enterprise AI Assistant Login</div>', unsafe_allow_html=True)
    st.write("Sign in with your corporate email to access your persona-tailored workspace.")

    col_l1, col_l2 = st.columns([1.2, 1], gap="large")

    with col_l1:
        st.markdown('<div class="persona-card">', unsafe_allow_html=True)
        st.markdown("### Sign In")
        with st.form("login_form"):
            email_input = st.text_input(
                "Corporate Email ID",
                placeholder="e.g. sales@company.com",
                key="input_email",
            )
            pwd_input = st.text_input(
                "Password",
                type="password",
                placeholder="Enter any password (demo mode)",
                key="input_password",
            )
            st.caption("ℹ️ *Password can be anything for demo purposes.*")

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
                    st.session_state.organization = "Acme Global"
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
        st.caption("Click any account below to log in instantly:")

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
                st.session_state.organization = "Acme Global"
                st.rerun()

    st.stop()


# ---------------------------------------------------------------------------
# Sidebar (Left Bar): Logged-in User, Persona, and Execution Mode Only
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

    st.markdown(
        '<div style="padding: 8px 12px; border-radius: 8px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); margin-bottom: 12px;">'
        '<span style="font-size: 0.78rem; color: #94A3B8;">🗄️ Database: <b>SQLite3 (enterprise_data.db)</b></span><br>'
        '<span style="font-size: 0.72rem; color: #64748B;">Tables: <code>domain_margins</code>, <code>revenue_drivers</code></span>'
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
        if st.button("📊 Margin Performance", use_container_width=True, help="Different domain lens on gross margins & cost controls"):
            st.session_state.input_prompt = "What is our margin performance across domains?"
            st.rerun()
    with sample_col2:
        if st.button("🚀 Revenue Drivers", use_container_width=True, help="Different domain drivers causing sales and growth"):
            st.session_state.input_prompt = "What are the key drivers causing our sales and revenue growth?"
            st.rerun()
    with sample_col3:
        if st.button("⚡ Operational Health", use_container_width=True, help="Operational efficiency metrics tailored to this persona"):
            st.session_state.input_prompt = "How are our operational efficiency and core performance metrics looking?"
            st.rerun()
    with sample_col4:
        if st.button("👋 Say Hi", use_container_width=True, help="Conversational greeting without unprompted commercial data"):
            st.session_state.input_prompt = "Hi"
            st.rerun()

# Render message history
for msg_idx, message in enumerate(st.session_state.messages):
    with st.chat_message(message["role"]):
        # Header tag showing generation mode
        if message["role"] == "assistant":
            m_mode = message.get("mode", "dummy")
            provider_info = get_active_provider_info()
            tag_badge = (
                f'<span class="mode-badge-realtime" style="font-size:0.75rem;">⚡ Real-time {provider_info["provider_name"]}</span>'
                if m_mode == "realtime"
                else '<span class="mode-badge-dummy" style="font-size:0.75rem;">⚪ Simulated Response</span>'
            )
            st.markdown(f'<div style="margin-bottom: 6px;">{tag_badge}</div>', unsafe_allow_html=True)

        st.markdown(message["content"])

        # If assistant message, render Trace Inspector and Default Automated Evaluation
        if message["role"] == "assistant" and "trace" in message:
            trace = message["trace"]
            obs = trace.get("observations", [])

            # 1. Trace Inspection Accordion
            with st.expander("🔍 Inspect Multi-Agent Execution Trace (Agents, Tools, LLMs)"):
                t_col1, t_col2, t_col3, t_col4 = st.columns(4)
                agents_count = sum(1 for o in obs if o.get("type") == "agent")
                tools_count = sum(1 for o in obs if o.get("type") == "tool")
                llm_count = sum(1 for o in obs if o.get("type") == "llm")

                t_col1.metric("Agents Executed", agents_count)
                t_col2.metric("Tools Invoked", tools_count)
                t_col3.metric("LLM Inferences", llm_count)
                t_col4.metric("Trace ID", trace.get("trace_id", "")[:12] + "...")

                st.markdown("##### Detailed Execution Observations:")
                for item in obs:
                    obs_type = item.get("type", "unknown")
                    icon = "🧠" if obs_type == "agent" else ("🛠️" if obs_type == "tool" else "⚡")
                    name = item.get("name", "")
                    status = item.get("status", "success")

                    with st.container():
                        st.markdown(
                            f'<div class="step-card">'
                            f'<b>{icon} [{obs_type.upper()}] {name}</b> &nbsp;|&nbsp; Status: <code>{status}</code>'
                            f'</div>',
                            unsafe_allow_html=True,
                        )
                        sub_c1, sub_c2 = st.columns(2)
                        with sub_c1:
                            st.caption("**Input:**")
                            st.json(item.get("input"), expanded=False)
                        with sub_c2:
                            st.caption("**Output:**")
                            st.json(item.get("output"), expanded=False)

            # 2. Automated Evaluation Section (Strictly evaluates user persona lens only)
            if "evaluations" not in message:
                message["evaluations"] = {}

            user_persona = st.session_state.persona
            eval_persona = user_persona

            if eval_persona not in message["evaluations"]:
                with st.spinner(f"Evaluating response for {eval_persona} persona..."):
                    eval_res = evaluate_chat_response(
                        query=message.get("query", ""),
                        output=message["content"],
                        trace=trace,
                        persona=eval_persona,
                        organization=st.session_state.organization,
                        backend_url=st.session_state.backend_url,
                        execution_mode="realtime" if st.session_state.realtime_mode else "dummy",
                    )
                    message["evaluations"][eval_persona] = eval_res

            res = message["evaluations"][eval_persona]
            score_val = res.get("score", 0.0)
            passed = res.get("passed", score_val >= 60.0)
            status_text = "PASSED" if passed else "NEEDS REVIEW"
            provider_info = get_active_provider_info()

            with st.expander(f"⚖️ Automated Persona Evaluation ({user_persona} Lens — {score_val} / 100 • {status_text})", expanded=False):
                eval_mode_desc = (
                    f"⚡ Live {provider_info['provider_name']} Evaluation"
                    if res.get("mode") in ("realtime_llm", "realtime_backend_api")
                    else "⚪ Simulated Persona Evaluation"
                )

                st.markdown(f"##### ⚖️ Evaluation Analysis *({user_persona} Perspective — {eval_mode_desc})*")

                c_score, c_meta = st.columns([1, 3])
                res_mode = res.get("mode", "dummy")

                with c_score:
                    badge_class = "score-badge-pass" if passed else "score-badge-fail"
                    st.markdown(f'<div class="{badge_class}">{score_val} / 100</div>', unsafe_allow_html=True)
                    st.caption(f"Status: **{status_text}**")
                    st.caption(f"Evaluator Lens: **{user_persona}** (User Persona)")
                    if res_mode in ("realtime_llm", "realtime_backend_api"):
                        st.markdown(f'<span class="mode-badge-realtime">⚡ Live {provider_info["provider_name"]}</span>', unsafe_allow_html=True)
                    else:
                        st.markdown('<span class="mode-badge-dummy">⚪ Simulated Evaluation</span>', unsafe_allow_html=True)

                with c_meta:
                    st.markdown(f"**Reasoning ({user_persona} Lens):**")
                    st.write(res.get("reasoning", ""))

                evidences = res.get("evidences", {})
                if evidences.get("supporting") or evidences.get("contradicting"):
                    e_c1, e_c2 = st.columns(2)
                    with e_c1:
                        if evidences.get("supporting"):
                            st.markdown("✅ **Supporting Evidence:**")
                            for item in evidences["supporting"]:
                                st.markdown(f"- {item}")
                    with e_c2:
                        if evidences.get("contradicting"):
                            st.markdown("⚠️ **Contradicting / Missing Evidence:**")
                            for item in evidences["contradicting"]:
                                st.markdown(f"- {item}")

                feedbacks = res.get("feedbacks", [])
                if feedbacks:
                    st.markdown(f"💡 **Actionable Feedback for {eval_persona}:**")
                    for fb in feedbacks:
                        st.markdown(f"- {fb}")

            # 3. Observability App Trace Link (Direct Link to Traces in Observix)
            trace_id = trace.get("trace_id", "")
            trace_url = trace.get("trace_url") or f"http://localhost:8011/dashboard/traces?trace_id={trace_id}"
            trace_tree_url = trace.get("trace_tree_url") or f"http://localhost:8011/dashboard/traces/{trace_id}"

            st.markdown(
                f"""
                <div style="margin-top: 14px; padding: 12px 16px; border-radius: 10px; background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.25); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <span style="font-weight: 700; color: #818CF8; font-size: 0.95rem;">📊 Observability Trace Captured</span><br>
                        <span style="font-size: 0.8rem; color: #94A3B8;">Trace ID: <code>{trace_id}</code> &bull; Ingested into Observix ClickHouse</span>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <a href="{trace_url}" target="_blank" style="text-decoration: none; padding: 7px 14px; border-radius: 8px; background: #6366F1; color: white; font-weight: 600; font-size: 0.83rem; display: inline-flex; align-items: center; gap: 6px;">
                            🔗 View Trace in Observability App ↗
                        </a>
                        <a href="{trace_tree_url}" target="_blank" style="text-decoration: none; padding: 7px 14px; border-radius: 8px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #E2E8F0; font-weight: 600; font-size: 0.83rem; display: inline-flex; align-items: center; gap: 6px;">
                            🌳 Full Trace Tree ↗
                        </a>
                    </div>
                </div>
                """,
                unsafe_allow_html=True,
            )

# ---------------------------------------------------------------------------
# Chat Input & Multi-Agent Execution with Default Persona Evaluation
# ---------------------------------------------------------------------------
user_prompt = st.chat_input("Ask a question (e.g., 'What is the sales this quarter?')...")
if "input_prompt" in st.session_state and st.session_state.input_prompt:
    user_prompt = st.session_state.input_prompt
    st.session_state.input_prompt = ""

if user_prompt:
    # Append user message
    st.session_state.messages.append({"role": "user", "content": user_prompt})
    with st.chat_message("user"):
        st.markdown(user_prompt)

    # Multi-agent execution container
    with st.chat_message("assistant"):
        exec_mode = "realtime" if st.session_state.realtime_mode else "dummy"
        active_llm = get_active_provider_info()
        status_label = (
            f"🚀 Executing Multi-Agent Workflow & Persona Evaluation (⚡ {active_llm['provider_name']})..."
            if st.session_state.realtime_mode and active_llm["configured"]
            else "🚀 Executing Multi-Agent Workflow & Persona Evaluation (⚪ Simulated Mode)..."
        )
        status_box = st.status(status_label, expanded=True)

        is_chitchat = is_chitchat_query(user_prompt)
        q_lower = user_prompt.lower()
        is_margin = any(k in q_lower for k in ["margin", "margins", "profitability", "gross margin", "ebitda", "cogs"])
        is_drivers = any(k in q_lower for k in ["driver", "drivers", "causing", "causes", "why sales", "why revenue", "growth driver"])

        with status_box:
            if is_chitchat:
                st.write("🧠 **Step 1 (SupervisorAgent):** Identified conversational greeting. Database retrieval bypassed.")
                time.sleep(0.12)
                st.write("🔬 **Step 2 (AnalyticsAgent):** No database data required for greeting.")
                time.sleep(0.12)
                st.write(f"📝 **Step 3 (ReporterAgent):** Composing friendly greeting tailored to {st.session_state.persona} perspective...")
            elif is_margin:
                st.write("🧠 **Step 1 (SupervisorAgent):** Deciding data required based on question -> SQLite3 `domain_margins` table...")
                time.sleep(0.15)
                st.write("🔬 **Step 2 (AnalyticsAgent):** Pulling margin records from SQLite3 `enterprise_data.db` across domain perspectives...")
                time.sleep(0.15)
                st.write(f"📝 **Step 3 (ReporterAgent):** Generating answer using pulled margin data tailored to {st.session_state.persona} lens...")
            elif is_drivers:
                st.write("🧠 **Step 1 (SupervisorAgent):** Deciding data required based on question -> SQLite3 `revenue_drivers` table...")
                time.sleep(0.15)
                st.write("🔬 **Step 2 (AnalyticsAgent):** Pulling revenue driver attribution from SQLite3 `enterprise_data.db`...")
                time.sleep(0.15)
                st.write(f"📝 **Step 3 (ReporterAgent):** Generating answer using pulled driver data tailored to {st.session_state.persona} lens...")
            else:
                st.write("🧠 **Step 1 (SupervisorAgent):** Deciding which data is required to answer the question...")
                time.sleep(0.15)
                st.write("🔬 **Step 2 (AnalyticsAgent):** Pulling required records from SQLite3 `enterprise_data.db`...")
                time.sleep(0.15)
                st.write(f"📝 **Step 3 (ReporterAgent):** Generating answer using pulled database data tailored to {st.session_state.persona}...")

            # Run LangGraph workflow with mode configuration
            result = run_multi_agent_workflow(
                query=user_prompt,
                persona=st.session_state.persona,
                organization=st.session_state.organization,
                execution_mode=exec_mode,
                user_email=st.session_state.user_email,
            )

            if result.get("error"):
                st.warning(
                    f"⚠️ Live LLM notice: {result['error']}. "
                    "A fallback simulated response was generated from the SQLite3 database."
                )

            st.write(f"⚖️ **Automated Evaluator:** Running default evaluation for {st.session_state.persona} persona...")
            eval_result = evaluate_chat_response(
                query=user_prompt,
                output=result["output"],
                trace=result["trace"],
                persona=st.session_state.persona,
                organization=st.session_state.organization,
                backend_url=st.session_state.backend_url,
                execution_mode=exec_mode,
            )

            status_box.update(
                label=f"✅ Multi-Agent Workflow & {st.session_state.persona} Evaluation Complete!",
                state="complete",
                expanded=False,
            )

        final_answer = result["output"]
        trace = result["trace"]

        tag_badge = (
            f'<span class="mode-badge-realtime" style="font-size:0.75rem;">⚡ {active_llm["provider_name"]} ({result.get("model", "live")})</span>'
            if result.get("mode") == "realtime" and active_llm["configured"]
            else '<span class="mode-badge-dummy" style="font-size:0.75rem;">⚪ Simulated Response (SQLite3)</span>'
        )
        st.markdown(f'<div style="margin-bottom: 6px;">{tag_badge}</div>', unsafe_allow_html=True)
        st.markdown(final_answer)

        # Store in session messages with evaluation pre-populated for user's persona
        st.session_state.messages.append({
            "role": "assistant",
            "content": final_answer,
            "query": user_prompt,
            "trace": trace,
            "mode": result.get("mode", "dummy"),
            "model": result.get("model", active_llm.get("model_name")),
            "evaluations": {st.session_state.persona: eval_result},
        })
        st.rerun()
