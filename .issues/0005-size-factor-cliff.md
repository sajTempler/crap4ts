---
labels: wayfinder:task
blocked-by: [0004-helper-hidden-threshold]
blocks: [0006-report-stable-label]
---
## Question

**File pressure `sizeFactor` fights AUTO_REFACTOR "split oversized examples"**

Splitting an oversized example from 4 to 5 examples jumps the multiplier from 0.65 to 1.0, often flipping STABLE to HIGH/REVIEW_FIRST.

Fix direction: Smooth the `sizeFactor` cliff. Adjust the factors (e.g., 4: 0.6, 5: 0.75, 6: 0.85, 8+: 1.0) so the cliff is smoother and the tool stops heavily penalizing users for following its own "split oversized examples" guidance.
