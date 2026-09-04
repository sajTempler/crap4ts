Type: task
Status: resolved
Blocked by: 03

## Question

Make the rest of scrap4ts production Clean: `discover.ts`, `cli.ts`, and `report.ts`.

Apply the extract method from [What extract seams make every production scoring unit in collect.ts Clean?](01-collect-seams.md): keep each file's existing public functions; hoist nested callbacks; split a file only when a scoring unit still exceeds CC 5. Do not clone collect.ts's four-file map.

Must split: `globToRegExp`, `identifierName`, `findTestConfig`, `walk` (discover); `loadBaseline`, `run`, `parseArgs`, `isSummary` (cli). Coverable: `stringLiteral` (discover, CC 5, 83%), `formatLineRange` (report, CC 2, 0%). Freeze existing tests. Cover coverable units at each file's public seam. Do not start crap4ts.

## Answer

Production discover, cli, and report are Clean. Public exports unchanged: `findTestFiles`, `run`, `formatReport`, `toBaseline`, and `renderJson`. Each file stayed one file; sibling functions only, no `discover/` / `cli/` / `report/` directories, no plugin table, no new public class.

The 8 CC ≥ 6 units (`globToRegExp`, `identifierName`, `findTestConfig`, `walk`; `loadBaseline`, `run`, `parseArgs`, `isSummary`) are split into CC ≤ 5 siblings. Nested config-walk and flag-parse callbacks are module-level so they stop folding. After the first hoist, leftover `isIncludedFile` (CC 6) was split once more.

`stringLiteral` stayed unsplit and is covered at `findTestFiles` (non-string and identifier include entries). `formatLineRange` stayed unsplit and is covered at `formatReport` (one-liner vs span in recommended extractions). After the hoist, leftover CC ≤ 5 units (`globQuestion`, quoted config keys for `isLiteralNode` / `identifierName`, invalid baseline entries for `parseBaselineEntry` and `failMessage`) were covered at the same public seams rather than split.

Workspace-root crap4ts on `packages/scrap4ts/src/discover.ts`, `cli.ts`, and `report.ts`: every in-scope production row CRAP ≤ 5 (worst 5.0). Existing scrap4ts and crap4ts tests green. crap4ts package untouched.

Concatenated LCOV from both packages shares `SF:src/cli.ts` and `SF:src/discover.ts`. Prefix `SF:` with `packages/<pkg>/` when concatenating, or one package overwrites the other.