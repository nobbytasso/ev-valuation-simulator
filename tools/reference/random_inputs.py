"""セクター別のシード固定ランダム入力生成。docs/engine-spec.md §2 の定義域に準拠。

各関数は `random.Random` インスタンス(呼び出し側でシード固定済み)を受け取り、
ドメイン内で妥当な1ケース分の入力 dict を返す。無効な組み合わせ(例: r ≤ g_term)は
生成時点で回避する(バリデーションエラー経路は本フィクスチャの対象外)。
"""

import random
from typing import Any, Dict


def _range3(rng: random.Random, lo: float, hi: float, spread: float) -> Dict[str, float]:
    """base を [lo,hi] からサンプルし、pessimistic ≤ base ≤ optimistic となる3点を返す。"""
    base = rng.uniform(lo, hi)
    pess = base * (1.0 - spread)
    opt = base * (1.0 + spread)
    return {"pessimistic": pess, "base": base, "optimistic": opt}


def gen_saas(rng: random.Random) -> Dict[str, Any]:
    terminal_growth = rng.uniform(0.0, 0.03)
    discount_rate = terminal_growth + rng.uniform(0.05, 0.15)
    return {
        "arr": rng.uniform(10.0, 5000.0),
        "arrGrowth": rng.uniform(-0.2, 1.5),
        "nrr": rng.uniform(0.8, 1.4),
        "grossMargin": rng.uniform(0.4, 0.9),
        "operatingMargin": rng.uniform(-0.5, 0.3),
        "fcfMargin": rng.uniform(-0.3, 0.3),
        "grossChurn": rng.uniform(0.0, 0.3),
        "cacPaybackMonths": rng.uniform(6.0, 36.0),
        "arrBasis": rng.choice(["current", "ntm"]),
        "evArrMultiple": _range3(rng, 4.0, 15.0, 0.35),
        "projectionYears": rng.randint(3, 7),
        "growthDecayFactor": rng.uniform(0.7, 0.95),
        "discountRate": discount_rate,
        "terminalGrowth": terminal_growth,
    }


_PHASES = ["preclinical", "phase1", "phase2", "phase3", "filing"]
_BASE_PHASE_PROBS = {
    "preclinical": 0.5,
    "phase1": 0.6,
    "phase2": 0.35,
    "phase3": 0.6,
    "filing": 0.85,
}
_BASE_PHASE_DURATIONS = {
    "preclinical": 2,
    "phase1": 2,
    "phase2": 2,
    "phase3": 3,
    "filing": 1,
}
_BASE_PHASE_COSTS = {
    "preclinical": (200.0, 600.0),
    "phase1": (500.0, 1500.0),
    "phase2": (1000.0, 3000.0),
    "phase3": (3000.0, 8000.0),
    "filing": (200.0, 800.0),
}

DRUG_DISCOVERY_DISCOUNT_RATE = {"pessimistic": 0.12, "base": 0.11, "optimistic": 0.10}
DRUG_DISCOVERY_HORIZON_YEARS = 15


def _gen_asset(rng: random.Random, current_phase: str, name: str) -> Dict[str, Any]:
    probs = {p: min(0.99, max(0.01, _BASE_PHASE_PROBS[p] + rng.uniform(-0.1, 0.1))) for p in _PHASES}
    durations = {p: max(1, _BASE_PHASE_DURATIONS[p] + rng.randint(-1, 1)) for p in _PHASES}
    costs = {p: rng.uniform(*_BASE_PHASE_COSTS[p]) for p in _PHASES}

    launch_year = sum(durations[p] for p in _PHASES[_PHASES.index(current_phase):]) + rng.randint(-1, 2)
    launch_year = max(1, launch_year)

    if rng.random() < 0.5:
        commercialization = {"type": "own", "contributionMargin": rng.uniform(0.5, 0.8)}
    else:
        remaining = _PHASES[_PHASES.index(current_phase):]
        milestone_phases = rng.sample(remaining, k=min(2, len(remaining)))
        milestones = [
            {"phase": p, "amount": rng.uniform(200.0, 2000.0)} for p in milestone_phases
        ]
        milestones.append({"phase": "launch", "amount": rng.uniform(500.0, 3000.0)})
        commercialization = {
            "type": "license",
            "royaltyRate": rng.uniform(0.08, 0.20),
            "milestones": milestones,
        }

    return {
        "name": name,
        "currentPhase": current_phase,
        "phaseSuccessProbs": probs,
        "phaseDurations": durations,
        "developmentCosts": costs,
        "launchYear": launch_year,
        "peakSales": rng.uniform(500.0, 5000.0),
        "yearsToPeak": rng.randint(2, 5),
        "plateauYears": rng.randint(0, 5),
        "declineRate": rng.uniform(0.05, 0.2),
        "commercialization": commercialization,
    }


def gen_drug_discovery(rng: random.Random) -> Dict[str, Any]:
    n_assets = rng.randint(1, 3)
    assets = [
        _gen_asset(rng, rng.choice(_PHASES), f"asset-{i + 1}") for i in range(n_assets)
    ]
    return {
        "assets": assets,
        "discountRate": dict(DRUG_DISCOVERY_DISCOUNT_RATE),
        "modelHorizonYears": DRUG_DISCOVERY_HORIZON_YEARS,
    }


def gen_medical_device(rng: random.Random) -> Dict[str, Any]:
    terminal_growth = rng.uniform(0.01, 0.02)
    base_rate = rng.uniform(0.10, 0.15)
    discount_rate = {
        "pessimistic": base_rate + 0.02,
        "base": base_rate,
        "optimistic": max(terminal_growth + 0.01, base_rate - 0.02),
    }
    return {
        "annualProcedures": rng.uniform(500.0, 20000.0),
        "procedureGrowth": rng.uniform(-0.05, 0.25),
        "deviceClass": rng.choice(["I", "II", "III", "IV"]),
        "launchYear": rng.randint(1, 3),
        "approvalDelayYears": rng.randint(0, 3),
        "pricePerProcedure": rng.uniform(50000.0, 500000.0),
        "peakPenetration": rng.uniform(0.1, 0.6),
        "yearsToPeak": rng.randint(2, 6),
        "recurringRatio": rng.uniform(0.0, 0.5),
        "operatingMargin": rng.uniform(0.05, 0.35),
        "discountRate": discount_rate,
        "projectionYears": 10,
        "terminalGrowth": terminal_growth,
    }


def gen_media_tech(rng: random.Random) -> Dict[str, Any]:
    return {
        "mau": rng.uniform(100_000.0, 50_000_000.0),
        "mauGrowth": rng.uniform(-0.1, 1.0),
        "growthDecayFactor": rng.uniform(0.7, 0.95),
        "dauMauRatio": rng.uniform(0.2, 0.7),
        "arpuMonthly": {
            "ad": rng.uniform(0.0, 500.0),
            "paid": rng.uniform(0.0, 500.0),
            "commerce": rng.uniform(0.0, 500.0),
        },
        "monthlyChurn": rng.uniform(0.0, 0.15),
        "contentCostRatio": rng.uniform(0.1, 0.6),
        "cpa": rng.uniform(100.0, 5000.0),
        "evSalesMultiple": _range3(rng, 3.0, 12.0, 0.35),
        "projectionYears": 3,
    }


def gen_ec_d2c(rng: random.Random) -> Dict[str, Any]:
    multiple_basis = rng.choice(["revenue", "grossProfit"])
    if multiple_basis == "revenue":
        ev_multiple = _range3(rng, 1.0, 4.0, 0.3)
    else:
        ev_multiple = _range3(rng, 3.0, 10.0, 0.3)
    return {
        "annualRevenue": rng.uniform(50.0, 10000.0),
        "revenueGrowth": rng.uniform(-0.1, 0.8),
        "grossMargin": rng.uniform(0.2, 0.7),
        "f2Rate": rng.uniform(0.1, 0.7),
        "aov": rng.uniform(2000.0, 30000.0),
        "purchaseFrequency": rng.uniform(1.0, 6.0),
        "cac": rng.uniform(1000.0, 15000.0),
        "adCostRatio": rng.uniform(0.05, 0.3),
        "logisticsCostRatio": rng.uniform(0.05, 0.25),
        "inventoryTurnover": rng.uniform(2.0, 12.0),
        "multipleBasis": multiple_basis,
        "evMultiple": ev_multiple,
        "maxLifetimeYears": 10,
    }


def gen_climate_tech(rng: random.Random) -> Dict[str, Any]:
    mass_production_year = rng.randint(3, 8)
    n_capex = rng.randint(2, 4)
    capex_years = sorted(rng.sample(range(0, mass_production_year + 1), k=min(n_capex, mass_production_year + 1)))
    capex_schedule = [
        {"yearIndex": y, "amount": rng.uniform(500.0, 5000.0)} for y in capex_years
    ]
    unit_price = rng.uniform(500.0, 50000.0)
    base_rate = rng.uniform(0.08, 0.14)
    return {
        "capexSchedule": capex_schedule,
        "subsidyCoverage": rng.uniform(0.0, 0.5),
        "massProductionYear": mass_production_year,
        "massProductionProb": rng.uniform(0.2, 0.9),
        "annualCapacityUnits": rng.uniform(10_000.0, 1_000_000.0),
        "rampYears": rng.randint(1, 4),
        "unitPrice": unit_price,
        "unitCost0": unit_price * rng.uniform(0.6, 1.3),
        "costDeclineRate": rng.uniform(0.02, 0.15),
        "offtakeCoverage": rng.uniform(0.0, 0.8),
        "merchantRealization": 1.0,
        "fixedOpexAnnual": rng.uniform(100.0, 2000.0),
        "carbonCreditVolume": rng.uniform(0.0, 500_000.0),
        "carbonCreditPrice": rng.uniform(0.0, 15000.0),
        "discountRate": {
            "pessimistic": base_rate + 0.02,
            "base": base_rate,
            "optimistic": base_rate - 0.02,
        },
        "projectYears": 20,
    }
