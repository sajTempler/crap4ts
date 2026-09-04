# Prepare crap4ts

## Destination

A working local repo at `workspaces/crap4ts`: two packages, two binaries. **crap4ts** prints the family CRAP report for TypeScript production code. **scrap4ts** prints a Vitest port of SCRAP. Implementation is the last phase of this map. Git init comes later.

## Notes

Domain: CRAP and SCRAP as separate products in one repo, never one blended score. Glossary: `CONTEXT.md`. Tracker: local markdown, see `docs/agents/issue-tracker.md`.

Skills every session should consult: grilling, domain-modeling, research, prototype. After the way is clear: tdd for implementation tickets. codebase-design when placing the parser adapter.

Standing preferences:

- TypeScript 7 `tsc` for this repo. Parse *target* source with oxc-parser behind a parser adapter so a TypeScript 7.1 compiler-API backend can be added later. Do not block v1 on 7.1.
- Vitest only. Jest is out.
- CRAP first, then SCRAP.
- Coverage pipeline matches the family: wipe `target/coverage`, run `vitest run --coverage --coverage.reporter=lcov --coverage.reportsDirectory=target/coverage`, read `target/coverage/lcov.info`, allow a custom coverage command. Missing file is `N/A`.
- Report only. Exit non-zero on tool failure, not on a high score.
- Scoring files: `.ts`, `.tsx`, `.mts`, `.cts`. Skip `.js`, `.d.ts`, `node_modules`, `dist`, coverage dirs.
- Node ESM, Vitest for our own tests, a root `SKILL.md` per package (family shape of crap4clj / crap4go).
- pnpm 12.0.0, pinned in repo `mise.toml` and root `"packageManager": "pnpm@12.0.0"`. Layout: `packages/crap4ts` and `packages/scrap4ts`, unscoped names matching binaries, private root name `crap4ts-workspace`.
- Research notes live under `docs/research/`.

## Decisions so far

- [What TypeScript shapes get a CRAP row?](issues/01-crap-scoring-units.md) — One row per non-nested body-bearing function-like; nested CC folds in; coverage is statement span, not function-hit. Detail: [crap-scoring-units.md](../../docs/research/crap-scoring-units.md)
- [Which Speclj SCRAP metrics port to Vitest?](issues/02-scrap-vitest-port.md) — Port the decision layer; adapt detectors to Vitest; drop Speclj nesting and the paren scanner. Detail: [scrap-vitest-port.md](../../docs/research/scrap-vitest-port.md)
- [Which TypeScript constructs increment CC?](issues/03-ts-cyclomatic-constructs.md) — Family decision points only (`if`, loops, cases including default, `catch`, `&&`/`||`, ternary). Not `??`, `?.`, or type-only syntax. Detail: [ts-cyclomatic-constructs.md](../../docs/research/ts-cyclomatic-constructs.md)
- [How does Vitest LCOV map onto scoring units?](issues/04-vitest-lcov-coverage-mapping.md) — Join `DA` line ranges to the unit span; artifact `target/coverage/lcov.info`; missing file is `N/A`. Detail: [vitest-lcov-coverage-mapping.md](../../docs/research/vitest-lcov-coverage-mapping.md)
- [What are the two package names, binary names, and workspace layout?](issues/05-package-layout.md) — pnpm workspace `packages/crap4ts` + `packages/scrap4ts`, unscoped names matching binaries; pin pnpm 12.0.0 via mise and `packageManager`.
- [Do crap4ts and scrap4ts share a kernel package?](issues/06-shared-kernel.md) — No third package. crap4ts owns formula, sort, and CRAP table; scrap4ts owns guidance. Parser adapter is a seam in a consumer.
- [What is the parser adapter's type?](issues/07-parser-adapter.md) — One function in crap4ts: `scoringUnits(filename, sourceText) → ScoringUnit[]`; CC inside; oxc now, 7.1 later as the same type. Prototype: [parser-adapter](prototypes/parser-adapter/)
- [What is the v1 CLI contract?](issues/08-cli-contract.md) — `--help`/`-h`, path-fragment OR filters, wipe-run-analyze, `--coverage-command`/`{lcov}`; scrap keeps `--verbose --json --write-baseline --compare`. No `--changed`, no crap JSON, no skip-coverage.
- [Scaffold the local pnpm workspace so both packages compile and our own tests run, before any scoring logic.](issues/09-repo-scaffold.md) — pnpm 12 workspace, TypeScript 7.0.2 `tsc`, Vitest, two ESM packages with `--help` stubs.
- [Implement the crap4ts binary: wipe-run-analyze, oxc parser adapter, family CRAP table.](issues/10-implement-crap4ts.md) — oxc `scoringUnits` in crap4ts; wipe-run-analyze prints the File-column CRAP table; missing LCOV is `N/A`.
- [Implement the scrap4ts binary: Vitest discovery, decision-layer port, guidance Report, `--verbose` / `--json` / `--write-baseline` / `--compare`.](issues/11-implement-scrap4ts.md) — oxc collection in scrap4ts (not crap4ts's adapter); saturating decision layer; guidance Report; `--json`/`--write-baseline`/`--compare`.
- [Dogfood crap4ts and scrap4ts on this workspace and lock SKILL.md wording to the live Reports.](issues/12-dogfood-skill-md.md) — Live table and guidance Report locked into each package's SKILL.md; `@vitest/coverage-v8` pinned; high scores / `REVIEW_FIRST` exit 0.

## Not yet specified

- A TypeScript 7.1 parser-adapter backend. The type is locked in [What is the parser adapter's type?](issues/07-parser-adapter.md); the implementation waits on 7.1.

## Out of scope

- Jest as a SCRAP runner or coverage driver.
- Scoring `.js` / `.jsx`, and declaration files (`.d.ts`, `.d.mts`, `.d.cts`).
- ESLint-maximal CC extras: `??`, optional chaining, logical/nullish assignment, default parameters.
- Class static blocks and non-function field initializers as scoring units.
- A hardcoded CRAP threshold that fails the process (the Java extra, not the family core).
- `--changed` (the other Java extra). Path fragments are the filter.
- JSON emission from crap4ts. `--json` is scrap4ts-only and is not a Report.
- npm publish and a GitHub remote (git init later, publish later).
- Waiting for TypeScript 7.1 before a working oxc-backed CLI.
- Jest as a SCRAP construct, including `done` callbacks and default automock.
- scrap4ts v1: in-source `import.meta.vitest` tests, `*.test-d.ts`, `bench`, third-party matchers.
