# SCRAP to Vitest: port / adapt / drop

Charting overlay (not from the research pass): parse target files with oxc-parser behind the parser adapter, not the TypeScript 6 compiler API. TypeScript 7 has no API; 6 is the Microsoft tool path we declined. The port/adapt/drop tables below still stand.

## Question

Which Speclj SCRAP metrics, smells, and AI decision layers have a Vitest analog, which must be adapted, and which should be dropped?

Constraint: a faithful port of the decision layer, not a "count assertions" toy, and not a Speclj clone that pretends Vitest nesting and mocking work like Speclj.

Sources of truth:

- Product behavior: `/Users/szymon/herocoders/workspaces/scrap/README.md` and `src/scrap/**`. `scrap.md` is stale where it conflicts (quadratic formula, extra smell penalties, `tools/scrap` path).
- Vitest: official docs cited inline. Jest is out of scope as a runner. Jest-shaped APIs are in scope only when Vitest documents them as first-class or as compatibility shims.

## Speclj SCRAP inventory

All of this is from code, not `scrap.md`.

### What SCRAP is for

SCRAP scores spec *structure* so an assistant can decide whether, where, and how to refactor. It does not use mutation. Recommendations are advisory. (`README.md`)

### Structural scan (not a smell, a parse-time error)

`src/scrap/scan.clj` + `src/scrap/scan_nesting.clj` + `src/scrap/scan_tokenize.clj`.

Paren tokenizer tracks Speclj forms in `shared/speclj-forms`: `describe`, `context`, `it`, `before`, `before-all`, `after`, `with-stubs`, `with`, `around`, `run-specs`.

Illegal nesting (`scan_nesting.clj` `invalid-parent-child?`):

- any Speclj form inside `it` (the parent=`it` clause fires first)
- `describe` inside `describe`
- `describe` inside `context`

Unclosed forms and `clojure.tools.reader` parse errors are reported as `structure-errors` / `parse-error` (`source.clj`).

File discovery (`source.clj` `spec-file?`): `*_spec.clj` and `*_spec.cljc`, default root `spec`.

### Example collection

`src/scrap/example_collect.clj` walks `describe` / `context` for path and inherited setup, scores only `it`. Setup heads inherited into examples: `let`, `binding`, `with-redefs`, `before`, `before-all`, `around`, `with`, `with-stubs` (`shared.clj` `setup-heads`).

### Per-`it` metrics

From `example_score.clj` `score-example` plus node/helper analysis:

| Field | Detector |
| --- | --- |
| `name`, `describe-path`, `line`, `end-line` | `it` form metadata |
| `raw-line-count` | form line span (`example_shapes.clj`) |
| `line-count` | raw lines + `helper-hidden-lines` |
| `assertions` | heads in `shared/assertion-heads`: `should`, `should=`, `should-not`, `should-not=`, `should-contain`, `should-not-contain`, `should-be-nil`, `should-not-be-nil`, `should-throw` |
| `branches` | `if`, `if-not`, `when`, `when-not`, `cond`, `case`, `and`, `or`, `try`, `loop`, `while`, plus `table-branches` |
| `table-branches` / `table-driven?` | `doseq`, `for`, `every?`, `map`, `mapv`, `run!` wrapping a "large case table" (seq of collections, length >= 2) (`expr.clj` `large-case-table?`) |
| `setup-depth` | nested `setup-heads` |
| `with-redefs` | count of `with-redefs` forms |
| `helper-calls` | calls to same-file `defn` / `defn-` / `defmacro` |
| `helper-hidden-lines` | line span of those helper bodies, charged back into the example |
| `temp-resources` | `createTempFile`, `createTempDirectory`, `mkdir`, `mkdirs`, `future`, `sh`, `slurp`, `spit`, or a name containing `Temp` |
| `large-literals` | string > 5 lines, or map/vector/set with > 10 entries |
| `subject-symbols` | namespaced symbols, or non-control non-helper symbols |
| `phases` | assertion clusters: top-level forms tagged `:setup` / `:assert` / `:action`, then `partition-by` (`example_node.clj` `assertion-clusters`) |
| `api-contract?` | small, shallow, unmocked, single-phase example (`example_metrics.clj`) |
| shape signatures | setup / assert / arrange / fixture / literal feature sets after `normalize.clj` |

Complexity (used internally):

```
complexity = 1 + branches + scored-setup-depth + helper-calls + (quot helper-hidden-lines 8)
```

Scored complexity (`saturating-complexity-score` in `example_metrics.clj`, constants in `policy.clj`):

```
floor=1, cap=25, rise-rate=0.18
score = floor                                    if complexity <= 1
      = floor + (cap-floor)*(1 - exp(-rise-rate*(complexity-1)))  otherwise
```

Input to the saturating curve is `1 + scored-branch-penalty + scored-setup-depth + helper-calls`. Table-driven examples use `table-branches` only. API-contract examples get a 2-unit discount on setup depth and branch penalty.

**Do not use `scrap.md`'s `SCRAP = complexity^2 + smell_penalties`.** Code is saturating curve plus smell penalties.

```
scrap = complexity-score + sum(smell penalties)
```

### Per-example smells

From `example_smells.clj` `smell-entries` only. `scrap.md` lists two extra penalties (`multiple unrelated assertion clusters +2`, `large inline test data blobs +2`) that are **not in code**. `multiple-phases` already covers clustered assertions. `literal-heavy-setup` already covers large blobs.

| Label | When | Penalty |
| --- | --- | --- |
| `no-assertions` | `assertions = 0` | 10 |
| `low-assertion-density` | exactly 1 assertion, `line-count > 10`, not table-driven, not api-contract | 6 |
| `multiple-phases` | `phases > 1` | 5 |
| `high-mocking` | `with-redefs > 3` | 4 |
| `large-example` | `line-count > 20` and not api-contract | 4 |
| `temp-resource-work` | `temp-resources > 0` | 3 |
| `literal-heavy-setup` | `large-literals > 0` | 3 |
| `helper-hidden-complexity` | `helper-hidden-lines > 8` | 4 |

`api-contract?` is a classifier that suppresses some smells. It is not itself a smell.

### File and block rollups

`summary.clj` `summarize-examples` (file) and `summarize-blocks` (group by `describe-path`).

Counts:

- `example-count`, `avg-scrap`, `max-scrap`
- `branching-examples` (has branches and not table-driven)
- `low-assertion-examples` (`assertions <= 1`)
- `zero-assertion-examples`
- `with-redefs-examples`
- `helper-hidden-example-count`
- `table-driven-examples`
- `coverage-matrix-candidates` / `case-matrix-repetition` (same value)

Duplication channels (Jaccard >= 0.5 on normalized feature sets, `policy.clj` `:threshold 0.5`):

- `setup-duplication-score`, `assertion-duplication-score`, `fixture-duplication-score`, `literal-duplication-score`, `arrange-duplication-score`
- `subject-repetition-score` (same production API, lightly penalized)
- `duplication-score` = setup + assertion + fixture + literal + arrange
- `harmful-duplication-score` = setup + assertion + fixture + arrange (literal dropped)
- shape diversity and average similarity per channel

Coverage-matrix candidate (policy caps in `duplication-policy`): scrap <= 18, lines <= 12, assertions <= 1, branches = 0, setup-depth <= 2, with-redefs = 0, temp-resources = 0, helper-hidden-lines = 0, and either already table-driven or few subject symbols plus some assert/arrange features. Then it must be similar to a sibling on setup, arrange, or (assert + subject).

Extraction pressure (`extraction_pressure.clj`):

- cluster examples by Jaccard on union of setup/assert/fixture/arrange features
- drop clusters that are all coverage-matrix candidates
- `F` shared features, `I` instances, `V` variable points
- `D_before = 0` if `F <= 3` or `V > 4`, else `(max(0, F-3) * (I-1)^1.5) / (V+1)`
- `D_after = 0`, helper cost `H = F + V`
- net benefit `max(0, D_before - D_after - H)`
- `effective-duplication-score` = sum of net benefits (`extraction-pressure-score`)
- recommended extractions carry `it` names and line ranges

Block report also has `worst-example`.

### Pressure, remediation, actionability

File score (`pressure_score.clj`): size-factor times weighted sum of avg-scrap, max-scrap, effective-duplication, low-assertion ratio, branching ratio, with-redefs ratio, helper-hidden ratio, minus `1.5 * case-matrix-repetition`. Size factors: 1 example 0.25, 2 0.40, <=4 0.65, else 1.0.

Levels (`policy.clj`): STABLE (via `stable-summary?`), else CRITICAL >= 55, HIGH >= 35, MEDIUM >= 18, else LOW.

`stable-summary?` (`pressure_stability.clj`): small files (<= 2 examples, max-scrap <= 10, effective-duplication <= 1, no helper-hidden, no zero-assertion) or general (max-scrap <= 12, effective-duplication <= 3, no zero-assertion, low-assertion ratio <= 0.35).

Remediation (`pressure_mode.clj`):

- `STABLE` if `stable-summary?`
- `SPLIT` if not stable, example-count >= 12, (high-pressure blocks >= 2 or max-scrap >= 35), and split-pressure (avg-scrap >= 10 or effective-duplication >= 20 or subject-repetition >= 12 or any helper-hidden)
- else `LOCAL`

AI actionability (`actionability_modes.clj`), first match wins:

| Mode | When |
| --- | --- |
| `LEAVE_ALONE` | remediation is `STABLE` |
| `AUTO_TABLE_DRIVE` | coverage-matrix candidates > 0, case-matrix-repetition high enough vs harmful duplication, max-scrap <= 12, branching-ratio <= 0.15, mocking-ratio < 0.2 |
| `AUTO_REFACTOR` | remediation is `LOCAL` and there is something to fix (harmful duplication, zero-assertion, low-assertion ratio > 0.4, or max-scrap > 20) and branching-ratio <= 0.3 and mocking-ratio < 0.35 |
| `MANUAL_SPLIT` | remediation is `SPLIT` |
| `REVIEW_FIRST` | fallback |

How-recommendations (`actionability_rules.clj`), max 4, confidence HIGH/MEDIUM/LOW:

- HIGH: table-drive coverage matrices; strengthen weak assertions; split oversized examples (LOCAL + max-scrap > 20); split file if SPLIT
- MEDIUM: extract harmful duplication; reduce mocking; remove spec logic / keep variation in tables
- LOW: distrust helper extraction that only hides setup; consider splitting by responsibility (LOCAL + avg-scrap > 12)

Baseline/compare (`comparison.clj`): verdict `improved` / `worse` / `mixed` / `unchanged` from file-score, extraction-pressure, max-scrap, helper-hidden, case-matrix deltas.

CLI (`cli.clj`): default path `spec`, `--verbose`, `--json`, `--write-baseline` -> `target/scrap/`, `--compare PATH`.

This whole judgment stack is the thing worth porting. The Speclj form names are not.

## Vitest construct map

Official docs only. First-class vs compatibility is as Vitest states it.

### File discovery

- Default include: `['**/*.{test,spec}.?(c|m)[jt]s?(x)']`. [vitest.dev/config/include](https://vitest.dev/config/include)
- Default exclude: `['**/node_modules/**', '**/.git/**']`. [vitest.dev/config/exclude](https://vitest.dev/config/exclude)
- `includeSource` defaults to `[]`. In-source tests (`if (import.meta.vitest)`) only run when configured. [vitest.dev/config/include-source](https://vitest.dev/config/include-source), [vitest.dev/guide/in-source](https://vitest.dev/guide/in-source)
- Type tests default to `*.test-d.ts` and are **not executed**. `expectTypeOf` is a runtime no-op. [vitest.dev/guide/testing-types](https://vitest.dev/guide/testing-types), [vitest.dev/api/expect-typeof](https://vitest.dev/api/expect-typeof)

### Suites and tests

[vitest.dev/api/](https://vitest.dev/api/), [vitest.dev/api/describe](https://vitest.dev/api/describe)

| Vitest | Notes |
| --- | --- |
| `test` / `it` | aliases of each other. Body optional => `todo`. |
| `describe` / `suite` | aliases. **Nested `describe` is documented and first-class.** |
| `test.skip` / `skipIf` / `runIf` / `only` / `todo` / `fails` / `concurrent` | modifiers. `sequential` is deprecated. |
| `test.for` / `describe.for` | first-class table-driven API, integrates Test Context |
| `test.each` / `describe.each` | **Jest compatibility.** Docs say prefer `.for`. |
| `test.extend` / `test.override` | fixtures. Playwright-inspired. [vitest.dev/guide/test-context](https://vitest.dev/guide/test-context) |
| `bench` | experimental, not a test |

There is no Speclj `context`. Nested `describe` is the grouping construct. Speclj forbids `describe` inside `describe`; Vitest's own describe page shows exactly that pattern.

Collection vs run: `describe` registers tests as a side effect of importing the file. [vitest.dev/guide/lifecycle](https://vitest.dev/guide/lifecycle). Calling `describe` / `test` / `beforeEach` from inside a running `test` is not how the runner works.

Done callbacks: Jest form `(done) => void` is mentioned only to say use `async` instead. [vitest.dev/api/](https://vitest.dev/api/)

### Hooks

[vitest.dev/api/hooks.html](https://vitest.dev/api/hooks.html)

| Vitest | Speclj nearest |
| --- | --- |
| `beforeEach` (optional cleanup return) | `before` |
| `afterEach` | `after` |
| `beforeAll` (optional cleanup return) | `before-all` |
| `afterAll` | (Speclj has `after`, not a distinct after-all in SCRAP's form set) |
| `aroundEach` (must call `runTest()`) | `around` |
| `aroundAll` (must call `runSuite()`) | none |
| `onTestFinished` / `onTestFailed` | **must** be called inside a test body |

Hooks apply to the current suite (file or `describe`). They are not legal inside `it` in Speclj, and they are not how you wrap a single Vitest test except `onTestFinished` / `onTestFailed`.

`test.extend` fixtures are the Speclj `with` analog: named, reusable, scoped setup injected into the test callback. `with-stubs` has no direct form. Mocking is `vi.*`.

### Assertions

[vitest.dev/api/expect.html](https://vitest.dev/api/expect.html), [vitest.dev/guide/features](https://vitest.dev/guide/features)

Vitest ships Chai and layers Jest-compatible matchers on it. Both styles are first-class:

```ts
expect(input).to.equal(2) // chai
expect(input).toBe(2)     // jest-shaped, still Vitest
```

Also first-class:

- `expect.soft`, `expect.poll` (async, must be awaited)
- `assert` imported from `vitest` (Chai assert; test API examples use `assert.equal`)
- `expect.assert` (same assert, for type narrowing)
- spy matchers: Jest `toHaveBeenCalled*` and, since 4.1, Chai `expect(spy).to.have.been.called()`
- snapshots: `toMatchSnapshot`, `toMatchInlineSnapshot`, file / aria variants
- `expect.assertions(n)` / `expect.hasAssertions()` are meta-checks, not production assertions
- `expectTypeOf` / `assertType` are type-only. Do not count them as runtime assertions.

Third-party matchers (Testing Library, jest-dom) exist in the wild. Vitest only documents that `test.globals = true` helps them. They are not v1 detectors.

### Mocking

[vitest.dev/api/vi](https://vitest.dev/api/vi), [vitest.dev/guide/mocking](https://vitest.dev/guide/mocking), [vitest.dev/guide/features](https://vitest.dev/guide/features)

"Vitest provides `jest`-compatible APIs on `vi`." That is Vitest's mocking API, not a reason to target Jest.

| API | Scope | Speclj analog |
| --- | --- | --- |
| `vi.spyOn(obj, key)` | per object, lexical | closest to `with-redefs` on a var's fn |
| `vi.fn()` | new mock function | stub |
| `vi.stubGlobal` / `vi.stubEnv` | globals / env, **do not auto-reset** unless config | none |
| `vi.mock(path)` | **hoisted to file top**, always runs before imports | **not** `with-redefs`. File-level module substitution. |
| `vi.doMock` | not hoisted; next *dynamic* import | still not dynamic-scope redef |
| `vi.hoisted` | factory vars for `vi.mock` | none |
| automock / `__mocks__` | opt-in. Default is **no** automock. Jest automock is a compatibility recipe, not Vitest default. | none |

`with-redefs` is dynamic scope for the body of one form. `vi.mock` is a file-wide hoist. Counting a `vi.mock` written inside `test()` as a per-example redef would be a lie. Vitest says so: "whenever you write it (be it inside `beforeEach` or `test`), it will actually be called before that."

### Fixtures / context

[vitest.dev/guide/test-context](https://vitest.dev/guide/test-context)

Test callback receives `{ task, expect, skip, annotate, signal, onTestFailed, onTestFinished, ...fixtures }`. Concurrent snapshots **must** use context `expect`. `test.extend` can scope fixtures to test or file. This is inherited setup, same role as Speclj `with` / `before` on a `describe`.

## Port / adapt / drop

Verdict key: **port** = keep the rule and numbers, swap only names. **adapt** = keep the intent, change the detector so it is true on Vitest. **drop** = Speclj-only or would produce false guidance.

### Decision layer (port)

| Item | Source | Vitest note |
| --- | --- | --- |
| Saturating complexity curve (`cap` 25, `rise-rate` 0.18, `floor` 1) | `policy.clj`, `example_metrics.clj` | Language-agnostic once inputs exist |
| Smell labels and penalties | `example_smells.clj` | Keep numbers. Change detectors (below). |
| `api-contract?` discount | `example_metrics.clj` | Keep thresholds. Retarget "unmocked" to per-test spies, not `vi.mock`. |
| Jaccard 0.5, F/I/V extraction formula, `D_after=0` | `extraction_pressure.clj`, `normalize.clj` | Keep math. Normalize TS AST instead of Clojure forms. |
| Harmful vs coverage-matrix vs subject-repetition split | `summary.clj`, README | Keep. Table-drive target becomes `test.for`. |
| Helper-hidden charge-back | `example_node.clj` `helper-expanded-metrics` | Keep. Helpers are same-file functions, not `defn`. |
| File/block/example rollup fields | `summary.clj`, `report_model.clj` | Rename `with-redefs-*` to mocking fields. |
| Pressure weights, size factors, matrix credit, levels | `policy.clj` `pressure-policy` | Port as-is for v1. Recalibrate later against real Vitest corpora. |
| `STABLE` / `LOCAL` / `SPLIT` | `pressure_mode.clj` | Port |
| `LEAVE_ALONE` / `AUTO_TABLE_DRIVE` / `AUTO_REFACTOR` / `MANUAL_SPLIT` / `REVIEW_FIRST` | `actionability_modes.clj` | Port. `AUTO_TABLE_DRIVE` how-text must say `test.for`, not "table-driven Speclj". |
| How-rules and HIGH/MEDIUM/LOW | `actionability_rules.clj` | Port intent. Mocking copy talks about `vi.spyOn` / `vi.fn`, not "reduce with-redefs". |
| Baseline sidecar + compare verdicts | `comparison.clj`, `cli.clj` | Port. Write under `target/scrap/` or a TS equivalent. |
| Guidance report shape (why / where / how / worst-examples) | `report.clj`, `actionability.clj` | Port |
| CLI flags `--verbose` `--json` `--write-baseline` `--compare` | `cli.clj` | Port |

This is the product. If v1 ships without this stack, it is not a SCRAP port.

### Detectors (adapt)

| Speclj detector | Vitest detector | Why adapt |
| --- | --- | --- |
| `*_spec.clj(c)` under `spec` | Default Vitest include glob. If `vitest.config.*` exists, honor `test.include` / `test.exclude`. Do not scan `includeSource` in v1 (`[]` by default). | Different convention. [config/include](https://vitest.dev/config/include) |
| Collect `it` only | Collect `test` and `it`, including `.skip` `.todo` `.fails` `.only` `.concurrent` as still-examples (skip/todo still have structure). Treat `.each` / `.for` as **one** example that is `table-driven?`, not N sibling examples. | `.for` is the first-class table. Expanding it into N tests would invent duplication that the author already collapsed. [api/](https://vitest.dev/api/) |
| Block path = `describe` + `context` | Block path = nested `describe` / `suite` titles. File-level tests live in an implicit suite (Vitest says so). | No `context`. Nested describe is legal. [api/describe](https://vitest.dev/api/describe) |
| Assertion heads `should*` | Count one assertion per `expect(...)` / `expect.soft(...)` / `await expect.poll(...)` **call**, plus each `assert.*` / `expect.assert` call from `vitest`. Do not count `expectTypeOf`, `assertType`, `expect.assertions`, `expect.hasAssertions`, `expect.anything`. Chai `expect(x).to.equal(y)` is one call. Matcher chains on one `expect` are one assertion. | Closed Speclj macro set vs open Chai/Jest matcher set. [api/expect](https://vitest.dev/api/expect.html) |
| `table-driven?` via `doseq`/`for` + case table | `table-driven?` if the test is `test.for` / `test.each` / `describe.for` / `describe.each`, or a `for`/`forEach`/`map` over a literal array of cases **inside** a `test`. Prefer recommending `test.for` in AUTO_TABLE_DRIVE. Treat `.each` as the same structure, labeled compat. | Vitest's table API is named. Heuristic loops remain for unconverted matrices. [api/](https://vitest.dev/api/) |
| `with-redefs` count | Split: **file-level** `vi.mock` / `vi.hoisted` (always file scope). **example-level** `vi.spyOn`, `vi.fn`, `vi.stubGlobal`, `vi.stubEnv`, `vi.doMock`. `high-mocking` uses example-level count > 3. File-level mocks feed `mocking-ratio` as "this file substitutes modules", not as 1.0 for every example. | Hoisting. [api/vi](https://vitest.dev/api/vi) |
| `setup-heads` including `let` | Do **not** increment setup-depth on every `const`/`let`. That would mark every TS test as deep. Count: inherited `beforeEach` / `beforeAll` / `aroundEach` / `aroundAll` / `test.extend` fixtures on the suite path (like inherited Speclj `before`/`with`); plus nested `try`, and callback-heavy arrange inside the test. `let` in Clojure is an explicit binding form. `const` in TS is not. | Would lie if copied |
| Branch heads Clojure `if-not`/`when`/`cond` | JS/TS: `if`, ternary, `switch`, `try`/`catch`, `for`/`while`/`do`, `&&` / `\|\|` used as control (not in assertions), `?.` not counted. `and`/`or` as Speclj branch heads do not map 1:1 to `&&`/`\|\|` in `expect(a && b)`. | Different AST |
| Same-file `defn` helpers | Same-file `function`, `const f = () =>`, `const f = function`, methods on a local object. Not imported helpers, not `vi.fn`. Expand one level with a cycle guard, same as `helper-stack`. | Same intent |
| Temp resources Java/Clojure names | `fs.mkdtemp`, `fs.mkdir`, `os.tmpdir`, `fs.writeFile`/`readFile`/`promises.writeFile`, names matching `/tmp/i` or `Temp`, `child_process`, `exec`, `spawn`. Keep the smell. Change the name list. | `expr.clj` `temp-resource-call?` is JVM-shaped |
| Large literals | Same thresholds on string line count and object/array/set size, on TS literals. | Portable |
| Subject symbols = namespaced Clojure symbols | Imported identifiers whose module is not `vitest` / relative test helper. Ignore `expect`, `vi`, fixture names. | Different module system |
| Phases = top-level forms in `it` | Partition **statements** in the test function body into setup / action / assert. A second `expect` after a call is a new phase, same as Speclj. Fixture params are inherited setup, not a phase. | Block vs forms |
| Shape normalize: symbol->`sym`, string->`:string` | Walk TS AST: identifiers -> `id`, string/number/boolean literals collapsed, object/array shape kept. Jaccard still 0.5. | `normalize.clj` is Clojure-specific in implementation only |
| Parse errors via tools.reader | TypeScript compiler API (see `docs/research/typescript-7-api.md`: TS 7 has no programmatic API today; parse with TS 6). Drop the paren scanner. | Different language |
| Nesting errors | Report Vitest-illegal structure only: `test`/`it` nested in `test`/`it`; `describe` nested in `test`; suite hooks (`beforeEach`, `aroundEach`, …) nested in `test`. Allow nested `describe`. Allow `onTestFinished` / `onTestFailed` in `test`. | Speclj rules are the opposite of Vitest docs |

### Drop

| Item | Why |
| --- | --- |
| Speclj nesting: `describe` inside `describe` or `context` is ERROR | Vitest documents nested `describe` as the way to group tests. Porting this rule would flag idiomatic files. [api/describe](https://vitest.dev/api/describe) |
| Paren tokenizer, unclosed `(` errors, `speclj-forms` token set | Clojure. TS parse errors come from the compiler. |
| `context` as a distinct construct | Does not exist. |
| `with`, `with-stubs`, `with-redefs` as metric **names** | Keep the concepts (fixtures, mocking) under Vitest names. |
| `run-specs` | Speclj runner entry. |
| `scrap.md` quadratic formula and extra smell rows | Conflicts with `example_score.clj` / `example_smells.clj`. |
| Counting `vi.mock` inside a test as per-example `with-redefs` | Hoisted. Would inflate every example in a mocked file equally, then tell AUTO_REFACTOR to "reduce mocking" in each `it`. |
| Counting `expectTypeOf` / `assertType` as assertions | Runtime no-op. Type files are not executed. [guide/testing-types](https://vitest.dev/guide/testing-types) |
| Scoring `*.test-d.ts` with runtime smells in v1 | Skip those files, or a later type-test mode. `no-assertions` would fire on every type test if you naively counted `expect` only. |
| `bench` files | Not tests. |
| In-source `import.meta.vitest` as default discovery | `includeSource` defaults to empty. Opt-in later. |
| Jest `done` callback as a construct to model | Vitest tells you to use `async`. |
| Jest automock / default `__mocks__` without `vi.mock` | Vitest default is no automock. [api/vi](https://vitest.dev/api/vi) |
| Treating `test.each` as the recommended table API | Compat shim. First-class is `test.for`. |
| Speclj `let`/`binding` depth copied onto every `const` | Would make every TS example `large-example` + high setup-depth. |
| Third-party matchers and `node:assert` in v1 | Not Vitest's assertion API. Miss some tests; do not pretend they are `should=`. |
| Cloning Speclj `around` call-style (`around` wrapping body as a form) onto `aroundEach` without requiring `runTest` awareness | Different contract. For v1, treat `aroundEach` as inherited setup depth, do not parse the `runTest` callback as example body. |

## Recommendation

Port the **decision layer** in full. Adapt every **detector**. Drop Speclj nesting and Clojure parsing.

That is a real port: same questions (refactor or not, where, how, whether an assistant may act unattended), same numbers, Vitest-true inputs.

### v1 surface (named)

Ship **scrap-for-vitest v1** as:

1. **Discover** files matching Vitest default `include`, minus `exclude`. Optionally read `vitest.config.*` `test.include` / `test.exclude`. Ignore `includeSource` and `*.test-d.ts`.
2. **Parse** TS/JS/TSX/JSX with the TypeScript 6 compiler API. No paren scan.
3. **Collect** `describe`/`suite` trees and `test`/`it` examples. Nested describe is a block path, not an error. `test.for` / `test.each` is one table-driven example.
4. **Measure per example** the current metric set, with adapted detectors: assertions (`expect`/`assert` from `vitest`), branches, setup-depth (hooks + fixtures + nested try, not every `const`), mocking (`vi.spyOn`/`vi.fn`/`vi.stub*`), helper-hidden, temp resources, large literals, phases, subject imports, shape features.
5. **Score** with the saturating curve and the eight smell penalties. Keep `api-contract?`.
6. **Roll up** files and describe-blocks with the same duplication channels, coverage-matrix split, and extraction-pressure formula.
7. **Judge** with the same pressure score, `STABLE`/`LOCAL`/`SPLIT`, and the five `ai-actionability` modes. `AUTO_TABLE_DRIVE` how-text: consolidate into `test.for`.
8. **Report** the existing guidance format (why / where / how / worst-examples), plus `--verbose`, `--json`, `--write-baseline`, `--compare`.

Out of v1, on purpose: in-source tests, type-test files, `bench`, third-party matchers, config-driven automock, browser-mode spy limitations.

Do not ship a v1 that only counts `expect(` calls. That throws away helper-hidden, extraction pressure, and actionability, which are the reason SCRAP exists.

Do not ship a v1 that errors on nested `describe`. That is a Speclj clone, and it would call healthy Vitest files broken.

## Risks (portable-looking, Vitest-false)

**Nested `describe`.** SCRAP's structure check treats it as ERROR. Vitest's describe page uses it as the example of "hierarchy of tests". Drop the rule or the tool lies on day one.

**`vi.mock` written inside `test` or `beforeEach`.** Looks local, runs file-wide, before imports. Per-example `high-mocking` from that form is wrong. Charge it at file scope. `vi.doMock` is still not `with-redefs` (static imports already evaluated).

**`const` / `let` as `setup-heads`.** Speclj `let` is a nesting construct. TS tests are walls of `const`. Copying the head list explodes setup-depth and `large-example`.

**`&&` / `||` as branches.** Speclj `and`/`or` are special forms. In Vitest they appear inside `expect(x && y)`. Count control-flow statements, not every logical operator.

**`test.each` vs `test.for`.** Both are tables. If AUTO_TABLE_DRIVE rewrites `.for` into `.each`, or expands `.for` into sibling `test`s, you undo Vitest's preferred API. Detect both as table-driven. Recommend `.for`.

**Concurrent tests + global `expect`.** Vitest requires context `expect` for concurrent snapshots. For SCRAP, `({ expect }) => expect(...)` is still an assertion. Do not miss it because `expect` is a parameter.

**`expect.poll` / `expect.soft`.** One call, one assertion. Forgetting `await` on `poll` is a Vitest test bug, not a SCRAP smell. Do not invent a `forgotten-await` smell in v1.

**Type tests.** `expectTypeOf` looks like `expect`. It does nothing at runtime. Scoring `*.test-d.ts` with `no-assertions` would be noise.

**Fixtures vs helper-hidden.** `test.extend` setup that lives in another file is inherited fixture shape, not a same-file helper. Charging it as helper-hidden would punish the recommended fixture style. Same-file `function makeUser()` still charges.

**Hooks inside tests.** Speclj forbids `before` in `it`. Vitest *requires* `onTestFinished` in the test when concurrent. A blanket "hooks in test = error" is wrong. Split the set.

**Globals.** `test.globals = true` means no import. Detectors must recognize `expect` / `vi` / `describe` as Vitest identifiers even without an import from `'vitest'`. [guide/features](https://vitest.dev/guide/features)

**Thresholds.** Pressure cutoffs were fit on Speclj specs. Port them so the decision layer is comparable, then recalibrate. Do not silently retune v1 or you cannot tell a bad detector from a bad threshold.

**Parser.** TypeScript 7.0 has no programmatic API (`docs/research/typescript-7-api.md`). A Vitest SCRAP that cannot parse TSX is not a port.

## Stale `scrap.md` (do not port)

- `SCRAP = complexity^2 + smell_penalties` vs saturating curve in `example_metrics.clj`
- Extra smells not in `example_smells.clj`
- `tools/scrap` vs `clj -M:scrap` in README and `cli.clj`
