---
labels: wayfinder:task
blocked-by: [0003-data-tables-case-table]
blocks: [0005-size-factor-cliff]
---
## Question

**`helperHiddenExampleCount` vs smell threshold mismatch**

Smell `helper-hidden-complexity` triggers when `hidden > 8`.
File metric `helperHiddenExampleCount` counts examples where `helperHiddenLines > 0`.

Fix direction: Align the file metric to match the smell threshold. Update `examples.filter(e => e.helperHiddenLines > 0)` to `> 8` so that 1-line helpers don't incorrectly dominate file pressure (`helperHiddenRatio: 12`).
