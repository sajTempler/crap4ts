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
- **Data Tables**: `it.each`/`test.for` first arguments should be treated as case tables (giving credit) rather than bloating the `rawLineCount` body.
- **Helper Hidden Threshold**: Align `helperHiddenExampleCount` to only count examples where `helperHiddenLines > 8`.
- **Size Factor Cliff**: Smooth the `sizeFactor` curve to soften the cliff for `AUTO_REFACTOR` splits.

## Not yet specified
*(None right now, the entire implementation is charted into tickets)*

## Out of scope
*(None yet)*
