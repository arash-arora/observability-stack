import clickhouse_connect
from app.core.config import settings

def get_clickhouse_client():
    client = clickhouse_connect.get_client(
        host=settings.CLICKHOUSE_HOST,
        port=settings.CLICKHOUSE_PORT,
        username=settings.CLICKHOUSE_USER,
        password=settings.CLICKHOUSE_PASSWORD
    )
    return client

def init_clickhouse():
    print("[Backend] Initializing ClickHouse tables...")
    client = get_clickhouse_client()
    # Ensure tables exist with project_id
    # We might want to do this more robustly with migration scripts, but for now:
    client.command("""
    CREATE TABLE IF NOT EXISTS traces (
        trace_id String,
        span_id String,
        parent_span_id Nullable(String),
        name String,
        kind String,
        start_time DateTime64(9),
        end_time DateTime64(9),
        status_code String,
        status_message Nullable(String),
        attributes Map(String, String),
        events String,
        links String,
        resource_attributes Map(String, String),
        duration_ms Float64,
        project_id UUID,
        user_id Nullable(String),
        application_name Nullable(String)
    ) ENGINE = MergeTree()
    ORDER BY (project_id, start_time)
    """)

    client.command("""
    CREATE TABLE IF NOT EXISTS observations (
        id UInt64,
        trace_id String,
        parent_observation_id Nullable(UInt64),
        name Nullable(String),
        type String,
        model Nullable(String),
        start_time DateTime64(9),
        end_time DateTime64(9),
        input_text Nullable(String),
        output_text Nullable(String),
        token_usage Nullable(String),
        model_parameters Nullable(String),
        metadata_json Nullable(String),
        extra Nullable(String),
        observation_type Nullable(String),
        error Nullable(String),
        total_cost Nullable(Float64),
        created_at DateTime64(9),
        project_id UUID,
        user_id Nullable(String)
    ) ENGINE = MergeTree()
    ORDER BY (project_id, start_time)
    """)
    print("[Backend] ClickHouse initialization complete.")
