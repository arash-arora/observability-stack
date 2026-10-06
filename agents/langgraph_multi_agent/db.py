"""
SQLite3 Enterprise Database for Multi-Agent Workflow.
Stores cross-domain data for:
1. Margin-based usecase (different domain perspectives: Sales, IT, Marketing, Product, Finance)
2. Revenue / Sales Drivers usecase (different domain perspectives)
"""
import os
import sqlite3
from typing import Dict, Any, List, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "enterprise_data.db")


def get_db_connection() -> sqlite3.Connection:
    """Create and return a connection to the SQLite3 enterprise database with row dict access."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Initialize tables and seed dummy data for margin and revenue driver usecases."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Table 1: Domain Margins
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS domain_margins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quarter TEXT NOT NULL,
            domain TEXT NOT NULL,
            metric_name TEXT NOT NULL,
            metric_value TEXT NOT NULL,
            target_value TEXT NOT NULL,
            variance TEXT NOT NULL,
            perspective_summary TEXT NOT NULL,
            operational_drivers TEXT NOT NULL
        )
    """)

    # Table 2: Revenue Drivers
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS revenue_drivers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quarter TEXT NOT NULL,
            domain TEXT NOT NULL,
            driver_name TEXT NOT NULL,
            impact_amount TEXT NOT NULL,
            contribution_pct REAL NOT NULL,
            driver_category TEXT NOT NULL,
            perspective_details TEXT NOT NULL,
            evidence_kpis TEXT NOT NULL
        )
    """)

    # Table 3: Sales Performance
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sales_performance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quarter TEXT NOT NULL,
            revenue_actual TEXT NOT NULL,
            revenue_target TEXT NOT NULL,
            quota_attainment_pct REAL NOT NULL,
            growth_yoy_pct REAL NOT NULL,
            deals_closed INTEGER NOT NULL,
            average_deal_size TEXT NOT NULL,
            top_deal TEXT NOT NULL,
            pipeline_remaining TEXT NOT NULL,
            top_performing_region TEXT NOT NULL,
            win_rate_pct REAL NOT NULL
        )
    """)

    # Table 4: System Telemetry
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS system_telemetry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            service TEXT NOT NULL,
            status TEXT NOT NULL,
            p50_latency_ms REAL NOT NULL,
            p95_latency_ms REAL NOT NULL,
            p99_latency_ms REAL NOT NULL,
            error_rate_pct REAL NOT NULL,
            active_replicas INTEGER NOT NULL,
            db_engine TEXT NOT NULL,
            db_query_time_avg_ms REAL NOT NULL,
            db_table_queried TEXT NOT NULL,
            api_endpoint TEXT NOT NULL,
            cache_hit_ratio_pct REAL NOT NULL
        )
    """)

    # Table 5: Marketing Campaigns
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS marketing_campaigns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quarter TEXT NOT NULL,
            mql_generated INTEGER NOT NULL,
            sql_converted INTEGER NOT NULL,
            conversion_rate_pct REAL NOT NULL,
            cac_dollars INTEGER NOT NULL,
            blended_roas REAL NOT NULL,
            brand_impressions TEXT NOT NULL,
            customer_sentiment_score REAL NOT NULL,
            top_channels_json TEXT NOT NULL
        )
    """)

    # Table 6: Product Metrics
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS product_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            quarter TEXT NOT NULL,
            feature TEXT NOT NULL,
            monthly_active_users INTEGER NOT NULL,
            daily_active_users INTEGER NOT NULL,
            dau_mau_ratio REAL NOT NULL,
            feature_adoption_rate_pct REAL NOT NULL,
            retention_30d_pct REAL NOT NULL,
            churn_rate_pct REAL NOT NULL,
            csat_score REAL NOT NULL,
            time_to_value_minutes REAL NOT NULL,
            user_dropoff_points TEXT NOT NULL
        )
    """)

    # Check and seed each table
    cursor.execute("SELECT COUNT(*) AS cnt FROM domain_margins")
    if cursor.fetchone()["cnt"] == 0:
        _seed_domain_margins(cursor)

    cursor.execute("SELECT COUNT(*) AS cnt FROM revenue_drivers")
    if cursor.fetchone()["cnt"] == 0:
        _seed_revenue_drivers(cursor)

    cursor.execute("SELECT COUNT(*) AS cnt FROM sales_performance")
    if cursor.fetchone()["cnt"] == 0:
        _seed_sales_performance(cursor)

    cursor.execute("SELECT COUNT(*) AS cnt FROM system_telemetry")
    if cursor.fetchone()["cnt"] == 0:
        _seed_system_telemetry(cursor)

    cursor.execute("SELECT COUNT(*) AS cnt FROM marketing_campaigns")
    if cursor.fetchone()["cnt"] == 0:
        _seed_marketing_campaigns(cursor)

    cursor.execute("SELECT COUNT(*) AS cnt FROM product_metrics")
    if cursor.fetchone()["cnt"] == 0:
        _seed_product_metrics(cursor)

    conn.commit()
    conn.close()


def _seed_domain_margins(cursor: sqlite3.Cursor) -> None:
    """Seed dummy data for Margin-based usecase across 5 domain perspectives."""
    margin_records = [
        # 1. Sales Domain Perspective on Margin
        (
            "Q3 2026",
            "sales",
            "Deal Gross Margin",
            "74.2%",
            "72.0%",
            "+2.2%",
            "Sales evaluates margin through gross profitability per deal contract, balancing volume discounting against quota margin tiers.",
            "Software license deals closed at 81.5% margin; professional services closed at 32.0%. Capping non-standard discounts at 8.4% preserved $260,000 in net deal margin. Marquee $520K Global Logistics contract retained 76.5% margin."
        ),
        (
            "Q3 2026",
            "sales",
            "Net Deal Margin Contribution",
            "$3,598,700",
            "$3,240,000",
            "+11.1%",
            "Net margin dollar contribution generated by direct sales reps toward corporate quota.",
            "142 closed deals yielded $3.6M in direct gross margin. Rep commission accelerators were tied to transactions preserving >70% margin."
        ),

        # 2. IT / Engineering / Infrastructure Domain Perspective on Margin
        (
            "Q3 2026",
            "it",
            "Cloud Infrastructure COGS Ratio",
            "11.8%",
            "<14.0%",
            "-2.2% (Favorable)",
            "IT / Infrastructure views margin through hosting efficiency, server utilization, compute cost per query, and infrastructure overhead.",
            "PostgreSQL & ClickHouse table partitioning reduced average query duration to 14.8ms, slashing cloud CPU cycles by 31%. Kubernetes cluster auto-scaling and spot instances kept cloud hosting COGS to $572,300 across 6 cloud replicas."
        ),
        (
            "Q3 2026",
            "it",
            "Compute Cost Per Active User",
            "$0.042 / user-month",
            "$0.055",
            "-23.6% (Favorable)",
            "Marginal compute expense required to serve each active enterprise user session.",
            "Optimized caching (89.4% cache hit ratio) and query deduplication saved an estimated $142,000 in monthly database compute costs."
        ),

        # 3. Marketing Domain Perspective on Margin
        (
            "Q3 2026",
            "marketing",
            "Customer Acquisition Margin (LTV:CAC)",
            "4.6x",
            "3.5x",
            "+1.1x",
            "Marketing views margin through acquisition capital efficiency, payback velocity, and channel contribution yields.",
            "Blended CAC was held at $1,420 with an Enterprise LTV of $6,530. Organic Technical Blog inbound leads yielded 84.2% contribution margin vs 58.6% on paid LinkedIn ads. Blended payback period compressed to 7.2 months."
        ),
        (
            "Q3 2026",
            "marketing",
            "Channel Margin Yield",
            "84.2% (Inbound) / 58.6% (Paid)",
            "70.0% (Blended)",
            "+5.4% (Blended)",
            "Net contribution margin variance across customer acquisition funnels.",
            "High-intent organic search and developer documentation delivered 240 enterprise conversions at an ultra-low CAC of $780."
        ),

        # 4. Product Domain Perspective on Margin
        (
            "Q3 2026",
            "product",
            "Feature Module Gross Margin",
            "91.4%",
            "85.0%",
            "+6.4%",
            "Product views margin through product-led self-service, feature unit economics, and reducing support escalation burdens.",
            "The new quarterly reporting module runs primarily client-side with vectorized server batch queries, requiring negligible per-seat compute. Automated onboarding reduced Tier-2 human support tickets by 22%, saving $85,000 in support margin."
        ),
        (
            "Q3 2026",
            "product",
            "Self-Serve vs Enterprise Tier Margin",
            "89.2% (Self-Serve) vs 64.8% (Enterprise)",
            "75.0% (Blended)",
            "+2.8%",
            "Margin divergence between frictionless PLG tiers and high-touch dedicated enterprise tier.",
            "Self-serve tier achieved 89.2% margin due to automated billing and zero customer engineering overhead. Enterprise tier overhead was driven by dedicated VPC single-tenancy and custom compliance SLAs."
        ),

        # 5. Finance / Executive Perspective on Margin
        (
            "Q3 2026",
            "finance",
            "Overall Corporate Gross Margin",
            "68.4%",
            "65.0%",
            "+3.4%",
            "Executive and Finance perspective synthesizing blended corporate profitability, EBITDA health, and GAAP gross margin.",
            "Consolidated revenue of $4.85M against total COGS of $1.53M yielded 68.4% gross margin. Operating income reached $1.11M with an EBITDA margin of 28.5% (exceeding the 24.0% board target)."
        ),
    ]

    cursor.executemany("""
        INSERT INTO domain_margins (
            quarter, domain, metric_name, metric_value, target_value, variance, perspective_summary, operational_drivers
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, margin_records)


def _seed_revenue_drivers(cursor: sqlite3.Cursor) -> None:
    """Seed dummy data for Drivers causing Sales / Revenue across domain perspectives."""
    driver_records = [
        # 1. Sales Perspective on Revenue Drivers
        (
            "Q3 2026",
            "sales",
            "Marquee Enterprise Deal Execution",
            "$520,000",
            10.7,
            "Direct Contract Closing",
            "Sales attributes revenue performance to top-tier enterprise account closures and strategic multi-year license commitments.",
            "Closed Global Logistics Corp 3-year enterprise license in week 9. Average contract value rose to $34,154 across 142 closed deals."
        ),
        (
            "Q3 2026",
            "sales",
            "Regional Outperformance (North America)",
            "$2,650,000",
            54.6,
            "Territory Execution",
            "Territory quota attainment and high win-rate execution by enterprise account executives.",
            "North America achieved 118% of assigned quota with a 31.4% win rate, driven by financial services and logistics sector demand."
        ),
        (
            "Q3 2026",
            "sales",
            "Net Revenue Retention & Account Expansion",
            "$980,000",
            20.2,
            "Customer Expansion",
            "Existing accounts expanding seat counts and tier upgrades.",
            "114% Net Revenue Retention (NRR) generated $980,000 in expansion revenue from existing installed base without new acquisition overhead."
        ),

        # 2. Marketing Perspective on Revenue Drivers
        (
            "Q3 2026",
            "marketing",
            "High-Intent Inbound Funnel Velocity",
            "$1,420,000",
            29.3,
            "Demand Generation",
            "Marketing views revenue as the direct outcome of qualified pipeline creation, MQL-to-SQL velocity, and multi-touch nurturing.",
            "3,480 MQLs generated 612 SQLs (17.6% conversion rate). Technical inbound articles and documentation delivered 240 customer conversions."
        ),
        (
            "Q3 2026",
            "marketing",
            "Interactive Enterprise Product Webinars",
            "$1,850,000",
            38.1,
            "Event Attribution",
            "Targeted technical webinars for CTOs and VPs of Engineering accelerating deal velocity.",
            "195 sales-qualified opportunities attended quarterly live demo webinars, shortening average sales cycles from 62 days down to 44 days."
        ),
        (
            "Q3 2026",
            "marketing",
            "Brand Authority & Category Positioning",
            "$840,000",
            17.3,
            "Brand Awareness",
            "1.42M brand impressions across LinkedIn and tech publications driving high-trust direct inbound RFP invitations.",
            "Customer sentiment index reached 8.7/10, increasing organic enterprise demo requests by 34% YoY."
        ),

        # 3. IT / Technology Perspective on Revenue Drivers
        (
            "Q3 2026",
            "it",
            "Zero-Downtime High Availability (99.98% SLA)",
            "$340,000 (Preserved)",
            7.0,
            "Infrastructure Reliability",
            "IT considers system uptime, SLA adherence, and sub-second latency as the foundation enabling customer revenue transactions.",
            "Zero P0 outages during peak quarter-end closing weeks. 99.98% uptime and 0.02% error rate prevented transaction abandonment."
        ),
        (
            "Q3 2026",
            "it",
            "Sub-50ms API Latency & Query Optimization",
            "$620,000",
            12.8,
            "Platform Performance",
            "Optimized database partitions and low latency enabling real-time analytics dashboards required by tier-1 enterprise clients.",
            "API p50 latency maintained at 28.4ms and p95 at 112.6ms. Enterprise benchmark tests passed 100% of vendor latency audits."
        ),
        (
            "Q3 2026",
            "it",
            "Automated Enterprise SSO / SAML & SCIM Integration",
            "$780,000",
            16.1,
            "Security & Compliance",
            "Seamless identity provider integrations (Okta, Azure AD, Ping) unlocking Fortune 500 procurement approvals.",
            "Deployment onboarding time dropped from 14 days to 2 hours, accelerating contract sign-to-billing recognition by an average of 12 days."
        ),

        # 4. Product Perspective on Revenue Drivers
        (
            "Q3 2026",
            "product",
            "Advanced Quarterly Reporting Feature Adoption",
            "$480,000",
            9.9,
            "Feature-Led Expansion",
            "Product views revenue as driven by daily feature stickiness, user journey completion, and viral workspace invitations.",
            "76.5% feature adoption on quarterly reporting modules prompted 38 enterprise tier upsells within 45 days of feature release."
        ),
        (
            "Q3 2026",
            "product",
            "High Product Stickiness & Churn Defense",
            "$680,000 (Preserved)",
            14.0,
            "Retention Economics",
            "Strong 30-day cohort retention (88.2%) and DAU/MAU ratio (42.9%) defending against recurring subscription churn.",
            "Monthly customer churn dropped to a historic low of 1.4%, preserving $680,000 in annual recurring subscription revenue."
        ),
        (
            "Q3 2026",
            "product",
            "Product-Led Growth (PLG) Viral User Invitations",
            "$420,000",
            8.7,
            "Organic Product Expansion",
            "In-app team collaboration and shared dashboard links driving peer seat expansions.",
            "410 organic internal enterprise user invites were initiated directly from the report export modal without direct sales rep outreach."
        ),
    ]

    cursor.executemany("""
        INSERT INTO revenue_drivers (
            quarter, domain, driver_name, impact_amount, contribution_pct, driver_category, perspective_details, evidence_kpis
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, driver_records)


def get_margin_records(domain: Optional[str] = None, quarter: str = "Q3 2026") -> List[Dict[str, Any]]:
    """Retrieve margin records from SQLite3 for a specific domain or all domains."""
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()

    if domain and domain.lower() not in ("all", "default"):
        cursor.execute(
            "SELECT * FROM domain_margins WHERE LOWER(domain) = ? AND quarter = ?",
            (domain.lower(), quarter),
        )
    else:
        cursor.execute("SELECT * FROM domain_margins WHERE quarter = ?", (quarter,))

    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def get_revenue_driver_records(domain: Optional[str] = None, quarter: str = "Q3 2026") -> List[Dict[str, Any]]:
    """Retrieve revenue driver records from SQLite3 for a specific domain or all domains."""
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()

    if domain and domain.lower() not in ("all", "default"):
        cursor.execute(
            "SELECT * FROM revenue_drivers WHERE LOWER(domain) = ? AND quarter = ?",
            (domain.lower(), quarter),
        )
    else:
        cursor.execute("SELECT * FROM revenue_drivers WHERE quarter = ?", (quarter,))

    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def _seed_sales_performance(cursor: sqlite3.Cursor) -> None:
    """Seed data for Sales Performance in Q3 2026."""
    cursor.execute("""
        INSERT INTO sales_performance (
            quarter, revenue_actual, revenue_target, quota_attainment_pct,
            growth_yoy_pct, deals_closed, average_deal_size, top_deal,
            pipeline_remaining, top_performing_region, win_rate_pct
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "Q3 2026", "$4,850,000", "$4,500,000", 107.8,
        24.3, 142, "$34,154", "Global Logistics Corp Enterprise License ($520,000)",
        "$8,200,000", "North America (118% quota)", 31.4
    ))


def _seed_system_telemetry(cursor: sqlite3.Cursor) -> None:
    """Seed data for System Telemetry & Infrastructure Performance."""
    cursor.execute("""
        INSERT INTO system_telemetry (
            service, status, p50_latency_ms, p95_latency_ms, p99_latency_ms,
            error_rate_pct, active_replicas, db_engine, db_query_time_avg_ms,
            db_table_queried, api_endpoint, cache_hit_ratio_pct
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "core-sales-service", "healthy", 28.4, 112.6, 245.1,
        0.02, 6, "PostgreSQL 16.2 / ClickHouse 24.3", 14.8,
        "enterprise_orders_partition_2026_q3", "GET /api/v2/analytics/quarterly-metrics", 89.4
    ))


def _seed_marketing_campaigns(cursor: sqlite3.Cursor) -> None:
    """Seed data for Marketing Campaigns & Customer Acquisition."""
    import json
    channels = [
        {"channel": "Inbound Organic / Technical Blog", "conversions": 240, "cac": "$780", "contribution_margin": "84.2%"},
        {"channel": "Enterprise Product Webinars", "conversions": 195, "cac": "$1,120", "contribution_margin": "72.1%"},
        {"channel": "Paid Search & LinkedIn Ads", "conversions": 177, "cac": "$2,240", "contribution_margin": "58.6%"}
    ]
    cursor.execute("""
        INSERT INTO marketing_campaigns (
            quarter, mql_generated, sql_converted, conversion_rate_pct,
            cac_dollars, blended_roas, brand_impressions, customer_sentiment_score,
            top_channels_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "Q3 2026", 3480, 612, 17.6,
        1420, 3.8, "1.42M", 8.7, json.dumps(channels)
    ))


def _seed_product_metrics(cursor: sqlite3.Cursor) -> None:
    """Seed data for Product Metrics & Feature Adoption."""
    cursor.execute("""
        INSERT INTO product_metrics (
            quarter, feature, monthly_active_users, daily_active_users,
            dau_mau_ratio, feature_adoption_rate_pct, retention_30d_pct,
            churn_rate_pct, csat_score, time_to_value_minutes, user_dropoff_points
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "Q3 2026", "quarterly_reporting", 18450, 7920,
        0.429, 76.5, 88.2,
        1.4, 4.6, 8.2, "complex SQL custom export modal (11% dropoff)"
    ))


def get_sales_records(quarter: str = "Q3 2026") -> Dict[str, Any]:
    """Retrieve sales performance metrics directly from SQLite3 database."""
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sales_performance WHERE quarter = ? LIMIT 1", (quarter,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return {
        "quarter": quarter,
        "revenue_actual": "$4,850,000",
        "revenue_target": "$4,500,000",
        "quota_attainment_pct": 107.8,
        "growth_yoy_pct": 24.3,
        "deals_closed": 142,
        "average_deal_size": "$34,154",
        "top_deal": "Global Logistics Corp Enterprise License ($520,000)",
        "pipeline_remaining": "$8,200,000",
        "top_performing_region": "North America (118% quota)",
        "win_rate_pct": 31.4,
    }


def get_telemetry_records(service: str = "core-sales-service") -> Dict[str, Any]:
    """Retrieve system telemetry and query metrics directly from SQLite3 database."""
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM system_telemetry WHERE service = ? LIMIT 1", (service,))
    row = cursor.fetchone()
    conn.close()
    if row:
        d = dict(row)
        d["database"] = {
            "engine": d.get("db_engine", "PostgreSQL 16.2 / ClickHouse 24.3"),
            "query_time_avg_ms": d.get("db_query_time_avg_ms", 14.8),
            "table_queried": d.get("db_table_queried", "enterprise_orders_partition_2026_q3"),
            "schema_version": "v3.1.2",
            "indexes_used": ["idx_quarter_status_amount", "idx_org_timestamp"],
        }
        return d
    return {
        "status": "healthy",
        "service": service,
        "p50_latency_ms": 28.4,
        "p95_latency_ms": 112.6,
        "p99_latency_ms": 245.1,
        "error_rate_pct": 0.02,
        "active_replicas": 6,
        "database": {
            "engine": "PostgreSQL 16.2 / ClickHouse 24.3",
            "query_time_avg_ms": 14.8,
            "table_queried": "enterprise_orders_partition_2026_q3",
            "schema_version": "v3.1.2",
            "indexes_used": ["idx_quarter_status_amount", "idx_org_timestamp"],
        },
        "api_endpoint": "GET /api/v2/analytics/quarterly-metrics",
        "cache_hit_ratio_pct": 89.4,
    }


def get_marketing_records(quarter: str = "Q3 2026") -> Dict[str, Any]:
    """Retrieve marketing campaign metrics directly from SQLite3 database."""
    import json
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM marketing_campaigns WHERE quarter = ? LIMIT 1", (quarter,))
    row = cursor.fetchone()
    conn.close()
    if row:
        d = dict(row)
        try:
            d["top_acquisition_channels"] = json.loads(d.get("top_channels_json", "[]"))
        except Exception:
            d["top_acquisition_channels"] = []
        return d
    return {
        "status": "success",
        "quarter": quarter,
        "mql_generated": 3480,
        "sql_converted": 612,
        "cac_dollars": 1420,
        "blended_roas": 3.8,
        "brand_impressions": "1.4M",
        "customer_sentiment_score": 8.7,
        "top_acquisition_channels": [
            {"channel": "Inbound Organic / Technical Blog", "conversions": 240, "cac": "$780"},
            {"channel": "Enterprise Product Webinars", "conversions": 195, "cac": "$1,120"},
            {"channel": "Paid Search & LinkedIn Ads", "conversions": 177, "cac": "$2,240"},
        ],
    }


def get_product_records(feature: str = "quarterly_reporting", quarter: str = "Q3 2026") -> Dict[str, Any]:
    """Retrieve product metrics directly from SQLite3 database."""
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM product_metrics WHERE feature = ? AND quarter = ? LIMIT 1", (feature, quarter))
    row = cursor.fetchone()
    conn.close()
    if row:
        d = dict(row)
        dropoff = d.get("user_dropoff_points", "")
        d["user_dropoff_points"] = [dropoff] if dropoff else []
        return d
    return {
        "status": "success",
        "feature": feature,
        "monthly_active_users": 18450,
        "daily_active_users": 7920,
        "dau_mau_ratio": 0.429,
        "feature_adoption_rate_pct": 76.5,
        "30d_retention_rate_pct": 88.2,
        "churn_rate_pct": 1.4,
        "csat_score": 4.6,
        "average_time_to_value_minutes": 8.2,
        "user_dropoff_points": ["complex SQL custom export modal (11% dropoff)"],
    }


def query_enterprise_db(sql: str, params: tuple = ()) -> List[Dict[str, Any]]:
    """Execute arbitrary read-only SQL query against the enterprise SQLite database."""
    init_db()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(sql, params)
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


# Ensure database and seed data are initialized upon module load
init_db()
