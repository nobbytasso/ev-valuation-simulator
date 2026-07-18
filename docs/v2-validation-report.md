# Validation Report

## Completed

- Strict TypeScript check of new domain, storage, Excel and React page code using the repository compiler settings relevant to these files.
- `noUnusedLocals` and `noUnusedParameters` checks.
- Runtime evaluation of four default cases for all six sectors.
- Finite-number check for every default Exit EV and current valuation bridge result.
- Ordering check that the management case produces a higher Exit EV than severe downside for every default sector.
- Legacy SaaS v3 JSON migration smoke.

## Runtime default Exit EV results (百万円)

| Sector | Management | Underwriting | Downside | Severe |
|---|---:|---:|---:|---:|
| SaaS | 35,166 | 16,334 | 6,884 | 2,678 |
| Drug Discovery | 12,535 | 3,985 | 482 | 24 |
| Medical Device | 8,265 | 3,634 | 887 | 113 |
| Media Tech | 126,490 | 42,171 | 11,962 | 2,858 |
| EC/D2C | 20,953 | 8,767 | 3,198 | 859 |
| Climate Tech | 11,306 | 3,183 | 409 | -114 |

Negative or infeasible cases are intentionally retained and surfaced as warnings rather than silently clamped.

## Not executable in this environment

The complete repository dependency tree was not locally available, so the existing Vitest/Playwright/build suites could not be executed here. The patch adds tests and an apply script; run the repository commands listed in `GITHUB_PR.md` after applying.
