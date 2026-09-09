---
labels: wayfinder:task
status: resolved
assignee: Antigravity
blocked-by: [0003-data-tables-case-table]
blocks: [0005-size-factor-cliff]
---
## Question

**`helperHiddenExampleCount` vs smell threshold mismatch**

Smell `helper-hidden-complexity` triggers when `hidden > 8`.
File metric `helperHiddenExampleCount` counts examples where `helperHiddenLines > 0`.

Fix direction: Align the file metric to match the smell threshold. Update `examples.filter(e => e.helperHiddenLines > 0)` to `> 8` so that 1-line helpers don't incorrectly dominate file pressure (`helperHiddenRatio: 12`).

## Answer

Aligned `helperHiddenExampleCount` in `packages/scrap4ts/src/score.ts` with the `helper-hidden-complexity` smell threshold.
- Updated `summarizeExamples` to filter examples with `e.helperHiddenLines > 8` instead of `> 0`. Small 1-8 line helpers no longer trigger `helperHiddenExampleCount`, preventing them from inflating file pressure or prematurely triggering `SPLIT` remediation.
- Added test coverage in `packages/scrap4ts/src/score.test.ts` verifying that `helperHiddenLines <= 8` results in `helperHiddenExampleCount: 0` and stays `LOCAL`, while `helperHiddenLines > 8` is counted and triggers split pressure.
