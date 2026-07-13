"""SaaS(日本市場)評価モデル。docs/engine-spec.md §2.1 に対応。

主評価: EV/ARR マルチプル。補助評価: 簡易DCF(単一値)。
"""

from typing import Any, Dict

from ..common import gordon_terminal_value, pv


def compute(inputs: Dict[str, Any]) -> Dict[str, Any]:
    arr = inputs["arr"]
    arr_growth = inputs["arrGrowth"]
    arr_basis = inputs["arrBasis"]
    ev_arr_multiple = inputs["evArrMultiple"]

    if arr_basis == "ntm":
        arr_basis_value = arr * (1.0 + arr_growth)
    elif arr_basis == "current":
        arr_basis_value = arr
    else:
        raise ValueError(f"unknown arrBasis: {arr_basis}")

    ev = {
        key: arr_basis_value * ev_arr_multiple[key]
        for key in ("pessimistic", "base", "optimistic")
    }

    # 補助評価: 簡易DCF(単一値)
    projection_years = inputs["projectionYears"]
    decay = inputs["growthDecayFactor"]
    r = inputs["discountRate"]
    g_term = inputs["terminalGrowth"]
    fcf_margin = inputs["fcfMargin"]

    revenue = arr
    cashflows = []
    for t in range(1, projection_years + 1):
        g_t = arr_growth * (decay ** (t - 1))
        revenue = revenue * (1.0 + g_t)
        cashflows.append((t, revenue * fcf_margin))

    ev_dcf = pv(cashflows, r)
    terminal_value = gordon_terminal_value(cashflows[-1][1], r, g_term)
    ev_dcf += terminal_value / (1.0 + r) ** projection_years

    rule_of_40 = (arr_growth + inputs["operatingMargin"]) * 100.0

    return {
        "ev": ev,
        "auxiliary": ev_dcf,
        "keyMetrics": {"ruleOf40": rule_of_40},
    }
