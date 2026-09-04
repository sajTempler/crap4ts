Type: task
Status: resolved
Blocked by: 02

## Question

Make `packages/scrap4ts/src/score.ts` Clean: every production scoring unit CRAP ≤ 5.

Apply the extract method from [What extract seams make every production scoring unit in collect.ts Clean?](01-collect-seams.md): keep `score.ts`'s existing public functions; hoist nested callbacks; split a file only when a scoring unit still exceeds CC 5; do not invent a plugin table. Do not clone collect.ts's four-file map.

12 units must split (CC ≥ 6). 2 are coverable: `splitPressure` (CC 4, 0%), `duplicationCost` (CC 3, 33%). Freeze existing tests. Cover the two coverable units at the public seam. Do not start scrap4ts `discover.ts` / `cli.ts` / `report.ts`.

## Answer

Production score is Clean. Public exports unchanged: `saturatingComplexityScore`, `scoreExample`, `scoreFile`, `compareReports`, and the existing types. Stayed in `packages/scrap4ts/src/score.ts`; sibling functions only, no `score/` directory, no plugin table, no new public class.

The 12 CC ≥ 6 units (`actionRules`, `aiActionability`, `connectedClusters`, `smellEntries`, `coverageMatrixCandidate`, `compareReports`, `apiContract`, `stableSummary`, `remediationMode`, `jaccard`, `averageSimilarity`, `summarizeBlocks`) are split into CC ≤ 5 siblings. Nested sort/filter comparators (`byPath`, `byConfidenceThenText`) are module-level so they stop folding.

`splitPressure` and `duplicationCost` stayed unsplit and are covered at `scoreFile` (SPLIT gates and extraction net-benefit 127). After the hoist, leftover `byPath` (CC 2, 0%) was covered at the same seam rather than split. Workspace-root crap4ts on `packages/scrap4ts/src/score`: every in-scope production row CRAP ≤ 5 (worst 5.0). Existing scrap4ts and crap4ts tests green. `discover.ts` / `cli.ts` / `report.ts` untouched.
