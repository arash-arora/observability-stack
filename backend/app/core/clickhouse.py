import clickhouse_connect
import logging
import time
from app.core.config import settings

logger = logging.getLogger(__name__)

def get_clickhouse_client():
    client = clickhouse_connect.get_client(
        host=settings.CLICKHOUSE_HOST,
        port=settings.CLICKHOUSE_PORT,
        username=settings.CLICKHOUSE_USER,
        password=settings.CLICKHOUSE_PASSWORD
    )
    return client

def init_clickhouse():
    logger.info("Initializing ClickHouse tables...")
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            client = get_clickhouse_client()
            client.command("SELECT 1")  # connectivity check
            break
        except Exception as e:
            if attempt == max_retries:
                logger.error("ClickHouse connection failed after %d attempts: %s", max_retries, e)
                raise
            wait = 2 ** attempt
            logger.warning("ClickHouse connection attempt %d/%d failed, retrying in %ds...", attempt, max_retries, wait)
            time.sleep(wait)
            client = get_clickhouse_client()

    # Ensure tables exist with project_id
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
    TTL start_time + INTERVAL 90 DAY
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
    TTL start_time + INTERVAL 90 DAY
    """)

    # Create system_metrics table
    client.command("""
    CREATE TABLE IF NOT EXISTS system_metrics (
        project_id UUID,
        application_name String,
        metric_type Enum8(
            'LATENCY_P50' = 1, 'LATENCY_P95' = 2, 'LATENCY_P99' = 3,
            'THROUGHPUT_RPS' = 4, 'ERROR_RATE' = 5,
            'TOKEN_RATE' = 6, 'COST_RATE' = 7
        ),

        timestamp DateTime64(9),
        window_start DateTime64(9),
        window_end DateTime64(9),
        granularity Enum8('1MIN' = 1, '5MIN' = 2, '1HOUR' = 3, '1DAY' = 4),

        value Float64,
        count UInt64,

        model Nullable(String),
        user_id Nullable(String),
        metadata Map(String, String)
    ) ENGINE = MergeTree()
    PARTITION BY toYYYYMM(timestamp)
    ORDER BY (project_id, application_name, metric_type, timestamp)
    TTL timestamp + INTERVAL 90 DAY
    SETTINGS index_granularity = 8192
    """)

    # Create materialized views for auto-aggregation
    # Latency P95 (1-minute windows)
    client.command("""
    CREATE MATERIALIZED VIEW IF NOT EXISTS system_metrics_latency_p95_1min
    TO system_metrics
    AS SELECT
        project_id,
        if(application_name = '' OR application_name IS NULL, 'Unknown', application_name) as application_name,
        toStartOfMinute(start_time) as timestamp,
        toStartOfMinute(start_time) as window_start,
        toStartOfMinute(start_time) + INTERVAL 1 MINUTE as window_end,
        'LATENCY_P95' as metric_type,
        quantile(0.95)(duration_ms) as value,
        count() as count,
        '' as model,
        '' as user_id,
        '1MIN' as granularity,
        cast(map(), 'Map(String, String)') as metadata
    FROM traces
    WHERE (parent_span_id IS NULL OR parent_span_id = '')
    GROUP BY project_id, application_name, timestamp, window_start, window_end
    """)

    # Error Rate (1-minute windows)
    client.command("""
    CREATE MATERIALIZED VIEW IF NOT EXISTS system_metrics_error_rate_1min
    TO system_metrics
    AS SELECT
        project_id,
        if(application_name = '' OR application_name IS NULL, 'Unknown', application_name) as application_name,
        toStartOfMinute(start_time) as timestamp,
        toStartOfMinute(start_time) as window_start,
        toStartOfMinute(start_time) + INTERVAL 1 MINUTE as window_end,
        'ERROR_RATE' as metric_type,
        countIf(status_code = 'ERROR') / count() * 100 as value,
        count() as count,
        '' as model,
        '' as user_id,
        '1MIN' as granularity,
        cast(map(), 'Map(String, String)') as metadata
    FROM traces
    WHERE (parent_span_id IS NULL OR parent_span_id = '')
    GROUP BY project_id, application_name, timestamp, window_start, window_end
    """)

    # Throughput RPS
    client.command("""
    CREATE MATERIALIZED VIEW IF NOT EXISTS system_metrics_throughput_1min
    TO system_metrics
    AS SELECT
        project_id,
        if(application_name = '' OR application_name IS NULL, 'Unknown', application_name) as application_name,
        toStartOfMinute(start_time) as timestamp,
        toStartOfMinute(start_time) as window_start,
        toStartOfMinute(start_time) + INTERVAL 1 MINUTE as window_end,
        'THROUGHPUT_RPS' as metric_type,
        count() / 60 as value,
        count() as count,
        '' as model,
        '' as user_id,
        '1MIN' as granularity,
        cast(map(), 'Map(String, String)') as metadata
    FROM traces
    WHERE (parent_span_id IS NULL OR parent_span_id = '')
    GROUP BY project_id, application_name, timestamp, window_start, window_end
    """)

    logger.info("ClickHouse initialization complete")
