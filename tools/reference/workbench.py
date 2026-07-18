"""V2 Investment Case Workbench モデルの独立Python実装。docs/engine-spec.md §5 に対応。

TSエンジン(`src/engine/workbench/`)との golden 突合(相対誤差 1e-9)のため、
成長投影・Valuation Bridge・セクター別Exit評価を TS 実装から独立に再実装する。

境界値・シード固定ランダムケースの生成(`boundary_cases` / `gen_random`)もこのファイルに
同梱する(6セクターモデルと異なり、workbench は「セクター×Exit評価」+「共通Valuation
Bridge」の組み合わせのため、既存の `boundary_cases.py` / `random_inputs.py` とは
ケース形状(`sector` / `exitInputs` / `coreInputs`)が異なる)。
"""

from typing import Any, Dict, List, Optional, Tuple

from .common import gordon_terminal_value, irr_bisection, pv

WorkbenchCase = Tuple[str, List[str], Dict[str, Any]]

SECTORS = ["saas_jp", "ec_d2c", "media_tech", "medical_device", "drug_discovery", "climate_tech"]


def project_metric(current_value: float, initial_growth: float, growth_decay: float, years: float) -> Dict[str, Any]:
    """g_t = initialGrowth × growthDecay^(t−1)  (t = 1..years)、value_t = value_{t−1} × (1+g_t)。"""
    value = current_value
    series: List[float] = []
    final_growth = initial_growth
    for year in range(1, max(0, int(years)) + 1):
        growth = initial_growth * (growth_decay ** (year - 1))
        value = value * (1.0 + growth)
        final_growth = growth
        series.append(value)
    return {"value": value, "finalGrowth": final_growth, "series": series}


def _terminal_value_guarded(final_cf: float, rate: float, terminal_growth: float) -> float:
    """v2独自仕様: rate <= terminalGrowth のとき0を返す(TS版 terminalValueGuarded と同一)。"""
    if rate <= terminal_growth:
        return 0.0
    return gordon_terminal_value(final_cf, rate, terminal_growth)


def saas_exit(inputs: Dict[str, Any]) -> Dict[str, Any]:
    projection = project_metric(inputs["currentArr"], inputs["arrGrowth"], inputs["growthDecay"], inputs["yearsToExit"])
    exit_ev = projection["value"] * inputs["exitMultiple"]
    rule_of_40 = (projection["finalGrowth"] + inputs["exitOperatingMargin"]) * 100.0
    return {
        "exitMetricLabel": "Exit ARR",
        "exitMetric": projection["value"],
        "exitEnterpriseValue": exit_ev,
        "diagnostics": {"exitGrowthRate": projection["finalGrowth"], "ruleOf40": rule_of_40},
        "warnings": [],
    }


def ec_d2c_exit(inputs: Dict[str, Any]) -> Dict[str, Any]:
    projection = project_metric(
        inputs["currentRevenue"], inputs["revenueGrowth"], inputs["growthDecay"], inputs["yearsToExit"]
    )
    basis = inputs["multipleBasis"]
    metric = projection["value"] * inputs["exitGrossMargin"] if basis == "grossProfit" else projection["value"]
    exit_ev = metric * inputs["exitMultiple"]
    return {
        "exitMetricLabel": "Exit粗利" if basis == "grossProfit" else "Exit売上",
        "exitMetric": metric,
        "exitEnterpriseValue": exit_ev,
        "diagnostics": {"exitRevenue": projection["value"], "exitGrossMargin": inputs["exitGrossMargin"]},
        "warnings": [],
    }


def media_tech_exit(inputs: Dict[str, Any]) -> Dict[str, Any]:
    mau = project_metric(inputs["currentMau"], inputs["mauGrowth"], inputs["growthDecay"], inputs["yearsToExit"])
    arpu = project_metric(inputs["currentMonthlyArpu"], inputs["arpuGrowth"], 1.0, inputs["yearsToExit"])
    exit_revenue = (mau["value"] * arpu["value"] * 12.0) / 1e6
    exit_ev = exit_revenue * inputs["exitMultiple"]
    return {
        "exitMetricLabel": "Exit売上",
        "exitMetric": exit_revenue,
        "exitEnterpriseValue": exit_ev,
        "diagnostics": {"exitMau": mau["value"], "exitMonthlyArpu": arpu["value"]},
        "warnings": [],
    }


def medical_device_exit(inputs: Dict[str, Any]) -> Dict[str, Any]:
    launch = inputs["launchYear"] + inputs["approvalDelayYears"]
    years_to_peak = max(1.0, inputs["yearsToPeak"] or 1.0)
    projection_years = max(10, int(inputs["yearsToExit"]))
    cashflow_values: List[float] = []
    exit_revenue = 0.0

    for year in range(1, projection_years + 1):
        procedures = inputs["annualProcedures"] * (1.0 + inputs["procedureGrowth"]) ** year
        if year < launch:
            penetration = 0.0
        else:
            penetration = min(inputs["peakPenetration"], (inputs["peakPenetration"] * (year - launch + 1)) / years_to_peak)
        device_revenue = (procedures * penetration * inputs["pricePerProcedure"]) / 1e6
        total_revenue = device_revenue / (1.0 - inputs["recurringRatio"]) if inputs["recurringRatio"] < 1 else 0.0
        cashflow_values.append(total_revenue * inputs["operatingMargin"])
        if year == inputs["yearsToExit"]:
            exit_revenue = total_revenue

    cashflows = [(i + 1, cf) for i, cf in enumerate(cashflow_values)]
    final_cf = cashflow_values[-1] if cashflow_values else 0.0
    tv = _terminal_value_guarded(final_cf, inputs["discountRate"], inputs["terminalGrowth"])
    intrinsic = pv(cashflows, inputs["discountRate"]) + tv / (1.0 + inputs["discountRate"]) ** projection_years
    exit_ev = exit_revenue * inputs["exitMultiple"]

    warnings = ["割引率は永久成長率を上回る必要があります。"] if inputs["discountRate"] <= inputs["terminalGrowth"] else []
    return {
        "exitMetricLabel": "Exit売上",
        "exitMetric": exit_revenue,
        "exitEnterpriseValue": exit_ev,
        "intrinsicValue": intrinsic,
        "diagnostics": {"effectiveLaunchYear": launch, "exitRevenue": exit_revenue},
        "warnings": warnings,
    }


def drug_discovery_exit(inputs: Dict[str, Any]) -> Dict[str, Any]:
    peak_sales = inputs["currentPeakSales"] * (1.0 + inputs["peakSalesGrowth"]) ** inputs["yearsToExit"]
    risk_adjusted_economic_value = peak_sales * inputs["posAtExit"] * inputs["valueCaptureRate"]
    exit_ev = risk_adjusted_economic_value * inputs["exitMultiple"]
    return {
        "exitMetricLabel": "リスク調整後経済価値",
        "exitMetric": risk_adjusted_economic_value,
        "exitEnterpriseValue": exit_ev,
        "intrinsicValue": inputs["currentRnpv"],
        "diagnostics": {"peakSalesAtExit": peak_sales, "posAtExit": inputs["posAtExit"]},
        "warnings": ["Exit価値はイベント取引価値の簡易モデルです。案件固有の導出・M&A条件で調整してください。"],
    }


def climate_tech_exit(inputs: Dict[str, Any]) -> Dict[str, Any]:
    realization = inputs["offtakeCoverage"] + (1.0 - inputs["offtakeCoverage"]) * inputs["merchantRealization"]
    cost_at_exit = inputs["unitCost"] * (1.0 - inputs["costDeclineRate"]) ** inputs["yearsToExit"]
    unit_margin = inputs["unitPrice"] - cost_at_exit
    operating_contribution = (inputs["annualCapacity"] * realization * unit_margin) / 1e6
    carbon_revenue = (inputs["carbonCreditVolume"] * inputs["carbonCreditPrice"]) / 1e6
    ebitda = operating_contribution + carbon_revenue - inputs["fixedOpex"]
    risk_adjusted_ebitda = ebitda * inputs["massProductionProbability"]
    exit_ev = risk_adjusted_ebitda * inputs["exitMultiple"]
    return {
        "exitMetricLabel": "確率調整後Exit EBITDA",
        "exitMetric": risk_adjusted_ebitda,
        "exitEnterpriseValue": exit_ev,
        "intrinsicValue": inputs["currentProjectNpv"],
        "diagnostics": {"exitUnitCost": cost_at_exit, "unadjustedExitEbitda": ebitda},
        "warnings": [],
    }


EXIT_FUNCTIONS = {
    "saas_jp": saas_exit,
    "ec_d2c": ec_d2c_exit,
    "media_tech": media_tech_exit,
    "medical_device": medical_device_exit,
    "drug_discovery": drug_discovery_exit,
    "climate_tech": climate_tech_exit,
}


def build_case_result(core: Dict[str, Any], exit_valuation: Dict[str, Any]) -> Dict[str, Any]:
    """Valuation Bridge(docs/redesign-v2.md §4)+ 期待リターン順算。"""
    warnings: List[str] = list(exit_valuation.get("warnings") or [])
    exit_enterprise_value = exit_valuation["exitEnterpriseValue"]
    exit_equity_value = exit_enterprise_value - core["exitNetDebt"]
    target_moic = core["targetMoic"]
    years_to_exit = core["yearsToExit"]
    investment = core["investmentAmount"]

    current_allowable_post_money = (
        exit_equity_value / target_moic if exit_equity_value > 0 and target_moic > 0 else 0.0
    )
    current_allowable_pre_money = current_allowable_post_money - investment
    required_entry_ownership = (
        investment / current_allowable_post_money if current_allowable_post_money > 0 else 0.0
    )
    implied_target_irr = (
        target_moic ** (1.0 / years_to_exit) - 1.0 if target_moic > 0 and years_to_exit > 0 else 0.0
    )

    fully_diluted_shares = core["fullyDilutedShares"]
    theoretical_share_price = (
        current_allowable_pre_money / fully_diluted_shares if fully_diluted_shares > 0 else None
    )
    proposed_price_per_share = (
        core["proposedPreMoney"] / fully_diluted_shares if fully_diluted_shares > 0 else None
    )
    valuation_gap_to_proposed = (
        current_allowable_pre_money / core["proposedPreMoney"] - 1.0 if core["proposedPreMoney"] > 0 else None
    )

    proposed_post_money = core["proposedPreMoney"] + investment
    expected_entry_ownership = investment / proposed_post_money if proposed_post_money > 0 else 0.0
    expected_exit_ownership = expected_entry_ownership * core["dilutionRetention"]
    expected_proceeds = max(0.0, exit_equity_value) * expected_exit_ownership
    expected_moic = expected_proceeds / investment if investment > 0 else None
    expected_irr = (
        expected_moic ** (1.0 / years_to_exit) - 1.0
        if expected_moic is not None and expected_moic >= 0 and years_to_exit > 0
        else None
    )

    if exit_enterprise_value <= 0:
        warnings.append("Exit企業価値が0以下です。")
    if exit_equity_value <= 0:
        warnings.append("Exit株式価値が0以下です。")
    if current_allowable_pre_money < 0:
        warnings.append("要求リターンから逆算した許容Pre-moneyが0未満です。")
    if required_entry_ownership > 1:
        warnings.append("要求持分が100%を超えており、この条件では投資が成立しません。")
    if core["dilutionRetention"] <= 0 or core["dilutionRetention"] > 1:
        warnings.append("持分残存率は0%超100%以下にしてください。")

    deduped_warnings = list(dict.fromkeys(warnings))

    return {
        "exitMetricLabel": exit_valuation["exitMetricLabel"],
        "exitMetric": exit_valuation["exitMetric"],
        "exitEnterpriseValue": exit_enterprise_value,
        "exitEquityValue": exit_equity_value,
        "currentAllowablePostMoney": current_allowable_post_money,
        "currentAllowablePreMoney": current_allowable_pre_money,
        "theoreticalSharePrice": theoretical_share_price,
        "requiredEntryOwnership": required_entry_ownership,
        "impliedTargetIrr": implied_target_irr,
        "proposedPricePerShare": proposed_price_per_share,
        "valuationGapToProposed": valuation_gap_to_proposed,
        "expectedEntryOwnership": expected_entry_ownership,
        "expectedExitOwnership": expected_exit_ownership,
        "expectedProceeds": expected_proceeds,
        "expectedMoic": expected_moic,
        "expectedIrr": expected_irr,
        "intrinsicValue": exit_valuation.get("intrinsicValue"),
        "diagnostics": exit_valuation.get("diagnostics") or {},
        "warnings": deduped_warnings,
    }


def compute(case_input: Dict[str, Any]) -> Dict[str, Any]:
    sector = case_input["sector"]
    exit_valuation = EXIT_FUNCTIONS[sector](case_input["exitInputs"])
    return build_case_result(case_input["coreInputs"], exit_valuation)


def follow_on_return(
    core: Dict[str, Any], follow_ons: List[Dict[str, Any]], exit_equity_value: float
) -> Dict[str, Any]:
    """追加出資を含む投資家リターン(docs/v2-adoption-spec.md §6.2、docs/engine-spec.md §5.5)。

    初回: e_0 = investmentAmount / (proposedPreMoney + investmentAmount)
    追加出資 i: e_i = amount_i / postMoney_i
    Exit持分 = (Σ e_i) × dilutionRetention、回収 = max(0, exitEquityValue) × Exit持分
    MOIC = 回収 / Σ amount、IRR = irrBisection([(0,-初回), (yearOffset_i,-amount_i)..., (yearsToExit,+回収)])
    """
    proposed_post_money = core["proposedPreMoney"] + core["investmentAmount"]
    initial_ownership_share = core["investmentAmount"] / proposed_post_money if proposed_post_money > 0 else 0.0

    tranches: List[Dict[str, Any]] = []
    previous_post_money = proposed_post_money
    for item in follow_ons:
        ownership_share = item["amount"] / item["postMoney"] if item["postMoney"] > 0 else 0.0
        multiple = item["postMoney"] / previous_post_money if previous_post_money > 0 else None
        tranches.append(
            {
                "label": item["label"],
                "yearOffset": item["yearOffset"],
                "amount": item["amount"],
                "postMoney": item["postMoney"],
                "ownershipShare": ownership_share,
                "multipleOfPreviousPostMoney": multiple,
            }
        )
        previous_post_money = item["postMoney"]

    total_ownership_share = initial_ownership_share + sum(t["ownershipShare"] for t in tranches)
    exit_ownership_share = total_ownership_share * core["dilutionRetention"]
    proceeds = max(0.0, exit_equity_value) * exit_ownership_share
    total_invested = core["investmentAmount"] + sum(item["amount"] for item in follow_ons)
    moic_value: Optional[float] = proceeds / total_invested if total_invested > 0 else None

    cashflows: List[Tuple[int, float]] = [(0, -core["investmentAmount"])]
    for item in follow_ons:
        cashflows.append((item["yearOffset"], -item["amount"]))
    cashflows.append((core["yearsToExit"], proceeds))
    irr_value = irr_bisection(cashflows)

    warnings: List[str] = []
    if total_ownership_share > 1:
        warnings.append("追加出資を含む持分合計が100%を超えています。")

    return {
        "tranches": tranches,
        "initialOwnershipShare": initial_ownership_share,
        "totalOwnershipShare": total_ownership_share,
        "exitOwnershipShare": exit_ownership_share,
        "totalInvested": total_invested,
        "proceeds": proceeds,
        "moic": moic_value,
        "irr": irr_value,
        "warnings": warnings,
    }


# --- ケース生成(境界値・シード固定ランダム) -------------------------------------------

_DEFAULT_CORE = {
    "fullyDilutedShares": 10.0,
    "proposedPreMoney": 3000.0,
    "investmentAmount": 300.0,
    "targetMoic": 10.0,
    "yearsToExit": 5,
    "dilutionRetention": 0.7,
    "exitNetDebt": 0.0,
}

_DEFAULT_SAAS_EXIT = {
    "currentArr": 1000.0,
    "arrGrowth": 0.35,
    "growthDecay": 0.9,
    "exitOperatingMargin": 0.15,
    "exitMultiple": 10.0,
    "yearsToExit": 5,
}


def boundary_cases() -> List[WorkbenchCase]:
    def case(case_id: str, tags: List[str], sector: str, exit_inputs: Dict[str, Any], core_overrides: Dict[str, Any]) -> WorkbenchCase:
        # followOns は coreInputs ではなくケース直下のキー(追加出資テストケース専用、§6.2)。
        overrides = dict(core_overrides)
        follow_ons = overrides.pop("followOns", None)
        core = {**_DEFAULT_CORE, **overrides}
        exit_inputs = {**exit_inputs, "yearsToExit": core["yearsToExit"]}
        payload: Dict[str, Any] = {"sector": sector, "exitInputs": exit_inputs, "coreInputs": core}
        if follow_ons is not None:
            payload["followOns"] = follow_ons
        return (case_id, tags, payload)

    cases: List[WorkbenchCase] = [
        case("saas-zero-growth", ["boundary", "zero-growth"], "saas_jp", {**_DEFAULT_SAAS_EXIT, "arrGrowth": 0.0}, {}),
        case("saas-negative-growth", ["boundary", "negative-growth"], "saas_jp", {**_DEFAULT_SAAS_EXIT, "arrGrowth": -0.2}, {}),
        case("saas-target-moic-one", ["boundary", "target-moic-one"], "saas_jp", _DEFAULT_SAAS_EXIT, {"targetMoic": 1.0}),
        case("saas-years-to-exit-one", ["boundary", "years-to-exit-one"], "saas_jp", _DEFAULT_SAAS_EXIT, {"yearsToExit": 1}),
        case(
            "saas-fully-diluted-shares-zero",
            ["boundary", "fully-diluted-shares-zero"],
            "saas_jp",
            _DEFAULT_SAAS_EXIT,
            {"fullyDilutedShares": 0.0},
        ),
        case(
            "saas-exit-net-debt-equity-non-positive",
            ["boundary", "exit-equity-non-positive"],
            "saas_jp",
            {**_DEFAULT_SAAS_EXIT, "arrGrowth": 0.05, "exitMultiple": 2.0},
            {"exitNetDebt": 1_000_000.0},
        ),
        case(
            "saas-dilution-retention-out-of-range",
            ["boundary", "dilution-retention-invalid"],
            "saas_jp",
            _DEFAULT_SAAS_EXIT,
            {"dilutionRetention": 0.0},
        ),
        case(
            "ec-d2c-zero-growth-gross-profit-basis",
            ["boundary", "zero-growth"],
            "ec_d2c",
            {
                "currentRevenue": 2000.0,
                "revenueGrowth": 0.0,
                "growthDecay": 0.9,
                "exitGrossMargin": 0.5,
                "multipleBasis": "grossProfit",
                "exitMultiple": 2.0,
                "yearsToExit": 5,
            },
            {},
        ),
        case(
            "media-tech-negative-growth",
            ["boundary", "negative-growth"],
            "media_tech",
            {
                "currentMau": 2_000_000.0,
                "mauGrowth": -0.1,
                "growthDecay": 0.9,
                "currentMonthlyArpu": 170.0,
                "arpuGrowth": -0.05,
                "exitMultiple": 1.5,
                "yearsToExit": 5,
            },
            {},
        ),
        case(
            "medical-device-years-to-exit-one",
            ["boundary", "years-to-exit-one"],
            "medical_device",
            {
                "annualProcedures": 15000.0,
                "pricePerProcedure": 150000.0,
                "launchYear": 2,
                "recurringRatio": 0.2,
                "procedureGrowth": 0.08,
                "approvalDelayYears": 0,
                "peakPenetration": 0.4,
                "yearsToPeak": 3,
                "operatingMargin": 0.22,
                "discountRate": 0.1,
                "terminalGrowth": 0.02,
                "exitMultiple": 5.0,
                "yearsToExit": 1,
            },
            {"yearsToExit": 1},
        ),
        case(
            "medical-device-discount-rate-at-terminal-growth",
            ["boundary", "terminal-growth-guard"],
            "medical_device",
            {
                "annualProcedures": 15000.0,
                "pricePerProcedure": 150000.0,
                "launchYear": 2,
                "recurringRatio": 0.2,
                "procedureGrowth": 0.08,
                "approvalDelayYears": 0,
                "peakPenetration": 0.4,
                "yearsToPeak": 3,
                "operatingMargin": 0.22,
                "discountRate": 0.02,
                "terminalGrowth": 0.02,
                "exitMultiple": 5.0,
                "yearsToExit": 5,
            },
            {},
        ),
        case(
            "drug-discovery-negative-peak-sales-growth",
            ["boundary", "negative-growth"],
            "drug_discovery",
            {
                "currentRnpv": 1200.0,
                "currentPeakSales": 5000.0,
                "peakSalesGrowth": -0.1,
                "yearsToExit": 5,
                "posAtExit": 0.05,
                "valueCaptureRate": 0.25,
                "exitMultiple": 0.8,
            },
            {},
        ),
        case(
            "followon-zero-tranches",
            ["boundary", "follow-on", "follow-on-zero"],
            "saas_jp",
            _DEFAULT_SAAS_EXIT,
            {"followOns": []},
        ),
        case(
            "followon-single-tranche",
            ["boundary", "follow-on", "follow-on-single"],
            "saas_jp",
            _DEFAULT_SAAS_EXIT,
            {"followOns": [{"label": "シリーズB", "yearOffset": 2, "amount": 500.0, "postMoney": 5000.0}]},
        ),
        case(
            "followon-multiple-tranches",
            ["boundary", "follow-on", "follow-on-multiple"],
            "saas_jp",
            _DEFAULT_SAAS_EXIT,
            {
                "followOns": [
                    {"label": "シリーズB", "yearOffset": 2, "amount": 500.0, "postMoney": 5000.0},
                    {"label": "シリーズC", "yearOffset": 4, "amount": 800.0, "postMoney": 4000.0},
                ]
            },
        ),
        case(
            "climate-tech-fully-diluted-shares-zero",
            ["boundary", "fully-diluted-shares-zero"],
            "climate_tech",
            {
                "currentProjectNpv": 800.0,
                "annualCapacity": 450000.0,
                "unitPrice": 8000.0,
                "unitCost": 9000.0,
                "fixedOpex": 500.0,
                "carbonCreditVolume": 100000.0,
                "massProductionProbability": 0.15,
                "offtakeCoverage": 0.1,
                "merchantRealization": 0.5,
                "costDeclineRate": 0.02,
                "carbonCreditPrice": 1500.0,
                "exitMultiple": 2.5,
                "yearsToExit": 7,
            },
            {"fullyDilutedShares": 0.0, "yearsToExit": 7},
        ),
    ]
    return cases


def _range3_pick(rng: Any, lo: float, hi: float) -> float:
    return rng.uniform(lo, hi)


def _gen_core(rng: Any) -> Dict[str, Any]:
    years_to_exit = rng.randint(1, 8)
    return {
        "fullyDilutedShares": rng.choice([0.0, rng.uniform(1.0, 50.0)]),
        "proposedPreMoney": rng.uniform(0.0, 10000.0),
        "investmentAmount": rng.uniform(10.0, 2000.0),
        "targetMoic": rng.uniform(1.0, 20.0),
        "yearsToExit": years_to_exit,
        "dilutionRetention": rng.uniform(0.1, 1.0),
        "exitNetDebt": rng.uniform(-500.0, 2000.0),
    }


def gen_random(rng: Any) -> Dict[str, Any]:
    sector = rng.choice(SECTORS)
    core = _gen_core(rng)
    years_to_exit = core["yearsToExit"]

    if sector == "saas_jp":
        exit_inputs = {
            "currentArr": rng.uniform(0.0, 5000.0),
            "arrGrowth": rng.uniform(-0.3, 1.5),
            "growthDecay": rng.uniform(0.5, 1.0),
            "exitOperatingMargin": rng.uniform(-0.5, 0.4),
            "exitMultiple": rng.uniform(0.5, 15.0),
            "yearsToExit": years_to_exit,
        }
    elif sector == "ec_d2c":
        exit_inputs = {
            "currentRevenue": rng.uniform(0.0, 8000.0),
            "revenueGrowth": rng.uniform(-0.3, 1.0),
            "growthDecay": rng.uniform(0.5, 1.0),
            "exitGrossMargin": rng.uniform(0.1, 0.8),
            "multipleBasis": rng.choice(["revenue", "grossProfit"]),
            "exitMultiple": rng.uniform(0.5, 6.0),
            "yearsToExit": years_to_exit,
        }
    elif sector == "media_tech":
        exit_inputs = {
            "currentMau": rng.uniform(0.0, 10_000_000.0),
            "mauGrowth": rng.uniform(-0.3, 1.2),
            "growthDecay": rng.uniform(0.5, 1.0),
            "currentMonthlyArpu": rng.uniform(0.0, 500.0),
            "arpuGrowth": rng.uniform(-0.2, 0.3),
            "exitMultiple": rng.uniform(0.5, 10.0),
            "yearsToExit": years_to_exit,
        }
    elif sector == "medical_device":
        terminal_growth = rng.uniform(0.0, 0.03)
        discount_rate = terminal_growth + rng.uniform(0.0, 0.2)
        exit_inputs = {
            "annualProcedures": rng.uniform(0.0, 30000.0),
            "pricePerProcedure": rng.uniform(1000.0, 500000.0),
            "launchYear": rng.randint(0, 4),
            "recurringRatio": rng.uniform(0.0, 0.9),
            "procedureGrowth": rng.uniform(-0.2, 0.3),
            "approvalDelayYears": rng.randint(0, 4),
            "peakPenetration": rng.uniform(0.0, 1.0),
            "yearsToPeak": rng.randint(1, 6),
            "operatingMargin": rng.uniform(-0.3, 0.4),
            "discountRate": discount_rate,
            "terminalGrowth": terminal_growth,
            "exitMultiple": rng.uniform(0.5, 8.0),
            "yearsToExit": years_to_exit,
        }
    elif sector == "drug_discovery":
        exit_inputs = {
            "currentRnpv": rng.uniform(0.0, 3000.0),
            "currentPeakSales": rng.uniform(0.0, 8000.0),
            "peakSalesGrowth": rng.uniform(-0.3, 0.3),
            "yearsToExit": years_to_exit,
            "posAtExit": rng.uniform(0.0, 1.0),
            "valueCaptureRate": rng.uniform(0.0, 1.0),
            "exitMultiple": rng.uniform(0.2, 5.0),
        }
    else:
        exit_inputs = {
            "currentProjectNpv": rng.uniform(0.0, 2000.0),
            "annualCapacity": rng.uniform(0.0, 1_000_000.0),
            "unitPrice": rng.uniform(100.0, 20000.0),
            "unitCost": rng.uniform(100.0, 20000.0),
            "fixedOpex": rng.uniform(0.0, 2000.0),
            "carbonCreditVolume": rng.uniform(0.0, 500000.0),
            "massProductionProbability": rng.uniform(0.0, 1.0),
            "offtakeCoverage": rng.uniform(0.0, 1.0),
            "merchantRealization": rng.uniform(0.0, 1.0),
            "costDeclineRate": rng.uniform(0.0, 0.3),
            "carbonCreditPrice": rng.uniform(0.0, 15000.0),
            "exitMultiple": rng.uniform(0.5, 10.0),
            "yearsToExit": years_to_exit,
        }

    return {"sector": sector, "exitInputs": exit_inputs, "coreInputs": core}
