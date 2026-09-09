---
labels: wayfinder:map
---
# Wayfinder Map: Fix scrap4ts score inflation

## Destination

Improve `scrap4ts` to stop inflating example/file scores for valid test structures. This ensures metrics align with intuitive code quality and do not penalize users for following `AUTO_REFACTOR` guidance.

## Notes

- **Target codebase:** `/Users/szymon/projects/crap4ts/packages/scrap4ts`
- **Methodology:** TDD. Add failing cases in `src/collect.test.ts` or `src/score.test.ts` first.
- **References:** Handoff notes on the 5 specific inflation bugs.

## Decisions so far
- [Fix double-charging of helpers on `helper().method()`](file:///Users/szymon/projects/crap4ts/.issues/0002-double-charge-chained-helpers.md) — Only charge helpers on direct calls (`chain.length === 1`), preventing chained method calls from re-absorbing helper metrics.
- [`it.each` / `test.for` table arg vs callback line count](file:///Users/szymon/projects/crap4ts/.issues/0003-data-tables-case-table.md) — Measure rawLineCount from callback and credit tableBranches on table tests so data tables do not trigger large-example smells.
- [Align helper-hidden example count with smell threshold](file:///Users/szymon/projects/crap4ts/.issues/0004-helper-hidden-threshold.md) — Count examples where `helperHiddenLines > 8` so small helpers don't inflate file pressure or trigger split remediation.
- [Smooth `sizeFactor` cliff between 4 and 5+ examples](file:///Users/szymon/projects/crap4ts/.issues/0005-size-factor-cliff.md) — Scale `sizeFactor` gradually (up to 4: 0.6, 5: 0.75, 7: 0.85, 8+: 1.0) so splitting oversized examples does not incur steep pressure penalties.
- [Omit raw pressure score under STABLE label](file:///Users/szymon/projects/crap4ts/.issues/0006-report-stable-label.md) — Dictate `refactor-pressure` format by `fileLevel` so `STABLE` outputs without parenthesized score, preventing confusing MEDIUM-range numbers on healthy files.

## Not yet specified
*(None right now, the entire implementation is charted into tickets)*

## Out of scope
*(None yet)*
