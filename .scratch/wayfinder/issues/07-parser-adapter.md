Type: prototype
Status: resolved
Blocked by: 01, 03

## Question

What is the parser adapter's type: the smallest interface that yields scoring units from source text, with an oxc-parser implementation now and a hole for a TypeScript 7.1 backend later?

Scoring and CLI must not import oxc types. Produce a cheap stub (types + one oxc `parseSync` walk over a fixture file) to react to. Official oxc API: `parseSync(filename, sourceText)` from `oxc-parser`; prefer `parseSync` over async parse.

Placement constraint from [Do crap4ts and scrap4ts share a kernel package?](06-shared-kernel.md): not a third workspace package. The adapter lives in a consumer.

## Answer

crap4ts owns one function. Scoring and CLI import only this type — never oxc, never a compiler API:

```ts
type ScoringUnit = {
  name: string
  file: string
  startLine: number // 1-based, inclusive, full node span
  endLine: number
  complexity: number
}

type ParserAdapter = {
  scoringUnits(filename: string, sourceText: string): ScoringUnit[]
}
```

CC is counted inside each adapter. No parser-neutral IR. `filename` is the dialect hint and `ScoringUnit.file` as passed in; the adapter does not read the filesystem. Parse failure throws.

v1 wires oxc (`parseSync`). Tests inject a fake that returns canned units. TypeScript 7.1 is a future `ParserAdapter`; do not ship a throwing stub.

scrap4ts does not share this type.

Name grammar (both adapters must match): `foo`; `default`; `Box.m`; `Box.constructor`; `Box.get value` / `Box.set value`; `Box.#secret`; `Box.static empty`; `Box.field`; `api.ping`; `N.f`; `(anonymous)` / `(computed)`. Qualifiers stack as `static` then `get`/`set` then the key.

Rejected: a shared IR, leaking `Program` into scoring, a third package, adapter-owned I/O, a `Result` type, a throwing 7.1 module in v1.

Prototype (throwaway): [parser-adapter](../prototypes/parser-adapter/). Run with `pnpm start`.
