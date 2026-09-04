Type: grilling
Status: resolved
Blocked by:

## Question

What is the v1 CLI contract for crap4ts (and, at the same grain, scrap4ts)?

Family core already wanted: `--help`, positional path-fragment filters, wipe coverage then run then analyze, custom coverage command (crap4go's `--test-command` / `{coverprofile}` analog). Java extras already out: hardcoded threshold exit. Still open: `--changed`, JSON output, default coverage directory (`target/coverage` vs Vitest's `coverage/`), whether scrap4ts shares flag names.

## Answer

Shared by both binaries: `-h` / `--help` (exit 0); positional **path fragments** (substring of a discovered path, several are OR, family `strings.Contains`); any other token starting with `-` is an error (message + usage, exit non-zero). They do not share coverage flags or scrap flags.

**crap4ts**

```
crap4ts [path-fragment ...] [--coverage-command <cmd>]
```

Walk cwd for `.ts` / `.tsx` / `.mts` / `.cts`. Skip `.js`, `.d.ts`, `node_modules`, `dist`, coverage dirs. No `--source-root`. Wipe `target/coverage`, run coverage, read `target/coverage/lcov.info` (from [How does Vitest LCOV map onto scoring units?](04-vitest-lcov-coverage-mapping.md)). Default command: `vitest run --coverage --coverage.reporter=lcov --coverage.reportsDirectory=target/coverage`. `--coverage-command` replaces that command; `{lcov}` becomes `target/coverage/lcov.info` when present; do not append Vitest flags. Inherit the command's stdout/stderr, then print the CRAP table. Missing LCOV file is `N/A`.

Exit 1 on coverage/parse/unknown-flag failure. Exit 0 on a high CRAP score. Table only: no `--json`, no `--changed`, no `--lcov`, no `--use-existing-coverage`, no `--max-workers`.

**scrap4ts**

```
scrap4ts [path-fragment ...] [--verbose] [--json] [--write-baseline] [--compare PATH]
```

Discover via `vitest.config.*` `test.include` / `test.exclude` when that file exists, otherwise Vitest's default include/exclude. Ignore `includeSource` and `*.test-d.ts`. Path fragments filter that set; they are not Speclj scan roots. No `--coverage-command`. `--json` is not a Report. `--write-baseline` writes under `target/scrap/`. `--compare` loads a Baseline JSON.

Exit 1 on parse errors, remaining structure errors, or unknown flags. Exit 0 on high SCRAP scores, `SPLIT`, or `REVIEW_FIRST`.

Rejected: Java `--changed`; JSON from crap4ts; skip-regenerate; `--lcov` override; `--max-workers`; Speclj directory-root args for scrap4ts; Vitest default `coverage/` directory (already locked to `target/coverage`).
