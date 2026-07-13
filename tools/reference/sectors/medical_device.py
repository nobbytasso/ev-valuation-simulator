"""医療機器評価モデル。docs/engine-spec.md §2.3 に対応。

市場浸透モデル(線形ランプ)+ DCF。
"""

from typing import Any, Dict

from ..common import gordon_terminal_value, pv


def compute(inputs: Dict[str, Any]) -> Dict[str, Any]:
    launch_year = inputs["launchYear"] + inputs["approvalDelayYears"]
    procedures0 = inputs["annualProcedures"]
    procedure_growth = inputs["procedureGrowth"]
    price_per_procedure = inputs["pricePerProcedure"]
    peak_penetration = inputs["peakPenetration"]
    years_to_peak = inputs["yearsToPeak"]
    recurring_ratio = inputs["recurringRatio"]
    operating_margin = inputs["operatingMargin"]
    projection_years = inputs["projectionYears"]
    terminal_growth = inputs["terminalGrowth"]

    ev = {}
    for key in ("pessimistic", "base", "optimistic"):
        r = inputs["discountRate"][key]
        cashflows = []
        for t in range(1, projection_years + 1):
            procedures = procedures0 * (1.0 + procedure_growth) ** t
            if t < launch_year:
                penetration = 0.0
            else:
                penetration = min(
                    peak_penetration,
                    peak_penetration * (t - launch_year + 1) / years_to_peak,
                )
            device_revenue = procedures * penetration * price_per_procedure / 1e6
            total_revenue = device_revenue / (1.0 - recurring_ratio)
            fcf = total_revenue * operating_margin
            cashflows.append((t, fcf))

        npv = pv(cashflows, r)
        terminal_value = gordon_terminal_value(cashflows[-1][1], r, terminal_growth)
        npv += terminal_value / (1.0 + r) ** projection_years
        ev[key] = npv

    return {"ev": ev, "keyMetrics": {}}
