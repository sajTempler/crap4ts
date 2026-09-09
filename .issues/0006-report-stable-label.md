---
labels: wayfinder:task
blocked-by: [0005-size-factor-cliff]
blocks: []
---
## Question

**STABLE label vs MEDIUM-range pressure number**

`generalStable` short-circuits the label to `STABLE` if `maxScrap <= 12`. However, the report still prints the raw pressure score, resulting in outputs like `STABLE (23.9)` (where 23.9 is technically MEDIUM range).

Fix direction: Ensure the Report does not print a confusing non-stable pressure score underneath a STABLE label. Either cap the printed score, change how the label dictates the score output, or visually separate them.
