"""共通の現在価値・IRR/MOIC計算。docs/engine-spec.md §0.4 / §1.1 / §1.3 に対応。

TSエンジンとの golden 突合(相対誤差 1e-9)のため、加算順序を t 昇順に固定する。
"""

from typing import Dict, List, Optional, Sequence, Tuple

Cashflow = Tuple[int, float]


def pv(cashflows: Sequence[Cashflow], r: float) -> float:
    """NPV(r, CF) = Σ CF_t / (1+r)^t。t 昇順に加算する(§0.4)。"""
    total = 0.0
    for t, cf in sorted(cashflows, key=lambda x: x[0]):
        total += cf / (1.0 + r) ** t
    return total


def gordon_terminal_value(cf_terminal: float, r: float, g_term: float) -> float:
    """TV_T = CF_T × (1+g) / (r−g)。r ≤ g は呼び出し側で事前に検証しておくこと(§1.1)。"""
    if r <= g_term:
        raise ValueError("discount rate must exceed terminal growth rate")
    return cf_terminal * (1.0 + g_term) / (r - g_term)


def irr_bisection(
    cashflows: Sequence[Cashflow],
    lo: float = -0.9999,
    hi: float = 10.0,
    tol: float = 1e-12,
    max_iter: int = 200,
) -> Optional[float]:
    """§0.4 の手順で固定した二分法。符号変化がない場合は None。"""

    def npv_at(r: float) -> float:
        return pv(cashflows, r)

    f_lo = npv_at(lo)
    f_hi = npv_at(hi)
    if f_lo == 0.0:
        return lo
    if f_hi == 0.0:
        return hi
    if (f_lo > 0) == (f_hi > 0):
        return None

    a, b = lo, hi
    fa = f_lo
    mid = a
    for _ in range(max_iter):
        mid = (a + b) / 2.0
        f_mid = npv_at(mid)
        if abs(f_mid) < tol:
            return mid
        if (f_mid > 0) == (fa > 0):
            a, fa = mid, f_mid
        else:
            b = mid
    return mid


def irr_closed_form(investment: float, proceeds: float, years: float) -> float:
    """単一投資・単一回収の閉形式(§1.3)。二分法と golden で相互検証する。"""
    return (proceeds / investment) ** (1.0 / years) - 1.0


def moic(cashflows: Sequence[Cashflow]) -> Optional[float]:
    positive = sum(cf for _, cf in cashflows if cf > 0)
    negative = sum(-cf for _, cf in cashflows if cf < 0)
    if negative == 0.0:
        return None
    return positive / negative


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


RangeKey = str  # "pessimistic" | "base" | "optimistic"
RANGE_KEYS: Tuple[RangeKey, RangeKey, RangeKey] = ("pessimistic", "base", "optimistic")


def range3(pessimistic: float, base: float, optimistic: float) -> Dict[str, float]:
    return {"pessimistic": pessimistic, "base": base, "optimistic": optimistic}
