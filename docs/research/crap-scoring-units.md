# Which syntactic units get a CRAP report row?

Charting overlay (not from the research pass): parse with oxc-parser behind the parser adapter, not the TypeScript 6 compiler API. The include/exclude lists below are AST-shape policy; implement them on oxc TS-ESTree nodes that correspond to these `FunctionLikeDeclaration` kinds.

## Question

For a TypeScript CRAP tool (cyclomatic complexity × coverage, family of crap4clj / crap4go / crap4java), which syntactic units should get their own CRAP report row?

Three candidate policies:

1. Function declarations, exported `const` arrows, class methods, object-literal methods. Nested functions stay inside the parent's CC. Type-only constructs add no CC. Files: `.ts`, `.tsx`, `.mts`, `.cts`. Skip `.js`, `node_modules`, `dist`, coverage dirs.
2. Every arrow and callback as its own row (ESLint `complexity` style).
3. Function declarations and class methods only (closer to Java/Go, misses idiomatic TS).

Also: constructors, getters/setters, function expressions assigned to `let`/`var`, default-export arrows, class static methods, `#private` methods, and whether Istanbul/V8 function-coverage rows align with any of these.

---

## Findings

### TypeScript compiler API: what is a callable

TypeScript 7.0 (Go native) does **not** ship a programmatic API. Tools that walk the AST must use the TypeScript 6 API via `@typescript/typescript6` (re-exported as the `typescript` package through an npm alias). TypeScript 7.1 is expected to ship a different API. Source: [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) (“While TypeScript 7.0 is here, it does not ship with an API. We expect TypeScript 7.1 to ship with a new (and different) API… we’ve published a new compatibility package, `@typescript/typescript6`”).

The 6.x compiler types define a closed union of nodes that “share function-like features such as a signature, a name, and a body”:

```ts
export type FunctionLikeDeclaration =
  | FunctionDeclaration
  | MethodDeclaration
  | GetAccessorDeclaration
  | SetAccessorDeclaration
  | ConstructorDeclaration
  | FunctionExpression
  | ArrowFunction;
```

Source: `microsoft/TypeScript` `src/compiler/types.ts` (`FunctionLikeDeclaration`). Each of these has `body?: Block | Expression`. A missing body is an overload, an ambient/`declare` signature, or an abstract method — not an executable unit.

`MethodDeclaration` is shared by class methods and object-literal methods: “Both the grammars for `ClassDeclaration` and `ObjectLiteralExpression` allow for MethodDeclarations as child elements” (`types.ts` comment on `MethodDeclaration`; `parent: ClassLikeDeclaration | ObjectLiteralExpression`).

`#private` methods are still `MethodDeclaration`. The compiler exposes `PrivateIdentifierMethodDeclaration` as `MethodDeclaration & { name: PrivateIdentifier }` (`types.ts`). Getters/setters with `#` names are the same pattern (`PrivateIdentifierGetAccessorDeclaration` / `PrivateIdentifierSetAccessorDeclaration`).

Type-only call shapes are **not** `FunctionLikeDeclaration`. They are `SignatureDeclaration` members with no body:

- `MethodSignature` (`kind: SyntaxKind.MethodSignature`; parent is `TypeLiteralNode | InterfaceDeclaration`)
- `CallSignatureDeclaration`, `ConstructSignatureDeclaration`, `IndexSignatureDeclaration`
- `FunctionTypeNode`, `ConstructorTypeNode` (`kind: SyntaxKind.FunctionType | SyntaxKind.ConstructorType`)

These must add zero CC and zero rows.

`ClassStaticBlockDeclaration` is a class element with a `body: Block` but is **not** in `FunctionLikeDeclaration`. ESLint and Oxc treat it as an implicit function (below). Istanbul’s instrumenter visitor does not.

File extensions the compiler treats as TypeScript source (not JS, not declarations):

```ts
export const enum Extension {
  Ts = ".ts", Tsx = ".tsx", Dts = ".d.ts",
  Js = ".js", Jsx = ".jsx",
  Mts = ".mts", Dmts = ".d.mts",
  Cts = ".cts", Dcts = ".d.cts",
}
```

Source: `types.ts` `Extension`. `.mts` / `.cts` are first-class TS input extensions ([TypeScript 4.7 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-7), [Modules — Reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html): “`.mts`/`.mjs`/`.d.mts` files are always ES modules. `.cts`/`.cjs`/`.d.cts` files are always CommonJS modules.”). `ScriptKind` is only `JS | JSX | TS | TSX | …` — `.mts`/`.cts` parse as `ScriptKind.TS` with a distinct `Extension`, not a distinct `ScriptKind` (`types.ts` `ScriptKind`).

`.d.ts` / `.d.mts` / `.d.cts` are declaration files. They typically contain signatures without bodies. Skip them.

### Family analogs (workspace source, not READMEs)

**crap4go** — `internal/complexity/complexity.go`:

- Iterates `file.Decls` and keeps only `*ast.FuncDecl` with `fn.Body != nil`. Nested function literals (`*ast.FuncLit`) never appear in `file.Decls`, so they never get a row.
- Methods are named `Receiver.Method` (`functionName`).
- Unexported (lowercase) funcs are included; there is no export filter.
- `CyclomaticComplexity` runs `ast.Inspect(fn.Body, …)`, so decision points **inside nested function literals are folded into the parent**.
- Coverage is **statement coverage over the function’s line range**, not a function-hit bit: `CoverageForRange(profile, file, fn.StartLine, fn.EndLine)` in `internal/coverage/coverage.go`; README: “coverage = fraction of covered Go coverage statements in the function range”; “Coverage is matched to functions by source file and line range.”

**crap4java** — `src/crap4java/JavaMethodParser.java` and `spec.md` §8.1:

- `visitMethod`: skip if `node.getBody() == null || node.getReturnType() == null` (abstracts and constructors). `visitMethod` does not call `super`, so it does not recurse into nested methods.
- `ComplexityCounter.visitClass` returns immediately without scanning, so anonymous-class bodies contribute neither a row nor CC to the enclosing method.
- Spec: “The method parser shall ignore: constructors, abstract methods, anonymous-class methods.”
- Test `ignoresConstructorsAndAbstractMethods`: only `present` is reported. Test `ignoresMethodsDeclaredInsideAnonymousClasses`: `outer` is CC 1 even though the anonymous `run()` contains `if (true)` — nested CC is **dropped**, not folded.

**crap4clj** — `src/crap4clj/complexity.cljc`:

- `defn-pattern` is `#"^\(\s*defn-?\s+…"`. Only **top-level** `defn` / `defn-` forms become rows (`extract-top-level-defn-forms` only records a form when `depth` returns to 0). Private `defn-` is included (`complexity_spec.clj` “handles defn-”).
- CC is computed on the whole form text, so nested `fn` / `letfn` decision points **fold into the parent**.

Family invariant: **one row per independently declared named callable at module/type scope; nested callables do not get rows.** Go and Clojure fold nested CC into the parent. Java drops nested-class CC. Coverage join is by **file + line range** (Go) or JaCoCo method match (Java), not by function-hit name.

### ESLint `complexity` (policy 2)

Rule source: [eslint `lib/rules/complexity.js`](https://raw.githubusercontent.com/eslint/eslint/main/lib/rules/complexity.js). Docs: [eslint.org/docs/latest/rules/complexity](https://eslint.org/docs/latest/rules/complexity).

The rule does not visit a fixed list of declaration kinds. It pushes a counter on every `onCodePathStart` and, on `onCodePathEnd`, reports iff `codePath.origin` is `"function" | "class-field-initializer" | "class-static-block"`. `"program"` is excluded. Comment in source: “Class field initializers and class static blocks are implicit functions. Therefore, they shouldn’t contribute to the enclosing function’s complexity, but their own complexity should be evaluated.” Docs repeat that.

Every nested `FunctionDeclaration`, `FunctionExpression`, and `ArrowFunctionExpression` is its own code path, so every callback is its own complexity unit. That is policy 2.

`ast-utils.getFunctionNameWithKind` ([eslint `lib/rules/utils/ast-utils.js`](https://raw.githubusercontent.com/eslint/eslint/main/lib/rules/utils/ast-utils.js)) names constructors `"constructor"`, accessors `"getter"` / `"setter"`, class/`#private` methods `"method"` / `"private method #foo"`, class-field arrows `"method"`, and free arrows `"arrow function"`. Nested callbacks still get rows.

**Oxc** ([`crates/oxc_linter/src/rules/eslint/complexity.rs`](https://github.com/oxc-project/oxc/blob/main/crates/oxc_linter/src/rules/eslint/complexity.rs)) matches ESLint’s *set of units*: it starts a `ComplexityVisitor` on `AstKind::Function`, `ArrowFunctionExpression`, `StaticBlock`, and `PropertyDefinition`. Nested functions are **not** folded: once `has_entered_complexity_evaluation` is set, `visit_function` / `visit_arrow_function_expression` refuse to walk nested callables (“Do not enter function if we already started evaluating complexity”). Nested arrows therefore add **neither** to the parent **nor** to their own count unless they are visited as a separate rule `run` — and they are, because `run` fires on every `Function` / `ArrowFunctionExpression` node. Same as ESLint: one diagnostic per nested callable.

ESLint/Oxc are linters (cap complexity per closure). CRAP is a coverage-joined risk metric. Their unit set is the wrong grain for a family CRAP report.

### Istanbul / V8 / Vitest / LCOV: how function coverage is recorded

**Istanbul file coverage** (`istanbul-lib-coverage` `FileCoverage`): each file has `fnMap` (metadata) and `f` (hit counts), plus `statementMap`/`s` and `branchMap`/`b`. Source: [`packages/istanbul-lib-coverage/lib/file-coverage.js`](https://raw.githubusercontent.com/istanbuljs/istanbuljs/master/packages/istanbul-lib-coverage/lib/file-coverage.js).

**Instrumenter** (`istanbul-lib-instrument` `src/visitor.js` `codeVisitor`) inserts a function counter for:

- `FunctionDeclaration`
- `FunctionExpression`
- `ArrowFunctionExpression` (after `convertArrowExpression` wraps a concise body in a block)
- `ClassMethod` (constructors, methods, get/set, static — Babel’s `ClassMethod`)
- `ObjectMethod`

There is **no** visitor for `ClassPrivateMethod` as a separate type in the copy of `visitor.js` on istanbuljs `master` (private methods typically come through as `ClassMethod` with a private key, depending on parser). There is **no** visitor for class static blocks.

`SourceCoverage.newFunction(name, decl, loc)` ([`source-coverage.js`](https://raw.githubusercontent.com/istanbuljs/istanbuljs/master/packages/istanbul-lib-instrument/src/source-coverage.js)):

```js
name = name || '(anonymous_' + f + ')';
this.data.fnMap[f] = { name, decl: cloneLocation(decl), loc: cloneLocation(loc), line: loc && loc.start.line };
```

`decl` is the name identifier’s loc when present; otherwise a 1-column span at `n.loc.start`. `loc` is `path.node.body.loc` (the body, not the header). Unnamed arrows historically become `(anonymous_N)`. Class/object method names were also `(anonymous_N)` until [istanbuljs#843 / commit 54ab1aa](https://github.com/istanbuljs/istanbuljs/commit/54ab1aa1fd4b082f3fc28b805e9ea4aa765d6c34) (2026-04-20), which infers `node.key` / assignment targets. **Do not join CRAP rows to coverage by function name.**

**LCOV** (istanbul `lcovonly` reporter [`packages/istanbul-reports/lib/lcovonly/index.js`](https://raw.githubusercontent.com/istanbuljs/istanbuljs/master/packages/istanbul-reports/lib/lcovonly/index.js)):

```
FN:<decl.start.line>,<meta.name>
FNDA:<hitCount>,<meta.name>
```

(`decl` falls back to `meta.loc` if missing.) Official geninfo shape is the same: `FN:<line number of function start>,<function name>` and `FNDA:<execution count>,<function name>` (llvm-cov’s `CoverageExporterLcov.cpp` cites [geninfo(1)](https://linux.die.net/man/1/geninfo)). The join key that survives anonymous names is **start line**, not name. Multiple functions on one line collide.

**V8 precise coverage** (Chrome DevTools Protocol [`Profiler.FunctionCoverage`](https://chromedevtools.github.io/devtools-protocol/tot/Profiler/#type-FunctionCoverage)): `{ functionName, ranges: CoverageRange[], isBlockCoverage }`. `CoverageRange` is **byte offsets** (`startOffset` / `endOffset`), not lines. `functionName` is the JS `.name` (empty string for many arrows). Mapping to source lines requires a source map or AST remap.

**Vitest** ([Coverage guide](https://vitest.dev/guide/coverage), [coverage config](https://vitest.dev/config/coverage.html)):

- Providers: `'v8'` (default) or `'istanbul'`.
- Since Vitest v3.2.0, V8 coverage is remapped with AST-based remapping “which produces identical coverage reports to Istanbul.”
- Default `coverage.reportsDirectory` is `'./coverage'`. Default `coverage.reporter` includes `'json'` (istanbul `FileCoverage` objects) and can include `'lcov'`.
- `coverage.exclude` default is `[]`; skipping `node_modules` / `dist` is a tool policy, not a Vitest default.
- Function thresholds (`coverage.thresholds.functions`) count **every** `fnMap` entry, including nested arrows.

Istanbul/V8 function rows therefore align with **policy 2** (every callable), not with policy 1 or 3. A family CRAP tool that uses policy 1 must **not** use function-hit (`f` / `FNDA`) as coverage. It should use **statement/line coverage over the unit’s `[startLine, endLine]`**, which is what crap4go does. Nested callbacks then affect the parent’s coverage when their lines lie in that range, which is the correct CRAP signal.

---

## Comparison of the three policies against coverage-mapping reality

| | Policy 1 (named TS callables; nested fold) | Policy 2 (every arrow/callback) | Policy 3 (function decls + class methods only) |
|---|---|---|---|
| Aligns with Istanbul `fnMap` / V8 `FunctionCoverage` / LCOV `FN` **row count** | No — those emit every nested arrow | Yes | No — and also misses `const f = () => {}` rows that coverage *does* emit |
| Aligns with crap4go coverage **join** (statements in line range) | Yes, if coverage is line/statement over the unit span | Only if each nested `fnMap` entry is joined separately by start line | Yes for the units it emits; idiomatic TS units are invisible |
| Family analog (Go `FuncDecl`, Java concrete methods, Clojure top-level `defn`) | Closest, if “exported const arrows” is widened to all module-scope bindings | ESLint grain, not CRAP family | Closest to Java/Go *syntax*, worst for TS idioms |
| `export const foo = () => {}` (the TS `defn`) | Row (if “exported const” is kept; see recommendation) | Row | **Missed** |
| `items.map(x => x ? 1 : 0)` inside a function | Folded into parent CC + parent line coverage | Own row; own `fnMap` hit | Folded if parent is a decl/method; else lost |
| Constructors / get / set / static / `#private` | Need an explicit include list (Java excludes constructors) | Included (ESLint names them) | Methods yes; constructors/accessors unspecified |
| Type-only (`interface` methods, `type F = () => void`) | No row, no CC | No runtime node | No row |
| Same-line two arrows | One line-range join is ambiguous | Two `fnMap` keys, same `decl.start.line` — LCOV `FN:` collides | N/A if not emitted |

Policy 2 matches coverage **function** tables and fights the family metric: a `.tsx` component with three `onClick` arrows becomes four CRAP rows, and a 1-line `x => x + 1` is a unit. Policy 3 matches Java/Go declarations and systematically misses the dominant TS export style (`export const parse = (s: string) => { … }`). Policy 1 is the right grain **if** the include list is made precise (not only *exported const* arrows) and coverage is line/statement span, not `FNDA`.

---

## Recommendation

**Policy 1, tightened into a hybrid:** one CRAP row per **body-bearing `FunctionLikeDeclaration` that is not nested inside another `FunctionLikeDeclaration`**. Nested callables do not get rows; their decision points **fold into the enclosing unit’s CC** (Go/Clojure, not Java’s drop). Coverage for a row is **statement or line coverage over `[startLine, endLine]`** (crap4go), never function-hit and never name match.

Parse with the TypeScript **6** API (`typescript` aliased to `@typescript/typescript6`). Do not import TypeScript 7 for AST walking.

### Files

**Include:** `.ts`, `.tsx`, `.mts`, `.cts` (`Extension.Ts | Tsx | Mts | Cts`).

**Skip:** `.js`, `.jsx`, `.mjs`, `.cjs`; `.d.ts`, `.d.mts`, `.d.cts`; anything under `node_modules`, `dist`, `build`, `coverage`, and Vitest’s `coverage.reportsDirectory` (default `./coverage`).

### Include (own row) — AST shapes

A node is a row iff `ts.isFunctionLikeDeclaration(node) && node.body` **and** the nearest enclosing `FunctionLikeDeclaration` ancestor is absent.

Concrete shapes that pass that test:

| Shape | `SyntaxKind` | Notes |
|---|---|---|
| `function foo() { … }` / `async function` / `function*` | `FunctionDeclaration` | Include unexported. Overload signatures have no `body` — skip those; keep the implementation. |
| `export default function () { … }` / `export default function named()` | `FunctionDeclaration` | `name` is optional. |
| `export default () => { … }` | `ArrowFunction` | Default-export arrow. |
| `const/let/var foo = () => { … }` and `= function () { … }` at module/namespace/`ModuleBlock` scope, exported or not | `ArrowFunction` / `FunctionExpression` | Widens policy 1’s “exported const arrows”. Matches crap4go (unexported funcs) and crap4clj (`defn-`). |
| `export const foo = () => { … }` | same | Subset of the previous row. |
| Class instance methods, including computed names | `MethodDeclaration` | `parent` is `ClassLikeDeclaration`. |
| Class `static` methods | `MethodDeclaration` + `StaticKeyword` | Same kind; static is a modifier. |
| Class `#private` methods | `MethodDeclaration` with `PrivateIdentifier` name | Still `MethodDeclaration`. |
| Constructors with a body | `ConstructorDeclaration` | **Include.** They are `FunctionLikeDeclaration`, Istanbul `ClassMethod`, and ESLint `"constructor"`. crap4java excludes them by spec; TS constructors are ordinary runtime functions with coverage. Skip `constructor()` with no body (abstract class). |
| `get` / `set` accessors with a body, including static and `#private` | `GetAccessorDeclaration` / `SetAccessorDeclaration` | Same union; Istanbul instruments them as `ClassMethod`. |
| Object-literal methods / accessors at reportable scope (`const api = { foo() {}, get bar() {} }`) | `MethodDeclaration` / accessors, `parent` is `ObjectLiteralExpression` | Policy 1 already listed these. |
| Class field / object property whose initializer **is** a function (`foo = () => { … }`, `foo = function () { … }`) at reportable scope | `ArrowFunction` / `FunctionExpression` as `PropertyDeclaration.initializer` | ESLint treats the field initializer as its own code path; Istanbul still emits an `fnMap` row for the arrow. These are idiomatic TS/`this`-binding methods. The **arrow** is the row (it is not nested in a function). |

### Exclude (no row)

| Shape | Why |
|---|---|
| Any `FunctionLikeDeclaration` nested inside another function body (callbacks, `map` arrows, nested `function`, IIFE, JSX `onClick={() => …}`, local classes’ methods) | Family analog; fold CC into parent. |
| `MethodSignature`, `CallSignatureDeclaration`, `ConstructSignatureDeclaration`, `IndexSignatureDeclaration`, `FunctionTypeNode`, `ConstructorTypeNode` | Type-only; no `body`. |
| `interface` / `type` / `enum` / `namespace` aliases with no runtime function | No `FunctionLikeDeclaration` body. |
| `declare function foo(): void` and other ambient signatures | `body` undefined. |
| Abstract methods (`abstract foo(): void`) | `body` undefined (same as crap4java). |
| Overload stubs (`function foo(x: string): void;` without a body) | `body` undefined. |
| Class static blocks (`static { … }`) | Not `FunctionLikeDeclaration`. Istanbul does not emit `fnMap` rows. Do not invent a unit. If a static block is complex, it will not appear — open risk. |
| Non-function class field initializers (`x = a \|\| b`) | ESLint/Oxc score these as implicit functions; they are not CRAP callables. Skip. |
| Parameter defaults and destructuring defaults | ESLint `AssignmentPattern` adds CC *inside* a function; they are not units. |

### CC of a row

Start at 1. Walk the unit’s `body` (and, for arrows, a concise expression body). Count decision points in nested `FunctionLikeDeclaration`s (fold-in). Do **not** count type-only nodes. Do **not** count nested units’ CC a second time as their own row.

### Coverage join

1. Prefer Istanbul JSON (`coverage-final.json` / Vitest json reporter): for each CRAP row, take `statementMap`/`s` entries whose `start.line` falls in `[row.startLine, row.endLine]`. Covered iff hit count > 0. This is crap4go’s `CoverageForRange`.
2. LCOV fallback: use `DA:` lines in the same range. Ignore `FN:`/`FNDA:` for the score (names are `(anonymous_N)`; lines collide).
3. Do not use `f[k]` / `FNDA` as the CRAP coverage fraction. Function-hit of the parent is 100% even when nested folded lines are cold; statement coverage of the span is not.

---

## Open risks (coverage name/line mismatch)

1. **`fnMap.name` is not a join key.** Unnamed arrows are `(anonymous_N)`. Class/object methods were anonymous in istanbul-lib-instrument until 54ab1aa (2026-04-20); older Vitest/Istanbul stacks still emit that. V8 `functionName` is often `""` for arrows.

2. **`decl.start.line` ≠ body start ≠ `function` keyword line.** Istanbul stores `decl` on the name identifier (or a 1-column stub at the node start) and `loc` on the **body**. LCOV `FN:` uses `decl`. A CRAP parser that takes `node.getStart()` (including modifiers/`async`/`export`) can sit on a different line than `fnMap.decl` or `fnMap.loc`. Prefer joining coverage by **overlapping line range**, not exact start-line equality.

3. **Multiple callables on one line.** `export const a = () => 1, b = (x: boolean) => x ? 1 : 0` — two rows, one LCOV `FN:` line, overlapping statement maps. Disambiguate with column (`decl.start.column`) when using JSON; LCOV cannot.

4. **Source-map / transpile skew.** Vitest v8 remaps through AST as of v3.2.0, claiming Istanbul-identical reports. Pre-3.2.0 v8, ts-jest, and `tsc` emit + nyc can shift function start lines (decorators, `experimentalDecorators`, `emitDecoratorMetadata`, downlevel `async`, class field `useDefineForClassFields`). Always consume coverage already remapped to **original TS**, not to emit JS.

5. **Folded nested functions vs function-coverage tables.** Istanbul/V8/LCOV will still list nested arrows as uncovered functions. A CRAP report under policy 1 will not. That is intentional, but `coverage.thresholds.functions` will not match CRAP row counts. Document it.

6. **Constructors vs crap4java.** Including TS constructors diverges from crap4java’s spec. Excluding them would drop real `new`-invoked logic that Istanbul *does* instrument. Keep them; note the Java difference.

7. **Class static blocks and non-function field initializers.** ESLint scores them; Istanbul `fnMap` and this recommendation do not. Complex `static { }` logic is invisible to CRAP.

8. **`.tsx` JSX handlers.** Under this policy, `onClick={() => { if (!ok) throw … }}` folds into the component function. That is correct for span coverage (cold handler lines lower the component’s cov%). It looks “wrong” if someone compares to Istanbul’s function table.

9. **Namespaces and `export =`.** Functions inside `namespace N { function f() {} }` are not nested in a `FunctionLikeDeclaration`, so they get rows. That matches Go package-level funcs. Confirm product intent if the tool wants file-top-level only.

10. **Decorators and parameter properties.** `constructor(private x: T) {}` and `@Dec method() {}` change start positions. Use the function body’s start/end for CC walking; use the full node span (or body span — pick one and stick to it) for coverage range. Body span matches Istanbul `fnMap.loc`; full node span matches crap4go’s `fn.Pos()`/`fn.End()`. Prefer **full node span** for family consistency; expect occasional mismatch with `FN:` lines.
