# Parser adapter (oxc now, TypeScript 7.1 later)

Decision from charting: parse target source with [oxc-parser](https://www.npmjs.com/package/oxc-parser) behind a parser adapter, so a TypeScript 7.1 compiler-API implementation can be swapped in without rewriting CRAP or SCRAP scoring.

TypeScript 7.0 has no programmatic API. See [typescript-7-api.md](./typescript-7-api.md).

oxc-parser Node API (from [oxc parser usage](https://oxc.rs/docs/guide/usage/parser) and the [oxc-parser package](https://www.npmjs.com/package/oxc-parser)):

```ts
parseSync(filename: string, sourceText: string, options?: ParserOptions): ParseResult
```

File extension selects dialect (`.ts` / `.tsx` / `.mts` / `.cts`). Official docs recommend `parseSync` over async `parse` because AST deserialization is on the main thread; parallelize with worker threads plus `parseSync` if needed.

The adapter's job is not to leak oxc node types into scoring. Scoring should see parser-neutral scoring units (name, span, source range) once What TypeScript shapes get a CRAP row? is answered.
