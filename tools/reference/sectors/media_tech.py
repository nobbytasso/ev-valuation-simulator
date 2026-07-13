"""メディアテック評価モデル。docs/engine-spec.md §2.4 に対応。

EV/売上マルチプル(NTM売上基準)+ ユーザーエコノミクス(診断指標)。
"""

from typing import Any, Dict


def compute(inputs: Dict[str, Any]) -> Dict[str, Any]:
    mau = inputs["mau"]
    mau_growth = inputs["mauGrowth"]
    decay = inputs["growthDecayFactor"]
    arpu_monthly = inputs["arpuMonthly"]
    arpu_total = arpu_monthly["ad"] + arpu_monthly["paid"] + arpu_monthly["commerce"]
    monthly_churn = inputs["monthlyChurn"]
    content_cost_ratio = inputs["contentCostRatio"]
    cpa = inputs["cpa"]
    projection_years = inputs["projectionYears"]

    revenue_by_year = {}
    current_mau = mau
    for t in range(1, projection_years + 1):
        g_t = mau_growth * (decay ** (t - 1))
        current_mau = current_mau * (1.0 + g_t)
        revenue_by_year[t] = current_mau * arpu_total * 12.0 / 1e6

    ntm_revenue = revenue_by_year[1]

    ev = {
        key: ntm_revenue * inputs["evSalesMultiple"][key]
        for key in ("pessimistic", "base", "optimistic")
    }

    key_metrics: Dict[str, float] = {}
    if monthly_churn > 0:
        avg_lifetime_months = 1.0 / monthly_churn
        ltv = arpu_total * (1.0 - content_cost_ratio) * avg_lifetime_months
        key_metrics["avgLifetimeMonths"] = avg_lifetime_months
        key_metrics["ltv"] = ltv
        if cpa > 0:
            key_metrics["ltvCpaRatio"] = ltv / cpa
            key_metrics["paybackMonths"] = cpa / (arpu_total * (1.0 - content_cost_ratio))

    return {"ev": ev, "keyMetrics": key_metrics}
