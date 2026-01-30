import requests
import json


def test_run_eval_no_observe():
    url = "http://localhost:8000/api/v1/evaluations/run"

    # Payload similar to frontend when observe is unchecked
    payload = {
        "metric_id": "HallucinationEvaluator",
        "inputs": {
            "input": "Who is the president of the moon?",
            "output": "There is no president of the moon.",
            "context": [
                "The Moon is an astronomical body orbiting Earth. It has no government or president."
            ],
            "expected": "No president",
            "persist_result": False,
            # observe is missing, should default to False
            "provider": "openai",
            "model": "gpt-4o",
            "api_key": "sk-dummy",  # Mock key, expecting mock/replay or error but checking trace_id
        },
    }

    headers = {"Content-Type": "application/json"}

    try:
        print(f"Sending request to {url} with observe=False (implicit)...")
        response = requests.post(url, json=payload, headers=headers)

        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print("Response Data:")
            print(json.dumps(data, indent=2))

            trace_id = data.get("trace_id")
            if trace_id:
                print(
                    f"[FAIL] Trace ID returned: {trace_id}. Tracing is ACTIVE despite observe=False."
                )
            else:
                print("[PASS] No Trace ID returned.")
        else:
            print(f"Request failed: {response.text}")

    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    test_run_eval_no_observe()
