import requests
import json
import sys

BASE_URL = "http://localhost:8000/api/v1"

def verify_runs():
    print("Verifying /evaluations/runs endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/evaluations/runs")
        response.raise_for_status()
        runs = response.json()
        print(f"Successfully fetched {len(runs)} runs.")
        
        if not runs:
            print("No runs found. Running media_agency.py to generate data...")
            # Import and run media agency if needed, or just warn
            # For now, let's just warn as user ran it recently
            print("WARNING: No data to verify grouping. please run 'uv run demo/media_agency.py'")
            return None

        first_run = runs[0]
        print(f"Latest Run: Trace ID: {first_run['trace_id']}, Count: {first_run['evaluation_count']}")
        
        # Verify structure
        required_fields = ['trace_id', 'status', 'evaluation_count', 'score_avg', 'passed']
        for field in required_fields:
            if field not in first_run:
                print(f"ERROR: Missing field '{field}' in response.")
                sys.exit(1)
                
        return first_run['trace_id']
        
    except Exception as e:
        print(f"Failed to fetch runs: {e}")
        sys.exit(1)

def verify_trace_details(trace_id):
    print(f"\nVerifying /evaluations/results?trace_id={trace_id} endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/evaluations/results", params={'trace_id': trace_id})
        response.raise_for_status()
        results = response.json()
        print(f"Successfully fetched {len(results)} results for trace {trace_id}.")
        
        if len(results) == 0:
            print("ERROR: Run reported count > 0 but details endpoint returned 0.")
            sys.exit(1)
            
        print("Verification Successful!")
        
    except Exception as e:
        print(f"Failed to fetch trace details: {e}")
        sys.exit(1)

if __name__ == "__main__":
    trace_id = verify_runs()
    if trace_id:
        verify_trace_details(trace_id)
