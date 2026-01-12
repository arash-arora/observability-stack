// --- Mock Data ---
/**
 * @deprecated This file is partially deprecated in favor of Backend API /api/v1/evaluations/metrics.
 * However, the backend static registry was inspired by this.
 */
export const PRESET_METRICS = [
  {
    id: 'ragas-faithfulness',
    name: 'Faithfulness',
    type: 'LLM',
    level: 'Trace',
    tags: ['ragas', 'preset', 'rag'],
    owner: 'Ragas',
    lastEdit: '1/9/26',
    description: 'Measures the factual consistency of the answer to the context found in the retrieved documents.',
    code: `from observability_stack.evaluation import RagasFaithfulnessEvaluator\n\nevaluator = RagasFaithfulnessEvaluator()\nresult = evaluator.evaluate(trace)`
  },
  {
    id: 'ragas-answer-relevance',
    name: 'Answer Relevance',
    type: 'LLM',
    level: 'Trace',
    tags: ['ragas', 'preset', 'rag'],
    owner: 'Ragas',
    lastEdit: '1/9/26',
    description: 'Measures how relevant the answer is to the question, ignoring the context.',
    code: `from observability_stack.evaluation import RagasAnswerRelevancyEvaluator\n\nevaluator = RagasAnswerRelevancyEvaluator()\nresult = evaluator.evaluate(trace)`
  },
  {
    id: 'ragas-context-precision',
    name: 'Context Precision',
    type: 'LLM',
    level: 'Retriever',
    tags: ['ragas', 'preset', 'rag'],
    owner: 'Ragas',
    lastEdit: '1/9/26',
    description: 'Measures the signal-to-noise ratio of the retrieved context compared to ground truth.',
    code: `from observability_stack.evaluation import RagasContextPrecisionEvaluator\n\nevaluator = RagasContextPrecisionEvaluator()\nresult = evaluator.evaluate(trace)`
  },
  {
    id: 'ragas-context-recall',
    name: 'Context Recall',
    type: 'LLM',
    level: 'Retriever',
    tags: ['ragas', 'preset', 'rag'],
    owner: 'Ragas',
    lastEdit: '1/9/26',
    description: 'Measures if the retrieved context aligns with the ground truth answer.',
    code: `from observability_stack.evaluation import RagasContextRecallEvaluator\n\nevaluator = RagasContextRecallEvaluator()\nresult = evaluator.evaluate(trace)`
  },
  {
    id: 'deepeval-hallucination',
    name: 'Hallucination',
    type: 'LLM',
    level: 'Trace',
    tags: ['deepeval', 'preset', 'safety'],
    owner: 'DeepEval',
    lastEdit: '1/9/26',
    description: 'Determines if the LLM output contains hallucinations based on context.',
    code: `from observability_stack.evaluation import DeepEvalHallucinationEvaluator\n\nevaluator = DeepEvalHallucinationEvaluator()\nresult = evaluator.evaluate(trace)`
  },
  {
    id: 'deepeval-bias',
    name: 'Bias',
    type: 'LLM',
    level: 'Trace',
    tags: ['deepeval', 'preset', 'safety'],
    owner: 'DeepEval',
    lastEdit: '1/9/26',
    description: 'Checks for bias in the generated output regarding gender, race, etc.',
    code: `from observability_stack.evaluation import DeepEvalMetricEvaluator\nfrom deepeval.metrics import BiasMetric\n\n# Generic wrapper usage\nevaluator = DeepEvalMetricEvaluator(metric=BiasMetric(threshold=0.5))\nresult = evaluator.evaluate(trace)`
  },
  {
    id: 'phoenix-toxicity',
    name: 'Toxicity',
    type: 'LLM',
    level: 'Trace',
    tags: ['phoenix', 'preset', 'safety'],
    owner: 'Phoenix',
    lastEdit: '1/9/26',
    description: 'Detects toxic content, hate speech, or harassment in the response.',
    code: `from observability_stack.evaluation import PhoenixHallucinationEvaluator\n# Note: Specific Toxicity wrapper pending, demonstrating typical usage\nevaluator = PhoenixHallucinationEvaluator()\nresult = evaluator.evaluate(trace)`
  },
  {
    id: 'custom-tone-check',
    name: 'Tone Consistency',
    type: 'LLM',
    level: 'Trace',
    tags: ['custom', 'prompt'],
    owner: 'User',
    lastEdit: 'Today',
    description: 'Checks if the response maintains a professional and helpful tone.',
    prompt: 'You are an expert evaluator. Rate the tone of the following response on a scale of 0-1. 1 is perfectly professional. Response: {{output}}'
  }
];
