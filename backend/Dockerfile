FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1

# Copy dependency metadata first (for caching)
COPY pyproject.toml uv.lock ./

# Copy observix before sync (needed for path dependency)
COPY observix ./observix

# Install dependencies (NO pip, NO editable)
RUN uv sync --frozen --no-dev --no-install-project

# Copy application code
COPY app ./app
COPY README.md ./

# Final stage
FROM python:3.12-slim-bookworm

WORKDIR /app

COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/app ./app
COPY --from=builder /app/observix ./observix

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONPATH="/app"

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
