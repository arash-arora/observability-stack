"""
Streamlit Multi-Agent Chat Application with Persona-Tailored Evaluations.
Built with LangGraph (3 Agents: SupervisorAgent, AnalyticsAgent, ReporterAgent).
Supports toggling between Dummy Responses & Evaluations and Real-time Groq LLM Calls.
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

from agents.langgraph_multi_agent.graph import run_multi_agent_workflow
from agents.langgraph_multi_agent.eval_client import (
    get_available_personas,
    evaluate_chat_response,
    DEFAULT_PERSONAS,
)

DEFAULT_GROQ_MODEL = "groq/llama-3.3-70b-versatile"

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
        padding: 1.2rem;
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
# Session State Initialization
# ---------------------------------------------------------------------------
if "session_started" not in st.session_state:
    st.session_state.session_started = False

if "persona" not in st.session_state:
    st.session_state.persona = "Sales"

if "organization" not in st.session_state:
    st.session_state.organization = "Acme Global"

if "messages" not in st.session_state:
    st.session_state.messages = []

if "backend_url" not in st.session_state:
    st.session_state.backend_url = "http://localhost:8000"

if "realtime_mode" not in st.session_state:
    st.session_state.realtime_mode = False  # Default to Dummy Mode

st.session_state.llm_model = DEFAULT_GROQ_MODEL
st.session_state.llm_api_key = os.getenv("GROQ_API_KEY", "")

available_personas = get_available_personas(st.session_state.backend_url)

PERSONA_META = {
    "Sales": {
        "icon": "💼",
        "description": "Commercial viability, quarterly revenue, quota attainment, pipeline velocity, client-ready clarity.",
        "example": "Highlights $4.85M revenue, 107.8% quota, $8.2M pipeline, and deal momentum.",
    },
    "Developer": {
        "icon": "💻",
        "description": "Technical precision, database schemas, query latency (p50/p95), error rates, API contracts.",
        "example": "Demands p50/p95 latency metrics, database partitions, and query reproducibility.",
    },
    "Marketing": {
        "icon": "📢",
        "description": "Audience engagement, campaign performance, lead acquisition channels, brand reach, CAC/ROAS.",
        "example": "Evaluates MQL/SQL counts, channel attribution, and demand generation ROI.",
    },
    "Product team": {
        "icon": "🚀",
        "description": "User experience (UX), product adoption, DAU/MAU engagement, retention, roadmap prioritization.",
        "example": "Focuses on 88.2% 30d retention, feature health, and user dropoff points.",
    },
    "Default": {
        "icon": "⚖️",
        "description": "Standard objective evaluation assessing factual accuracy, completeness, and overall answer clarity.",
        "example": "Evaluates general truthfulness, directness, and factual balance.",
    },
}

# ---------------------------------------------------------------------------
# Sidebar (Left Bar): Mode Switcher & Configuration (Always Available)
# ---------------------------------------------------------------------------
with st.sidebar:
    st.markdown('<div class="main-header" style="font-size: 1.5rem;">🤖 LangGraph Agent</div>', unsafe_allow_html=True)
    st.markdown(
        f'<div class="persona-badge">Perspective: {st.session_state.persona}</div> '
        f'<span style="font-size:0.85rem; color:#94A3B8;">({st.session_state.organization})</span>',
        unsafe_allow_html=True,
    )

    st.markdown("---")
    st.markdown("### 🎛️ Execution Mode")
    mode_toggle = st.toggle(
        "⚡ Real-time LLM Calls",
        value=st.session_state.realtime_mode,
        key="mode_toggle_switch",
        help="Switch between Dummy responses & evaluations (no API key needed) and live Real-time Groq LLM calls.",
    )
    st.session_state.realtime_mode = mode_toggle

    if mode_toggle:
        env_key = os.getenv("GROQ_API_KEY", "")
        st.markdown(
            f'<div style="padding: 10px 14px; border-radius: 8px; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); margin-bottom: 10px;">'
            f'<span style="color: #34D399; font-weight: 700; font-size: 0.9rem;">🟢 Real-time Groq LLM Active</span><br>'
            f'<span style="font-weight: 400; font-size: 0.78rem; color: #A7F3D0;">Engine: <b>Groq (llama-3.3-70b-versatile)</b></span>'
            f'</div>',
            unsafe_allow_html=True,
        )
        st.session_state.llm_api_key = st.text_input(
            "Groq API Key (from .env):",
            value=st.session_state.get("llm_api_key") or env_key,
            type="password",
            help="Default loaded from .env (GROQ_API_KEY). You can update it here if your key is invalid or changed.",
            key="groq_key_input",
        )
    else:
        st.markdown(
            '<div style="padding: 10px 14px; border-radius: 8px; background: rgba(99, 102, 241, 0.12); border: 1px solid rgba(99, 102, 241, 0.35); margin-bottom: 12px;">'
            '<span style="color: #818CF8; font-weight: 700; font-size: 0.9rem;">⚪ Dummy Mode Active</span><br>'
            '<span style="font-weight: 400; font-size: 0.78rem; color: #C7D2FE;">Fast deterministic responses & mock evaluations without API consumption.</span>'
            '</div>',
            unsafe_allow_html=True,
        )

    st.markdown("---")
    if st.session_state.session_started:
        if st.button("🔄 Change Persona / New Session", use_container_width=True):
            st.session_state.session_started = False
            st.session_state.messages = []
            st.rerun()

    st.markdown("### 🧩 Multi-Agent Architecture")
    st.markdown(
        """
        - 🧠 **SupervisorAgent**
          *Decomposes query & orchestrates plan*
        - 🔬 **AnalyticsAgent**
          *Executes Sales, Telemetry & Marketing tools*
        - 📝 **ReporterAgent**
          *Synthesizes findings into verified report*
        """
    )

    if st.session_state.session_started:
        st.markdown("---")
        st.markdown("### 💡 Quick Test Prompts")
        quick_prompts = [
            "What is the sales this quarter?",
            "Show me API latency and query performance metrics.",
            "What are our top customer acquisition channels and CAC?",
            "What is our DAU/MAU and feature adoption rate?",
        ]
        for qp in quick_prompts:
            if st.button(qp, use_container_width=True, key=f"quick_{qp}"):
                st.session_state.input_prompt = qp

        st.markdown("---")
        st.session_state.backend_url = st.text_input("Backend API URL", value=st.session_state.backend_url)
        if st.button("🗑️ Clear Chat History", use_container_width=True):
            st.session_state.messages = []
            st.rerun()


# ---------------------------------------------------------------------------
# View 1: Before Session Start (Persona Selection Screen)
# ---------------------------------------------------------------------------
if not st.session_state.session_started:
    st.markdown('<div class="main-header">🤖 Enterprise Multi-Agent System</div>', unsafe_allow_html=True)
    st.markdown("### Step 1: Select Session Persona & Organization")
    st.write(
        "Before beginning your chat session, select the target **Persona** and **Organization**. "
        "The multi-agent workflow and downstream evaluations will be tailored to this perspective."
    )

    mode_notice = (
        "🟢 **Mode:** Real-time Groq LLM active (`groq/llama-3.3-70b-versatile`)"
        if st.session_state.realtime_mode
        else "⚪ **Mode:** Dummy responses & evaluations (Fast / Zero API cost)"
    )
    st.caption(f"Current execution setting: {mode_notice}. You can switch this anytime using the toggle in the left bar.")

    col1, col2 = st.columns([2, 1])

    with col1:
        st.markdown("#### Choose Persona:")
        chosen_persona = st.radio(
            "Select Persona for this session:",
            options=available_personas,
            index=available_personas.index("Sales") if "Sales" in available_personas else 0,
            format_func=lambda p: f"{PERSONA_META.get(p, {}).get('icon', '👤')} {p} — {PERSONA_META.get(p, {}).get('description', '')}",
        )

        org_input = st.text_input(
            "Organization Name:",
            value=st.session_state.organization,
            help="The organization context passed to agents and evaluation metric prompts.",
        )

        if st.button("🚀 Start Session with Selected Persona", type="primary", use_container_width=True):
            st.session_state.persona = chosen_persona
            st.session_state.organization = org_input.strip() or "Acme Global"
            st.session_state.session_started = True
            st.rerun()

    with col2:
        st.markdown("#### Selected Persona Perspective:")
        info = PERSONA_META.get(chosen_persona, PERSONA_META["Default"])
        st.info(
            f"**{info['icon']} {chosen_persona} Perspective**\n\n"
            f"**Focus Areas:**\n{info['description']}\n\n"
            f"**Evaluation Standard:**\n{info['example']}"
        )
        st.caption(
            "💡 *Tip:* You can toggle between Dummy responses and Real-time Groq LLM calls at any time "
            "using the switch in the left sidebar."
        )

    st.stop()


# ---------------------------------------------------------------------------
# View 2: Main Active Chat Session
# ---------------------------------------------------------------------------

# Header Banner
col_h1, col_h2 = st.columns([2, 2])
with col_h1:
    st.markdown('<div class="main-header">Enterprise Multi-Agent Chat</div>', unsafe_allow_html=True)
    st.caption(
        f"Active Session: **{st.session_state.persona}** perspective | Organization: **{st.session_state.organization}** | "
        "Agents instrumented: Supervisor, Analytics, Reporter"
    )
with col_h2:
    mode_badge_html = (
        '<span class="mode-badge-realtime">⚡ Live Groq LLM</span>'
        if st.session_state.realtime_mode
        else '<span class="mode-badge-dummy">⚪ Dummy Mode</span>'
    )
    st.markdown(
        f'<div style="text-align: right; margin-top: 10px;">'
        f'{mode_badge_html} &nbsp; '
        f'<span class="persona-badge">Perspective: {st.session_state.persona}</span></div>',
        unsafe_allow_html=True,
    )

st.markdown("---")

# Render message history
for msg_idx, message in enumerate(st.session_state.messages):
    with st.chat_message(message["role"]):
        # Header tag showing generation mode
        if message["role"] == "assistant":
            m_mode = message.get("mode", "dummy")
            tag_badge = (
                '<span class="mode-badge-realtime" style="font-size:0.75rem;">⚡ Real-time Groq LLM</span>'
                if m_mode == "realtime"
                else '<span class="mode-badge-dummy" style="font-size:0.75rem;">⚪ Dummy Response</span>'
            )
            st.markdown(f'<div style="margin-bottom: 6px;">{tag_badge}</div>', unsafe_allow_html=True)

        st.markdown(message["content"])

        # If assistant message, render Trace Inspector and Optional Evaluation
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

            # 2. Evaluation Section
            eval_mode_desc = (
                "⚡ Real-time Groq LLM Evaluation"
                if st.session_state.realtime_mode
                else "⚪ Dummy Persona Evaluation"
            )
            st.markdown(f"##### ⚖️ Evaluate this Response *({eval_mode_desc})*")
            eval_col1, eval_col2, eval_col3 = st.columns([2, 1, 1])

            with eval_col1:
                eval_persona = st.selectbox(
                    "Persona for evaluation:",
                    options=available_personas,
                    index=available_personas.index(st.session_state.persona) if st.session_state.persona in available_personas else 0,
                    key=f"eval_persona_{msg_idx}",
                    help="Select which perspective to evaluate this response with.",
                )

            with eval_col2:
                st.write("")
                st.write("")
                run_eval_btn = st.button("Run Evaluation", key=f"eval_btn_{msg_idx}", type="secondary")

            with eval_col3:
                st.write("")
                st.write("")
                compare_all_btn = st.button("Compare All 5", key=f"compare_btn_{msg_idx}", help="Evaluate against all 5 personas side-by-side")

            # Store evaluations in message state if not present
            if "evaluations" not in message:
                message["evaluations"] = {}

            # Execute single evaluation
            if run_eval_btn:
                eval_spinner_msg = (
                    f"Running real-time Groq LLM evaluation for {eval_persona} perspective..."
                    if st.session_state.realtime_mode
                    else f"Evaluating response from perspective of {eval_persona} (Dummy mode)..."
                )
                with st.spinner(eval_spinner_msg):
                    eval_result = evaluate_chat_response(
                        query=message.get("query", ""),
                        output=message["content"],
                        trace=trace,
                        persona=eval_persona,
                        organization=st.session_state.organization,
                        backend_url=st.session_state.backend_url,
                        api_key=st.session_state.llm_api_key,
                        execution_mode="realtime" if st.session_state.realtime_mode else "dummy",
                        model_name=DEFAULT_GROQ_MODEL,
                    )
                    message["evaluations"][eval_persona] = eval_result

            # Execute compare all
            if compare_all_btn:
                compare_spinner_msg = (
                    "Running real-time Groq LLM evaluations across all 5 personas..."
                    if st.session_state.realtime_mode
                    else "Evaluating across all 5 personas (Sales, Developer, Marketing, Product team, Default)..."
                )
                with st.spinner(compare_spinner_msg):
                    for p in available_personas:
                        eval_res = evaluate_chat_response(
                            query=message.get("query", ""),
                            output=message["content"],
                            trace=trace,
                            persona=p,
                            organization=st.session_state.organization,
                            backend_url=st.session_state.backend_url,
                            api_key=st.session_state.llm_api_key,
                            execution_mode="realtime" if st.session_state.realtime_mode else "dummy",
                            model_name=DEFAULT_GROQ_MODEL,
                        )
                        message["evaluations"][p] = eval_res

            # Render Evaluation Results if available
            if message["evaluations"]:
                st.markdown("---")
                st.markdown("#### 📊 Evaluation Results")

                eval_keys = list(message["evaluations"].keys())
                tabs = st.tabs([f"Perspective: {k}" for k in eval_keys])

                for tab_idx, tab in enumerate(tabs):
                    p_key = eval_keys[tab_idx]
                    res = message["evaluations"][p_key]
                    with tab:
                        c_score, c_meta = st.columns([1, 3])
                        score_val = res.get("score", 0.0)
                        passed = res.get("passed", score_val >= 60.0)
                        res_mode = res.get("mode", "dummy")

                        with c_score:
                            badge_class = "score-badge-pass" if passed else "score-badge-fail"
                            status_text = "PASSED" if passed else "NEEDS REVIEW"
                            st.markdown(f'<div class="{badge_class}">{score_val} / 100</div>', unsafe_allow_html=True)
                            st.caption(f"Status: **{status_text}**")
                            st.caption(f"Evaluator Lens: **{p_key}**")
                            if res_mode in ("realtime_llm", "realtime_backend_api"):
                                st.markdown('<span class="mode-badge-realtime">⚡ Live Groq LLM</span>', unsafe_allow_html=True)
                            else:
                                st.markdown('<span class="mode-badge-dummy">⚪ Dummy Evaluation</span>', unsafe_allow_html=True)

                        with c_meta:
                            st.markdown(f"**Reasoning ({p_key} Perspective):**")
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
                            st.markdown(f"💡 **Actionable Feedback for {p_key}:**")
                            for fb in feedbacks:
                                st.markdown(f"- {fb}")

# ---------------------------------------------------------------------------
# Chat Input & Multi-Agent Execution
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
        status_label = (
            "🚀 Multi-Agent Workflow Executing (⚡ Real-time Groq LLM)..."
            if st.session_state.realtime_mode
            else "🚀 Multi-Agent Workflow Executing (⚪ Dummy Mode)..."
        )
        status_box = st.status(status_label, expanded=True)

        with status_box:
            st.write("🧠 **SupervisorAgent:** Analyzing query & formulating plan...")
            time.sleep(0.2)
            st.write("🔬 **AnalyticsAgent:** Invoking domain tools (Sales, Telemetry, Marketing, Product)...")
            time.sleep(0.2)
            st.write(f"📝 **ReporterAgent:** Synthesizing facts tailored to {st.session_state.persona} perspective...")

            # Run LangGraph workflow with mode configuration
            result = run_multi_agent_workflow(
                query=user_prompt,
                persona=st.session_state.persona,
                organization=st.session_state.organization,
                execution_mode=exec_mode,
                model_name=DEFAULT_GROQ_MODEL,
                api_key=st.session_state.llm_api_key,
            )

            if result.get("error"):
                st.warning(
                    f"⚠️ Real-time Groq LLM notice: {result['error']}. "
                    "A fallback simulated response was generated. You can verify your GROQ_API_KEY in .env."
                )

            status_box.update(label="✅ Multi-Agent Workflow Completed!", state="complete", expanded=False)

        final_answer = result["output"]
        trace = result["trace"]

        tag_badge = (
            '<span class="mode-badge-realtime" style="font-size:0.75rem;">⚡ Real-time Groq LLM</span>'
            if result.get("mode") == "realtime"
            else '<span class="mode-badge-dummy" style="font-size:0.75rem;">⚪ Dummy Response</span>'
        )
        st.markdown(f'<div style="margin-bottom: 6px;">{tag_badge}</div>', unsafe_allow_html=True)
        st.markdown(final_answer)

        # Store in session messages
        st.session_state.messages.append({
            "role": "assistant",
            "content": final_answer,
            "query": user_prompt,
            "trace": trace,
            "mode": result.get("mode", "dummy"),
            "model": result.get("model", DEFAULT_GROQ_MODEL),
            "evaluations": {},
        })
        st.rerun()
