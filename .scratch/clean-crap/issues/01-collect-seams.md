Type: prototype
Status: resolved
Blocked by:

## Question

What extract seams make every production scoring unit in `packages/scrap4ts/src/collect.ts` Clean (CC ≤ 5) without changing SCRAP scores?

14 units are above 5. 13 must split (CC ≥ 6). 1 is coverable: `largeCaseTable` (CC 4, 0% cov). Hottest: `analyzeBody` (CC 66), `collectExamples` (CC 26), `normalize` (CC 20).

Constraints from the map: existing scrap4ts tests are the freeze; no shared kernel with crap4ts; splits stay in scrap4ts. Produce a cheap throwaway outline or stub modules to react to. Consult codebase-design for seams. Do not edit production `collect.ts` in this ticket.

## Answer

Keep `collectExamples(filename, sourceText) → CollectResult` as the only export. `cli.ts` and `collect.test.ts` stay the only callers. Do not export `analyzeBody`, `CollectCtx`, or a `collectWith` / detector registry. Cover `largeCaseTable` (CC 4, unsplit) later at that seam.

Nested arrows are not scoring units — their CC folds into the parent. That is why `collectExamples` is 26 and `analyzeBody` is 66. The extract hoists those callbacks to **non-nested** module-level functions. oxc `Visitor` object-literal methods must not remain inside `collectExamples`.

Four files, functions plus a mutable `CollectCtx`, not two public classes, not twelve shallow files:

| File | Holds |
|---|---|
| `packages/scrap4ts/src/collect.ts` | Facade: parse, fatal path, `new Visitor(oxcHandlers(ctx)).visit`, result. Target CC 2. |
| `packages/scrap4ts/src/collect/ast.ts` | Duck peel, `walkNodes`, `calleeChain`, `stringValue`. Real internal seam: visit and body both peel. Not a parser adapter, not shared with crap4ts. |
| `packages/scrap4ts/src/collect/visit.ts` | `CollectCtx`, `oxcHandlers` (one-line binds, no `if`/`&&`/`||` in the nested functions), `classifyCall`, `onCall` / `onTest` / suite stack. |
| `packages/scrap4ts/src/collect/body.ts` | `analyzeBody` as orchestration, the body walk as sibling functions (`visitBodyNode` and friends), `normalize`, assertions, literals, file facts (`collectImports` / helpers / extend). `largeCaseTable` moves here unsplit. |

`oxcHandlers(ctx)` is a CC-1 bind. Decisions live in `onCallExpression` / `onTest`. Same bind rule for `walkNodes` visitors inside facts and `analyzeBody`.

File length is not the bar. After hoisting, `body.ts` may still be hundreds of lines; split a file later only if a scoring unit still exceeds CC 5. Facts stay in `body.ts` (one caller until they grow a second).

Rejected: `collectWith` and detector tables (Vitest callees are closed; one production adapter is a hypothetical seam); class methods as the public story (this package is functions); a `Map` of normalizers as a plugin (named sibling functions); changing what a scoring unit is so object-literal Visitor methods count.

Prototype (throwaway): [collect-seams](../prototypes/collect-seams/). Run with `node .scratch/clean-crap/prototypes/collect-seams/run.mjs`.
