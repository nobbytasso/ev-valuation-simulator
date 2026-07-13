"""ドメイン制約の検証。出典: docs/engine-spec.md §0.2.1

golden fixture 生成時に、サンプリングした入力が有効ドメイン内であることを保証する。
TSエンジン側(src/engine/common/validation.ts)が行う検証と同じ制約を独立に
Python側でも実装し、サンプリング範囲(random_inputs.py)・境界値(boundary_cases.py)
の両方をクロスチェックする(2実装独立クロスチェックの方針をドメイン制約にも適用)。
"""

from typing import Any, Dict


class DomainError(Exception):
    pass


def in_range(value: float, field: str, lo: float, hi: float, min_exclusive: bool = False, max_exclusive: bool = False) -> None:
    low_ok = value > lo if min_exclusive else value >= lo
    high_ok = value < hi if max_exclusive else value <= hi
    if not (low_ok and high_ok):
        lb = "(" if min_exclusive else "["
        rb = ")" if max_exclusive else "]"
        raise DomainError(f"{field} は {lb}{lo}, {hi}{rb} の範囲外です(実際: {value})")


def at_least(value: float, field: str, lo: float, exclusive: bool = False) -> None:
    ok = value > lo if exclusive else value >= lo
    if not ok:
        raise DomainError(f"{field} は {lo} {'超' if exclusive else '以上'}である必要があります(実際: {value})")


def positive_integer(value: Any, field: str) -> None:
    if not (isinstance(value, int) and not isinstance(value, bool) and value >= 1):
        raise DomainError(f"{field} は1以上の整数である必要があります(実際: {value})")


def non_negative_integer(value: Any, field: str) -> None:
    if not (isinstance(value, int) and not isinstance(value, bool) and value >= 0):
        raise DomainError(f"{field} は0以上の整数である必要があります(実際: {value})")


def check_saas(i: Dict[str, Any]) -> None:
    at_least(i["arr"], "arr", 0)
    at_least(i["arrGrowth"], "arrGrowth", -1, exclusive=True)
    in_range(i["grossMargin"], "grossMargin", 0, 1)
    in_range(i["operatingMargin"], "operatingMargin", -1, 1)
    in_range(i["fcfMargin"], "fcfMargin", -1, 1)
    in_range(i["grossChurn"], "grossChurn", 0, 1)
    at_least(i["cacPaybackMonths"], "cacPaybackMonths", 0, exclusive=True)
    for k in ("pessimistic", "base", "optimistic"):
        at_least(i["evArrMultiple"][k], f"evArrMultiple.{k}", 0, exclusive=True)
    positive_integer(i["projectionYears"], "projectionYears")
    in_range(i["growthDecayFactor"], "growthDecayFactor", 0, 1, min_exclusive=True)
    at_least(i["discountRate"], "discountRate", 0, exclusive=True)
    if i["discountRate"] <= i["terminalGrowth"]:
        raise DomainError(f"discountRate({i['discountRate']}) は terminalGrowth({i['terminalGrowth']}) を上回る必要があります")


_PHASES = ("preclinical", "phase1", "phase2", "phase3", "filing")


def _check_asset(asset: Dict[str, Any], index: int) -> None:
    prefix = f"assets[{index}]"
    for p in _PHASES:
        in_range(asset["phaseSuccessProbs"][p], f"{prefix}.phaseSuccessProbs.{p}", 0, 1)
        positive_integer(asset["phaseDurations"][p], f"{prefix}.phaseDurations.{p}")
        at_least(asset["developmentCosts"][p], f"{prefix}.developmentCosts.{p}", 0)
    in_range(asset["declineRate"], f"{prefix}.declineRate", 0, 1)
    at_least(asset["peakSales"], f"{prefix}.peakSales", 0)
    positive_integer(asset["yearsToPeak"], f"{prefix}.yearsToPeak")
    non_negative_integer(asset["plateauYears"], f"{prefix}.plateauYears")


def check_drug_discovery(i: Dict[str, Any]) -> None:
    for idx, asset in enumerate(i["assets"]):
        _check_asset(asset, idx)
    for k in ("pessimistic", "base", "optimistic"):
        at_least(i["discountRate"][k], f"discountRate.{k}", 0, exclusive=True)
    positive_integer(i["modelHorizonYears"], "modelHorizonYears")


def check_medical_device(i: Dict[str, Any]) -> None:
    at_least(i["annualProcedures"], "annualProcedures", 0)
    at_least(i["procedureGrowth"], "procedureGrowth", -1, exclusive=True)
    non_negative_integer(i["approvalDelayYears"], "approvalDelayYears")
    at_least(i["pricePerProcedure"], "pricePerProcedure", 0)
    in_range(i["peakPenetration"], "peakPenetration", 0, 1)
    positive_integer(i["yearsToPeak"], "yearsToPeak")
    in_range(i["recurringRatio"], "recurringRatio", 0, 1, max_exclusive=True)
    positive_integer(i["projectionYears"], "projectionYears")
    for k in ("pessimistic", "base", "optimistic"):
        rate = i["discountRate"][k]
        at_least(rate, f"discountRate.{k}", 0, exclusive=True)
        if rate <= i["terminalGrowth"]:
            raise DomainError(f"discountRate.{k}({rate}) は terminalGrowth({i['terminalGrowth']}) を上回る必要があります")


def check_media_tech(i: Dict[str, Any]) -> None:
    at_least(i["mau"], "mau", 0)
    at_least(i["mauGrowth"], "mauGrowth", -1, exclusive=True)
    in_range(i["growthDecayFactor"], "growthDecayFactor", 0, 1, min_exclusive=True)
    in_range(i["dauMauRatio"], "dauMauRatio", 0, 1)
    for k in ("ad", "paid", "commerce"):
        at_least(i["arpuMonthly"][k], f"arpuMonthly.{k}", 0)
    in_range(i["monthlyChurn"], "monthlyChurn", 0, 1)
    in_range(i["contentCostRatio"], "contentCostRatio", 0, 1)
    at_least(i["cpa"], "cpa", 0)
    for k in ("pessimistic", "base", "optimistic"):
        at_least(i["evSalesMultiple"][k], f"evSalesMultiple.{k}", 0, exclusive=True)
    positive_integer(i["projectionYears"], "projectionYears")


def check_ec_d2c(i: Dict[str, Any]) -> None:
    at_least(i["annualRevenue"], "annualRevenue", 0)
    at_least(i["revenueGrowth"], "revenueGrowth", -1, exclusive=True)
    in_range(i["grossMargin"], "grossMargin", 0, 1)
    in_range(i["f2Rate"], "f2Rate", 0, 1, max_exclusive=True)
    at_least(i["aov"], "aov", 0)
    at_least(i["purchaseFrequency"], "purchaseFrequency", 0)
    at_least(i["cac"], "cac", 0)
    in_range(i["adCostRatio"], "adCostRatio", 0, 1)
    in_range(i["logisticsCostRatio"], "logisticsCostRatio", 0, 1)
    at_least(i["inventoryTurnover"], "inventoryTurnover", 0, exclusive=True)
    for k in ("pessimistic", "base", "optimistic"):
        at_least(i["evMultiple"][k], f"evMultiple.{k}", 0, exclusive=True)
    positive_integer(i["maxLifetimeYears"], "maxLifetimeYears")


def check_climate_tech(i: Dict[str, Any]) -> None:
    in_range(i["subsidyCoverage"], "subsidyCoverage", 0, 1)
    in_range(i["massProductionProb"], "massProductionProb", 0, 1)
    at_least(i["annualCapacityUnits"], "annualCapacityUnits", 0)
    positive_integer(i["rampYears"], "rampYears")
    at_least(i["unitPrice"], "unitPrice", 0)
    at_least(i["unitCost0"], "unitCost0", 0)
    in_range(i["costDeclineRate"], "costDeclineRate", 0, 1, max_exclusive=True)
    in_range(i["offtakeCoverage"], "offtakeCoverage", 0, 1)
    in_range(i["merchantRealization"], "merchantRealization", 0, 1)
    at_least(i["fixedOpexAnnual"], "fixedOpexAnnual", 0)
    at_least(i["carbonCreditVolume"], "carbonCreditVolume", 0)
    at_least(i["carbonCreditPrice"], "carbonCreditPrice", 0)
    for k in ("pessimistic", "base", "optimistic"):
        at_least(i["discountRate"][k], f"discountRate.{k}", 0, exclusive=True)
    positive_integer(i["projectYears"], "projectYears")
    for idx, entry in enumerate(i["capexSchedule"]):
        at_least(entry["amount"], f"capexSchedule[{idx}].amount", 0)


CHECKERS = {
    "saas_jp": check_saas,
    "drug_discovery": check_drug_discovery,
    "medical_device": check_medical_device,
    "media_tech": check_media_tech,
    "ec_d2c": check_ec_d2c,
    "climate_tech": check_climate_tech,
}


def check_domain(sector: str, inputs: Dict[str, Any]) -> None:
    """指定セクターの入力がドメイン制約(§0.2.1)を満たすことを検証する。違反時はDomainErrorを送出。"""
    CHECKERS[sector](inputs)
