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
        id="AnswerRelevancyEvaluator",
        name="Answer Relevancy",
        description="Measures if the response answers the specific question asked.",
        provider="Observix",
        type="RAG Evaluation",
        tags=["preset", "rag"],
        inputs=["query", "response", "context"],
        code_snippet=get_code_snippet_template("AnswerRelevancyEvaluator"),
        dummy_data={
            "query": "What is the capital of France?",
            "response": "The capital of France is Paris.",
            "context": ["Paris is the capital and most populous city of France."]
        }
    ),
    MetricInfo(
        id="FaithfulnessEvaluator",
        name="Faithfulness",
        description="Measures if the answer is derived faithfully from the retrieved context.",
        provider="Observix",
        type="RAG Evaluation",
        tags=["preset", "rag"],
        inputs=["query", "response", "context"],
        code_snippet=get_code_snippet_template("FaithfulnessEvaluator"),
        dummy_data={
            "query": "What is the capital of France?",
            "response": "The capital of France is Paris.",
            "context": ["Paris is the capital and most populous city of France."]
        }
    ),
    MetricInfo(
        id="ContextualPrecisionEvaluator",
        name="Contextual Precision",
        description="Measures the precision of the retrieved context.",
        provider="Observix",
        type="RAG Evaluation",
        tags=["preset", "rag"],
        inputs=["query", "response", "context"],
        code_snippet=get_code_snippet_template("ContextualPrecisionEvaluator"),
        dummy_data={
            "query": "What is the capital of France?",
            "context": ["Paris is the capital and most populous city of France.", "Lyon is a major city in France."],
            "expected": "Paris"
        }
    ),
    MetricInfo(
        id="ContextualRecallEvaluator",
        name="Contextual Recall",
        description="Measures the recall of the retrieved context.",
        provider="Observix",
        type="RAG Evaluation",
        tags=["preset", "rag"],
        inputs=["query", "response", "context"],
        code_snippet=get_code_snippet_template("ContextualRecallEvaluator"),
        dummy_data={
            "query": "What is the capital of France?",
            "context": ["Paris is the capital and most populous city of France."],
            "expected": "Paris"
        }
    ),
    MetricInfo(
        id="HallucinationEvaluator",
        name="Hallucination",
        description="Determines if the LLM output contains hallucinations based on context.",
        provider="Observix",
        type="LLM",
        tags=["preset", "safety"],
        inputs=["query", "response", "context"],
        code_snippet=get_code_snippet_template("HallucinationEvaluator"),
        dummy_data={
            "query": "What is the capital of France?",
            "response": "The capital of France is London.",
            "context": ["Paris is the capital and most populous city of France."]
        }
    ),
    MetricInfo(
        id="TaskCompletionEvaluator",
        name="Task Completion",
        description="Measures if the LLM successfully completes the task.",
        provider="Observix",
        type="Agentic AI",
        tags=["preset", "agents"],
        inputs=["query", "response", "context"],
        code_snippet=get_code_snippet_template("TaskCompletionEvaluator"),
        dummy_data={
            "query": "Book a flight to Paris",
            "response": "I have booked your flight to Paris for tomorrow.",
            "context": ["User requested a flight booking to Paris."]
        }
    ),
    MetricInfo(
        id="ToolCorrectnessEvaluator",
        name="Tool Correctness",
        description="Measures if the LLM correctly uses tools.",
        provider="Observix",
        type="Agentic AI",
        tags=["preset", "agents", "tools"],
        inputs=["query", "response", "context"],
        code_snippet=get_code_snippet_template("ToolCorrectnessEvaluator"),
        dummy_data={
            "query": "Calculate 2 + 2",
            "response": "The answer is 4.",
            "context": ["Tool 'calculator' was called with arguments '2 + 2' and returned '4'."]
        }
    ),
    MetricInfo(
        id="ToxicityEvaluator",
        name="Toxicity",
        description="Measures if the LLM output contains toxic content.",
        provider="Observix",
        type="LLM",
        tags=["llm", "safety"],
        inputs=["query", "response", "context"],
        code_snippet=get_code_snippet_template("ToxicityEvaluator"),
        dummy_data={
            "query": "Tell me a joke.",
            "response": "You are stupid.",
            "context": []
        }
    ),
    MetricInfo(
        id="BiasEvaluator",
        name="Bias",
        description="Measures if the LLM output contains bias.",
        provider="Observix",
        type="LLM",
        tags=["llm", "safety"],
        inputs=["query", "response", "context"],
        code_snippet=get_code_snippet_template("BiasEvaluator"),
        dummy_data={
            "query": "Who is better, men or women?",
            "response": "Men are generally better at logic.",
            "context": []
        }
    ),
    
]