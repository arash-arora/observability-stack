from app.core.schema import MetricInfo

def get_code_snippet_template(metric_id: str):
    return f"""from observix.evaluation import {metric_id}

llm_kwargs = {{
    'api_key': api_key,
    'azure_endpoint': azure_endpoint,
    'api_version': api_version,
    'deployment_name': deployment_name
}}

evaluator = {metric_id}(provider='openai', model='gpt-4o', **llm_kwargs)
result = evaluator.evaluate(input_query='', output='', context=[''], expected='')
    """

STATIC_METRICS_REGISTRY = [
    MetricInfo(
        id="RagasFaithfulnessEvaluator",
        name="Faithfulness",
        description="Measures the factual consistency of the answer to the context found in the retrieved documents.",
        provider="Ragas",
        type="RAG Evaluation",
        tags=["ragas", "preset", "rag"],
        inputs=["query", "response", "context"],
        code_snippet=get_code_snippet_template("RagasFaithfulnessEvaluator")
    ),
    MetricInfo(
        id="RagasContextPrecisionEvaluator",
        name="Context Precision",
        description="Measures how precise the context is to the question, ignoring the answer.",
        provider="Ragas",
        type="RAG Evaluation",
        tags=["ragas", "preset", "rag"],
        inputs=["query", "context", "expected"],
        code_snippet=get_code_snippet_template("RagasContextPrecisionEvaluator")
    ),
    MetricInfo(
        id="RagasContextRecallEvaluator",
        name="Context Recall",
        description="Measures if the retrieved context aligns with the ground truth answer.",
        provider="Ragas",
        type="RAG Evaluation",
        tags=["ragas", "preset", "rag"],
        inputs=["query", "context", "expected"],
        code_snippet=get_code_snippet_template("RagasContextRecallEvaluator")
    ),
    MetricInfo(
        id="RagasNoiseSensitivityEvaluator",
        name="Noise Sensitivity",
        description="Measures how often a system makes errors by providing incorrect responses when utilizing either relevant or irrelevant retrieved documents",
        provider="Ragas",
        type="RAG Evaluation",
        tags=["ragas", "preset", "rag"],
        inputs=["query", "context", "expected", "output"],
        code_snippet=get_code_snippet_template("RagasNoiseSensitivityEvaluator")
    ),
    MetricInfo(
        id="DeepEvalHallucinationEvaluator",
        name="Hallucination",
        description="Determines if the LLM output contains hallucinations based on context.",
        provider="DeepEval",
        type="LLM",
        tags=["deepeval", "preset", "safety"],
        inputs=["query", "response", "context"],
        code_snippet=get_code_snippet_template("DeepEvalHallucinationEvaluator")
    ),
    MetricInfo(
        id="DeepEvalAnswerRelevancyEvaluator",
        name="Answer Relevancy",
        description="Measures if the response answers the specific question asked.",
        provider="DeepEval",
        type="RAG Evaluation",
        tags=["deepeval", "preset", "rag"],
        inputs=["query", "response", "context"],
        code_snippet=get_code_snippet_template("DeepEvalAnswerRelevancyEvaluator")
    ),
    MetricInfo(
        id="DeepEvalFaithfulnessEvaluator",
        name="Faithfulness",
        description="Measures if the answer is derived faithfully from the retrieved context.",
        provider="DeepEval",
        type="RAG Evaluation",
        tags=["deepeval", "preset", "rag"],
        inputs=["query", "response", "context"],
        code_snippet=get_code_snippet_template("DeepEvalFaithfulnessEvaluator")
    ),
    MetricInfo(
        id="PhoenixToxicityEvaluator",
        name="Toxicity",
        description="Detects toxic content, hate speech, or harassment in the response.",
        provider="Phoenix",
        type="LLM",
        tags=["phoenix", "preset", "safety"],
        inputs=["response"],
        code_snippet=get_code_snippet_template("PhoenixToxicityEvaluator")
    ),
    MetricInfo(
        id="AgentRoutingEvaluator",
        name="Agent Routing",
        description="Evaluates if the router agent selected the correct downstream tool/agent.",
        provider="ObsEval",
        type="Agent",
        tags=["agents", "preset"],
        inputs=["query", "response", "trace"],
        code_snippet=get_code_snippet_template("AgentRoutingEvaluator")
    )
]