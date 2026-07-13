"""EC/D2C評価モデル。docs/engine-spec.md §2.5 に対応。

EV/売上 or EV/粗利マルチプル + ユニットエコノミクス(診断指標)。
U-10確定: LTVはF2転換率を年次リピート率の近似とみなし、上限10年でキャップする。
"""

from typing import Any, Dict


def compute(inputs: Dict[str, Any]) -> Dict[str, Any]:
    annual_revenue = inputs["annualRevenue"]
    revenue_growth = inputs["revenueGrowth"]
    gross_margin = inputs["grossMargin"]
    f2_rate = inputs["f2Rate"]
    aov = inputs["aov"]
    purchase_frequency = inputs["purchaseFrequency"]
    cac = inputs["cac"]
    ad_cost_ratio = inputs["adCostRatio"]
    logistics_cost_ratio = inputs["logisticsCostRatio"]
    max_lifetime_years = inputs["maxLifetimeYears"]
    multiple_basis = inputs["multipleBasis"]

    revenue_ntm = annual_revenue * (1.0 + revenue_growth)
    if multiple_basis == "revenue":
        basis = revenue_ntm
    elif multiple_basis == "grossProfit":
        basis = revenue_ntm * gross_margin
    else:
        raise ValueError(f"unknown multipleBasis: {multiple_basis}")

    ev = {
        key: basis * inputs["evMultiple"][key]
        for key in ("pessimistic", "base", "optimistic")
    }

    annual_value = aov * purchase_frequency * gross_margin
    if f2_rate < 1.0:
        lifetime_years = min(1.0 / (1.0 - f2_rate), max_lifetime_years)
    else:
        lifetime_years = float(max_lifetime_years)
    ltv = annual_value * lifetime_years

    key_metrics: Dict[str, float] = {
        "contributionMarginRatio": gross_margin - ad_cost_ratio - logistics_cost_ratio,
        "ltv": ltv,
    }
    if cac > 0:
        key_metrics["ltvCacRatio"] = ltv / cac

    return {"ev": ev, "keyMetrics": key_metrics}
