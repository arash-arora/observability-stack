import os
import asyncio
import time
import httpx
import json
from dotenv import load_dotenv

# 1. Load environment variables first so Observix can read them
load_dotenv()

# Ensure backend path is in sys.path
import sys
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

# 2. Import Observix - it will auto-initialize dynamically using the loaded environment
from observix import observe
from openai import AsyncOpenAI


# =====================================================================
# Mock OpenAI HTTP Transport
# =====================================================================
class MockAsyncTransport(httpx.AsyncBaseTransport):
    """
    A mock HTTP transport that intercepts standard OpenAI completions requests
    and returns simulated model outputs, avoiding the need for real API keys.
    """
    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        try:
            req_body = json.loads(request.read().decode("utf-8"))
            messages = req_body.get("messages", [])
            prompt = " ".join([m.get("content", "") for m in messages if m.get("role") == "user"])
        except Exception:
            prompt = ""

        content_text = "Simulated response context"
        if "clinical" in prompt.lower() or "medical" in prompt.lower():
            content_text = (
                "Clinical AI Research Summary:\n"
                "- AI assistants improve clinician diagnostic accuracy by 25%.\n"
                "- Automated retrieval reduces search time for patient history by 40%."
            )
        elif "architecture" in prompt.lower() or "technical" in prompt.lower() or "tech" in prompt.lower():
            content_text = (
                "System Architecture & Performance Analysis:\n"
                "- Real-time clinical flows require low-latency streaming (sub-100ms first-chunk).\n"
                "- Deployments rely on secure containerized microservices behind enterprise API gateways."
            )
        elif "compliance" in prompt.lower() or "regulation" in prompt.lower() or "hipaa" in prompt.lower():
            content_text = (
                "Regulatory Compliance & Safety Audit:\n"
                "- HIPAA requires end-to-end data encryption at rest and in transit.\n"
                "- Hallucination guardrails must filter clinical statements before presenting to physicians."
            )
        elif "summarize" in prompt.lower() or "synthesis" in prompt.lower() or "combine" in prompt.lower():
            content_text = (
                "Comprehensive Synthesized Report on AI Medical Assistants:\n"
                "1. CLINICAL IMPACT: Improves diagnosis accuracy by 25% and speeds history searches by 40%.\n"
                "2. SYSTEM DESIGN: Relies on containerized microservices and low-latency vector cache.\n"
                "3. COMPLIANCE: HIPAA-aligned through encryption, audit trails, and output validators."
            )

        response_data = {
            "choices": [
                {
                    "message": {
                        "role": "assistant",
                        "content": content_text
                    }
                }
            ],
            "usage": {
                "prompt_tokens": 40,
                "completion_tokens": 80,
                "total_tokens": 120
            },
            "model": "gpt-4o"
        }

        return httpx.Response(
            status_code=200,
            content=json.dumps(response_data).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            request=request
        )


def get_openai_client() -> AsyncOpenAI:
    """
    Returns a standard AsyncOpenAI client configured with the mock HTTP transport.
    """
    return AsyncOpenAI(
        api_key="mock-openai-key",
        http_client=httpx.AsyncClient(transport=MockAsyncTransport())
    )

# =====================================================================
# The 5 Tools (All Instrument-Decorated)
# =====================================================================
@observe(name="web_search_tool", as_tool=True)
async def web_search_tool(query: str):
    """
    Search the web for research papers, articles, and documentation.
    """
    print(f"    [Tool] web_search_tool: Executing search for '{query}'...")
    await asyncio.sleep(0.5)
    return f"[Web Result for '{query}'] Found clinical or system details"


@observe(name="database_lookup_tool", as_tool=True)
async def database_lookup_tool(query: str):
    """
    Query internal databases for records, logs, and stored standards.
    """
    print(f"    [Tool] database_lookup_tool: Querying DB for '{query}'...")
    await asyncio.sleep(0.4)
    return f"[DB Result for '{query}'] Found records in clinical/compliance tables"


@observe(name="clinical_guidelines_tool", as_tool=True)
async def clinical_guidelines_tool(query: str):
    """
    Retrieve clinical safety guidelines and official health protocols.
    """
    print(f"    [Tool] clinical_guidelines_tool: Retrieving guidelines for '{query}'...")
    await asyncio.sleep(0.4)
    return f"[Guidelines for '{query}'] HIPAA/Clinical diagnostic protocols"


@observe(name="compliance_check_tool", as_tool=True)
async def compliance_check_tool(query: str):
    """
    Verify HIPAA rules, data privacy, and ethical guardrail compliance.
    """
    print(f"    [Tool] compliance_check_tool: Checking compliance rules for '{query}'...")
    await asyncio.sleep(0.5)
    return f"[Compliance Check for '{query}'] Approved HIPAA compliance parameters"


@observe(name="latency_metrics_tool", as_tool=True)
async def latency_metrics_tool(query: str):
    """
    Fetch performance logs, resource usage, and query latency measurements.
    """
    print(f"    [Tool] latency_metrics_tool: Fetching system benchmarks for '{query}'...")
    await asyncio.sleep(0.3)
    return f"[Latency for '{query}'] Under 50ms average query latency metrics"

# =====================================================================
# Parallel Specialist Agents
# =====================================================================
@observe(name="medical_researcher_agent", as_agent=True)
async def medical_researcher_agent(topic: str):
    """
    Research agent specialized in clinical validation, diagnostic accuracy, and patient safety.
    """
    print("  [Agent] Medical Researcher: Starting clinical investigation...")
    
    # Call web_search_tool twice in parallel, and clinical_guidelines_tool once in parallel
    results = await asyncio.gather(
        web_search_tool(f"clinical trials of {topic}"),
        web_search_tool(f"diagnostic accuracy of {topic}"),
        clinical_guidelines_tool(topic)
    )
    web_data_1, web_data_2, clinical_data = results
    
    client = get_openai_client()
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are a clinical researcher specializing in AI diagnostics."},
            {"role": "user", "content": f"Analyze: {web_data_1}, {web_data_2}, and {clinical_data}."}
        ]
    )
    
    output = response.choices[0].message.content
    print("  [Agent] Medical Researcher: Completed analysis.")
    return output


@observe(name="tech_analyst_agent", as_agent=True)
async def tech_analyst_agent(topic: str):
    """
    Research agent specialized in software engineering, system architectures, and latency benchmarking.
    """
    print("  [Agent] Tech Analyst: Starting systems architecture review...")
    
    # Call web_search_tool twice in parallel, and latency_metrics_tool once in parallel
    results = await asyncio.gather(
        web_search_tool(f"system architecture of {topic}"),
        web_search_tool(f"scalability of {topic}"),
        latency_metrics_tool(topic)
    )
    web_data_1, web_data_2, latency_data = results
    
    client = get_openai_client()
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are a software architect evaluating latency and scalability."},
            {"role": "user", "content": f"Review technical stack requirements. Web: {web_data_1}, {web_data_2}. Latency: {latency_data}."}
        ]
    )
    
    output = response.choices[0].message.content
    print("  [Agent] Tech Analyst: Completed review.")
    return output


@observe(name="compliance_officer_agent", as_agent=True)
async def compliance_officer_agent(topic: str):
    """
    Research agent specialized in HIPAA audits, safety guardrails, and compliance logs.
    """
    print("  [Agent] Compliance Officer: Starting regulatory framework assessment...")
    
    # Call database_lookup_tool twice in parallel, and compliance_check_tool once in parallel
    results = await asyncio.gather(
        database_lookup_tool(f"HIPAA regulation protocols for {topic}"),
        database_lookup_tool(f"audit logs standards for {topic}"),
        compliance_check_tool(topic)
    )
    db_data_1, db_data_2, compliance_data = results
    
    client = get_openai_client()
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are a compliance officer auditing AI governance."},
            {"role": "user", "content": f"Determine compliance guardrails. DB: {db_data_1}, {db_data_2}. Compliance: {compliance_data}."}
        ]
    )
    
    output = response.choices[0].message.content
    print("  [Agent] Compliance Officer: Completed audit.")
    return output

# =====================================================================
# Synthesis Agent (Runs Sequentially After Parallel Agents Finish)
# =====================================================================
@observe(name="synthesis_agent", as_agent=True)
async def synthesis_agent(topic: str, findings: list[str]):
    """
    Lead editor agent that synthesizes multiple parallel research documents into a single report.
    """
    print("  [Agent] Synthesis Agent: Compiling reports from clinical, technical, and regulatory agents...")
    
    combined = "\n\n".join(findings)
    client = get_openai_client()
    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "You are a lead editor synthesis agent."},
            {"role": "user", "content": f"Summarize and structure the following research findings on '{topic}':\n{combined}"}
        ]
    )
    
    output = response.choices[0].message.content
    print("  [Agent] Synthesis Agent: Final report synthesized.")
    return output

# =====================================================================
# Workflow Coordinator (Runner)
# =====================================================================
@observe(name="run_research_coordinator", as_type="runner")
async def run_research_coordinator(topic: str):
    """
    Coordinator runner that manages parallel agent tasks and delegates final synthesis.
    """
    print(f"\n[Runner] run_research_coordinator: Initializing task for topic '{topic}'")
    print("\n>>> Spawning research agents in parallel (via asyncio.gather) <<<")
    start_time = time.time()
    
    # Concurrently execute the three specialist agents
    results = await asyncio.gather(
        medical_researcher_agent(topic),
        tech_analyst_agent(topic),
        compliance_officer_agent(topic),
        return_exceptions=True
    )
    
    elapsed = time.time() - start_time
    print(f">>> Parallel agents completed execution in {elapsed:.2f} seconds <<<\n")
    
    findings = []
    for index, r in enumerate(results):
        if isinstance(r, Exception):
            print(f"Error executing agent index {index}: {r}")
        else:
            findings.append(r)
            
    final_report = await synthesis_agent(topic, findings)
    print("[Runner] run_research_coordinator: Workflow execution finished.\n")
    return final_report

# =====================================================================
# Entrypoint Execution
# =====================================================================
async def main():
    print("=====================================================================")
    print("   Starting Parallel Agent Demo Application with Observix Tracing")
    print("=====================================================================")
    
    topic = "AI Healthcare Assistants"
    final_report = await run_research_coordinator(topic)
    
    print("=====================================================================")
    print("   FINAL REPORT OUTPUT")
    print("=====================================================================")
    print(final_report)
    print("=====================================================================")
    
    print("\nSleeping for 3 seconds to let Observix batch processor flush spans to the server...")
    await asyncio.sleep(3)
    print("Demo execution finished.")


if __name__ == "__main__":
    asyncio.run(main())
