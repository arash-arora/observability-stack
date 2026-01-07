

import json
import os

# Assuming backend is running on localhost:8000
url = "http://localhost:8000/api/v1/analytics/traces/d6011781"
# We need to authentication usually, but let's try if we can hit it or if we Need a token.
# analytics endpoints usually require auth.

# I'll try to find a valid token or just use the python function directly via a script in the backend container context? 
# No, I can't easily run inside container.
# I will try to use the `uv media_agency.py` output to get a trace ID? 
# The user provided a trace ID in the screenshot: d6011781
# I will try to hit the endpoint. If I get 401, I will try to look for a token or Mock the dependency?
# Accessing via python shell in the backend directory is easier if I Mock the DB? 
# No, DB is in docker.

# Let's try to query ClickHouse directly using the existing backend code style.
import clickhouse_connect
# I need to connect to localhost clickhouse? Port 8123 is usually exposed?
# The docker-compose usually exposes it.

def check_trace():
    try:
        client = clickhouse_connect.get_client(
            host='localhost', 
            port=8123, 
            username='clickhouse', 
            password='clickhouse'
        )
        
        print("Checking recent observations...")
        
        obs_query = f"""
        SELECT 
            id, name, type, token_usage, total_cost, model, extra, metadata_json, start_time
        FROM observations
        WHERE type = 'score'
        ORDER BY start_time DESC
        LIMIT 10
        """
        
        result = client.query(obs_query)
        print("Observations Found:", len(result.result_rows))
        for row in result.result_rows:
            print("--- Observation ---")
            print(f"ID: {row[0]}")
            print(f"Name: {row[1]}")
            print(f"Type: {row[2]}")
            print(f"Time: {row[8]}")
            # print(f"Usage: {row[3]}")
            # print(f"Cost: {row[4]}")
            # print(f"Model: {row[5]}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_trace()
