Type: task
Status: resolved
Blocked by: 09

## Question

Implement the crap4ts binary: wipe-run-analyze, oxc parser adapter, family CRAP table.

Follow [What is the v1 CLI contract?](08-cli-contract.md), [What is the parser adapter's type?](07-parser-adapter.md), [What TypeScript shapes get a CRAP row?](01-crap-scoring-units.md), [Which TypeScript constructs increment CC?](03-ts-cyclomatic-constructs.md), [How does Vitest LCOV map onto scoring units?](04-vitest-lcov-coverage-mapping.md), and [Do crap4ts and scrap4ts share a kernel package?](06-shared-kernel.md). Use tdd. codebase-design when placing the parser adapter. Do not start scrap4ts in this ticket.

## Answer

crap4ts is a working wipe-run-analyze CLI. `run(args)` wipes `target/coverage`, runs the coverage command (default Vitest LCOV into `target/coverage/lcov.info`; `--coverage-command` with `{lcov}` substitution), discovers `.ts`/`.tsx`/`.mts`/`.cts` (skipping `.d.ts`, `node_modules`, `dist`, coverage/`target` dirs), scores through `ParserAdapter.scoringUnits`, joins LCOV `DA` line ranges, and prints the family CRAP table (File column, `N/A` last). Exit 1 on unknown flags, coverage failure, or parse failure; exit 0 on a high score.

The oxc adapter lives in `packages/crap4ts/src/oxc-adapter.ts` and is the only module that imports oxc. Scoring and CLI depend on `ParserAdapter` in `parser.ts`. Tests inject a fake adapter at that seam. scrap4ts was not started.

