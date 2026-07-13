
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

{standard_evaluation}

{rubric_score_guidelines}

Expected JSON Output:
{{
    "score": <int 10-100>,
    "reasoning": "<Detailed reasoning>",
    "evidences": {{
        "supporting": ["<evidence_1>", "<evidence_2>"],
        "contradicting": ["<evidence_1>"]
    }},
    "feedbacks": ["<feedback_1>", "<feedback_2>"]
}}

JSON:"""


TOOL_SELECTION_PROMPT = """
You are an expert evaluation assistant evaluating tool selection quality.

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
Please rate the correctness of tool selection on a scale from 0 to 1.
"""


TOOL_INPUT_STRUCTURE_PROMPT_TEMPLATE = """
You are an expert evaluation assistant evaluating the input structure of tool calls.

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
Please rate the correctness of the tool input structure on a scale from 0 to 1.
"""


TOOL_SEQUENCE_PROMPT_TEMPLATE = """
You are an expert evaluation assistant evaluating the tool sequence of the tool calls   

    [BEGIN DATA]
    ************
    [Question]: {question}
    ************
    [Tool Sequence]: {tool_sequence}
    ************
    [Trace]: {trace}
    [END DATA]

Example Scoring Rubric
0: The tool sequence is incorrect
0.5: The tool sequence is partially correct
1: The tool sequence is correct

[Tool Definitions]: {tool_definitions}

#QUESTION
Please rate the percentage of correctness in the context on a scale from 0 to 1.
"""


AGENT_ROUTING_PROMPT_TEMPLATE = """
You are an expert evaluation assistant evaluating agent routing decisions.

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
Please rate the correctness of the agent routing on a scale from 0 to 1.
"""


HITL_PROMPT_TEMPLATE = """
You are an expert evaluation assistant evaluating Human-in-the-Loop (HITL) interactions.

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
Please rate the quality of HITL interaction on a scale from 0 to 1.
"""


WORKFLOW_COMPLETION_PROMPT_TEMPLATE = """
You are an expert evaluation assistant evaluating workflow completion.

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
Please rate the workflow completion on a scale from 0 to 1.
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

CUSTOM EVALUATION CRITERIA:
{custom_instructions}

EVALUATION FOCUS:
Evaluate the workflow execution specifically against the user-defined custom metrics provided above. 
Focus on measuring adherence to the custom instructions and requirements.

EVALUATION APPROACH:
1. Parse and understand each custom metric/criterion provided.
2. Identify evidence in the custom criteria variables, inputs, outputs, or trace data that relates to each criterion.
3. Assess compliance level for each criterion.
4. Provide an overall score based on how well the requirements were met.
5. IF TRACE DATA IS EMPTY: Do not penalize or fail the evaluation. Assess compliance entirely on the custom criteria context, inputs, and outputs provided.

EVIDENCE REQUIREMENTS:
- Map specific constraints, variables, or trace events to each custom criterion
- Document instances of compliance and non-compliance
- Extract relevant agent actions or tool usage IF present in a trace
- Avoid mentioning trace IDs, trace combinations, or technical metadata

REASONING REQUIREMENTS:
- Explain how well each custom criterion was met
- Provide specific examples from the inputs, outputs, or trace
- Justify the overall score based on criterion-by-criterion analysis
- Highlight areas where custom requirements were exceeded or missed

FEEDBACK REQUIREMENTS:
- Identify how to improve the performance of custom metric evaluation 
- Steps should be taken to increase the score

Expected JSON Output:
{{
    "score": <int 10-100>,
    "reasoning": "<Detailed analysis of how well the workflow or provided inputs/outputs met the user-defined custom evaluation criteria>",
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
        "<Specific recommendation for better meeting custom criterion 1>",
        "<Actionable suggestion for improving compliance with criterion 2>",
        "<Guidance for exceeding custom metric requirements>",
        "<Example 1: provide examples similar to the context which could get higher scores>"
    ]
}}

**IMPORTANT: Focus exclusively on the user-defined custom criteria. Base all assessments on actual evidence from the criteria context, inputs, outputs, or trace.**

JSON:"""
