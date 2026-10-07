#!/usr/bin/env bash
# Launcher for the Multi-Agent Streamlit Chat Application
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="${DIR}/backend/.venv/bin/python"

if [ ! -f "$PYTHON" ]; then
    echo "Using system python3"
    PYTHON="python3"
fi

export OBSERVIX_URL="${OBSERVIX_URL:-http://localhost:8010}"
export OBSERVIX_HOST="${OBSERVIX_HOST:-http://localhost:8010}"

echo "Starting Streamlit Multi-Agent Chat Application..."
echo "Open your browser at: http://localhost:8501"

"$PYTHON" -m streamlit run "${DIR}/agents/langgraph_multi_agent/app.py" --server.port=8501 --server.address=0.0.0.0
