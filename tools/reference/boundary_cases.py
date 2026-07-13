"""境界値ケース(要件Rev.4 §7: ゼロ成長・成功確率0/1・割引率上限 等)。

ランダム生成とは別に、各ケースを明示的な dict で固定する(可読性・再現性のため)。
「単一ラウンド」境界(要件§7)は資本政策シミュレーター(希薄化, src/engine/common)の
境界値であり、6セクターモデルには適用対象がないため本ファイルには含めない。
"""

from typing import Any, Dict, List, Tuple

BoundaryCase = Tuple[str, List[str], Dict[str, Any]]


def saas_cases() -> List[BoundaryCase]:
    return [
        (
            "zero-growth-current",
            ["boundary", "zero-growth"],
            {
                "arr": 1000.0,
                "arrGrowth": 0.0,
                "nrr": 1.0,
                "grossMargin": 0.7,
                "operatingMargin": 0.1,
                "fcfMargin": 0.1,
                "grossChurn": 0.1,
                "cacPaybackMonths": 18.0,
                "arrBasis": "current",
                "evArrMultiple": {"pessimistic": 5.0, "base": 8.0, "optimistic": 12.0},
                "projectionYears": 5,
                "growthDecayFactor": 0.85,
                "discountRate": 0.12,
                "terminalGrowth": 0.02,
            },
        ),
        (
            "zero-growth-ntm",
            ["boundary", "zero-growth"],
            {
                "arr": 1000.0,
                "arrGrowth": 0.0,
                "nrr": 1.0,
                "grossMargin": 0.7,
                "operatingMargin": 0.1,
                "fcfMargin": 0.1,
                "grossChurn": 0.1,
                "cacPaybackMonths": 18.0,
                "arrBasis": "ntm",
                "evArrMultiple": {"pessimistic": 5.0, "base": 8.0, "optimistic": 12.0},
                "projectionYears": 5,
                "growthDecayFactor": 0.85,
                "discountRate": 0.12,
                "terminalGrowth": 0.02,
            },
        ),
        (
            "arr-zero",
            ["boundary", "zero-value"],
            {
                "arr": 0.0,
                "arrGrowth": 0.3,
                "nrr": 1.1,
                "grossMargin": 0.7,
                "operatingMargin": -0.2,
                "fcfMargin": -0.1,
                "grossChurn": 0.15,
                "cacPaybackMonths": 24.0,
                "arrBasis": "ntm",
                "evArrMultiple": {"pessimistic": 5.0, "base": 8.0, "optimistic": 12.0},
                "projectionYears": 5,
                "growthDecayFactor": 0.85,
                "discountRate": 0.12,
                "terminalGrowth": 0.02,
            },
        ),
        (
            "discount-rate-upper-bound",
            ["boundary", "discount-rate-upper-bound"],
            {
                "arr": 800.0,
                "arrGrowth": 0.4,
                "nrr": 1.15,
                "grossMargin": 0.75,
                "operatingMargin": 0.0,
                "fcfMargin": 0.05,
                "grossChurn": 0.08,
                "cacPaybackMonths": 15.0,
                "arrBasis": "ntm",
                "evArrMultiple": {"pessimistic": 5.0, "base": 8.0, "optimistic": 12.0},
                "projectionYears": 5,
                "growthDecayFactor": 0.85,
                "discountRate": 0.95,
                "terminalGrowth": 0.02,
            },
        ),
    ]


def drug_discovery_cases() -> List[BoundaryCase]:
    default_probs_zero_at_phase2 = {
        "preclinical": 0.5,
        "phase1": 0.55,
        "phase2": 0.0,
        "phase3": 0.6,
        "filing": 0.85,
    }
    all_one_probs = {p: 1.0 for p in ["preclinical", "phase1", "phase2", "phase3", "filing"]}
    durations = {"preclinical": 2, "phase1": 2, "phase2": 2, "phase3": 3, "filing": 1}
    costs = {
        "preclinical": 400.0,
        "phase1": 900.0,
        "phase2": 2000.0,
        "phase3": 5000.0,
        "filing": 400.0,
    }
    own_commercialization = {"type": "own", "contributionMargin": 0.65}

    return [
        (
            "success-prob-zero",
            ["boundary", "success-prob-0"],
            {
                "assets": [
                    {
                        "name": "asset-prob-zero",
                        "currentPhase": "preclinical",
                        "phaseSuccessProbs": default_probs_zero_at_phase2,
                        "phaseDurations": durations,
                        "developmentCosts": costs,
                        "launchYear": 10,
                        "peakSales": 3000.0,
                        "yearsToPeak": 3,
                        "plateauYears": 3,
                        "declineRate": 0.1,
                        "commercialization": own_commercialization,
                    }
                ],
                "discountRate": {"pessimistic": 0.12, "base": 0.11, "optimistic": 0.10},
                "modelHorizonYears": 15,
            },
        ),
        (
            "success-prob-one",
            ["boundary", "success-prob-1"],
            {
                "assets": [
                    {
                        "name": "asset-prob-one",
                        "currentPhase": "preclinical",
                        "phaseSuccessProbs": all_one_probs,
                        "phaseDurations": durations,
                        "developmentCosts": costs,
                        "launchYear": 10,
                        "peakSales": 3000.0,
                        "yearsToPeak": 3,
                        "plateauYears": 3,
                        "declineRate": 0.1,
                        "commercialization": own_commercialization,
                    }
                ],
                "discountRate": {"pessimistic": 0.12, "base": 0.11, "optimistic": 0.10},
                "modelHorizonYears": 15,
            },
        ),
        (
            "peak-sales-zero",
            ["boundary", "zero-value"],
            {
                "assets": [
                    {
                        "name": "asset-peak-zero",
                        "currentPhase": "phase2",
                        "phaseSuccessProbs": {
                            "preclinical": 1.0,
                            "phase1": 1.0,
                            "phase2": 0.35,
                            "phase3": 0.6,
                            "filing": 0.85,
                        },
                        "phaseDurations": durations,
                        "developmentCosts": costs,
                        "launchYear": 6,
                        "peakSales": 0.0,
                        "yearsToPeak": 3,
                        "plateauYears": 2,
                        "declineRate": 0.1,
                        "commercialization": own_commercialization,
                    }
                ],
                "discountRate": {"pessimistic": 0.12, "base": 0.11, "optimistic": 0.10},
                "modelHorizonYears": 15,
            },
        ),
        (
            "discount-rate-upper-bound",
            ["boundary", "discount-rate-upper-bound"],
            {
                "assets": [
                    {
                        "name": "asset-high-discount",
                        "currentPhase": "phase3",
                        "phaseSuccessProbs": {
                            "preclinical": 1.0,
                            "phase1": 1.0,
                            "phase2": 1.0,
                            "phase3": 0.6,
                            "filing": 0.85,
                        },
                        "phaseDurations": durations,
                        "developmentCosts": costs,
                        "launchYear": 4,
                        "peakSales": 4000.0,
                        "yearsToPeak": 3,
                        "plateauYears": 4,
                        "declineRate": 0.1,
                        "commercialization": own_commercialization,
                    }
                ],
                "discountRate": {"pessimistic": 0.5, "base": 0.45, "optimistic": 0.4},
                "modelHorizonYears": 15,
            },
        ),
    ]


def medical_device_cases() -> List[BoundaryCase]:
    base = {
        "annualProcedures": 5000.0,
        "procedureGrowth": 0.05,
        "deviceClass": "II",
        "launchYear": 2,
        "approvalDelayYears": 0,
        "pricePerProcedure": 150000.0,
        "peakPenetration": 0.3,
        "yearsToPeak": 4,
        "recurringRatio": 0.2,
        "operatingMargin": 0.15,
        "discountRate": {"pessimistic": 0.14, "base": 0.12, "optimistic": 0.10},
        "projectionYears": 10,
        "terminalGrowth": 0.02,
    }
    return [
        ("zero-growth", ["boundary", "zero-growth"], {**base, "procedureGrowth": 0.0}),
        (
            "peak-penetration-zero",
            ["boundary", "zero-value"],
            {**base, "peakPenetration": 0.0},
        ),
        (
            "annual-procedures-zero",
            ["boundary", "zero-value"],
            {**base, "annualProcedures": 0.0},
        ),
        (
            "discount-rate-upper-bound",
            ["boundary", "discount-rate-upper-bound"],
            {**base, "discountRate": {"pessimistic": 0.9, "base": 0.85, "optimistic": 0.8}},
        ),
    ]


def media_tech_cases() -> List[BoundaryCase]:
    base = {
        "mau": 2_000_000.0,
        "mauGrowth": 0.3,
        "growthDecayFactor": 0.85,
        "dauMauRatio": 0.4,
        "arpuMonthly": {"ad": 100.0, "paid": 50.0, "commerce": 20.0},
        "monthlyChurn": 0.05,
        "contentCostRatio": 0.3,
        "cpa": 800.0,
        "evSalesMultiple": {"pessimistic": 3.0, "base": 5.0, "optimistic": 8.0},
        "projectionYears": 3,
    }
    return [
        ("zero-growth", ["boundary", "zero-growth"], {**base, "mauGrowth": 0.0}),
        ("mau-zero", ["boundary", "zero-value"], {**base, "mau": 0.0}),
        ("churn-zero", ["boundary", "zero-value"], {**base, "monthlyChurn": 0.0}),
    ]


def ec_d2c_cases() -> List[BoundaryCase]:
    base = {
        "annualRevenue": 2000.0,
        "revenueGrowth": 0.25,
        "grossMargin": 0.45,
        "f2Rate": 0.35,
        "aov": 8000.0,
        "purchaseFrequency": 2.5,
        "cac": 4000.0,
        "adCostRatio": 0.15,
        "logisticsCostRatio": 0.1,
        "inventoryTurnover": 6.0,
        "multipleBasis": "revenue",
        "evMultiple": {"pessimistic": 1.5, "base": 2.5, "optimistic": 4.0},
        "maxLifetimeYears": 10,
    }
    return [
        ("zero-growth", ["boundary", "zero-growth"], {**base, "revenueGrowth": 0.0}),
        (
            "annual-revenue-zero",
            ["boundary", "zero-value"],
            {**base, "annualRevenue": 0.0},
        ),
        (
            "f2-rate-near-one",
            ["boundary", "lifetime-cap"],
            {**base, "f2Rate": 0.999},
        ),
    ]


def climate_tech_cases() -> List[BoundaryCase]:
    base = {
        "capexSchedule": [
            {"yearIndex": 0, "amount": 2000.0},
            {"yearIndex": 1, "amount": 1500.0},
        ],
        "subsidyCoverage": 0.2,
        "massProductionYear": 4,
        "massProductionProb": 0.6,
        "annualCapacityUnits": 200000.0,
        "rampYears": 2,
        "unitPrice": 8000.0,
        "unitCost0": 9000.0,
        "costDeclineRate": 0.08,
        "offtakeCoverage": 0.4,
        "merchantRealization": 1.0,
        "fixedOpexAnnual": 500.0,
        "carbonCreditVolume": 100000.0,
        "carbonCreditPrice": 5000.0,
        "discountRate": {"pessimistic": 0.12, "base": 0.10, "optimistic": 0.08},
        "projectYears": 20,
    }
    return [
        (
            "mass-production-prob-zero",
            ["boundary", "success-prob-0"],
            {**base, "massProductionProb": 0.0},
        ),
        (
            "mass-production-prob-one",
            ["boundary", "success-prob-1"],
            {**base, "massProductionProb": 1.0},
        ),
        (
            "discount-rate-upper-bound",
            ["boundary", "discount-rate-upper-bound"],
            {
                **base,
                "discountRate": {"pessimistic": 0.5, "base": 0.45, "optimistic": 0.4},
            },
        ),
    ]
