import os
import asyncio
import httpx
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add parent path to sys.path
import sys
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from observix import observe
from openai import AsyncOpenAI

# Intercept OpenAI requests offline
class MockAsyncTransport(httpx.AsyncBaseTransport):
    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        content_text = "Successful execution response."
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
                "total_tokens": 120
            }
        }
        return httpx.Response(
            status_code=200,
            headers={"Content-Type": "application/json"},
            content=json.dumps(response_data).encode("utf-8"),
            request=request
        )

mock_client = AsyncOpenAI(
    api_key="mock-key-for-observix",
    http_client=httpx.AsyncClient(transport=MockAsyncTransport())
)

attempts_run = 0

@observe(name="my_sub_agent", as_type="agent")
async def my_sub_agent(prompt: str):
    """
    Sub-agent processing clinical documents.
    """
    global attempts_run
    attempts_run += 1
    print(f"Executing my_sub_agent: Attempt {attempts_run}...")
    
    if attempts_run < 3:
        raise ValueError(f"Simulated sub-agent failure on attempt {attempts_run}")
        
    # Attempt 3: Success
    completion = await mock_client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}]
    )
    return completion.choices[0].message.content

@observe(name="retry_workflow_runner")
async def retry_workflow_runner():
    """
    Workflow runner that retries the sub-agent.
    """
    print("Starting retry_workflow_runner...")
    result = None
    for attempt in range(1, 4):
        try:
            result = await my_sub_agent("Process clinical report summary")
            print("my_sub_agent succeeded!")
            break
        except Exception as e:
            print(f"Attempt {attempt} failed: {e}")
            
    print(f"Workflow finished. Result: {result}")
    return result

if __name__ == "__main__":
    asyncio.run(retry_workflow_runner())
