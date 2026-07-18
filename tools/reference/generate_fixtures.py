"""golden fixture 生成スクリプト。

各セクター: 境界値ケース + シード固定ランダムケース(合計20件以上)を生成し、
Python リファレンス実装で期待出力を計算して src/engine/__fixtures__/{sector}.golden.json
に書き出す。TSエンジンのテストはこのJSONと相対誤差1e-9以内で突合する
(docs/requirements-rev4.md §7 / docs/engine-spec.md §3)。

全ケース(境界値・ランダムとも)は書き出し前に domain_check でドメイン制約
(§0.2.1)を検証する。TSエンジン側(src/engine/common/validation.ts)の検証と
独立実装のクロスチェックであり、サンプリング範囲(random_inputs.py)や
境界値定義(boundary_cases.py)が将来変更されてドメイン外の値を生成して
しまった場合、ここで即座に検出する(D-2裁定「サンプリング範囲を有効ドメイン内に
限定」の実装)。

実行: リポジトリルートから `python3 -m tools.reference.generate_fixtures`
"""

import json
from datetime import date
from pathlib import Path
from random import Random
from typing import Any, Callable, Dict, List

from . import boundary_cases, random_inputs, workbench
from .domain_check import check_domain
from .sectors import climate_tech, drug_discovery, ec_d2c, media_tech, medical_device, saas

REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURES_DIR = REPO_ROOT / "src" / "engine" / "__fixtures__"

BASE_SEED = 20260713
RANDOM_CASES_PER_SECTOR = 20

SECTORS: List[Dict[str, Any]] = [
    {
        "sector": "saas_jp",
        "compute": saas.compute,
        "gen_random": random_inputs.gen_saas,
        "boundary_cases": boundary_cases.saas_cases,
        "seed_offset": 0,
    },
    {
        "sector": "drug_discovery",
        "compute": drug_discovery.compute,
        "gen_random": random_inputs.gen_drug_discovery,
        "boundary_cases": boundary_cases.drug_discovery_cases,
        "seed_offset": 1,
    },
    {
        "sector": "medical_device",
        "compute": medical_device.compute,
        "gen_random": random_inputs.gen_medical_device,
        "boundary_cases": boundary_cases.medical_device_cases,
        "seed_offset": 2,
    },
    {
        "sector": "media_tech",
        "compute": media_tech.compute,
        "gen_random": random_inputs.gen_media_tech,
        "boundary_cases": boundary_cases.media_tech_cases,
        "seed_offset": 3,
    },
    {
        "sector": "ec_d2c",
        "compute": ec_d2c.compute,
        "gen_random": random_inputs.gen_ec_d2c,
        "boundary_cases": boundary_cases.ec_d2c_cases,
        "seed_offset": 4,
    },
    {
        "sector": "climate_tech",
        "compute": climate_tech.compute,
        "gen_random": random_inputs.gen_climate_tech,
        "boundary_cases": boundary_cases.climate_tech_cases,
        "seed_offset": 5,
    },
]


def build_cases(entry: Dict[str, Any]) -> List[Dict[str, Any]]:
    sector = entry["sector"]
    compute: Callable[[Dict[str, Any]], Dict[str, Any]] = entry["compute"]
    rng = Random(BASE_SEED + entry["seed_offset"])

    cases: List[Dict[str, Any]] = []

    for case_id, tags, case_input in entry["boundary_cases"]():
        try:
            check_domain(sector, case_input)
        except Exception as e:
            raise AssertionError(f"{sector}/{case_id}: ドメイン制約違反 ({e})") from e
        cases.append(
            {
                "id": case_id,
                "tags": tags,
                "input": case_input,
                "expected": compute(case_input),
            }
        )

    for i in range(RANDOM_CASES_PER_SECTOR):
        case_input = entry["gen_random"](rng)
        case_id = f"random-{i:02d}"
        try:
            check_domain(sector, case_input)
        except Exception as e:
            raise AssertionError(f"{sector}/{case_id}: ドメイン制約違反 ({e})") from e
        cases.append(
            {
                "id": case_id,
                "tags": ["random"],
                "input": case_input,
                "expected": compute(case_input),
            }
        )

    return cases


WORKBENCH_SEED = BASE_SEED + 6
WORKBENCH_RANDOM_CASES = 24


def build_workbench_cases() -> List[Dict[str, Any]]:
    """V2 Investment Case Workbench(docs/engine-spec.md §5)の golden ケース。

    6セクターモデルとは異なり `sector` / `exitInputs` / `coreInputs` の組を1ケースとする
    (`workbench.compute` がディスパッチする)。ドメイン制約は6セクターモデルほど厳格ではない
    (v2は警告方式)ため `check_domain` は適用しない。
    """
    rng = Random(WORKBENCH_SEED)
    cases: List[Dict[str, Any]] = []

    for case_id, tags, case_input in workbench.boundary_cases():
        cases.append(
            {
                "id": case_id,
                "tags": tags,
                "input": case_input,
                "expected": workbench.compute(case_input),
            }
        )

    for i in range(WORKBENCH_RANDOM_CASES):
        case_input = workbench.gen_random(rng)
        case_id = f"random-{i:02d}"
        cases.append(
            {
                "id": case_id,
                "tags": ["random", case_input["sector"]],
                "input": case_input,
                "expected": workbench.compute(case_input),
            }
        )

    return cases


def main() -> None:
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
    gitkeep = FIXTURES_DIR / ".gitkeep"
    if gitkeep.exists():
        gitkeep.unlink()

    for entry in SECTORS:
        cases = build_cases(entry)
        assert len(cases) >= 20, f"{entry['sector']}: expected >=20 cases, got {len(cases)}"

        payload = {
            "schemaVersion": "1.0",
            "sector": entry["sector"],
            "generatedAt": date.today().isoformat(),
            "seed": BASE_SEED + entry["seed_offset"],
            "caseCount": len(cases),
            "cases": cases,
        }

        out_path = FIXTURES_DIR / f"{entry['sector']}.golden.json"
        with out_path.open("w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2, sort_keys=False)
            f.write("\n")

        print(f"wrote {out_path.relative_to(REPO_ROOT)} ({len(cases)} cases)")

    workbench_cases = build_workbench_cases()
    assert len(workbench_cases) >= 20, f"workbench: expected >=20 cases, got {len(workbench_cases)}"
    workbench_payload = {
        "schemaVersion": "1.0",
        "model": "workbench",
        "generatedAt": date.today().isoformat(),
        "seed": WORKBENCH_SEED,
        "caseCount": len(workbench_cases),
        "cases": workbench_cases,
    }
    workbench_out_path = FIXTURES_DIR / "workbench.golden.json"
    with workbench_out_path.open("w", encoding="utf-8") as f:
        json.dump(workbench_payload, f, ensure_ascii=False, indent=2, sort_keys=False)
        f.write("\n")
    print(f"wrote {workbench_out_path.relative_to(REPO_ROOT)} ({len(workbench_cases)} cases)")


if __name__ == "__main__":
    main()
