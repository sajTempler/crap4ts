Type: task
Status: resolved
Blocked by: 04

## Question

Make the crap4ts package production Clean: every scoring unit in `oxc-adapter.ts`, `cli.ts`, `coverage.ts`, and `discover.ts` has CRAP ≤ 5.

Apply the extract method from [What extract seams make every production scoring unit in collect.ts Clean?](01-collect-seams.md): keep each file's existing public functions; hoist nested callbacks; split a file only when a scoring unit still exceeds CC 5. Do not clone collect.ts's four-file map. Parser adapter type stays the one locked in [What is the parser adapter's type?](../../wayfinder/issues/07-parser-adapter.md).

9 units, all CC ≥ 6 (must split). None are coverable. Freeze existing tests. No new kernel package.

## Answer

Production oxc-adapter, cli, coverage, and discover are Clean. Public exports unchanged: `oxcParser`, `run`, `parseLcov`, `loadLcov`, `coverageForRange`, `normalizePath`, and `findSourceFiles`. ParserAdapter type unchanged. Each file stayed one file; sibling functions only, no `oxc-adapter/` / `cli/` / `coverage/` / `discover/` directories, no plugin table, no new public class, no kernel package.

The 9 CC ≥ 6 units (`bindingName`, `keyName`, `unitName`, `oxcParser.scoringUnits`; `parseArgs`, `run`; `parseLcov`, `coverageForRange`; `walk`) are split into CC ≤ 5 siblings. Nested Visitor/walk callbacks are module-level so they stop folding. After the hoist, leftover `bindingName` (CC 5, 50%) was covered at `oxcParser.scoringUnits` (pattern bindings) rather than split.

Workspace-root crap4ts on concatenated LCOV (`SF:` prefixed with `packages/<pkg>/`): every in-scope production row CRAP ≤ 5 (worst 5.0). Existing scrap4ts and crap4ts tests green. Package `SKILL.md` samples not locked.
