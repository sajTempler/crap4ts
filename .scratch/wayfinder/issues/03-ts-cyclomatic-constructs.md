Type: research
Status: resolved
Blocked by:

## Question

Which TypeScript / TSX constructs increment cyclomatic complexity inside a scoring unit?

Start from the family lists (crap4go AST visitors, crap4java `ComplexityCounter`, crap4clj decision points) and map them onto TypeScript:

- `if`, loops, `switch` / `case`, `catch`, `&&`, `||`
- `??`, optional chaining, nullish assignment
- ternary, nested ternary
- `throw` (usually not CC)
- type predicates, `asserts`, narrowing `if` that is type-only
- `satisfies`, type assertions (should be zero)
- JSX conditional rendering (`&&` in JSX, ternary in JSX)

Primary sources: oxc/TS-ESTree node types, ESLint `complexity` / oxc complexity visitors, family source. Write to `docs/research/ts-cyclomatic-constructs.md` with a countable / not-countable list.

## Answer

CC is 1 plus runtime decision points: `if` / `else if`, loops, every `switch` case including `default`, `catch`, `&&` / `||`, and ternaries (including in JSX). Nested callbacks fold into the parent unit (already decided).

Do not count `??`, `?.`, nullish/logical assignment, default parameters, `throw`, `try`/`finally`, the `switch` node itself, type predicates / `asserts` / `satisfies` / assertions, or type-level `|` `&`. A narrowing `if` is a normal `IfStatement` and counts once.

Detail: [docs/research/ts-cyclomatic-constructs.md](../../../docs/research/ts-cyclomatic-constructs.md)
