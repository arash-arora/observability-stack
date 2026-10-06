"""
Domain Tools for Multi-Agent Enterprise Operations.
Instrumented automatically via Observix (@observe with as_tool=True).
"""
from typing import Dict, Any, Optional, List

try:
    from observix import observe
except ImportError:
    def observe(*dargs: Any, **dkwargs: Any):
        """No-op decorator fallback when observix SDK is not installed."""
        def decorator(fn):
            return fn
        if len(dargs) == 1 and callable(dargs[0]) and not dkwargs:
            return dargs[0]
        return decorator

from agents.langgraph_multi_agent.db import (
    get_margin_records,
    get_revenue_driver_records,
    get_sales_records,
    get_telemetry_records,
    get_marketing_records,
    get_product_records,
)


@observe(name="query_sales_data", as_tool=True)
def query_sales_data(
    quarter: str = "Q3 2026",
    **kwargs: Any,
) -> Dict[str, Any]:
    """Retrieve quarterly commercial performance, revenue, quota, and sales metrics from SQLite3."""
    res = get_sales_records(quarter=quarter)
    res["status"] = "success"
    return res


@observe(name="query_system_telemetry", as_tool=True)
def query_system_telemetry(
    service: str = "core-sales-service",
    **kwargs: Any,
) -> Dict[str, Any]:
    """Retrieve technical infrastructure telemetry, latencies, schemas, and query performance from SQLite3."""
    return get_telemetry_records(service=service)


@observe(name="query_marketing_campaigns", as_tool=True)
def query_marketing_campaigns(
    quarter: str = "Q3 2026",
    **kwargs: Any,
) -> Dict[str, Any]:
    """Retrieve marketing campaign ROI, lead acquisition channels, and brand reach metrics from SQLite3."""
    return get_marketing_records(quarter=quarter)


@observe(name="query_product_metrics", as_tool=True)
def query_product_metrics(
    feature: str = "quarterly_reporting",
    **kwargs: Any,
) -> Dict[str, Any]:
    """Retrieve product usage metrics, feature adoption, user journey completion, and retention from SQLite3."""
    return get_product_records(feature=feature)


@observe(name="query_domain_margins", as_tool=True)
def query_domain_margins(
    domain: str = "all",
    quarter: str = "Q3 2026",
    **kwargs: Any,
) -> Dict[str, Any]:
    """
    Retrieve margin metrics and domain-specific perspectives from the SQLite3 database
    (domain_margins table) across Sales, IT, Marketing, Product, and Finance.
    """
    records = get_margin_records(domain=domain, quarter=quarter)
    return {
        "status": "success",
        "source": "sqlite3:enterprise_data.db:domain_margins",
        "quarter": quarter,
        "domain_filter": domain,
        "record_count": len(records),
        "records": records,
    }


@observe(name="query_revenue_drivers", as_tool=True)
def query_revenue_drivers(
    domain: str = "all",
    quarter: str = "Q3 2026",
    **kwargs: Any,
) -> Dict[str, Any]:
    """
    Retrieve drivers causing sales and revenue growth from the SQLite3 database
    (revenue_drivers table) across Sales, IT, Marketing, and Product perspectives.
    """
    records = get_revenue_driver_records(domain=domain, quarter=quarter)
    return {
        "status": "success",
        "source": "sqlite3:enterprise_data.db:revenue_drivers",
        "quarter": quarter,
        "domain_filter": domain,
        "record_count": len(records),
        "records": records,
    }
