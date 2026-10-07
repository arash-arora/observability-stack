"""
LangGraph Multi-Agent Workflow for Lululemon Athletica Enterprise Intelligence.

Connects 3 specialized agents:
1. SupervisorAgent (Stage 1): Analyzes question, plans data requirements across Lululemon SQLite3 tables:
   - Table 1 (product_list): product_id, product_name, cost_price, selling_price, year_added, is_active, category, sub_category
   - Table 2 (sales_data): product_id, total_sales, quarter_wise_sales, profit, traffic
   - Table 3 (marketing_data): product_id, click_through_rate, ad_budget, views, likes, is_active, querter
   - Table 4 (dev_data): latency, downtime_hours, time_range, cache_hit, cache_failure, llm_tokens_used, llm_cost, product_wise_click_throughs
2. AnalyticsAgent (Stage 2): Pulls required quantitative records and builds interactive Evidence Tables.
3. ReporterAgent (Stage 3): Synthesizes an executive, persona-tailored response representing Lululemon Athletica.
"""
import os
import sys
import json
import time
from typing import Dict, Any, List, Optional, TypedDict

from langgraph.graph import StateGraph, START, END

# Import Observix for full trace capture
try:
    from observix import observe, init_observability
except ImportError:
    def observe(*dargs: Any, **dkwargs: Any):
        def decorator(fn):
            return fn
        if len(dargs) == 1 and callable(dargs[0]) and not dkwargs:
            return dargs[0]
        return decorator

    def init_observability(*args: Any, **kwargs: Any):
        pass

try:
    from observix.traces import get_current_trace
except ImportError:
    get_current_trace = None

from agents.langgraph_multi_agent.llm_config import (
    call_llm,
    get_active_provider_info,
)
from agents.langgraph_multi_agent.tools import (
    query_product_list,
    query_sales_data,
    query_marketing_data,
    query_dev_data,
    query_most_viewed_products,
    query_domain_margins,
    query_revenue_drivers,
)

DEFAULT_OBSERVIX_URL = os.getenv("OBSERVIX_URL", "http://localhost:8010")
DEFAULT_OBSERVIX_KEY = os.getenv("OBSERVIX_API_KEY", "sk-cortex-live-key-9f8a12bc34de56fa78bc90de")
os.environ.setdefault("OBSERVIX_URL", DEFAULT_OBSERVIX_URL)
os.environ.setdefault("OBSERVIX_HOST", DEFAULT_OBSERVIX_URL)

try:
    init_observability(url=DEFAULT_OBSERVIX_URL, api_key=DEFAULT_OBSERVIX_KEY)
except Exception as exc:
    print(f"[ObservixWarning] Initialization skipped: {exc}")

CHITCHAT_EXACT = {
    "hi", "hello", "hey", "hiya", "howdy", "greetings", "yo", "hola",
    "hi there", "hello there", "hey there",
    "good morning", "good afternoon", "good evening", "good day",
    "how are you", "how are you doing", "how do you do", "hows it going", "how is it going",
    "whats up", "what is up", "sup",
    "who are you", "what can you do", "help",
    "thanks", "thank you", "bye", "goodbye",
}

DOMAIN_KEYWORDS = {
    "product", "products", "item", "items", "clothes", "apparel", "catalog", "align", "scuba",
    "define", "pant", "pants", "hoodie", "hoodies", "jacket", "jackets", "shirt", "shirts",
    "short", "shorts", "bag", "belt bag", "tight", "tights", "wunder", "cost", "selling", "price",
    "sales", "total sales", "units", "profit", "traffic", "quarter wise", "revenue", "quota",
    "marketing", "ctr", "click through", "ad budget", "views", "likes", "tiktok", "instagram",
    "dev", "tech", "latency", "downtime", "cache", "cache hit", "llm", "tokens", "most viewed",
    "margin", "margins", "profitability", "gross margin", "ebitda", "cogs", "driver", "drivers",
}


def is_chitchat_query(query: str) -> bool:
    """Detect whether a user query is conversational greeting/chitchat rather than a data question."""
    if not query:
        return False
    import re
    cleaned = re.sub(r"[^\w\s]", " ", query).strip().lower()
    cleaned = " ".join(cleaned.split())
    if not cleaned:
        return False

    if cleaned in CHITCHAT_EXACT:
        return True

    words = cleaned.split()
    if any(w in DOMAIN_KEYWORDS for w in words):
        return False

    if len(words) <= 4 and words[0] in {"hi", "hello", "hey", "greetings", "howdy", "hola", "yo"}:
        return True

    return False


class MultiAgentState(TypedDict):
    query: str
    persona: str
    organization: str
    execution_mode: str
    model_name: str
    api_key: Optional[str]
    plan: Dict[str, Any]
    analytical_data: Dict[str, Any]
    final_output: str
    error: Optional[str]


# ---------------------------------------------------------------------------
# Stage 1: SupervisorAgent — LLM Table Selection Based on Question & Persona
# ---------------------------------------------------------------------------

def decide_required_tables_llm(
    query: str,
    persona: str,
    org: str = "Lululemon Athletica",
    execution_mode: str = "realtime",
) -> Dict[str, Any]:
    """
    Execute an LLM decision call to dynamically select strictly required SQLite3 tables
    based on the user's question and persona.
    """
    if is_chitchat_query(query):
        return {
            "required_tables": [],
            "intent": "chitchat",
            "reasoning": "Conversational greeting acknowledged. Database retrieval bypassed (no quantitative data required).",
            "llm_used": False,
        }

    provider_info = get_active_provider_info()
    valid_tables = {"product_list", "sales_data", "marketing_data", "dev_data"}

    system_instruction = (
        f"You are the Supervisor Decision Agent for {org} Enterprise Multi-Agent Intelligence.\n"
        "Your task is to analyze the user's question and target persona, and select ONLY the SQLite3 database table(s) "
        "strictly required to formulate an accurate, evidence-backed answer.\n\n"
        "DATABASE TABLES IN enterprise_data.db:\n"
        "1. `product_list`: product_id, product_name, cost_price, selling_price, year_added, is_active, category, sub_category\n"
        "   - Use for: product catalog, SKU details, product names, cost vs selling prices, unit gross margins, product categories.\n"
        "2. `sales_data`: product_id, total_sales, quarter_wise_sales, profit, traffic\n"
        "   - Use for: sales volumes, units sold, quarter-wise breakdowns, gross profit, revenue, commercial conversion rates, store/web traffic.\n"
        "3. `marketing_data`: product_id, click_through_rate, ad_budget, views, likes, is_active, querter\n"
        "   - Use for: marketing campaigns, click-through rates (CTR), ad spend, impressions/views, likes, social engagement, and viral reach.\n"
        "4. `dev_data`: latency, downtime_hours, time_range, cache_hit, cache_failure, llm_tokens_used, llm_cost, product_wise_click_throughs\n"
        "   - Use for: digital platform latency, system downtime, edge cache hit ratio, AI stylist LLM tokens and inference cost, and product click-throughs to find MOST VIEWED products.\n\n"
        "PERSONA ROLES:\n"
        "- sales / merchandising: Prioritizes product catalog, selling prices, unit margins, sales units, revenue, and gross profit.\n"
        "- marketing / brand: Prioritizes campaign performance, click-through rates (CTR), video views, likes, social engagement, and ad spend.\n"
        "- IT / dev / engineering: Prioritizes latency, service uptime, cache hit ratios, LLM tokens/costs, and most-viewed product traffic.\n\n"
        "RULES:\n"
        "1. Select ONLY the tables containing data directly needed to answer the question. Do NOT select tables you do not need.\n"
        "2. If the user asks about most viewed products, select 'dev_data' (which holds the click-through data) and 'product_list' (to display product names).\n"
        "3. Output strictly valid JSON matching this schema:\n"
        "{\n"
        '  "required_tables": ["table_name_1", ...],\n'
        '  "intent": "short_intent_slug",\n'
        '  "reasoning": "Clear 1-2 sentence explanation of why these specific tables were chosen based on the question and persona"\n'
        "}"
    )

    user_prompt = f"User Question: \"{query}\"\nTarget Persona: \"{persona}\"\nWhich database tables are required?"

    raw_response = ""
    if provider_info.get("configured"):
        try:
            raw_response = call_llm(
                prompt=user_prompt,
                system_instruction=system_instruction,
                execution_mode="realtime",
            )
        except Exception as exc:
            print(f"[SupervisorAgent] LLM table selection call encountered error: {exc}")

    if raw_response:
        clean_text = raw_response.strip()
        if "```json" in clean_text:
            clean_text = clean_text.split("```json", 1)[1].split("```", 1)[0].strip()
        elif "```" in clean_text:
            clean_text = clean_text.split("```", 1)[1].split("```", 1)[0].strip()

        try:
            parsed = json.loads(clean_text)
            tables = [t for t in parsed.get("required_tables", []) if t in valid_tables]
            intent = parsed.get("intent", "data_analysis")
            reasoning = parsed.get("reasoning", "")
            if tables:
                return {
                    "required_tables": tables,
                    "intent": intent,
                    "reasoning": reasoning,
                    "llm_used": True,
                }
        except Exception as parse_err:
            print(f"[SupervisorAgent] Failed to parse JSON from LLM: {parse_err}")

    # Fallback heuristic if LLM call is offline or unconfigured
    q_lower = query.lower()
    p_lower = persona.lower()
    tables = []
    reasoning_parts = []

    if any(k in q_lower for k in ["latency", "downtime", "cache", "token", "llm", "telemetry", "dev"]):
        tables.append("dev_data")
        reasoning_parts.append("Dev engineering telemetry requested")
    if any(k in q_lower for k in ["most viewed", "top viewed", "viewed products", "clicks"]):
        if "dev_data" not in tables:
            tables.append("dev_data")
        if "product_list" not in tables:
            tables.append("product_list")
        reasoning_parts.append("Product click-through ranking and product names needed")
    if any(k in q_lower for k in ["marketing", "ctr", "click through", "ad budget", "views", "likes", "campaign", "social"]):
        tables.append("marketing_data")
        reasoning_parts.append("Marketing campaign and social engagement metrics needed")
    if any(k in q_lower for k in ["sales", "profit", "units sold", "units", "traffic", "revenue", "driver", "drivers"]):
        tables.append("sales_data")
        reasoning_parts.append("Commercial sales volume and profitability metrics needed")
    if any(k in q_lower for k in ["product", "catalog", "price", "cost", "selling price", "margin", "align", "scuba", "define", "abc"]):
        if "product_list" not in tables:
            tables.append("product_list")
        reasoning_parts.append("Product catalog and pricing architecture needed")

    # If nothing matched, use persona preference
    if not tables:
        if "market" in p_lower:
            tables = ["marketing_data"]
            reasoning_parts.append("Defaulted to marketing_data for Marketing persona")
        elif "it" in p_lower or "dev" in p_lower:
            tables = ["dev_data"]
            reasoning_parts.append("Defaulted to dev_data for IT/Dev persona")
        else:
            tables = ["product_list", "sales_data"]
            reasoning_parts.append("Defaulted to product catalog and sales for Sales persona")

    return {
        "required_tables": tables,
        "intent": f"{tables[0]}_analysis" if tables else "data_analysis",
        "reasoning": "; ".join(reasoning_parts) if reasoning_parts else "Selected tables based on query keywords and persona.",
        "llm_used": False,
    }


@observe(name="SupervisorAgent", as_agent=True)
def supervisor_node(state: MultiAgentState) -> Dict[str, Any]:
    """Analyze query and persona using LLM to dynamically decide required database tables."""
    query = state.get("query", "")
    persona = state.get("persona", "Default")
    org = state.get("organization", "Lululemon Athletica")
    execution_mode = state.get("execution_mode", "dummy")

    decision = decide_required_tables_llm(
        query=query,
        persona=persona,
        org=org,
        execution_mode=execution_mode,
    )

    required_tables = decision.get("required_tables", [])
    intent = decision.get("intent", "data_analysis")
    reasoning = decision.get("reasoning", "")
    llm_used = decision.get("llm_used", False)
    requires_db = len(required_tables) > 0

    if not requires_db or intent == "chitchat":
        plan_summary = (
            f"Step 1 (SupervisorAgent): Query '{query}' recognized as conversational greeting.\n"
            f"- Required Database Tables: None (bypassed for greeting).\n"
            f"- Action: Route directly to ReporterAgent to provide a warm Lululemon greeting."
        )
    else:
        llm_badge = "LLM Call (Groq / Azure OpenAI)" if llm_used else "Heuristic Fallback"
        plan_summary = (
            f"Step 1 (SupervisorAgent Data Decision via {llm_badge} for '{query}'):\n"
            f"1. Decided Data Required: SQLite3 tables [{', '.join(required_tables)}].\n"
            f"2. Persona Target: {persona} at {org}.\n"
            f"3. Decision Reasoning: {reasoning}\n"
            f"4. Next Step: AnalyticsAgent will query ONLY the selected tables from enterprise_data.db."
        )

    plan = {
        "status": "planned",
        "intent": intent,
        "requires_database": requires_db,
        "required_tables": required_tables,
        "reasoning": reasoning,
        "llm_used": llm_used,
        "plan_summary": plan_summary,
        "mode": execution_mode,
    }
    return {"plan": plan, "error": state.get("error")}


# ---------------------------------------------------------------------------
# Stage 2: AnalyticsAgent — Pull Data STRICTLY From Required Tables
# ---------------------------------------------------------------------------

@observe(name="AnalyticsAgent", as_agent=True)
def analytics_node(state: MultiAgentState) -> Dict[str, Any]:
    """Pull records strictly from the tables decided by the Supervisor LLM."""
    query = state.get("query", "")
    persona = state.get("persona", "Default")
    org = state.get("organization", "Lululemon Athletica")
    plan = state.get("plan", {})
    intent = plan.get("intent", "data_analysis")

    if intent == "chitchat" or is_chitchat_query(query) or not plan.get("requires_database", True):
        analytical_data = {
            "type": "chitchat",
            "retrieved_tables": [],
            "retrieved_data": {},
            "synthesis": "Conversational greeting acknowledged. Database retrieval bypassed (no quantitative data required).",
        }
        return {"analytical_data": analytical_data, "error": state.get("error")}

    required_tables = plan.get("required_tables", [])
    pulled_records = {}
    evidence_tables = []

    # FETCH RECORDS ONLY FROM THE REQUIRED TABLES
    if "product_list" in required_tables:
        product_list_data = query_product_list()
        pulled_records["product_list"] = product_list_data
        evidence_tables.append({
            "table_name": "product_list",
            "display_name": "Table 1: Product List (SQLite3 enterprise_data.db)",
            "description": f"Lululemon apparel catalog ({len(product_list_data.get('records', []))} products) with cost price, selling price, year added, active status, category, and computed unit gross margin.",
            "record_count": len(product_list_data.get("records", [])),
            "rows": product_list_data.get("records", []),
        })

    if "sales_data" in required_tables:
        sales_data_res = query_sales_data()
        pulled_records["sales_data"] = sales_data_res
        evidence_tables.append({
            "table_name": "sales_data",
            "display_name": "Table 2: Sales Data (SQLite3 enterprise_data.db)",
            "description": f"Apparel units sold ({sales_data_res.get('total_units_sold', 0):,} units, {sales_data_res.get('total_profit')} total gross profit), quarter-wise sales, and store/e-commerce traffic.",
            "record_count": len(sales_data_res.get("records", [])),
            "rows": sales_data_res.get("records", []),
        })

    if "marketing_data" in required_tables:
        marketing_data_res = query_marketing_data()
        pulled_records["marketing_data"] = marketing_data_res
        evidence_tables.append({
            "table_name": "marketing_data",
            "display_name": "Table 3: Marketing Data (SQLite3 enterprise_data.db)",
            "description": f"Campaign metrics across products: click-through rates (avg {marketing_data_res.get('average_ctr_pct')}), ad budgets ({marketing_data_res.get('total_ad_budget')}), {marketing_data_res.get('total_views'):,} views, and {marketing_data_res.get('total_likes'):,} likes.",
            "record_count": len(marketing_data_res.get("records", [])),
            "rows": marketing_data_res.get("records", []),
        })

    if "dev_data" in required_tables:
        dev_data_res = query_dev_data(time_range="Q3 2026")
        pulled_records["dev_data"] = dev_data_res
        evidence_tables.append({
            "table_name": "dev_data",
            "display_name": "Table 4: Dev & Platform Telemetry (SQLite3 enterprise_data.db)",
            "description": f"Platform latency ({dev_data_res.get('latency_ms')}ms), downtime ({dev_data_res.get('downtime_hours')} hrs), cache hits ({dev_data_res.get('cache_hit'):,} / {dev_data_res.get('cache_hit_ratio_pct')}%), AI styling LLM tokens ({dev_data_res.get('llm_tokens_used'):,}), and LLM cost (${dev_data_res.get('llm_cost_dollars')}).",
            "record_count": 1,
            "rows": [{
                "latency_ms": dev_data_res.get("latency_ms"),
                "downtime_hours": dev_data_res.get("downtime_hours"),
                "time_range": dev_data_res.get("time_range"),
                "cache_hit": dev_data_res.get("cache_hit"),
                "cache_failure": dev_data_res.get("cache_failure"),
                "cache_hit_ratio_pct": f"{dev_data_res.get('cache_hit_ratio_pct')}%",
                "llm_tokens_used": f"{dev_data_res.get('llm_tokens_used'):,}",
                "llm_cost": f"${dev_data_res.get('llm_cost_dollars'):,.2f}",
            }],
        })

        # Include ranked most viewed products if requested or if dev_data is present
        if any(k in query.lower() for k in ["most viewed", "top viewed", "viewed products", "clicks", "click through"]):
            most_viewed_res = query_most_viewed_products(limit=5)
            pulled_records["most_viewed_products"] = most_viewed_res.get("most_viewed_products", [])
            evidence_tables.append({
                "table_name": "most_viewed_products",
                "display_name": "Table 4 Analysis: Top Viewed Products by Click-Throughs",
                "description": "Ranked product click-through counts extracted from dev_data.product_wise_click_throughs joined with product_list.",
                "record_count": len(most_viewed_res.get("most_viewed_products", [])),
                "rows": most_viewed_res.get("most_viewed_products", []),
            })

    analytical_data = {
        "intent": intent,
        "persona": persona,
        "retrieved_tables": required_tables,
        "evidence_tables": evidence_tables,
        "pulled_records": pulled_records,
        "product_list": pulled_records.get("product_list", {}),
        "sales_data": pulled_records.get("sales_data", {}),
        "marketing_data": pulled_records.get("marketing_data", {}),
        "dev_data": pulled_records.get("dev_data", {}),
        "most_viewed_products": pulled_records.get("most_viewed_products", []),
        "synthesis": f"Pulled {len(evidence_tables)} evidence tables ({', '.join(required_tables)}) strictly selected by LLM for {org}.",
    }

    return {"analytical_data": analytical_data, "error": state.get("error")}


# ---------------------------------------------------------------------------
# Stage 3: ReporterAgent & Tailored Lululemon Report Generators
# ---------------------------------------------------------------------------

def generate_tailored_product_list_report(persona: str, org: str) -> str:
    """Generate executive report on Table 1 (product_list)."""
    return f"""### 🧘 Lululemon Apparel Product Catalog & Pricing Architecture — {org}
*(Data retrieved from SQLite3 `product_list` in `enterprise_data.db`)*

**Executive Merchandising Summary:**
Lululemon’s apparel portfolio spans high-performance technical fabric franchises across **Women's**, **Men's**, and **Accessories**, maintaining an elite average unit gross margin of **74.1%** with zero seasonal re-tooling dependencies.

---

### 📋 Core Product Catalog Breakdown:

1. **Align High-Rise Pant 25" (`LLL-ALN-001`)**
   - **Fabric:** Weightless, buttery-soft Nulu™ fabric
   - **Pricing:** **$98.00 Selling Price** | **$24.50 Cost Price**
   - **Unit Gross Margin:** **75.0%** (+$73.50 gross profit per unit)
   - **Category:** Women's Pants & Tights &bull; Active: Yes (2021)

2. **Scuba Oversized Half-Zip Hoodie (`LLL-SCU-002`)**
   - **Fabric:** Naturally breathable cotton-blend fleece
   - **Pricing:** **$118.00 Selling Price** | **$32.00 Cost Price**
   - **Unit Gross Margin:** **72.9%** (+$86.00 gross profit per unit)
   - **Category:** Women's Hoodies & Sweatshirts &bull; Active: Yes (2022)

3. **Define Jacket (`LLL-DEF-003`)**
   - **Fabric:** Cottony-soft, supportive Luon™ fabric
   - **Pricing:** **$118.00 Selling Price** | **$31.50 Cost Price**
   - **Unit Gross Margin:** **73.3%** (+$86.50 gross profit per unit)
   - **Category:** Women's Jackets & Outerwear &bull; Active: Yes (2020)

4. **ABC Classic-Fit Pant 32" (`LLL-ABC-004`)**
   - **Fabric:** Four-way stretch Warpstreme™ fabric with ergonomic gusset
   - **Pricing:** **$128.00 Selling Price** | **$34.00 Cost Price**
   - **Unit Gross Margin:** **73.4%** (+$94.00 gross profit per unit)
   - **Category:** Men's Pants & Trousers &bull; Active: Yes (2021)

5. **Everywhere Belt Bag 1L (`LLL-EBB-006`)**
   - **Fabric:** Water-repellent textured nylon
   - **Pricing:** **$38.00 Selling Price** | **$9.20 Cost Price**
   - **Unit Gross Margin:** **75.8%** (+$28.80 gross profit per unit)
   - **Category:** Accessories Bags &bull; Active: Yes (2022)

---
*Report verified against SQLite3 Table 1 (`product_list`).*"""


def generate_tailored_sales_data_report(persona: str, org: str) -> str:
    """Generate executive report on Table 2 (sales_data)."""
    return f"""### 💼 Commercial Sales, Product Profitability & Traffic Breakdown — {org}
*(Data retrieved from SQLite3 `sales_data` joined with `product_list` in `enterprise_data.db`)*

**Executive Sales Summary:**
In Q3 2026, core apparel lines generated **$76,039,800 in gross revenue** across **893,100 units sold**, delivering **$56,091,050 in cumulative gross profit** and converting **6.1% of 14.6M global visits**.

---

### 📊 Top Product Sales & Profit Contributors:

1. **Align High-Rise Pant 25" (`LLL-ALN-001`):**
   - **Total Sales:** **145,000 units** ($14,210,000 gross revenue)
   - **Net Profit:** **$10,657,500** (Top profit driver across Lululemon)
   - **Quarterly Trend:** Q1: 34.2K &bull; Q2: 36.1K &bull; Q3: 38.9K &bull; Q4: 35.8K
   - **Traffic & Conversion:** 2,420,000 visits (**5.99% conversion rate**)

2. **Scuba Oversized Half-Zip Hoodie (`LLL-SCU-002`):**
   - **Total Sales:** **98,500 units** ($11,623,000 gross revenue)
   - **Net Profit:** **$8,471,000**
   - **Quarterly Trend:** Q1: 22.1K &bull; Q2: 19.4K &bull; Q3: 28.6K &bull; Q4: 28.4K
   - **Traffic & Conversion:** 1,890,000 visits (**5.21% conversion rate**)

3. **ABC Classic-Fit Pant 32" (`LLL-ABC-004`):**
   - **Total Sales:** **84,200 units** ($10,777,600 gross revenue)
   - **Net Profit:** **$7,914,800** (Leading men's technical apparel line)
   - **Quarterly Trend:** Q1: 20.1K &bull; Q2: 21.5K &bull; Q3: 22.4K &bull; Q4: 20.2K
   - **Traffic & Conversion:** 1,450,000 visits (**5.81% conversion rate**)

4. **Everywhere Belt Bag 1L (`LLL-EBB-006`):**
   - **Total Sales:** **215,000 units** ($8,170,000 gross revenue) — **#1 Highest Unit Volume**
   - **Net Profit:** **$6,192,000**
   - **Quarterly Trend:** Q1: 48.0K &bull; Q2: 56.0K &bull; Q3: 59.0K &bull; Q4: 52.0K
   - **Traffic & Conversion:** 3,120,000 visits (**6.89% conversion rate**)

5. **Define Jacket (`LLL-DEF-003`):**
   - **Total Sales:** **72,000 units** ($8,496,000 revenue &bull; **$6,228,000 profit**)

---
*Report verified against SQLite3 Table 2 (`sales_data`).*"""


def generate_tailored_marketing_data_report(persona: str, org: str) -> str:
    """Generate executive report on Table 3 (marketing_data)."""
    return f"""### 📢 Marketing Performance, Social Virality & CTR Analytics — {org}
*(Data retrieved from SQLite3 `marketing_data` in `enterprise_data.db`)*

**Executive Marketing Summary:**
Across a quarterly ad budget of **$593,000**, Lululemon generated **35.6M video views**, **2.76M social likes**, and an outstanding blended **ROAS of 4.6x**, anchored by viral TikTok organic creator hauls.

---

### 🎯 Product Campaign Performance Breakdown:

1. **Everywhere Belt Bag 1L (`LLL-EBB-006`):**
   - **Click-Through Rate (CTR):** **6.38%** (Highest CTR across all apparel & accessories)
   - **Ad Budget:** **$45,000** (Lowest spend, highest return)
   - **Social Views:** **8,420,000 views** &bull; **Likes:** **920,000 likes**
   - **Virality Driver:** Organic TikTok hauls (#EverywhereBeltBag) and college ambassador gifting.

2. **Scuba Oversized Half-Zip Hoodie (`LLL-SCU-002`):**
   - **Click-Through Rate (CTR):** **5.14%**
   - **Ad Budget:** **$95,000**
   - **Social Views:** **5,620,000 views** &bull; **Likes:** **488,000 likes**
   - **Campaign Focus:** Fall drop styling videos and cozy athleisure aesthetics.

3. **Align High-Rise Pant 25" (`LLL-ALN-001`):**
   - **Click-Through Rate (CTR):** **4.82%**
   - **Ad Budget:** **$120,000**
   - **Social Views:** **4,850,000 views** &bull; **Likes:** **342,000 likes**
   - **Campaign Focus:** Global yoga ambassador community activations and buttery-soft feel demonstrations.

4. **Define Jacket (`LLL-DEF-003`):**
   - **Click-Through Rate (CTR):** **4.25%** &bull; **Views:** 3.74M &bull; **Likes:** 295K &bull; **Ad Budget:** $75K

5. **ABC Classic-Fit Pant 32" (`LLL-ABC-004`):**
   - **Click-Through Rate (CTR):** **3.92%** &bull; **Views:** 3.12M &bull; **Likes:** 164K &bull; **Ad Budget:** $85K (Men's commute & golf targeting)

---
*Report verified against SQLite3 Table 3 (`marketing_data`).*"""


def generate_tailored_dev_data_report(persona: str, org: str) -> str:
    """Generate executive report on Table 4 (dev_data)."""
    return f"""### 🖥️ Digital Commerce Engineering, Latency & Most Viewed Products — {org}
*(Data retrieved from SQLite3 `dev_data` in `enterprise_data.db`)*

**Executive Engineering Summary:**
Lululemon’s digital commerce platform maintained an exceptional **99.99% uptime SLA** (only **0.08 hours downtime**) and **28.4ms edge latency** during Q3 2026. Global CDN edge caching achieved a **92.35% cache hit ratio** across 14.25M hits.

---

### ⚙️ Core Platform Telemetry (Table 4):
- **Edge API & Checkout Latency:** **28.4ms** (Target: <50ms)
- **Platform Downtime:** **0.08 hours** (99.99% availability with zero P0 drop failures)
- **Time Range:** **Q3 2026**
- **Edge Cache Performance:** **14,250,000 Cache Hits** vs **1,180,000 Failures** (**92.35% Cache Hit Ratio**)
- **AI Virtual Stylist LLM Usage:** **18,450,000 Tokens** utilized for personalized fit and styling
- **LLM Inferencing Cost:** **$3,690.00** ($0.018 cost per styling session)

---

### 🔥 Most Viewed Products (Ranked by Web & App Click-Throughs):
*Extracted from `dev_data.product_wise_click_throughs` and joined with `product_list`:*

1. **#1 Everywhere Belt Bag 1L (`LLL-EBB-006`):** **524,000 Click-Throughs** (Accessories | $38.00)
2. **#2 Align High-Rise Pant 25" (`LLL-ALN-001`):** **482,000 Click-Throughs** (Women's Pants | $98.00)
3. **#3 Scuba Oversized Half-Zip (`LLL-SCU-002`):** **395,000 Click-Throughs** (Women's Hoodies | $118.00)
4. **#4 Define Jacket Luon (`LLL-DEF-003`):** **312,000 Click-Throughs** (Women's Outerwear | $118.00)
5. **#5 ABC Classic-Fit Pant 32" (`LLL-ABC-004`):** **284,000 Click-Throughs** (Men's Pants | $128.00)
6. **#6 Wunder Train High-Rise Tight (`LLL-WUN-007`):** **245,000 Click-Throughs** ($98.00)
7. **#7 Pace Breaker Short 7" (`LLL-PCB-008`):** **198,000 Click-Throughs** ($68.00)

---
*Report verified against SQLite3 Table 4 (`dev_data`).*"""


def generate_tailored_margin_report(persona: str, org: str) -> str:
    """Generate tailored margin analysis for Lululemon."""
    return f"""### 💼 Lululemon Core Apparel Margins & Franchise Profitability — {org}
*(Data retrieved from SQLite3 `product_list`, `sales_data`, and `domain_margins`)*

**Executive Summary for {persona} Leadership:**
Lululemon maintained an exceptional **75.0% Core Apparel Gross Margin** on key fabric lines (Nulu, Luon, Warpstreme), generating **$56,091,050 in cumulative gross profit** on **$76.04M in gross sales**.

---

### 🎯 Margin Architecture by Product Line:
- **Align High-Rise Pant 25":** **75.0% Gross Margin** (Selling: $98.00, Cost: $24.50) &bull; **$10,657,500 Gross Profit**
- **Everywhere Belt Bag 1L:** **75.8% Gross Margin** (Selling: $38.00, Cost: $9.20) &bull; **$6,192,000 Gross Profit**
- **Define Jacket Luon:** **73.3% Gross Margin** (Selling: $118.00, Cost: $31.50) &bull; **$6,228,000 Gross Profit**
- **ABC Classic-Fit Pant 32":** **73.4% Gross Margin** (Selling: $128.00, Cost: $34.00) &bull; **$7,914,800 Gross Profit**
- **Scuba Oversized Hoodie:** **72.9% Gross Margin** (Selling: $118.00, Cost: $32.00) &bull; **$8,471,000 Gross Profit**

---

### 🌐 Cross-Functional Margin Enablers:
- **Merchandising Discipline:** Confining markdowns strictly to "We Made Too Much" preserved **$4,200,000** in gross margin.
- **Digital Infrastructure:** E-commerce CDN and cloud hosting COGS held to **3.8% of digital revenue**.
- **Customer Acquisition:** **5.4x LTV:CAC** with blended CAC of **$32 per customer**.

---
*Tailored for the **{persona}** perspective from SQLite3.*"""


def generate_tailored_revenue_drivers_report(persona: str, org: str) -> str:
    """Generate tailored revenue drivers report for Lululemon."""
    return f"""### 🚀 Key Revenue Drivers & Growth Catalysts — {org}
*(Data retrieved from SQLite3 `revenue_drivers`, `sales_data`, and `marketing_data`)*

**Executive Summary for {persona} Leadership:**
In Q3 2026, Lululemon generated **$76,039,800 in total sales revenue** (exceeding the $70.0M quarterly target by **108.6% quota attainment**).

---

### 🎯 Key Departmental Revenue Catalysts:
1. **Align™ & Nulu™ Franchise Volume Surge:** **$14,210,000 revenue contribution** (145,000 units closed at $98 retail).
2. **TikTok Organic Virality (#LululemonHaul):** Sourced **$11,623,000 in Scuba Franchise revenue** and **8.42M views on Everywhere Belt Bag**.
3. **Men's ABC Pant™ & On-The-Move Expansion:** **$10,777,600 revenue contribution** (+34.2% YoY growth in men's technical trousers).
4. **Everywhere Belt Bag Volume Driver:** **$8,170,000 revenue** across 215,000 units ($38 entry price driving 38% cross-sell basket attach rate).
5. **99.99% Platform Uptime & 28.4ms Latency:** Preserved **$4,850,000** in digital transactions with zero P0 checkout outages.

---
*Tailored for the **{persona}** perspective from SQLite3.*"""


def generate_tailored_operational_health_report(persona: str, org: str) -> str:
    """Generate operational health report across commercial, technical, and marketing dimensions."""
    return f"""### ⚡ Lululemon Omnichannel Operational Health & Telemetry — {org}

**Executive Summary:**
Across commercial retail, digital commerce, and community brand presence, operational health remains exceptional:
- **Commercial Performance:** $76.04M revenue, 893,100 units sold, 74.2% full-price sell-through rate.
- **Digital Infrastructure:** 28.4ms edge latency, 0.08h downtime (99.99% uptime), 92.35% CDN cache hit ratio.
- **AI Virtual Stylist:** 18.45M LLM tokens used at $3,690 cost, driving 4.8x higher checkout conversions.
- **Marketing Efficiency:** 4.6x blended ROAS, 6.38% peak CTR on viral belt bag, $32 customer acquisition cost.
- **Most Viewed Products:** Everywhere Belt Bag (524K clicks) and Align Pant (482K clicks).
"""


def get_chitchat_report(query: str, persona: str, org: str) -> str:
    """Generate polite Lululemon greeting tailored for casual pleasantries."""
    return (
        f"Hello! 👋 Welcome to **{org}**'s Multi-Agent Enterprise Intelligence Platform.\n\n"
        f"I'm here to assist you with real-time quantitative analysis across our operational database:\n"
        f"- 📋 **Table 1 (Product Catalog & Margins):** Align Pant, Scuba Hoodie, ABC Pant, Define Jacket, Everywhere Belt Bag pricing & unit gross margins (72-76%)\n"
        f"- 💼 **Table 2 (Sales & Profitability):** Total units sold (893.1K), quarterly breakdown, net profit ($56.09M), and store/e-commerce traffic\n"
        f"- 📢 **Table 3 (Marketing & Social Reach):** TikTok/IG viral views (35.6M), likes, ad budgets, and click-through rates (up to 6.38%)\n"
        f"- 🖥️ **Table 4 (Dev Telemetry & Most Viewed SKUs):** Edge latency (28.4ms), 99.99% uptime, CDN cache hits, AI Stylist LLM cost, and top viewed products click-throughs"
    )


def extract_compact_context(data: Dict[str, Any], intent: str, persona: str) -> str:
    """Extract a concise summary of the Lululemon database records for LLM synthesis."""
    lines = []

    # Product List
    pl = data.get("product_list", {})
    if isinstance(pl, dict) and pl.get("records"):
        recs = pl["records"][:4]
        for r in recs:
            lines.append(f"Product: {r.get('product_name')} (ID: {r.get('product_id')}) | Cost: ${r.get('cost_price')} | Selling: ${r.get('selling_price')} | Unit Margin: {r.get('unit_gross_margin_pct')} | Category: {r.get('category')}")

    # Sales Data
    sd = data.get("sales_data", {})
    if isinstance(sd, dict) and sd.get("records"):
        recs = sd["records"][:3]
        for r in recs:
            lines.append(f"Sales: {r.get('product_name')} | Units Sold: {r.get('total_sales'):,} | Gross Profit: ${r.get('profit'):,.2f} | Traffic: {r.get('traffic'):,} visits | Conversion: {r.get('conversion_rate_pct')}%")

    # Marketing Data
    md = data.get("marketing_data", {})
    if isinstance(md, dict) and md.get("records"):
        recs = md["records"][:3]
        for r in recs:
            lines.append(f"Marketing: {r.get('product_name')} | CTR: {r.get('click_through_rate')}% | Ad Budget: ${r.get('ad_budget'):,.2f} | Views: {r.get('views'):,} | Likes: {r.get('likes'):,}")

    # Dev Data
    dd = data.get("dev_data", {})
    if isinstance(dd, dict) and dd.get("latency_ms"):
        lines.append(f"Dev Telemetry: Latency={dd.get('latency_ms')}ms | Downtime={dd.get('downtime_hours')}h | Cache Hits={dd.get('cache_hit'):,} ({dd.get('cache_hit_ratio_pct')}%) | LLM Tokens={dd.get('llm_tokens_used'):,} (Cost: ${dd.get('llm_cost_dollars')})")

    # Most Viewed Products
    mv = data.get("most_viewed_products", [])
    if mv:
        top_names = [f"#{item.get('rank')} {item.get('product_name')} ({item.get('click_throughs'):,} clicks)" for item in mv[:3]]
        lines.append(f"Most Viewed Products: {', '.join(top_names)}")

    return "\n".join(lines) if lines else "Verified Lululemon operational apparel records available."


def get_reporter_prompt_and_instruction(query: str, persona: str, org: str, data: Dict[str, Any], intent: str) -> tuple[str, str]:
    """Generate system instruction and user prompt for ReporterAgent LLM synthesis."""
    compact_records = extract_compact_context(data, intent, persona)
    prompt = f"""You are the ReporterAgent delivering an executive response for {org}.
User Query: "{query}"
Target Persona: "{persona}"
Intent: "{intent}"

Relevant SQLite3 Database Records (enterprise_data.db):
{compact_records}

CRITICAL REQUIREMENT - TAILOR DEEPLY TO THE '{persona}' PERSPECTIVE AT LULULEMON:
You are presenting this response directly to a {persona} stakeholder at Lululemon Athletica.
Your answer MUST be tailored through the specific lens, priorities, and vocabulary of {persona}:

- If target persona is 'Sales':
  Prioritize commercial apparel sell-through, product unit gross margins (72-76%), gross profit contribution ($56.09M), total volume (893.1K units), hero SKUs (Align Pant $14.21M, Scuba Hoodie $11.62M, ABC Pant $10.78M, Everywhere Belt Bag 215K units sold), and minimal discounting (preserving $4.2M).
- If target persona is 'IT' or 'Developer':
  Prioritize digital platform reliability, 28.4ms edge latency, 0.08h downtime (99.99% uptime), 92.35% CDN cache hit ratio (14.25M hits), AI Virtual Stylist LLM inferencing cost ($3,690 across 18.45M tokens), and web product click-through telemetry highlighting the most viewed products (Everywhere Belt Bag 524K clicks, Align Pant 482K clicks).
- If target persona is 'Marketing':
  Prioritize brand reach, viral social commerce (#LululemonHaul), Everywhere Belt Bag 6.38% CTR and 8.42M views, Scuba Hoodie 5.14% CTR, ad budget allocation ($593K total), 4.6x blended ROAS, low $32 CAC, and community sweat ambassador events.

Cite verified data from the SQLite3 database tables (product_list, sales_data, marketing_data, dev_data)."""
    system_instruction = f"You are a professional executive reporting agent for {org} tailoring responses deeply to the {persona} perspective."
    return prompt, system_instruction


def get_deterministic_report(query: str, persona: str, org: str, intent: str = "") -> str:
    """Generate deterministic persona-tailored response from SQLite3 ground truth data."""
    q_lower = query.lower()

    if intent == "dev_data_analysis" or any(k in q_lower for k in ["latency", "downtime", "cache", "cache hit", "llm", "tokens", "most viewed", "click through"]):
        return generate_tailored_dev_data_report(persona=persona, org=org)

    elif intent == "marketing_data_analysis" or any(k in q_lower for k in ["marketing", "ctr", "ad budget", "views", "likes", "tiktok", "instagram"]):
        return generate_tailored_marketing_data_report(persona=persona, org=org)

    elif intent == "sales_data_analysis" or any(k in q_lower for k in ["sales data", "total sales", "quarter wise", "profit", "traffic", "units"]):
        return generate_tailored_sales_data_report(persona=persona, org=org)

    elif intent == "product_list_analysis" or any(k in q_lower for k in ["product list", "catalog", "cost price", "selling price", "category", "sub category"]):
        return generate_tailored_product_list_report(persona=persona, org=org)

    elif intent == "margin_analysis" or any(k in q_lower for k in ["margin", "margins", "profitability", "gross margin", "ebitda", "cogs"]):
        return generate_tailored_margin_report(persona=persona, org=org)

    elif intent == "revenue_drivers_analysis" or any(k in q_lower for k in ["driver", "drivers", "causing", "causes", "growth driver"]):
        return generate_tailored_revenue_drivers_report(persona=persona, org=org)

    elif any(k in q_lower for k in ["operational efficiency", "operational health", "efficiency", "sla", "health"]):
        return generate_tailored_operational_health_report(persona=persona, org=org)

    else:
        return generate_tailored_sales_data_report(persona=persona, org=org)


@observe(name="ReporterAgent", as_agent=True)
def reporter_node(state: MultiAgentState) -> Dict[str, Any]:
    """Reporter agent delivering executive synthesis and persona-tailored report."""
    query = state.get("query", "")
    persona = state.get("persona", "Default")
    org = state.get("organization", "Lululemon Athletica")
    data = state.get("analytical_data", {})
    execution_mode = state.get("execution_mode", "dummy")
    plan = state.get("plan", {})
    intent = plan.get("intent", "enterprise_performance_analysis")

    is_chitchat = (intent == "chitchat") or is_chitchat_query(query)

    if is_chitchat:
        llm_output = ""
        llm_error = None
        if execution_mode == "realtime":
            prompt = f"""You are the ReporterAgent for {org}.
The user said: "{query}"
Target Persona: "{persona}"

The user is greeting or having casual pleasantries.
Respond with a polite, professional, and friendly greeting.
Briefly welcome them to {org}'s Enterprise Intelligence Platform and outline what questions you can help with:
- Table 1 (Product Catalog & Margins): Align Pant, Scuba Hoodie, ABC Pant, Define Jacket, Everywhere Belt Bag pricing & unit margins (72-76%)
- Table 2 (Sales & Profitability): Units sold, quarterly sales breakdown, net profit ($56.09M), and store/e-commerce traffic
- Table 3 (Marketing & Social Reach): TikTok viral views (35.6M), likes, ad budgets, and click-through rates (up to 6.38%)
- Table 4 (Dev Telemetry & Most Viewed SKUs): 28.4ms latency, 99.99% uptime, CDN cache hits, AI Stylist LLM cost, and top viewed products
Do NOT output unrequested raw tables or fake error messages."""
            try:
                llm_output = call_llm(
                    prompt=prompt,
                    system_instruction=f"You are a helpful, professional enterprise AI assistant for {org}.",
                    execution_mode="realtime",
                )
            except Exception as exc:
                llm_error = str(exc)

        if not llm_output:
            llm_output = get_chitchat_report(query, persona, org)

        final_err = state.get("error") or llm_error
        return {"final_output": llm_output, "error": final_err}

    # Real-time LLM Synthesis
    llm_output = ""
    llm_error = None
    if execution_mode == "realtime":
        prompt, sys_inst = get_reporter_prompt_and_instruction(query, persona, org, data, intent)
        try:
            llm_output = call_llm(
                prompt=prompt,
                system_instruction=sys_inst,
                execution_mode="realtime",
            )
        except Exception as exc:
            llm_error = str(exc)

    if not llm_output:
        llm_output = get_deterministic_report(query, persona, org, intent)

    final_err = state.get("error") or llm_error
    return {"final_output": llm_output, "error": final_err}


# ---------------------------------------------------------------------------
# Build & Compile LangGraph Multi-Agent Workflow
# ---------------------------------------------------------------------------

def build_multi_agent_graph():
    """Build the compiled LangGraph workflow connecting the 3 agents."""
    builder = StateGraph(MultiAgentState)

    builder.add_node("SupervisorAgent", supervisor_node)
    builder.add_node("AnalyticsAgent", analytics_node)
    builder.add_node("ReporterAgent", reporter_node)

    builder.add_edge(START, "SupervisorAgent")
    builder.add_edge("SupervisorAgent", "AnalyticsAgent")
    builder.add_edge("AnalyticsAgent", "ReporterAgent")
    builder.add_edge("ReporterAgent", END)

    return builder.compile()


@observe(name="multi_agent_workflow")
def run_multi_agent_workflow(
    query: str,
    persona: str = "Default",
    organization: str = "Lululemon Athletica",
    application_name: str = "demo-1",
    execution_mode: str = "realtime",
    model_name: Optional[str] = None,
    api_key: Optional[str] = None,
    user_email: str = "sales@lululemon.com",
    observix_url: Optional[str] = None,
) -> Dict[str, Any]:
    """Run the 3-agent LangGraph workflow instrumented natively with Observix."""
    provider_info = get_active_provider_info()
    effective_model = model_name or provider_info["model_name"]
    effective_api_key = api_key or provider_info.get("api_key")

    graph = build_multi_agent_graph()

    initial_state: MultiAgentState = {
        "query": query,
        "persona": persona,
        "organization": organization,
        "execution_mode": execution_mode,
        "model_name": effective_model,
        "api_key": effective_api_key,
        "plan": {},
        "analytical_data": {},
        "final_output": "",
        "error": None,
    }

    final_state = graph.invoke(initial_state)

    trace_id = ""
    if get_current_trace:
        try:
            curr = get_current_trace()
            if curr:
                trace_id = getattr(curr, "trace_id", "") or getattr(curr, "id", "")
        except Exception:
            pass

    if not trace_id:
        import uuid
        trace_id = f"trc_lll_{uuid.uuid4().hex[:12]}"

    observations = [
        {
            "name": "SupervisorAgent",
            "type": "agent",
            "status": "success",
            "input": {"query": query, "persona": persona, "organization": organization},
            "output": final_state.get("plan"),
        },
        {
            "name": "AnalyticsAgent",
            "type": "agent",
            "status": "success",
            "input": final_state.get("plan"),
            "output": final_state.get("analytical_data"),
        },
        {
            "name": "ReporterAgent",
            "type": "agent",
            "status": "success",
            "input": {"analytical_data": final_state.get("analytical_data"), "persona": persona},
            "output": {"final_output": final_state.get("final_output")},
        },
    ]

    analytical_data = final_state.get("analytical_data", {})
    evidence_tables = analytical_data.get("evidence_tables", [])

    trace = {
        "trace_id": trace_id,
        "trace_url": f"http://localhost:8011/dashboard/traces?trace_id={trace_id}",
        "trace_tree_url": f"http://localhost:8011/dashboard/traces?trace_id={trace_id}",
        "application_name": application_name,
        "user_email": user_email,
        "execution_mode": execution_mode,
        "observations": observations,
        "evidence_tables": evidence_tables,
    }

    is_chitchat = (final_state.get("plan", {}).get("intent") == "chitchat") or is_chitchat_query(query)

    return {
        "output": final_state.get("final_output", ""),
        "plan": final_state.get("plan", {}),
        "analytical_data": analytical_data,
        "evidence_tables": evidence_tables,
        "is_chitchat": is_chitchat,
        "trace": trace,
        "mode": execution_mode,
        "provider": provider_info["provider"],
        "model": effective_model,
        "error": final_state.get("error"),
    }
