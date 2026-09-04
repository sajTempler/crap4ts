Type: research
Status: resolved
Blocked by:

## Question

Which TypeScript syntactic shapes should receive their own CRAP row (a scoring unit)?

Candidates already on the table:

1. Function declarations, exported `const` arrows, class methods, object-literal methods. Nested functions stay inside the parent's CC. Type-only constructs add no CC.
2. Every arrow and callback as its own row (ESLint-complexity style).
3. Function declarations and class methods only.

Also settle constructors, getters/setters, `let`/`const` function expressions, default-export arrows, static and `#private` methods, and whether Istanbul/V8/LCOV function records align with the chosen shapes.

Primary sources: TypeScript AST (via TS 6 types or oxc TS-ESTree), Vitest/Istanbul/LCOV function records, ESLint/oxc complexity visitors, and the family extractors in crap4clj / crap4go / crap4java.

Write findings to `docs/research/crap-scoring-units.md` and recommend one policy with an inclusion/exclusion list.

## Answer

One CRAP row per body-bearing function-like that is not nested in another function. Nested arrows and callbacks fold into the parent's CC. Include constructors, getters/setters, static and `#private` methods, module-scope `const`/`let` arrows (exported or not), default-export arrows, object-literal methods, and class-field function initializers. Exclude type-only signatures, abstracts, overloads, `declare`, nested callbacks as rows, and class static blocks.

Coverage is statement/line coverage over the unit's span, not Istanbul/V8 function-hit and not name match.

Parse with oxc-parser via the parser adapter (charting), not TypeScript 6 as the research note first suggested.

Detail: [docs/research/crap-scoring-units.md](../../../docs/research/crap-scoring-units.md)
