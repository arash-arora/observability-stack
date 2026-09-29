from typing import Optional, Dict, Any

TRACE_SANITIZATION_PROMPT = """
You are sanitizing trace data from a multi-agent system. Your goal is to extract ONLY agent execution steps. 
Workflow Structure: 
Agents -> {agents}
Tools -> {tools}

AGENT COUNT VALIDATION REQUIREMENT:
**Before proceeding with sanitization, extract the expected agent count from the workflow structure.
After sanitization is complete, verify that the number of unique agents in the sanitized output matches the expected count.
This prevents unintended agent filtering or data loss during processing.

Validation Steps:
    1. Count expected agents from workflow structure
    2. Perform sanitization following the rules below
    3. Count unique agents in sanitized output (by unique agent_name/node_name)
    4. If counts don't match, review filtering rules to ensure no valid agents were excluded
    5. Include validation metadata in output: {{"expected_agent_count": X, "sanitized_agent_count": Y, "validation_passed": true/false}}
    6. Don't consider tool execution as agent and ensure in the sanitized output there are no tool calling and LLM calling as agents.

**CRITICAL AGENT IDENTIFICATION RULES:**
1. An observation is an AGENT STEP if and ONLY if: it has a `node.type=='agent'` - then only it will represent an actual agent decision / action, not internal LLM processing.
2. NEVER treat these as agent steps: 
    - Any observation with `name` having ['invoke'] is not an agent
    - Any observation with `node.type`=='tool'
3. For each valid agent step, extract the following
    - agent name
    - agent's goal
    - agent's input
    - agent's output
    - agent's timestamp
4. Maintain the chronological order using the timestamps
5. **POST-SANITIZATION CHECK:**
    Verify that all agents mentioned in the `Workflow Structure` appear in the sanitized output, if an agent is missing, flag it as a potential data integrity issue rather than silently excluding it.

** OUTPUT FORMAT (STRICT JSON) **
{{
"sanitized_trace": [
    {{
        "agent": "RoutingAgent", 
        "goal": "Route user request to appropriate handler", 
        "input": {{"user_query": "..."}}
        "output": {{"next_agent": "..."}}
        "timestamp": "2024-01-15T10:30:00"
    }}
]
}}

**Validation**
- Every entry MUST have a valid agent name 
- Eliminate duplicate entries for the same agent action 
- Keep only semantically meaningfull agent steps 

Raw Trace Data: {trace}
"""


# ---------------------------------------------------------------------------
# Persona & Organization Definitions & Guidelines
# ---------------------------------------------------------------------------

AVAILABLE_PERSONAS = [
    "Default",
    "Sales",
    "Marketing",
    "Developer",
    "Product team",
]

PERSONA_PERSPECTIVES: Dict[str, Dict[str, Any]] = {
    "Default": {
        "title": "Default / General Evaluator",
        "description": "Standard objective evaluation assessing correctness, factual accuracy, completeness, and general task fulfillment.",
        "focus_areas": [
            "Objective factual accuracy and logical coherence",
            "Direct and complete answering of the user inquiry",
            "Clarity, conciseness, and helpfulness",
            "Adherence to specified constraints without assumptions",
        ],
        "guidelines": (
            "Evaluate the response from a balanced, objective perspective. Verify that the answer directly and accurately "
            "satisfies the user query, presents verifiable facts, and avoids unnecessary fluff or ungrounded assumptions."
        ),
        "example_scenario": (
            "If asked 'What is the sales this quarter?', evaluate for factual correctness, clarity, and direct answering of the question."
        ),
    },
    "Sales": {
        "title": "Sales Team",
        "description": "Commercial and revenue-focused evaluation emphasizing business metrics, deal acceleration, customer value, and executive clarity.",
        "focus_areas": [
            "Revenue figures, quarterly sales totals, quota attainment, and pipeline growth",
            "Customer value proposition, ROI justification, and commercial impact",
            "Executive summaries, client-ready communication, and actionable sales next steps",
            "Eliminating unnecessary technical/backend jargon in favor of commercial bottom-line clarity",
        ],
        "guidelines": (
            "Evaluate the response strictly from the perspective of a Sales Team. For example, if asked 'What is the sales this quarter?', "
            "the evaluation must ensure the answer highlights exact revenue numbers, quota attainment, top winning deals, pipeline pace, and actionable sales guidance. "
            "Reward responses that provide executive commercial summaries, customer value propositions, and clear financial takeaways that help close deals. "
            "Penalize answers that bog down in database schemas, technical API errors, or provide vague non-committal figures without commercial utility."
        ),
        "example_scenario": (
            "When evaluating 'What is the sales this quarter?', a Sales perspective rewards clear dollar amounts, percentage of target reached, "
            "deal velocity, and pipeline insights, while penalizing raw database query logs or missing bottom-line revenue impact."
        ),
    },
    "Marketing": {
        "title": "Marketing Team",
        "description": "Brand, growth, and audience-focused evaluation emphasizing messaging clarity, market resonance, campaign impact, and customer engagement.",
        "focus_areas": [
            "Campaign effectiveness, lead acquisition channels, conversion funnels, and reach",
            "Brand voice alignment, positioning, and compelling communication",
            "Customer segment resonance, market trends, and competitive positioning",
            "Actionable marketing insights and data-backed promotional strategy",
        ],
        "guidelines": (
            "Evaluate the response strictly from the perspective of a Marketing Team. Assess whether the content reflects brand voice, customer acquisition "
            "dynamics, and campaign resonance. For example, if analyzing sales or quarterly performance, evaluate whether the response highlights customer demand "
            "drivers, lead source channels, campaign attribution, and audience engagement trends. "
            "Reward creative clarity, compelling presentation, audience empathy, and market-driven strategic insights. "
            "Penalize dry, disconnected figures that lack marketing context or audience implications."
        ),
        "example_scenario": (
            "When evaluating 'What is the sales this quarter?', a Marketing perspective looks at campaign-driven revenue, customer acquisition channels, "
            "lead conversions, and brand market momentum."
        ),
    },
    "Developer": {
        "title": "Developer / Engineering Team",
        "description": "Technical and systems-focused evaluation emphasizing architectural accuracy, implementation precision, code/API specs, and edge-case handling.",
        "focus_areas": [
            "Technical correctness, code/schema validity, API contracts, and implementation feasibility",
            "System performance, query efficiency, data pipelines, error codes, and latency",
            "Edge case handling, error traces, reproducibility, and deterministic data flow",
            "Concrete data structures, schemas, and root-cause explanations over high-level business fluff",
        ],
        "guidelines": (
            "Evaluate the response strictly from the perspective of a Developer / Engineering Team. If asked 'What is the sales this quarter?', "
            "the evaluation scrutinizes technical details: data pipeline integrity, source tables/APIs queried, metric calculation logic, time-zone boundaries, "
            "query performance, schema accuracy, and handling of anomalies or missing records. "
            "Reward high technical rigor, explicit contracts, reproducible steps, and detailed implementation accuracy. "
            "Penalize vague generalities, hand-waving, unverified estimates, or omitting crucial technical caveats."
        ),
        "example_scenario": (
            "When evaluating 'What is the sales this quarter?', a Developer perspective evaluates the data freshness, API endpoints queried, "
            "aggregation logic correctness, database query performance, and handling of edge-case refunds or pending transactions."
        ),
    },
    "Product team": {
        "title": "Product Team",
        "description": "Product management and user experience (UX) evaluation emphasizing customer problem solving, feature adoption, roadmaps, and product metrics.",
        "focus_areas": [
            "User experience (UX), customer journey friction, and end-user satisfaction",
            "Product adoption, engagement metrics (DAU/MAU, retention, drop-off), and feature impact",
            "Alignment with product requirements, user stories, feature completeness, and roadmaps",
            "Strategic trade-offs, feature prioritization, and measurable user-centric outcomes",
        ],
        "guidelines": (
            "Evaluate the response strictly from the perspective of a Product Team. Assess how well the answer addresses user needs, product usability, "
            "feature health, and product strategy. For example, if asked 'What is the sales this quarter?', examine whether the response links sales numbers to "
            "specific product tier adoption, user retention, feature upgrades, and customer pain points. "
            "Reward user-centric clarity, structured feature/insight breakdowns, and actionable prioritization for product roadmaps. "
            "Penalize answers that ignore user experience, overlook feature performance, or fail to connect metrics with customer value."
        ),
        "example_scenario": (
            "When evaluating 'What is the sales this quarter?', a Product perspective checks which features or plan tiers drove the revenue, "
            "churn rates, user onboarding impact, and strategic takeaways for upcoming product releases."
        ),
    },
}


def normalize_persona(persona: Optional[str]) -> str:
    """Normalize persona name to one of the 5 canonical personas, defaulting to 'Default'."""
    if not persona:
        return "Default"
    cleaned = str(persona).strip().lower()
    lookup = {
        "default": "Default",
        "sales": "Sales",
        "marketing": "Marketing",
        "developer": "Developer",
        "dev": "Developer",
        "engineering": "Developer",
        "engineer": "Developer",
        "product": "Product team",
        "product team": "Product team",
        "product_team": "Product team",
        "productteam": "Product team",
        "product management": "Product team",
        "pm": "Product team",
    }
    return lookup.get(cleaned, "Default")


def format_persona_context(persona: Optional[str] = "Default", organization: Optional[str] = None) -> str:
    """
    Generate the persona and organization context block to be embedded in evaluation prompts.
    """
    canonical_persona = normalize_persona(persona)
    info = PERSONA_PERSPECTIVES.get(canonical_persona, PERSONA_PERSPECTIVES["Default"])
    
    org_str = str(organization).strip() if organization and str(organization).strip() else "Standard / Not Specified"
    focus_bullets = "\n".join(f"  • {item}" for item in info["focus_areas"])
    
    return f"""EVALUATION PERSPECTIVE & AUDIENCE CONTEXT:
Active Persona: {info['title']} ({canonical_persona})
Target Organization: {org_str}

Perspective Guidelines:
{info['guidelines']}

Key Priorities for this Persona:
{focus_bullets}

Example Domain Application:
  {info['example_scenario']}

CRITICAL INSTRUCTION FOR TAILORED EVALUATION:
You MUST evaluate the response strictly through the lens and priorities of the '{canonical_persona}' persona and '{org_str}'.
An answer that satisfies a Developer (high technical detail, query/API contracts) may fail for a Sales team (demanding bottom-line revenue, quota pace, and deal velocity without jargon).
Tailor your score, reasoning, evidence, and recommendations specifically to this persona's point of view."""


# ---------------------------------------------------------------------------
# Evaluation Templates Tailored for Persona & Organization
# ---------------------------------------------------------------------------

STANDARD_EVALUATION_TEMPLATE = """
You are an expert AI evaluation assistant. Your task is to evaluate the quality of an AI system's response based on the provided criteria.

AVAILABLE WORKFLOW RESOURCES:
Available Agents: {agents}
Available Tools: {tools}
Use ONLY these available resources for evaluation. Do not suggest tools or agents not present in this context.

SPECIAL INSTRUCTIONS FOR COMBINED TRACES:
- This trace represents an end-to-end workflow execution across multiple agents/steps
- Evaluate the complete flow from initial request to final output
- Consider inter-agent handoffs and data flow continuity
- Account for human-in-the-loop interactions if present
- Focus on the overall journey effectiveness, not individual trace segments

TRACE DATA TO ANALYZE (If applicable):
{trace_data}

{persona_context}

{standard_evaluation}

{rubric_score_guidelines}

Expected JSON Output:
{{
    "score": <int 10-100>,
    "reasoning": "<Detailed reasoning evaluating the response specifically through the lens of the target persona and organization>",
    "evidences": {{
        "supporting": ["<evidence_1>", "<evidence_2>"],
        "contradicting": ["<evidence_1>"]
    }},
    "feedbacks": ["<feedback_1 tailored to this persona>", "<feedback_2 tailored to this persona>"]
}}

JSON:"""


TOOL_SELECTION_PROMPT = """
You are an expert evaluation assistant evaluating tool selection quality.

{persona_context}

[BEGIN DATA]
************
[Question]: {question}
************
[Tool Call]: {tool_call}
************
[Trace]: {trace}
[END DATA]

Example Scoring Rubric:
0: The tool selected is incorrect or irrelevant
0.5: The tool selected is partially correct
1: The tool selected is correct and appropriate

[Tool Definitions]: {tool_definitions}
[Agent Definitions]: {agent_definitions}

#QUESTION
Please rate the correctness of tool selection on a scale from 0 to 1, taking into account the expectations of the active persona and organization.
"""


TOOL_INPUT_STRUCTURE_PROMPT_TEMPLATE = """
You are an expert evaluation assistant evaluating the input structure of tool calls.

{persona_context}

[BEGIN DATA]
************
[Question]: {question}
************
[Tool Call]: {tool_call}
************
[Trace]: {trace}
[END DATA]

Example Scoring Rubric:
0: The tool input structure is completely wrong
0.5: The tool input structure is partially correct
1: The tool input structure is correct

[Tool Definitions]: {tool_definitions}
[Agent Definitions]: {agent_definitions}

#QUESTION
Please rate the correctness of the tool input structure on a scale from 0 to 1, taking into account the requirements of the active persona.
"""


TOOL_SEQUENCE_PROMPT_TEMPLATE = """
You are an expert evaluation assistant evaluating the tool sequence of the tool calls.

{persona_context}

[BEGIN DATA]
************
[Question]: {question}
************
[Tool Sequence]: {tool_sequence}
************
[Trace]: {trace}
[END DATA]

Example Scoring Rubric:
0: The tool sequence is incorrect
0.5: The tool sequence is partially correct
1: The tool sequence is correct

[Tool Definitions]: {tool_definitions}

#QUESTION
Please rate the percentage of correctness in the context on a scale from 0 to 1, taking into account the active persona workflow requirements.
"""


AGENT_ROUTING_PROMPT_TEMPLATE = """
You are an expert evaluation assistant evaluating agent routing decisions.

{persona_context}

[BEGIN DATA]
************
[Question]: {question}
************
[Trace]: {trace}
[END DATA]

Example Scoring Rubric:
0: The routing decision is completely incorrect
0.5: The routing decision is partially correct
1: The routing decision is correct and optimal

[Agent Definitions]: {agent_definitions}

#QUESTION
Please rate the correctness of the agent routing on a scale from 0 to 1, considering the requirements of the active persona and organization.
"""


HITL_PROMPT_TEMPLATE = """
You are an expert evaluation assistant evaluating Human-in-the-Loop (HITL) interactions.

{persona_context}

[BEGIN DATA]
************
[Question]: {question}
************
[HITL Information]: {HITL_INFO}
************
[Trace]: {trace}
[END DATA]

Example Scoring Rubric:
0: The HITL interaction is inappropriate or missing
0.5: The HITL interaction is partially correct
1: The HITL interaction is correct and well-handled

#QUESTION
Please rate the quality of HITL interaction on a scale from 0 to 1, taking into account the needs of the active persona and organization.
"""


WORKFLOW_COMPLETION_PROMPT_TEMPLATE = """
You are an expert evaluation assistant evaluating workflow completion.

{persona_context}

[BEGIN DATA]
************
[Question]: {question}
************
[Trace]: {trace}
[END DATA]

Example Scoring Rubric:
0: The workflow is not completed or has major issues
0.5: The workflow is partially completed
1: The workflow is fully and correctly completed

[Agent Definitions]: {agent_definitions}
[Tool Definitions]: {tool_definitions}

#QUESTION
Please rate the workflow completion on a scale from 0 to 1, considering the perspective and expectations of the active persona.
"""


CUSTOM_METRIC_PROMPT_TEMPLATE = """
You are evaluating workflow performance based on user-defined custom metrics and evaluation criteria.

AVAILABLE WORKFLOW RESOURCES:
Available Agents: {agents}
Available Tools: {tools}
Use ONLY these available resources for evaluation. Do not suggest tools or agents not present in this context.

SPECIAL INSTRUCTIONS FOR COMBINED TRACES:
- This trace represents an end-to-end workflow execution across multiple agents/steps
- Evaluate the complete flow from initial request to final output
- Consider inter-agent handoffs and data flow continuity
- Account for human-in-the-loop interactions if present
- Focus on the overall journey effectiveness, not individual trace segments

TRACE DATA TO ANALYZE (If applicable):
{trace_data}

{persona_context}

CUSTOM EVALUATION CRITERIA:
{custom_instructions}

EVALUATION FOCUS:
Evaluate the workflow execution and response specifically against the custom criteria provided above, strictly tailored through the lens of the active persona ({persona}) and organization ({organization}).
Focus on measuring adherence to the instructions and requirements from the perspective of this persona.

EVALUATION APPROACH:
1. Parse and understand each custom metric/criterion provided through the active persona's perspective.
2. Identify evidence in the custom criteria variables, inputs, outputs, or trace data that relates to each criterion.
3. Assess compliance level for each criterion based on what matters to this persona.
4. Provide an overall score based on how well the requirements were met.
5. IF TRACE DATA IS EMPTY: Do not penalize or fail the evaluation. Assess compliance entirely on the custom criteria context, inputs, and outputs provided.

EVIDENCE REQUIREMENTS:
- Map specific constraints, variables, or trace events to each custom criterion
- Document instances of compliance and non-compliance
- Extract relevant agent actions or tool usage IF present in a trace
- Avoid mentioning trace IDs, trace combinations, or technical metadata

REASONING REQUIREMENTS:
- Explain how well each custom criterion was met from the active persona's perspective
- Provide specific examples from the inputs, outputs, or trace
- Justify the overall score based on criterion-by-criterion analysis
- Highlight areas where requirements were exceeded or missed from this persona's viewpoint

FEEDBACK REQUIREMENTS:
- Identify how to improve the performance of custom metric evaluation for this persona
- Actionable steps should be taken to increase the score

Expected JSON Output:
{{
    "score": <int 10-100>,
    "reasoning": "<Detailed analysis of how well the workflow or provided inputs/outputs met the evaluation criteria tailored to the active persona and organization>",
    "evidences": {{
        "evaluated_criteria": ["<criterion_1>", "<criterion_2>", "..."],
        "compliance_instances": ["<compliance_evidence_1>", "<compliance_evidence_2>", "..."],
        "non_compliance_instances": ["<non_compliance_1>", "<non_compliance_2>", "..."],
        "relevant_agents": ["<agent_name_1>", "<agent_name_2>", "..."],
        "relevant_tools": ["<tool_name_1>", "<tool_name_2>", "..."]
    }},
    "criterion_breakdown": [
        {{
            "criterion": "<criterion_description>",
            "met": <true/false>,
            "evidence": "<specific evidence>",
            "score_impact": "<how this affected the overall score>"
        }}
    ],
    "feedbacks": [
        "<Specific recommendation for better meeting criterion for this persona>",
        "<Actionable suggestion for improving compliance with criterion for this persona>",
        "<Guidance for exceeding metric requirements for this persona>",
        "<Example 1: provide examples tailored to this persona which could get higher scores>"
    ]
}}

**IMPORTANT: Focus on the evaluation criteria through the active persona's perspective. Base all assessments on actual evidence from the criteria context, inputs, outputs, or trace.**

JSON:"""
