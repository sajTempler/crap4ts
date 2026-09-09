---
labels: wayfinder:task
status: resolved
assignee: Antigravity
blocked-by: [0004-helper-hidden-threshold]
blocks: [0006-report-stable-label]
---
## Question

**File pressure `sizeFactor` fights AUTO_REFACTOR "split oversized examples"**

Splitting an oversized example from 4 to 5 examples jumps the multiplier from 0.65 to 1.0, often flipping STABLE to HIGH/REVIEW_FIRST.

Fix direction: Smooth the `sizeFactor` cliff. Adjust the factors (e.g., 4: 0.6, 5: 0.75, 6: 0.85, 8+: 1.0) so the cliff is smoother and the tool stops heavily penalizing users for following its own "split oversized examples" guidance.

## Answer

Smoothed the `sizeFactor` multiplier progression in `packages/scrap4ts/src/score.ts`.
- Updated `PRESSURE.sizeFactors` to gradual steps:
  - up to 1: 0.25
  - up to 2: 0.40
  - up to 4: 0.60
  - up to 5: 0.75
  - up to 7: 0.85
  - 8+: 1.0
- Splitting a large example from 4 to 5 examples now increases the multiplier gradually from 0.60 to 0.75 (a 25% change) instead of jumping abruptly from 0.65 to 1.00 (a 54% spike).
- Added test coverage in `packages/scrap4ts/src/score.test.ts` verifying `sizeFactor` values across all example thresholds (1, 2, 3, 4, 5, 6, 7, 8, 12) and verifying that a 4-to-5 example split preserves the smoothed factor ratio.
