"""
Domain Tools for Multi-Agent Enterprise Operations — Lululemon Athletica.
Instrumented automatically via Observix (@observe with as_tool=True).

Operates strictly on the 4 Core Tables:
1. Table 1: product_list
2. Table 2: sales_data
3. Table 3: marketing_data
4. Table 4: dev_data
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
    get_product_list_records,
    get_sales_data_records,
    get_marketing_data_records,
    get_dev_data_records,
    get_most_viewed_products,
    get_margin_records,
    get_revenue_driver_records,
    query_enterprise_db,
)


@observe(name="query_product_list", as_tool=True)
def query_product_list(
    category: Optional[str] = None,
    sub_category: Optional[str] = None,
    is_active: Optional[int] = None,
    **kwargs: Any,
) -> Dict[str, Any]:
    """
    Retrieve Table 1 (product_list): product_id, product_name, cost_price, selling_price,
    year_added, is_active, category, sub_category, and calculated unit_gross_margin_pct.
    """
    records = get_product_list_records(category=category, sub_category=sub_category, is_active=is_active)
    return {
        "status": "success",
        "source": "sqlite3:enterprise_data.db:product_list",
        "table": "product_list",
        "filter_category": category,
        "record_count": len(records),
        "records": records,
    }


@observe(name="query_sales_data", as_tool=True)
def query_sales_data(
    product_id: Optional[str] = None,
    **kwargs: Any,
) -> Dict[str, Any]:
    """
    Retrieve Table 2 (sales_data): product_id, total_sales, quarter_wise_sales, profit, traffic,
    joined with product_list for product_name, category, and conversion_rate_pct.
    """
    records = get_sales_data_records(product_id=product_id)
    total_profit = sum(r.get("profit", 0) for r in records)
    total_units = sum(r.get("total_sales", 0) for r in records)
    total_traffic = sum(r.get("traffic", 0) for r in records)
    return {
        "status": "success",
        "source": "sqlite3:enterprise_data.db:sales_data",
        "table": "sales_data",
        "product_id_filter": product_id,
        "record_count": len(records),
        "total_units_sold": total_units,
        "total_profit": f"${total_profit:,.2f}",
        "total_traffic": total_traffic,
        "records": records,
    }


@observe(name="query_marketing_data", as_tool=True)
def query_marketing_data(
    product_id: Optional[str] = None,
    querter: Optional[str] = None,
    **kwargs: Any,
) -> Dict[str, Any]:
    """
    Retrieve Table 3 (marketing_data): product_id, click_through_rate, ad_budget, views,
    likes, is_active, querter, joined with product_list for product_name and engagement rates.
    """
    records = get_marketing_data_records(product_id=product_id, querter=querter)
    total_ad_budget = sum(r.get("ad_budget", 0) for r in records)
    total_views = sum(r.get("views", 0) for r in records)
    total_likes = sum(r.get("likes", 0) for r in records)
    avg_ctr = round(sum(r.get("click_through_rate", 0) for r in records) / len(records), 2) if records else 0.0
    return {
        "status": "success",
        "source": "sqlite3:enterprise_data.db:marketing_data",
        "table": "marketing_data",
        "record_count": len(records),
        "total_ad_budget": f"${total_ad_budget:,.2f}",
        "total_views": total_views,
        "total_likes": total_likes,
        "average_ctr_pct": f"{avg_ctr}%",
        "records": records,
    }


@observe(name="query_dev_data", as_tool=True)
def query_dev_data(
    time_range: Optional[str] = None,
    **kwargs: Any,
) -> Dict[str, Any]:
    """
    Retrieve Table 4 (dev_data): latency, downtime_hours, time_range, cache_hit, cache_failure,
    llm_tokens_used, llm_cost, product_wise_click_throughs (to find out most viewed products).
    """
    dev_record = get_dev_data_records(time_range=time_range)
    most_viewed = get_most_viewed_products(limit=5)
    return {
        "status": "success",
        "source": "sqlite3:enterprise_data.db:dev_data",
        "table": "dev_data",
        "time_range": dev_record.get("time_range"),
        "latency_ms": dev_record.get("latency"),
        "downtime_hours": dev_record.get("downtime_hours"),
        "cache_hit": dev_record.get("cache_hit"),
        "cache_failure": dev_record.get("cache_failure"),
        "cache_hit_ratio_pct": dev_record.get("cache_hit_ratio_pct"),
        "llm_tokens_used": dev_record.get("llm_tokens_used"),
        "llm_cost_dollars": dev_record.get("llm_cost"),
        "most_viewed_products": most_viewed,
        "product_wise_click_throughs": dev_record.get("product_wise_click_throughs", {}),
    }


@observe(name="query_most_viewed_products", as_tool=True)
def query_most_viewed_products(
    limit: int = 5,
    **kwargs: Any,
) -> Dict[str, Any]:
    """
    Find out the most viewed products using product_wise_click_throughs from Table 4 (dev_data)
    joined with Table 1 (product_list).
    """
    most_viewed = get_most_viewed_products(limit=limit)
    return {
        "status": "success",
        "source": "sqlite3:enterprise_data.db:dev_data.product_wise_click_throughs",
        "limit": limit,
        "most_viewed_products": most_viewed,
    }


@observe(name="query_domain_margins", as_tool=True)
def query_domain_margins(
    domain: str = "all",
    quarter: str = "Q3 2026",
    **kwargs: Any,
) -> Dict[str, Any]:
    """
    Retrieve apparel margin metrics computed directly from Table 1 (product_list)
    and Table 2 (sales_data).
    """
    records = get_margin_records(domain=domain, quarter=quarter)
    return {
        "status": "success",
        "source": "computed:product_list+sales_data",
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
    Retrieve catalysts of sales and revenue growth computed directly from Table 2 (sales_data)
    and Table 1 (product_list).
    """
    records = get_revenue_driver_records(domain=domain, quarter=quarter)
    return {
        "status": "success",
        "source": "computed:sales_data+product_list",
        "quarter": quarter,
        "domain_filter": domain,
        "record_count": len(records),
        "records": records,
    }
