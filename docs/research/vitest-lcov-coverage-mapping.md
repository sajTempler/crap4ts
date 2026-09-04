# Mapping Vitest coverage onto a scoring unit

Charting overlay: scoring units are settled (non-nested body-bearing function-likes). Nested callbacks are not rows, so `DA` lines in a nested arrow count toward the parent's span. Same-line sibling units still need column disambiguation from Istanbul JSON when LCOV collides; v1 LCOV join stays line-range.

How CRAP coverage stays honest when the runner is Vitest and the artifact is LCOV.

This ticket is blocked by scoring-unit research (`01-crap-scoring-units`). The join described here is the same for any scoring unit that exposes a source file plus an inclusive line range. Function-name join against LCOV `FN`/`FNDA` is not honest (see below). Until scoring units are settled, treat a unit as whatever shape we score, keyed by file plus `[start-line, end-line]`.

## Answer

1. **Default command.** Not bare `vitest run --coverage`. Vitest default reporters do not write LCOV. The family-shaped command is:

   `vitest run --coverage --coverage.reporter=lcov --coverage.reportsDirectory=target/coverage`

   That produces `target/coverage/lcov.info`. Vitest own default directory is `./coverage` which yields `coverage/lcov.info`. Align with crap4clj/crap4go (`target/coverage/`) by passing `reportsDirectory`. Allow a custom coverage command that still drops an LCOV file at a known path.

2. **v8 vs istanbul.** Consume **one LCOV file**. Both providers finish as an Istanbul `CoverageMap` and run the same Istanbul reporters. v8 (the default) remaps through `ast-v8-to-istanbul`; istanbul instruments then remaps through `istanbul-lib-source-maps`. Since Vitest 3.2.0 the docs claim identical reports. Do not special-case the provider when reading LCOV.

3. **Join key.** **Line ranges, not function records.** Parse `SF:` plus `DA:line,count` the way crap4clj does. Overlap those lines with the scoring unit `[start-line, end-line]`. Do **not** join on `FN`/`FNDA`: Istanbul LCOV writer emits only the function **start** line and a name that is often `(anonymous_N)`, and `FNDA` is entry count, not body coverage.

4. **Paths.** `SF:` is `path.relative(projectRoot, fileCoverage.path)` with `projectRoot` set to Vitest `config.root` (Vite `root`, usually `process.cwd()`). Aliases and Vite transforms are supposed to be gone after source-map remap. Match files the way the family does: normalize, then exact key, then path-suffix. tsconfig `rootDir` is not this path. Monorepo: one coverage process, one `lcov.info`, `SF` relative to the **root** config.

5. **Missing file.** **`N/A`, not 0%.** Follow crap4go/crap4java: no `SF` match means coverage unknown. 0% only when the file **is** in LCOV and the unit lines are present with zero hits (or no instrumented lines in range). Vitest omits files that were never imported unless `coverage.include` is set. Those omissions are `N/A`, not fully uncovered.

## Default command and artifact path

### What Vitest actually writes

From the [Coverage guide](https://vitest.dev/guide/coverage): enable with `vitest run --coverage` or `coverage.enabled`. Example npm script is `"coverage": "vitest run --coverage"`.

From [coverage config](https://vitest.dev/config/coverage):

| Option | Default | Meaning for us |
| --- | --- | --- |
| `coverage.provider` | `'v8'` | Collection only. Report format is still Istanbul. |
| `coverage.enabled` | `false` | `--coverage` turns it on. |
| `coverage.reporter` | `['text', 'html', 'clover', 'json']` | **No `lcov`.** Bare `--coverage` does not produce `lcov.info`. |
| `coverage.reportsDirectory` | `'./coverage'` | Directory for all reporters. |
| `coverage.clean` | `true` | Vitest **deletes** `reportsDirectory` before the run. |
| `coverage.allowExternal` | `false` | Files outside project root are skipped. |

Istanbul `lcov` reporter (`packages/istanbul-reports/lib/lcov/index.js`) instantiates `LcovOnlyReport` with `file: 'lcov.info'` and also writes HTML under `lcov-report/`. `lcovonly` writes only that info file (same `file` default).

Artifact we consume:

- Vitest-native: `coverage/lcov.info`
- Family-aligned: `target/coverage/lcov.info` via `--coverage.reportsDirectory=target/coverage`

The config example for reporter options is `['lcov', { 'projectRoot': './src' }]`. Vitest providers already pass `projectRoot: this.ctx.config.root` into `istanbul-lib-report.createAsync`. Overriding `projectRoot` to `./src` would strip a `src/` prefix from every `SF:` and make suffix matching harder. Do not pass that option unless a project LCOV is already written that way.

### Family wipe, run, join

| Tool | Wipe | Command | Artifact |
| --- | --- | --- | --- |
| crap4clj | `target/coverage` | `clj -M:cov --lcov` (or `--coverage-command`) | `target/coverage/lcov.info` |
| crap4go | dir of profile | `go test ./... -coverprofile=target/coverage/coverage.out` | `target/coverage/coverage.out` |
| crap4java | `target/site/jacoco`, `target/jacoco.exec` | Maven JaCoCo prepare-agent + test + report | `target/site/jacoco/jacoco.xml` |

crap4clj: `--lcov <path>` default `target/coverage/lcov.info`; custom path requires `--use-existing-coverage` or `--coverage-command`.

**Recommendation.** Default coverage command:

```
vitest run --coverage --coverage.reporter=lcov --coverage.reportsDirectory=target/coverage
```

Default LCOV path: `target/coverage/lcov.info`. Custom `--coverage-command` (crap4clj) / `--test-command` (crap4go) allowed; if the command already writes LCOV, crap4ts should still know the path (`--lcov` analog). Vitest itself deletes `reportsDirectory` when `coverage.clean` is true, so a family-style wipe of `target/coverage` is redundant but harmless.

`lcovonly` is enough if we never need the HTML sidecar. `lcov` is the name Vitest docs use in examples; it still writes `lcov.info`.

CLI `--coverage.reporter=lcov` replaces the default reporter list (Vitest CLI coverage options override config). That is what we want for a CRAP run: one machine-readable file, not html/clover/json.

## v8 vs istanbul: we consume LCOV, not V8 scripts

[Coverage guide](https://vitest.dev/guide/coverage): both providers are optional; default is v8 (`@vitest/coverage-v8`). Istanbul needs `@vitest/coverage-istanbul`.

**v8** (Vitest `packages/coverage-v8/src/provider.ts`):

- Collects V8 `Profiler.ScriptCoverage`.
- Remaps with `ast-v8-to-istanbul` (AST plus Vite transform `code`/`map`).
- Since **v3.2.0**, the guide says this produces identical coverage reports to Istanbul.
- `generateReports` builds `istanbul-lib-report` context with `dir: reportsDirectory` and runs each configured reporter with `projectRoot: ctx.config.root`.

**istanbul** (`packages/coverage-istanbul/src/provider.ts`):

- Instruments via `istanbul-lib-instrument` using the Vite combined sourcemap.
- After collection, `istanbul-lib-source-maps` `transformCoverage`.
- Same `generateReports` shape: same reporters, same `projectRoot`.

Both then `coverageMap.filter((filename) => existsSync(filename))`. After remap, paths that do not exist on disk are **dropped** and never appear in LCOV.

**We do not consume:**

- V8 inspector JSON
- Istanbul `coverage-final.json` (`statementMap` / `fnMap` / `s` / `f`) — richer, but the ticket says LCOV
- HTML under `coverage/` or `lcov-report/`

v8 vs istanbul only matters if remap is wrong (missing maps, virtual ids). The LCOV grammar is the same.

## LCOV records (what Istanbul actually emits)

### Format owner

Linux Test Project **geninfo** tracefile (`man/geninfo.1`):

- `TN:` test name (Istanbul writes `TN:` empty)
- `SF:<path>` source file
- `FN:<start-line>,<name>` optional end line in newer gcc/lcov; Istanbul does **not** write end
- `FNDA:<count>,<name>`
- `FNF:` / `FNH:`
- `DA:<line>,<count>[,checksum]`
- `LF:` / `LH:`
- `BRDA:` … `BRF:` / `BRH:`
- `end_of_record`

Istanbul `LcovOnlyReport.onDetail` (`istanbul-reports/lib/lcovonly/index.js`):

```
writer.println('TN:');
const fileName = path.relative(this.projectRoot, fc.path);
writer.println('SF:' + fileName);
// FN from fnMap: decl.start.line + name  (decl || loc)
// FNDA from fc.f[key] + name
// DA from fc.getLineCoverage()  → DA:line,count
writer.println('end_of_record');
```

Defaults: `file = 'lcov.info'`, `projectRoot = process.cwd()` unless the caller passes one (Vitest passes `config.root`).

### DA is collapsed statements, not functions

Istanbul `FileCoverage.getLineCoverage()` (`istanbul-lib-coverage/lib/file-coverage.js`): for each statement, take `statementMap[st].start.line`, keep the **max** hit count on that line.

So LCOV `DA` is **line** coverage: one count per executable line, max of statements on that line. Multi-statement lines share a hit. This is less precise than crap4go statement-weighted segments (`start.line:col,end.line:col statements count`).

crap4clj parser ignores `FN`/`FNDA`/`BRDA` and only keeps `DA`. Each `DA` becomes `{line {:covered (if (pos? count) 1 0) :total 1}}`. Then `coverage-for-range` sums covered/total for lines in `[start-line, end-line]`. Empty range → `0.0`.

**crap4ts should copy that DA join**, not invent a function-name join.

### Why FN/FNDA are a bad join key

| Fact | Source | Consequence |
| --- | --- | --- |
| `FN` is start line (optional end in modern gcov LCOV; **not** in Istanbul) | geninfo; istanbul-reports `FN:decl.start.line,name` | No range. Cannot clip a scoring unit body. |
| Names are Istanbul `fnMap[].name`, often `(anonymous_N)` | istanbul-reports | Will not match `const foo = () =>` or class methods reliably. |
| `FNDA` is times the function **entered** | geninfo | A function that ran once with half its branches dead still looks 100% covered. CRAP would lie. |
| Nested arrows / object methods | scoring-unit ticket still open | One Istanbul function record is not one CRAP row, and vice versa. |

JaCoCo (crap4java) **does** join by `class#method:line` because the XML has per-method instruction counters. LCOV function records are not that.

## Join algorithm (family, then TS)

### crap4clj (LCOV, closest analog)

1. `load-lcov` — missing file → `nil` (not throw).
2. `lcov-coverage-for-source` — normalize (`URLDecoder`, backslash to slash, strip `file:`, strip `./`, collapse slashes); try relative, absolute, canonical, and those with `src/` stripped; else **suffix segment match**.
3. `coverage-for-range` on the function `:start-line` / `:end-line`.
4. If no per-file HTML and LCOV lookup **misses**, it still `build-entries` with `{}` → **0.0%**, not `N/A`. `N/A` is reserved for namespace-HTML **name** mismatch (`coverage-for-function-name` returns `nil`).

That last point is the family split. crap4clj README: unmatched namespace-fallback functions are `N/A`, not `0.0%`. The LCOV miss path does not get that treatment.

### crap4go (coverprofile, the N/A policy we want)

`CoverageForRange`:

- No segments for file (after suffix match) → **`nil`** → report `N/A`. Test: `TestCoverageForRangeIsNilWhenFileMissing`.
- Segments exist but none overlap the range, or `Statements` sum to 0 → **`0.0`**.
- Overlap: statement-weighted `100 * covered / total`.

Join is **file + line range**, same as clj LCOV DA, with explicit missing-file `nil`.

### crap4java (method identity, not range)

JaCoCo XML `class` / `method` / `INSTRUCTION` counters. Key `className#methodName:line`. Miss → `null` → `N/A`. Missing `jacoco.xml` → warning, all `N/A`. Not the LCOV model; listed so family `N/A` is not only Go.

### Recommended crap4ts join

parse LCOV → map[normalized SF]map[line]hitCount

for each scoring unit:
  fileCov = lookup(unit.file)   # exact, then suffix (family)
  if fileCov is missing:        coverage = N/A
  else:
    lines = DA lines with startLine <= line <= endLine
    if lines empty:             coverage = 0.0   # file known, nothing instrumented in range
    else:                       coverage = 100 * (hits>0) / count

Hit/not-hit like crap4clj (positive count → covered), not raw execution counts. CRAP wants percent of instrumented lines executed, not how hot the line was.

### Where this depends on a scoring unit

The join does **not** care whether the unit is a function declaration, a `const` arrow, a class method, or a getter. It cares that each unit has:

1. **A filesystem path** we can suffix-match to `SF:`.
2. **Inclusive start and end lines** in the **original** source (the same coordinate system as remapped LCOV).

Open questions that scoring-unit research must answer before the join is honest:

- **Nested units.** If a parent function and a nested arrow both get rows, DA lines in the inner span count for **both** unless we exclude inner ranges from the parent. crap4clj nested `fn` stays in the parent CC and is not a separate row, so no double count. If TS scores nested arrows separately (candidate 2 on ticket 01), parent coverage must subtract or ignore the inner span, or CRAP will double-charge those lines.
- **Column-only siblings.** Two arrows on the same line: LCOV has one `DA` for that line. Range join cannot split them. Statement maps could (`start.column`); LCOV cannot. Honesty cap of this artifact.
- **Type-only / interface / declare.** If they are not scoring units, they never join. If they somehow get a range with no `DA` lines, the algorithm above yields 0%, which would be a lie (no executable code). Prefer: do not emit a row, or treat empty-instrumentation-in-range as `N/A` when the **file** has other DA lines. Family: crap4clj empty range → 0.0; crap4go no overlapping segments on a **present** file → 0.0. Call that out if type-only shapes ever leak into scoring.
- **Constructors, getters, static, `#private`.** Only affect the extractor ranges; LCOV DA does not name them.

Until 01 lands, implement the DA range join behind unit has `{file, startLine, endLine}` and do not couple to `FN` names.

## Path aliases, root, source maps, monorepo

### root vs tsconfig rootDir

Vitest/Vite **`root`** (`config.root`, default current working directory) is what Istanbul gets as `projectRoot`. `SF:` is relative to that.

TypeScript **`compilerOptions.rootDir`** is an emit layout setting. It does not appear in Vitest coverage config. Do not use it as the LCOV join root.

### Aliases

[Configuring Vitest](https://vitest.dev/config/): `resolve.alias` (Vite) and `test.alias` (merged for tests). Aliases apply to `import` of inlined modules, not `require`.

Coverage collection runs on **transformed** modules. Remap (v8: `ast-v8-to-istanbul` plus Vite `map`; istanbul: instrumenter plus `transformCoverage`) is supposed to restore **original file paths**. `SF:` should be real source (`src/foo.ts`), not `@/foo`.

If maps are missing or `sources` are `file:` URIs, Istanbul has historically written broken `SF:` (`src/file:/home/...`). crap4clj already strips a `file:` prefix during normalize. Keep that.

Query strings (`*.vue?vue&type=script`) are stripped in the istanbul provider (`removeQueryParameters`) and v8 maps `sources` through `new URL(source, url)`.

### Source maps from Vite

Vitest `server.sourcemap` default `'inline'`. Transforms carry maps into both providers.

`coverage.excludeAfterRemap` (default `false`): re-apply `include`/`exclude` after remap. Use when transpiled files maps pull in non-source files that still exist on disk.

`coverage.allowExternal` default `false`: coverage outside project root is dropped.

After remap, **non-existent paths are filtered out** (`existsSync`). A bad map means silent omission, then our join sees a missing file → `N/A`.

### Monorepo / projects

[Test projects](https://vitest.dev/guide/projects): `coverage` is **root-only**, done for the whole process. Not allowed in `defineProject`. One `reportsDirectory`, one `lcov.info`.

`SF:` is relative to the **root** `config.root`, so a package file is typically `packages/app/src/foo.ts`, not `src/foo.ts`.

If someone runs Vitest **inside** a package, `root` is the package and `SF` is `src/foo.ts`, while crap4ts might walk `packages/app/src/foo.ts`. **Suffix match** (crap4clj / crap4go) is the join, not string equality.

Multiple packages each running their own `vitest --coverage` produce multiple `lcov.info` files. Concatenating LCOV records is valid (geninfo: sections concatenated). crap4ts should either:

- run coverage once from the repo root (Vitest projects), or
- accept `--lcov` / a merge, or
- document that `--coverage-command` must emit one file.

Do not assume `coverage/` at repo root if the command ran in a package.

### coverage.include and untested files

Guide: default include is **files imported during the test run**. Unimported source is absent from the report unless `coverage.include` is set (e.g. `src/**/*.{ts,tsx}`).

Absent from LCOV is not 0%. That is the `N/A` case. If we want untested files to show **0%** (high CRAP for complex untested units), the coverage command must pass `coverage.include` (and usually `coverage.exclude` for tests, `dist`, `**/*.d.ts`). That is a product default, not required for the join to be well-defined.

## Missing file → N/A vs 0%

| Situation | crap4clj | crap4go | crap4java | crap4ts (recommend) |
| --- | --- | --- | --- | --- |
| LCOV/profile/XML file missing | `load-lcov` → nil; no HTML → **0%** via empty range | `LoadProfile` missing → nil map; no segments → **N/A** | warning; empty map → **N/A** | **N/A** (go/java) |
| File not in artifact (not imported, remap dropped, path mismatch) | LCOV lookup nil, then HTML or **0%** | **N/A** | **N/A** | **N/A**; optional debug like `CRAP4CLJ_DEBUG_LCOV` |
| File present, all DA in range count 0 | **0%** | **0%** | 0% instructions | **0%** |
| File present, no DA lines in unit range | **0%** | **0%** (total 0) | N/A if no method key | **0%** if we treat instrumented file empty span like family; else `N/A` if we worry about type-only spans |
| Function **name** not in HTML fallback | **N/A** | n/a | n/a | n/a (we are not doing name join) |

`N/A` means CRAP is not computed (`crap-score` / `Score` / `CrapScore.calculate` all no-op on nil coverage). Sorting puts numeric CRAP first (family).

**Do not report 0% for a missing `SF`.** That would mark every untested-and-unimported module as fully uncovered even when Vitest never measured it, or worse, when we simply failed to match `packages/foo/src/a.ts` to `src/a.ts`.

Path mismatch should be diagnosable (crap4clj `lcov-diagnostics`: common suffix length, closest `SF`). Worth porting.

## Settled defaults (for implementers)

| Item | Decision | Depends on scoring unit? |
| --- | --- | --- |
| Command | `vitest run --coverage --coverage.reporter=lcov --coverage.reportsDirectory=target/coverage` | No |
| Artifact | `target/coverage/lcov.info` (not Vitest `coverage/lcov.info`, unless `--lcov` / custom command) | No |
| Provider | Either; default v8; read LCOV only | No |
| Parser | `SF` + `DA`; ignore `FN`/`FNDA`/`BRDA` for the percent | No |
| Join | File match (normalize + suffix) times line overlap with unit `[start,end]` | **Yes — unit must have those fields** |
| Nested overlap | Unspecified until 01; parent+child both counting inner `DA` is dishonest if both are rows | **Yes** |
| Same-line siblings | Cannot split with LCOV | **Yes** if those shapes are units |
| Missing `SF` | `N/A` | No |
| Present, uncovered | `0%` | No |
| Aliases / maps | Trust remap; suffix-match leftovers; strip `file:` | No |
| Monorepo | One root coverage process; suffix-match package prefixes | No |
| Untested files | Absent unless `coverage.include`; then 0%. Do not fake 0% for absent. | No |

## Sources

- [Vitest Coverage guide](https://vitest.dev/guide/coverage) — providers, `--coverage`, include/exclude, ignore comments, v8 AST remap since 3.2.0
- [Vitest coverage config](https://vitest.dev/config/coverage) — defaults (`reporter`, `reportsDirectory`, `clean`, `provider`, `allowExternal`, `excludeAfterRemap`, `projectRoot` example)
- [Vitest test projects](https://vitest.dev/guide/projects) — coverage is root-process, not per-project
- [Vitest config](https://vitest.dev/config/) — `server.sourcemap` default `inline`; `alias` / `resolve.alias`
- Istanbul `lcovonly/index.js` and `lcov/index.js` in istanbuljs/istanbuljs
- Istanbul `file-coverage.js` `getLineCoverage`
- LCOV geninfo TRACEFILE FORMAT (`linux-test-project/lcov` `man/geninfo.1`)
- Vitest `packages/coverage-v8/src/provider.ts`, `packages/coverage-istanbul/src/provider.ts`
- crap4clj `src/crap4clj/coverage.cljc`, `core.cljc`, `crap.cljc`, `cli.cljc`
- crap4go `internal/coverage/coverage.go`, `cmd/crap4go/main.go`, `internal/crap/crap.go`
- crap4java `JacocoCoverageParser.java`, `CrapAnalyzer.java`, `CliApplication.java`
