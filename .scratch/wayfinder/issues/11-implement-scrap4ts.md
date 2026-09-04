Type: task
Status: resolved
Blocked by: 10

## Question

Implement the scrap4ts binary: Vitest discovery, decision-layer port, guidance Report, `--verbose` / `--json` / `--write-baseline` / `--compare`.

Follow [What is the v1 CLI contract?](08-cli-contract.md) and [Which Speclj SCRAP metrics port to Vitest?](02-scrap-vitest-port.md). scrap4ts does not use crap4ts's parser adapter type and does not print a CRAP table. Use tdd.

## Answer

scrap4ts is a working CLI. `run(args)` discovers Vitest files (`vitest.config.*` `test.include`/`test.exclude` when present, otherwise `*.test`/`*.spec` with `?(c|m)[jt]s?(x)`), filters by path-fragment OR, collects examples through oxc in scrap4ts (not crap4ts's `ParserAdapter`), scores with the Speclj saturating curve and eight smells, and prints the guidance Report (`=== SCRAP Report ===`, why/where/how/worst-examples). `--verbose` dumps metrics; `--json` is not a Report; `--write-baseline` writes `target/scrap/`; `--compare PATH` attaches improved/worse/mixed/unchanged. Exit 1 on unknown flags, parse errors, or remaining structure errors; exit 0 on high SCRAP, `SPLIT`, or `REVIEW_FIRST`.

Seams: `run`, `collectExamples`, `scoreFile`, `formatReport`. `vi.mock` is file-level; `vi.spyOn`/`vi.fn` are example-level. Nested `describe` is a block path. `test.for`/`test.each` is one table-driven example. `AUTO_TABLE_DRIVE` how-text says `test.for`.
