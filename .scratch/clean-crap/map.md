# Clean CRAP

## Destination

Every in-scope production scoring unit is **Clean** (CRAP ≤ 5), verified by a workspace-root crap4ts Report. In scope: `packages/crap4ts` and `packages/scrap4ts` `src/`, excluding `*.test.ts` and `.scratch`. Implementation is the last phase of this map.

## Notes

Domain: CRAP per scoring unit, not a repo aggregate, not SCRAP. Glossary: `CONTEXT.md`. Tracker: local markdown, see `docs/agents/issue-tracker.md`. Sibling map [Prepare crap4ts](../wayfinder/map.md) is done and is not this effort.

Skills every session should consult: grilling, domain-modeling, prototype, codebase-design. Splits keep existing tests green (the freeze); tdd only for new coverage tests on coverable units, at the public seam. Do not TDD the extract itself.

Standing preferences:

- Hottest file first: `collect.ts` → `score.ts` → rest of scrap4ts (`discover.ts`, `cli.ts`, `report.ts`) → crap4ts.
- CC ≥ 6 must split (CRAP’s floor is CC). CC ≤ 5 and CRAP > 5: add tests, do not split to dodge coverage.
- Behavior freeze: existing scrap4ts and crap4ts tests are the contract. Do not retune SCRAP detectors. CRAP row names and counts will change; that is the point.
- No third package, no shared AST helpers. Splits stay inside the package that owns the file. Hold [Do crap4ts and scrap4ts share a kernel package?](../wayfinder/issues/06-shared-kernel.md).
- Do not change what counts as a scoring unit to game CRAP.
- Verify with workspace-root crap4ts (coverage via both packages’ Vitest LCOV concatenated into `target/coverage/lcov.info`). Judge only in-scope production rows; test files and `.scratch` still appear in an unfiltered walk and do not count.
- After the last file is Clean, lock each package `SKILL.md` to the live Report.
- Extract method (from collect.ts): keep the existing public function; hoist nested Visitor/walk callbacks into sibling scoring units (nested arrows fold); module-level functions + ctx, not a plugin table and not a new public class; split a file only when a scoring unit still exceeds CC 5; cover coverable units at the public seam. Later files apply this method — they do not clone collect.ts's four-file map.

Opening inventory (workspace-root run, in-scope production only): 47 units above 5; 42 must split; 5 coverable (`largeCaseTable`, `splitPressure`, `formatLineRange`, `duplicationCost`, `stringLiteral`).

## Decisions so far

- [What extract seams make every production scoring unit in collect.ts Clean?](issues/01-collect-seams.md) — Four files; `collectExamples` stays the only export; hoist Visitor/walk callbacks so they stop folding; cover `largeCaseTable` at that seam. Prototype: [collect-seams](prototypes/collect-seams/)
- [Make packages/scrap4ts/src/collect.ts Clean](issues/02-collect-clean.md) — Four-file extract shipped; every collect production unit CRAP ≤ 5; leftover coverable units tested at `collectExamples`.
- [Make packages/scrap4ts/src/score.ts Clean](issues/03-score-clean.md) — Stayed one file; 12 hot units split into siblings; `splitPressure` and `duplicationCost` covered at `scoreFile`; every score production unit CRAP ≤ 5.
- [Make the rest of scrap4ts production Clean](issues/04-scrap-rest-clean.md) — discover, cli, and report stayed one file each; 8 hot units split into siblings; `stringLiteral` and `formatLineRange` covered at `findTestFiles` / `formatReport`.
- [Make the crap4ts package production Clean](issues/05-crap4ts-clean.md) — oxc-adapter, cli, coverage, and discover stayed one file each; 9 hot units split into siblings; leftover `bindingName` covered at `oxcParser.scoringUnits`; every crap4ts production unit CRAP ≤ 5.
- [Dogfood crap4ts on this workspace after every in-scope unit is Clean, and lock each package SKILL.md to the live Reports](issues/06-dogfood-skill-md.md) — Workspace-root Report: 355 in-scope production rows, all CRAP ≤ 5; test/`.scratch` `N/A`; exit 0. Both SKILL.md samples locked to the live Reports.

## Not yet specified

## Out of scope

- Changing the scoring-unit definition or CC visitor to lower scores without splitting.
- A shared kernel or AST-helper package.
- A hardcoded CRAP threshold that fails the process.
- Test files and `.scratch` (out of the Clean bar, not out of discovery).
- Retuning SCRAP detectors or allowing fixture Report drift.
- TypeScript 7.1 parser-adapter backend (still waiting on 7.1; not this destination).
- Git init, npm publish, a GitHub remote.
