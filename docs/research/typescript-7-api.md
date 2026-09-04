# TypeScript 7 and the compiler API

Question: can crap4ts parse TypeScript with the TypeScript 7 package the way crap4go uses `go/parser` and crap4java uses javac?

## Findings

TypeScript 7.0 is a native Go port of the compiler. It is installed as the `typescript` npm package and provides a `tsc` executable. Microsoft’s announcement: [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).

TypeScript 7.0 does not ship a programmatic API. The same announcement says TypeScript 7.1 is expected to ship a new (and different) API. Until then, tools that import the compiler (the announcement names typescript-eslint) should run TypeScript 6.0 side-by-side.

Microsoft’s compatibility package is `@typescript/typescript6`. It provides `tsc6` and re-exports the TypeScript 6.0 API. Recommended layout from that post:

```json
{
  "devDependencies": {
    "@typescript/native": "npm:typescript@^7.0.2",
    "typescript": "npm:@typescript/typescript6@^6.0.2"
  }
}
```

The TypeScript 7.1 iteration plan ([microsoft/TypeScript#63703](https://github.com/microsoft/TypeScript/issues/63703), opened 2026-07-31) lists “Stabilize API” (Content Mapper, Emit, Language Service) and a stable target of 2026-11-10. That API is not available today (2026-08-28).

## Implication for crap4ts

`tsc` for typechecking this repo can be TypeScript 7. Parsing target projects for cyclomatic complexity cannot use `import ts from "typescript"` if `typescript` is 7.0.

Options that exist today:

1. Parse with the TypeScript 6 API via `@typescript/typescript6` (Microsoft’s stated path for tools).
2. Parse with a third-party TS parser that is not the compiler API (for example `oxc-parser`).
3. Wait for TypeScript 7.1. That delays a working CLI until mid-November 2026 at the earliest.
