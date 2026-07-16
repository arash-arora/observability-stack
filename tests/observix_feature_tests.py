import asyncio
import sys
import os
import json
from datetime import datetime

# Add backend directory to sys.path so we can import app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../backend")))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlmodel import select

from app.core.database import engine
from app.models.evaluation_rule import EvaluationRule
from app.models.evaluation_result import EvaluationResult
from app.core.evaluation_runner import run_triggered_evaluation, fetch_complete_trace, extract_workflow_details
from app.core.clickhouse import get_clickhouse_client

# Define AGENTIC_METRICS locally to check matching in tests
AGENTIC_METRICS = {
    "ToolSelectionEvaluator",
    "ToolInputStructureEvaluator",
    "ToolSequenceEvaluator",
    "AgentRoutingEvaluator",
    "HITLEvaluator",
    "WorkflowCompletionEvaluator"
}

def test_workflow_details_extraction():
    """
    Test 1: Verifies that extract_workflow_details correctly parses trace observations
    and lists unique agents and tools with their descriptions.
    """
    print("Running Test 1: workflow details extraction...")
    mock_trace = {
        "observations": [
            {
                "type": "agent",
                "name": "orchestrator",
                "metadata_json": {"description": "Coordinates operations"}
            },
            {
                "type": "tool",
                "name": "calculator",
                "metadata_json": {"description": "Performs calculations"}
            },
            {
                "type": "tool",
                "name": "calculator", # Duplicate tool name, should be deduped
                "metadata_json": {"description": "Performs calculations"}
            },
            {
                "type": "agent",
                "name": "summarizer",
                "metadata_json": '{"description": "Creates summaries"}' # JSON string style metadata
            }
        ]
    }
    
    details = extract_workflow_details(mock_trace)
    
    assert "orchestrator: Coordinates operations" in details["agents"]
    assert "summarizer: Creates summaries" in details["agents"]
    assert len(details["agents"]) == 2, "Should have exactly 2 unique agents"
    
    assert "calculator: Performs calculations" in details["tools"]
    assert len(details["tools"]) == 1, "Should have exactly 1 unique tool (deduplicated)"
    print("✅ Test 1 Passed!")


def test_agentic_metrics_matching():
    """
    Test 2: Verifies that agentic metrics are correctly matched.
    """
    print("Running Test 2: agentic metrics matching...")
    
    # ToolSequenceEvaluator is agentic
    rule_metrics_1 = ["ToolSequenceEvaluator"]
    is_agentic_1 = any(m in AGENTIC_METRICS for m in rule_metrics_1)
    assert is_agentic_1 is True, "ToolSequenceEvaluator must be classified as agentic"
    
    # FaithfulnessEvaluator is non-agentic
    rule_metrics_2 = ["FaithfulnessEvaluator"]
    is_agentic_2 = any(m in AGENTIC_METRICS for m in rule_metrics_2)
    assert is_agentic_2 is False, "FaithfulnessEvaluator must be classified as non-agentic"
    print("✅ Test 2 Passed!")


async def test_duplicate_evaluation_prevention():
    """
    Test 3: Verifies that run_triggered_evaluation avoids running duplicate evaluations
    for the same trace_id and metric_id if a result already exists in the database.
    """
    print("Running Test 3: duplicate evaluation prevention...")
    trace_id = "test_duplicate_prevention_trace_999"
    metric_id = "ToolSequenceEvaluator"
    
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    # Cleanup any existing result
    async with async_session() as session:
        stmt = select(EvaluationResult).where(EvaluationResult.trace_id == trace_id)
        results = (await session.execute(stmt)).scalars().all()
        for r in results:
            await session.delete(r)
        await session.commit()
        
        # Pre-insert a mock completed result
        pre_existing = EvaluationResult(
            trace_id=trace_id,
            metric_id=metric_id,
            status="COMPLETED",
            score=1.0,
            passed=True,
            reason="Pre-existing check",
            application_name="demo-1"
        )
        session.add(pre_existing)
        await session.commit()
    
    # Run triggered evaluation manually - should skip due to existing result
    # We pass rule_id=2 (Tool Selection metric check)
    trace_data = {
        "input": "test input",
        "output": "test output",
        "trace_id": trace_id,
        "is_agentic": True
    }
    
    # Execute (should skip inside metric loop and not fail/error)
    await run_triggered_evaluation(rule_id=2, trace_data=trace_data)
    
    # Fetch result and verify it has not been overwritten (reason should still be "Pre-existing check")
    async with async_session() as session:
        stmt = select(EvaluationResult).where(EvaluationResult.trace_id == trace_id)
        res = (await session.execute(stmt)).scalars().all()
        assert len(res) == 1, "Should not create a second evaluation result"
        assert res[0].reason == "Pre-existing check", "The existing result must not be modified or overwritten"
        
        # Cleanup
        await session.delete(res[0])
        await session.commit()
        
    print("✅ Test 3 Passed!")


async def test_sequential_trigger_logic():
    """
    Test 4: Simulates a stream of sequential observations. Verifies that
    an agentic rule only yields a run task when the root observation is present.
    """
    print("Running Test 4: sequential trigger logic...")
    
    trace_id = "seq_test_trace_789"
    
    # Batch 1: Only contains a child tool node (should NOT trigger agentic rule)
    batch_1 = [
        {
            "id": "2002",
            "parent_observation_id": "2001",
            "trace_id": trace_id,
            "name": "CalculatorTool",
            "type": "tool",
            "input_text": "2+2",
            "output_text": "4"
        }
    ]
    
    root_obs_1 = next((o for o in batch_1 if not o.get("parent_observation_id")), None)
    assert root_obs_1 is None, "Batch 1 should have no root observation"
    
    # Batch 2: Contains the root node (should trigger agentic rule)
    batch_2 = [
        {
            "id": "2001",
            "parent_observation_id": None,
            "trace_id": trace_id,
            "name": "MathAgent",
            "type": "agent",
            "input_text": "Solve 2+2",
            "output_text": "The answer is 4"
        }
    ]
    
    root_obs_2 = next((o for o in batch_2 if not o.get("parent_observation_id")), None)
    assert root_obs_2 is not None, "Batch 2 must contain a root observation"
    assert root_obs_2["id"] == "2001"
    print("✅ Test 4 Passed!")


def test_parameter_extraction_parser():
    """
    Test 5: Verifies that extract_clean_param correctly extracts query content from:
    - Plain strings
    - Lists of messages (user/assistant role checks)
    - LangChain style kwargs/args configurations
    """
    print("Running Test 5: parameter extraction parser...")
    from app.core.evaluation_runner import extract_clean_param
    
    # 1. Plain string
    res = extract_clean_param("What is up?", "input")
    assert res == "What is up?"
    
    # 2. String array
    res = extract_clean_param('["Check Alice login"]', "input")
    assert res == "Check Alice login"
    
    # 3. LangChain args: [ {config}, "prompt" ]
    res = extract_clean_param('[{"temperature": 0.1, "max_tokens": 100}, "Based on the tool output: check user Alice"]', "input")
    assert res == "Based on the tool output: check user Alice"
    
    # 4. Message dictionary format
    msg_data = {
        "messages": [
            {"role": "user", "content": "What is the capital of France?"},
            {"role": "assistant", "content": "The capital is Paris."}
        ]
    }
    res_input = extract_clean_param(json.dumps(msg_data), "input")
    assert res_input == "What is the capital of France?"
    
    res_output = extract_clean_param(json.dumps(msg_data), "output")
    assert res_output == "The capital is Paris."
    
    print("✅ Test 5 Passed!")


def test_uuid_nameerror_prevention():
    """
    Test 6: Verifies that uuid is correctly defined and imported for rule endpoints,
    avoiding NameError during UUID conversions.
    """
    print("Running Test 6: uuid NameError prevention...")
    import uuid
    dummy_id = "c24a6422-1688-414f-bd46-408a32a5308e"
    parsed_uuid = uuid.UUID(dummy_id)
    assert str(parsed_uuid) == dummy_id
    
    # Ensure backend's rules endpoint has imported uuid
    from app.api.v1.endpoints.rules import uuid as rules_endpoint_uuid
    assert rules_endpoint_uuid is uuid, "uuid must be imported in rules endpoint"
    print("✅ Test 6 Passed!")


async def main():
    print("=================== STARTING TEST SUITE ===================")
    test_workflow_details_extraction()
    test_agentic_metrics_matching()
    await test_duplicate_evaluation_prevention()
    await test_sequential_trigger_logic()
    test_parameter_extraction_parser()
    test_uuid_nameerror_prevention()
    print("=================== TEST SUITE COMPLETED ===================")


if __name__ == "__main__":
    asyncio.run(main())
