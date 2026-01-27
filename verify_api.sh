#!/bin/bash

BASE_URL="http://localhost:8000/api/v1"
echo "Verifying API endpoints at $BASE_URL..."

# 0. Auth
echo "Signing up test user..."
curl -s -X POST "$BASE_URL/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email": "testuser@example.com", "password": "password123", "full_name": "Test User"}'

echo "Logging in..."
TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=testuser@example.com&password=password123" | jq -r .access_token)
echo "Token: $TOKEN"

# 1. Tools
echo "Creating Tool..."
TOOL_ID=$(curl -s -X POST "$BASE_URL/tools/" \
  -H "Content-Type: application/json" \
  -d '{"name": "test_tool", "description": "A test tool", "type": "custom", "configuration": {"key": "value"}}' | jq -r .id)
echo "Tool ID: $TOOL_ID"

echo "Listing Tools..."
curl -s "$BASE_URL/tools/" | jq .

# 1.5 Create Dummy Provider (for Agent)
echo "Creating Dummy Provider..."
PROJECT_ID="d637956a-1234-4567-8901-234567890123" # Dummy UUID
PROVIDER_ID=$(curl -s -X POST "$BASE_URL/management/providers/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "test_provider",
    "provider": "openai",
    "model_name": "gpt-4o",
    "api_key": "sk-dummy",
    "project_id": "'"$PROJECT_ID"'"
  }' | jq -r .id)
echo "Provider ID: $PROVIDER_ID"

# 2. Agents
echo "Creating Agent..."
AGENT_RESPONSE=$(curl -s -X POST "$BASE_URL/agents/" \
  -H "Content-Type: application/json" \
  -d '{
  "name": "test_agent", 
  "description": "A test agent",
  "model_config_id": "'"$PROVIDER_ID"'",
  "instruction": "You are a test agent.",
  "input_key": "input",
  "output_key": "output",
  "tool_ids": ["'"$TOOL_ID"'"]
}')
echo "Agent Response: $AGENT_RESPONSE"

AGENT_ID=$(echo $AGENT_RESPONSE | jq -r .id)
echo "Agent ID: $AGENT_ID"

echo "Listing Agents..."
curl -s "$BASE_URL/agents/" | jq .

# 3. Workflows
echo "Creating Workflow..."
# Construct simple graph: Start -> Agent -> End
# React Flow format
GRAPH_DATA=$(cat <<EOF
{
  "nodes": [
    {"id": "node-1", "type": "start", "position": {"x": 0, "y": 0}, "data": {"label": "Start"}},
    {"id": "node-2", "type": "agent", "position": {"x": 100, "y": 0}, "data": {"label": "My Agent", "id": "$AGENT_ID"}},
    {"id": "node-3", "type": "end", "position": {"x": 200, "y": 0}, "data": {"label": "End"}}
  ],
  "edges": [
    {"id": "edge-1", "source": "node-1", "target": "node-2"},
    {"id": "edge-2", "source": "node-2", "target": "node-3"}
  ]
}
EOF
)

WORKFLOW_ID=$(curl -s -X POST "$BASE_URL/workflows/" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"test_workflow\", \"description\": \"A test workflow\", \"graph_data\": $GRAPH_DATA}" | jq -r .id)
echo "Workflow ID: $WORKFLOW_ID"

echo "Listing Workflows..."
curl -s "$BASE_URL/workflows/" | jq .

# 4. Run (New)
echo "Running Workflow..."
curl -s -X POST "$BASE_URL/workflows/$WORKFLOW_ID/run" \
  -H "Content-Type: application/json" \
  -d '{"input": "Hello from verify script"}' | jq .

# 5. Export
echo "Exporting Workflow..."
EXPORT_CODE=$(curl -s -X POST "$BASE_URL/workflows/$WORKFLOW_ID/export" | jq -r .code)
echo "---------------- EXPORTED CODE ----------------"
echo "$EXPORT_CODE"
echo "-----------------------------------------------"

# Cleanup
echo "Cleaning up..."
curl -s -X DELETE "$BASE_URL/workflows/$WORKFLOW_ID" > /dev/null
curl -s -X DELETE "$BASE_URL/agents/$AGENT_ID" > /dev/null
curl -s -X DELETE "$BASE_URL/tools/$TOOL_ID" > /dev/null

echo "Verification Complete."
