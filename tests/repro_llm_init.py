
import sys
import os
from unittest.mock import MagicMock

# Mock imports if packages are missing
sys.modules["ragas"] = MagicMock()
sys.modules["ragas.metrics"] = MagicMock()
sys.modules["deepeval"] = MagicMock()
sys.modules["deepeval.metrics"] = MagicMock()
sys.modules["deepeval.test_case"] = MagicMock()
sys.modules["phoenix"] = MagicMock()
sys.modules["phoenix.evals"] = MagicMock()
sys.modules["phoenix.evals.models"] = MagicMock()
sys.modules["dotenv"] = MagicMock()
sys.modules["opentelemetry"] = MagicMock()
sys.modules["opentelemetry.trace"] = MagicMock()
sys.modules["opentelemetry.context"] = MagicMock()
sys.modules["opentelemetry.sdk"] = MagicMock()
sys.modules["opentelemetry.sdk.trace"] = MagicMock()
sys.modules["opentelemetry.sdk.trace.export"] = MagicMock()
sys.modules["pandas"] = MagicMock() # Phoenix uses pandas
sys.modules["clickhouse_sqlalchemy"] = MagicMock()
sys.modules["clickhouse_sqlalchemy.engines"] = MagicMock()
sys.modules["clickhouse_sqlalchemy.types"] = MagicMock()
sys.modules["sqlalchemy"] = MagicMock()
sys.modules["sqlalchemy.orm"] = MagicMock()
sys.modules["pydantic"] = MagicMock()
sys.modules["fastapi"] = MagicMock()
sys.modules["fastapi"] = MagicMock()
sys.modules["httpx"] = MagicMock()
sys.modules["observix.schema"] = MagicMock()
# Define Trace mock as a real class to avoid typing issues
class MockTrace: pass
class MockObservation: pass
sys.modules["observix.schema"].Trace = MockTrace
sys.modules["observix.schema"].Observation = MockObservation

# Mock observix dependencies
sys.path.append(os.path.abspath("backend/observix/src"))

from observix.evaluation.integrations.ragas import RagasFaithfulnessEvaluator
from observix.evaluation.integrations.deepeval import DeepEvalAnswerRelevancyEvaluator
from observix.evaluation.integrations.phoenix import PhoenixHallucinationEvaluator
from observix.evaluation.integrations.observix_eval import ToolSelectionEvaluator

def test_initialization():
    print("Testing Initialization...")

    # Mock LLMs
    mock_openai_client = MagicMock()
    mock_openai_client.chat.completions.create.return_value = MagicMock(choices=[MagicMock(message=MagicMock(content="Score: 0.9"))])
    
    mock_langchain_llm = MagicMock()
    mock_langchain_llm.invoke.return_value = "Score: 0.8"

    # 1. Ragas
    print("1. Ragas...", end="")
    try:
        ragas_eval = RagasFaithfulnessEvaluator(llm=mock_langchain_llm)
        print("OK")
    except Exception as e:
        print(f"FAILED: {e}")

    # 2. DeepEval
    print("2. DeepEval...", end="")
    try:
        deepeval_eval = DeepEvalAnswerRelevancyEvaluator(llm=mock_openai_client)
        print("OK")
    except Exception as e:
        print(f"FAILED: {e}")

    # 3. Phoenix
    print("3. Phoenix...", end="")
    try:
        phoenix_eval = PhoenixHallucinationEvaluator(llm=mock_openai_client)
        print("OK")
    except Exception as e:
        print(f"FAILED: {e}")

    # 4. ObsEval (OpenAI)
    print("4. ObsEval (OpenAI)...", end="")
    try:
        obseval_openai = ToolSelectionEvaluator(llm=mock_openai_client)
        print("OK")
    except Exception as e:
        print(f"FAILED: {e}")

    # 5. ObsEval (LangChain)
    print("5. ObsEval (LangChain)...", end="")
    try:
        obseval_langchain = ToolSelectionEvaluator(llm=mock_langchain_llm)
        print("OK")
    except Exception as e:
        print(f"FAILED: {e}")

if __name__ == "__main__":
    test_initialization()
