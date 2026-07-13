"""クライメートテック評価モデル。docs/engine-spec.md §2.6 に対応。

プロジェクトDCF(CAPEX重視)+ 量産化到達確率によるリスク調整。
U-11確定: 非オフテイク分の販売実現率は割引なし(merchantRealization=1.0)を既定運用とする。
"""

from typing import Any, Dict


def compute(inputs: Dict[str, Any]) -> Dict[str, Any]:
    capex_schedule = {c["yearIndex"]: c["amount"] for c in inputs["capexSchedule"]}
    subsidy_coverage = inputs["subsidyCoverage"]
    mass_production_year = inputs["massProductionYear"]
    mass_production_prob = inputs["massProductionProb"]
    annual_capacity_units = inputs["annualCapacityUnits"]
    ramp_years = inputs["rampYears"]
    unit_price = inputs["unitPrice"]
    unit_cost0 = inputs["unitCost0"]
    cost_decline_rate = inputs["costDeclineRate"]
    offtake_coverage = inputs["offtakeCoverage"]
    merchant_realization = inputs["merchantRealization"]
    fixed_opex_annual = inputs["fixedOpexAnnual"]
    carbon_credit_volume = inputs["carbonCreditVolume"]
    carbon_credit_price = inputs["carbonCreditPrice"]
    project_years = inputs["projectYears"]

    ev = {}
    for key in ("pessimistic", "base", "optimistic"):
        r = inputs["discountRate"][key]
        pre_pv = 0.0
        post_pv = 0.0
        for t in range(0, project_years + 1):
            capex = capex_schedule.get(t, 0.0)
            net_capex = capex * (1.0 - subsidy_coverage)
            if t < mass_production_year:
                pre_pv += (-net_capex) / (1.0 + r) ** t
            else:
                volume = annual_capacity_units * min(
                    1.0, (t - mass_production_year + 1) / ramp_years
                ) * (offtake_coverage + (1.0 - offtake_coverage) * merchant_realization)
                unit_cost = unit_cost0 * (1.0 - cost_decline_rate) ** t
                unit_margin = (unit_price - unit_cost) / 1e6
                op_cf = (
                    volume * unit_margin
                    + carbon_credit_volume * carbon_credit_price / 1e6
                    - fixed_opex_annual
                )
                post_pv += (op_cf - net_capex) / (1.0 + r) ** t

        ev[key] = pre_pv + mass_production_prob * post_pv

    return {"ev": ev, "keyMetrics": {}}
