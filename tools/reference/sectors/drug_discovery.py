"""創薬(rNPV)評価モデル。docs/engine-spec.md §2.2 に対応。

パイプライン品目ごとの rNPV を合算する。フェーズ確率・開発費・マイルストーン・
売上カーブをすべてリスク調整した上で共通の PV(§0.4 t昇順合算)にかける。
"""

from typing import Any, Dict, List, Tuple

from ..common import pv

PHASE_ORDER = ["preclinical", "phase1", "phase2", "phase3", "filing"]


def _asset_rnpv(asset: Dict[str, Any], discount_rate: float, horizon_years: int) -> float:
    current_idx = PHASE_ORDER.index(asset["currentPhase"])
    remaining = PHASE_ORDER[current_idx:]
    m = len(remaining)
    probs = asset["phaseSuccessProbs"]
    durations = asset["phaseDurations"]
    costs = asset["developmentCosts"]

    # p_reach[j] = そのフェーズ(remaining[j])に到達する確率。p_reach[m] = POS(上市確率)
    p_reach: List[float] = [1.0]
    for j in range(1, m + 1):
        p_reach.append(p_reach[-1] * probs[remaining[j - 1]])
    pos = p_reach[m]

    cashflows: Dict[int, float] = {}

    def add_cf(t: int, amount: float) -> None:
        cashflows[t] = cashflows.get(t, 0.0) + amount

    # 開発費(フェーズごと、その期間の各年に均等配分、P_reach で加重)
    cumulative_year = 0
    phase_completion_year: Dict[str, int] = {}
    for j, phase in enumerate(remaining):
        duration = durations[phase]
        start_year = cumulative_year
        cumulative_year += duration
        phase_completion_year[phase] = cumulative_year
        per_year_cost = costs[phase] / duration
        weight = p_reach[j]
        for t in range(start_year + 1, start_year + duration + 1):
            add_cf(t, -per_year_cost * weight)

    launch_year = asset["launchYear"]
    commercialization = asset["commercialization"]

    if commercialization["type"] == "license":
        for milestone in commercialization["milestones"]:
            phase = milestone["phase"]
            amount = milestone["amount"]
            if phase == "launch":
                t_e = launch_year
                weight = pos
            else:
                j = remaining.index(phase)
                t_e = phase_completion_year[phase]
                weight = p_reach[j]
            add_cf(t_e, amount * weight)

    # 売上カーブ(上市年 L からの経過年 u で場合分け)
    peak_sales = asset["peakSales"]
    years_to_peak = asset["yearsToPeak"]
    plateau_years = asset["plateauYears"]
    decline_rate = asset["declineRate"]

    for t in range(launch_year, launch_year + horizon_years):
        u = t - launch_year
        if u < years_to_peak:
            sales = peak_sales * (u + 1) / years_to_peak
        elif u < years_to_peak + plateau_years:
            sales = peak_sales
        else:
            decay_periods = u - years_to_peak - plateau_years + 1
            sales = peak_sales * ((1.0 - decline_rate) ** decay_periods)

        if commercialization["type"] == "own":
            revenue_cf = sales * commercialization["contributionMargin"] * pos
        else:
            revenue_cf = sales * commercialization["royaltyRate"] * pos
        add_cf(t, revenue_cf)

    return pv(list(cashflows.items()), discount_rate)


def compute(inputs: Dict[str, Any]) -> Dict[str, Any]:
    assets = inputs["assets"]
    horizon_years = inputs["modelHorizonYears"]
    discount_rate = inputs["discountRate"]

    ev = {}
    for key in ("pessimistic", "base", "optimistic"):
        r = discount_rate[key]
        ev[key] = sum(_asset_rnpv(asset, r, horizon_years) for asset in assets)

    return {"ev": ev, "keyMetrics": {}}
