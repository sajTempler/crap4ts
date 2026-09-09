---
labels: wayfinder:task
status: resolved
assignee: Antigravity
blocked-by: [0005-size-factor-cliff]
blocks: []
---
## Question

**STABLE label vs MEDIUM-range pressure number**

`generalStable` short-circuits the label to `STABLE` if `maxScrap <= 12`. However, the report still prints the raw pressure score, resulting in outputs like `STABLE (23.9)` (where 23.9 is technically MEDIUM range).

Fix direction: Ensure the Report does not print a confusing non-stable pressure score underneath a STABLE label. Either cap the printed score, change how the label dictates the score output, or visually separate them.

## Answer

Updated `renderGuidance` in `packages/scrap4ts/src/report.ts` so that `refactor-pressure` is dictated by `fileLevel`.
- When `fileLevel === "STABLE"`, `refactor-pressure` is rendered as `STABLE` without appending the raw numeric score in parentheses. This prevents outputs like `STABLE (23.9)` where structurally stable test files with many examples displayed misleading MEDIUM-range pressure numbers.
- Non-stable levels (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) continue to display both their level and raw formatted score (e.g., `LOW (17.1)`).
- Added test coverage in `packages/scrap4ts/src/report.test.ts` verifying that files qualifying as STABLE via `generalStable` with scores >= 18 output `refactor-pressure: STABLE` without parenthesized scores, and non-STABLE files retain the level-and-score formatting.
