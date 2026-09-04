# TypeScript cyclomatic constructs

## Question

Which TypeScript / TSX constructs increment cyclomatic complexity inside a scoring unit?

Start from the family lists (crap4go AST visitors, crap4java `ComplexityCounter`, crap4clj decision points) and map them onto TypeScript. ESLint `complexity` and oxc’s ESLint-compatible visitor are contrast, not the target, except where they coincide with the family.

## Findings

Family tools count **runtime decision points + 1**. They do not try to be McCabe-maximal, and they do not count every short-circuit or every exception edge. TypeScript scoring should copy that posture: same shape of decisions, TS-specific syntax only when it is the same kind of construct.

### Family lists (source of truth)

**crap4go** (`internal/complexity/complexity.go`, `CyclomaticComplexity`): start at 1, walk the function body, increment on:

- `*ast.IfStmt`
- `*ast.ForStmt`, `*ast.RangeStmt`
- `*ast.CaseClause` (every `switch` / type-switch case, including `default`)
- `*ast.CommClause` (`select` cases)
- `*ast.BinaryExpr` when `Op` is `token.LAND` or `token.LOR` (`&&`, `||`)

`ThrowStmt` is not in that switch. Neither is type assertion. The README restates the same list: `if`, `for`, `range`, switch/type-switch case clauses, select clauses, `&&`, `||`.

The unit test `TestCyclomaticComplexityCountsGoDecisionPoints` encodes the case-vs-default rule: `if x > 0 && x < 10` plus `switch` with `case 1, 2` and `default` is **5** (base 1 + `if` + `&&` + one `case` + `default`). Go `case 1, 2:` is a single `CaseClause`.

**crap4java** (`JavaMethodParser.ComplexityCounter`): start at 1, scan the method body, increment on:

- `visitIf` (`IfTree`; `else if` is a nested `IfTree`)
- `visitForLoop`, `visitEnhancedForLoop`, `visitWhileLoop`, `visitDoWhileLoop`
- `visitCatch`
- `visitConditionalExpression` (ternary)
- `visitCase` (`CaseTree`, including `default`)
- `visitBinary` only for `Tree.Kind.CONDITIONAL_AND` and `CONDITIONAL_OR`

`visitClass` returns without descending, so nested classes are not attributed to the enclosing method. There is no `visitThrow`. `spec.md` §8.2 says complexity comes from Java syntax structure, `CC >= 1`.

**crap4clj** (`src/crap4clj/complexity.cljc`): start at 1, then:

- one increment per `if` / `if-not` / `if-let` / `if-some` / `when*` / `and` / `or` / `loop` / `catch`
- per-clause counts for `cond`, `condp`, `case`, `cond->`, `cond->>`
- per-step counts for `some->`, `some->>`

README “What It Counts” matches that list. There is no `throw` form in the decision-point pattern.

Family consensus that TypeScript can inherit:

| Decision | Go | Java | Clojure | TS analog |
| --- | --- | --- | --- | --- |
| `if` | yes | yes | yes (`if`/`when` family) | `IfStatement` |
| loops | `for`/`range` | `for`/`foreach`/`while`/`do` | `loop` | `ForStatement`, `ForInStatement`, `ForOfStatement`, `WhileStatement`, `DoWhileStatement` |
| `switch` cases including `default` | `CaseClause` | `CaseTree` | `case`/`cond` clauses | every `SwitchCase` (see below) |
| `catch` | n/a | yes | yes | `CatchClause` |
| short-circuit and/or | `&&` / `\|\|` only | `&&` / `\|\|` only | `and` `or` | `LogicalExpression` with `&&` / `\|\|` only |
| ternary | n/a | `ConditionalExpressionTree` | n/a | `ConditionalExpression` (Java analog) |
| `throw` | no | no | no | do not count `ThrowStatement` |

Family divergences that TypeScript must pick a side for: Go has no ternary and no `catch`; Java/Clojure do. TypeScript has both, so count them (Java/Clojure). Go `select` has no TS analog; do not invent one.

### ESLint / oxc (contrast, not target)

ESLint `lib/rules/complexity.js` starts each code path at 1 and increments on:

- `CatchClause`, `ConditionalExpression`, `LogicalExpression` (all of `&&`, `||`, `??`)
- `ForStatement`, `ForInStatement`, `ForOfStatement`, `IfStatement`, `WhileStatement`, `DoWhileStatement`
- `AssignmentPattern` (default values)
- `SwitchCase[test]` in classic variant (skips `default`); `SwitchStatement` once in modified variant
- `AssignmentExpression` when the operator is a logical assignment (`&&=`, `||=`, `??=`)
- `MemberExpression` / `CallExpression` when `optional === true`

`ThrowStatement` is not a listener. Nested functions, class field initializers, and static blocks are separate code paths (`onCodePathStart` / `onCodePathEnd`).

oxc `crates/oxc_linter/src/rules/eslint/complexity.rs` implements the same set (`VisitJs`: `visit_logical_expression` increments for every logical operator including `??`; `visit_assignment_pattern`; `visit_formal_parameter` when `initializer.is_some()`; optional member/call; logical assignment). Tests in that file treat `x ?? 4`, `x ??= 4`, `b?.c`, and `function a(b = '') {}` as extra complexity.

Official ESLint docs (https://eslint.org/docs/latest/rules/complexity) document those extras: default parameters, destructuring defaults, optional chaining, logical assignment, and modified-switch.

Those extras **do not coincide** with the family lists. crap4ts should not take them unless a family language has the same construct.

### TypeScript / TS-ESTree / oxc node types

oxc-parser’s published ESTree types (`npm/oxc-types/types.d.ts`) and typescript-eslint `ast-spec` are the node vocabulary.

Runtime control flow (count these nodes, not their TypeScript overlays):

- `IfStatement`
- `ForStatement`, `ForInStatement`, `ForOfStatement`, `WhileStatement`, `DoWhileStatement`
- `SwitchStatement` with `cases: SwitchCase[]`; `SwitchCase.test` is `Expression | null` (`null` is `default`)
- `TryStatement` (`block`, `handler: CatchClause | null`, `finalizer`); increment `CatchClause`, not `try` / `finally`
- `LogicalExpression` with `operator: LogicalOperator` where `LogicalOperator = "||" | "&&" | "??"`
- `ConditionalExpression` (`test` / `consequent` / `alternate`); nesting is extra nodes, not a special case
- `AssignmentExpression.operator` includes `"||=" | "&&=" | "??="` (logical assignment)
- `MemberExpression.optional: boolean`, `CallExpression.optional: boolean`, plus wrapping `ChainExpression`
- `ThrowStatement`
- `JSXExpressionContainer.expression` is `JSXExpression = JSXEmptyExpression | Expression` — JSX does not invent new branch nodes; `{cond && <X />}` and `{cond ? <A /> : <B />}` are ordinary `LogicalExpression` / `ConditionalExpression` inside the container

Type-only / erased (do not count the type node itself):

- `TSAsExpression` (`expression` + `typeAnnotation`) — typescript-eslint `packages/ast-spec/src/expression/TSAsExpression/spec.ts`
- `TSSatisfiesExpression` (same shape) — `packages/ast-spec/src/expression/TSSatisfiesExpression/spec.ts`
- `TSTypeAssertion` (`<T>expr`), `TSNonNullExpression` (`expr!`) — in oxc `Expression` union
- `TSTypePredicate` `{ asserts: boolean; parameterName; typeAnnotation }` — `packages/ast-spec/src/type/TSTypePredicate/spec.ts` (`x is T` and `asserts x is T` / `asserts x`)
- Type-level `|` / `&` are `TSUnionType` / `TSIntersectionType`, not `LogicalExpression`

### TypeScript semantics that decide whether this is a branch

**Narrowing `if` is still a runtime `if`.** The narrowing handbook (https://www.typescriptlang.org/docs/handbook/2/narrowing.html) says TypeScript overlays type analysis on JavaScript runtime constructs (`if/else`, ternaries, loops, truthiness). `typeof padding === "number"` is a type guard because it is a JavaScript `typeof` check. There is no TypeScript-only `if` in the AST: a narrowing `if` is an `IfStatement`. Count it.

**Type predicates and `asserts` are return-type syntax.** Same handbook: a user-defined type guard is a function whose return type is a type predicate (`parameterName is Type`). typescript-eslint models that as `TSTypePredicate`, including `asserts: boolean`. The annotation does not add a path. If the function body uses `if` or `throw`, those statements are counted or not by the statement rules, not by the predicate.

**`satisfies` is compile-time.** TypeScript 4.9 handbook (https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html): `satisfies` “lets us validate that the type of an expression matches some type, without changing the resulting type of that expression.” It is `TSSatisfiesExpression`. Zero CC.

**Type assertions are compile-time.** `as T`, `<T>expr`, and `expr!` are `TSAsExpression` / `TSTypeAssertion` / `TSNonNullExpression`. They wrap an expression; they do not branch. Walk into `expression`, do not increment for the wrapper.

**`??` is a third logical operator, not family `||`.** oxc `LogicalOperator = "||" | "&&" | "??"`. ESLint/oxc increment every `LogicalExpression`. Family visitors increment only conditional and / or. `??` has no Go/Java/Clojure counterpart in those visitors. Family-faithful: do not count `??`.

**Optional chaining is a short-circuit member/call, not family `if`.** oxc: `MemberExpression.optional`, `CallExpression.optional`, `ChainExpression`. ESLint #18152 and the complexity docs treat each `?.` as a branch. Family languages have no `?.`. Family-faithful: do not count `optional === true` by itself. An `if (x?.y)` still counts the `IfStatement`.

**Logical / nullish assignment.** oxc `AssignmentOperator` includes `||=`, `&&=`, `??=`. ESLint increments all three. Family visitors never inspect assignments (Go `BinaryExpr` LAND/LOR; Java `BinaryTree` CONDITIONAL_AND/OR). Family-faithful: do not count `&&=`, `||=`, `??=`. Writing `x && (x = y)` would count the `&&`; the compound assignment is a different node.

**Default parameters / destructuring defaults.** ESLint `AssignmentPattern` and oxc `visit_formal_parameter` when `initializer.is_some()`. Family does not count parameter defaults. Skip.

**`throw`.** Present as `ThrowStatement` in oxc-types. Absent from family visitors and from ESLint `complexity.js`. Usually not CC. Do not count. A `catch` of that throw, if present in the same unit, is already a `CatchClause`.

**JSX conditional rendering.** `JSXExpressionContainer` holds a normal `Expression`. Counting `LogicalExpression` (`&&` / `||` only) and `ConditionalExpression` already covers `{flag && <Foo />}` and `{flag ? <A /> : <B />}`. Do not add a JSX-specific increment. Do not skip them because they sit under JSX.

**Switch `default`.** Family counts it (Go `CaseClause` with nil list; Java every `CaseTree`). ESLint classic skips `SwitchCase` with no `test`. Family-faithful: increment every `SwitchCase`, including `test === null`. Do not use ESLint “modified” (one increment per `SwitchStatement`).

**`else`.** Not a node of its own. `else if` is another `IfStatement`. Same as Java `visitIf` and ESLint `IfStatement`.

**Nested functions.** Scoring-unit ownership is issue 01, not this list. Note only: crap4go `ast.Inspect` walks nested `FuncLit` bodies into the outer count; Java skips nested classes; ESLint/oxc start a new complexity visitor and do not enter nested functions. Whatever unit crap4ts chooses, apply this construct list inside that unit only.

## Countable list

Increment once per matching AST node inside the scoring unit (`CC = 1 + decisions`). Nested instances each add 1 (nested ternary, `else if`, `a && b && c`).

| Construct | TS / TSX syntax | AST to match | Family analog |
| --- | --- | --- | --- |
| `if` / `else if` | `if (c) …` / `else if` | `IfStatement` | Go `IfStmt`, Java `IfTree`, Clojure `if`/`when*` |
| `for` | `for (;;)` | `ForStatement` | Go `ForStmt`, Java `ForLoopTree` |
| `for … in` | `for (k in o)` | `ForInStatement` | Java enhanced-for / Go `RangeStmt` (same role) |
| `for … of` | `for (x of xs)` | `ForOfStatement` | same |
| `while` | `while (c)` | `WhileStatement` | Java `WhileLoopTree` |
| `do … while` | `do … while (c)` | `DoWhileStatement` | Java `DoWhileLoopTree` |
| `switch` case | `case e:` | `SwitchCase` with `test != null` | Go `CaseClause`, Java `CaseTree` |
| `switch` default | `default:` | `SwitchCase` with `test == null` | Go/Java count default; ESLint classic does not |
| `catch` | `catch (e) { … }` / `catch { … }` | `CatchClause` | Java `CatchTree`, Clojure `catch` |
| `&&` | `a && b` (including in JSX) | `LogicalExpression` where `operator === "&&"` | Go `LAND`, Java `CONDITIONAL_AND`, Clojure `and` |
| `\|\|` | `a \|\| b` (including in JSX) | `LogicalExpression` where `operator === "\|\|"` | Go `LOR`, Java `CONDITIONAL_OR`, Clojure `or` |
| ternary | `c ? a : b` (including nested and JSX) | `ConditionalExpression` | Java `ConditionalExpressionTree` |

JSX: no extra row. The `&&` / ternary rows already apply when those nodes appear under `JSXExpressionContainer`.

## Not-countable list

Do not increment for these. Walk through wrappers so inner countable nodes still score.

| Construct | Why zero | Who does count it (do not follow) |
| --- | --- | --- |
| `??` | Third logical operator; family only counts and/or | ESLint/oxc every `LogicalExpression` |
| `?.` optional chaining | No family analog; not an `IfStatement` | ESLint/oxc `optional === true` on member/call |
| `??=` | Nullish assignment; family does not inspect assignments | ESLint/oxc logical assignment |
| `&&=` `\|\|=` | Same: assignment node, not `LogicalExpression` | ESLint/oxc |
| Default parameter / destructuring default | `AssignmentPattern` / param initializer; family ignores | ESLint/oxc |
| `throw` | Family and ESLint complexity omit `ThrowStatement` | — |
| `try` / `finally` | Only `CatchClause` is the decision | — |
| `switch` itself (the `SwitchStatement` node) | Family counts cases, not the switch | ESLint modified variant |
| Type predicate `x is T` | `TSTypePredicate` on the signature | — |
| `asserts x` / `asserts x is T` | `TSTypePredicate.asserts === true`; annotation only | — |
| Narrowing `if` as a special case | It is a normal `IfStatement` (already counted once) | — |
| `satisfies` | `TSSatisfiesExpression`; compile-time | — |
| `as T`, `<T>expr`, `expr!` | `TSAsExpression` / `TSTypeAssertion` / `TSNonNullExpression` | — |
| Type-level `A \| B`, `A & B` | `TSUnionType` / `TSIntersectionType` | — |
| `else` (not `else if`) | Not a separate statement node | — |
| `break` / `continue` / labels | Not family decision points | — |
| JSX element / fragment / attribute structure | Not branches; only embedded expressions | — |
| Nested function / class field / static block as extra CC on the parent | Unit boundary (issue 01), not a construct increment | ESLint isolates them; crap4go currently folds nested `FuncLit` into the parent |

## Recommendation for crap4ts

Implement a **family-faithful** visitor, not an ESLint-maximal one.

1. `CC = 1 +` countable nodes in the table above, inside one scoring unit.
2. Match on statement/expression kinds (`IfStatement`, `CatchClause`, …). For `LogicalExpression`, branch on `operator === "&&" || operator === "||"` only — do not treat the oxc `LogicalExpression` type as always +1.
3. Count every `SwitchCase`, including default. Do not implement ESLint `variant: "modified"`.
4. Count `ConditionalExpression` once per node (nested ternary = N nodes). Count those nodes under JSX the same way.
5. Do not increment for `??`, `?.`, logical/nullish assignment, defaults, `throw`, or any `TS*` type wrapper / predicate / `satisfies` / assertion. Recurse into their `expression` (or function body) so real branches inside still count.
6. Do not special-case “type-only narrowing”: if the parser emitted `IfStatement`, it counts. If it emitted only `TSTypePredicate` on a signature, it does not.
7. Keep ESLint/oxc complexity as a test oracle for the overlapping subset (`if`, loops, `&&`/`||`, ternary, `catch`, non-default `case`), and as a documented non-oracle for `??`, `?.`, `??=`, defaults, and `default:` clauses.

That is the Java/Go/Clojure decision-point list mapped onto TS-ESTree, not a port of `eslint/complexity`.
