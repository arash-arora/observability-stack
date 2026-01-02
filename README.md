# Observability App

A full-stack observability platform including a backend, frontend dashboard, and Python SDK.

## Structure

- **backend/**: FastAPI application handling data ingestion and serving APIs.
- **frontend/**: Next.js dashboard for visualizing traces and metrics.
- **obs-sdk/**: Python SDK for auto-instrumenting applications.

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Make (optional)

### Running with Docker

The easiest way to run the entire stack is with Docker Compose:

```bash
make up
# OR
docker compose up -d
```

This will start:
- Frontend at [http://localhost:3000](http://localhost:3000)
- Backend at [http://localhost:8000](http://localhost:8000)
- Postgres at `localhost:5432`
- ClickHouse at `localhost:8123`

### Local Development

To install dependencies for all services locally:

```bash
make install
```

#### Backend

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

#### SDK

```bash
cd obs-sdk
uv sync
```
