Type: task
Status: resolved
Blocked by: 01

## Question

Make `packages/scrap4ts/src/collect.ts` Clean: every production scoring unit CRAP ≤ 5.

Follow the seams from [What extract seams make every production scoring unit in collect.ts Clean?](01-collect-seams.md):

- `collect.ts` — facade only (`collectExamples` remains the sole export).
- `collect/ast.ts` — duck peel, `walkNodes`, `calleeChain`, `stringValue`.
- `collect/visit.ts` — `CollectCtx`, `oxcHandlers` binds, classify, suite stack.
- `collect/body.ts` — `analyzeBody` + walk siblings, `normalize`, assertions, literals, file facts. Move `largeCaseTable` here; do not split it.

Cover `largeCaseTable` with tests at the `collectExamples` seam. Keep existing tests green. Do not start `score.ts`. Do not TDD the extract.

## Answer

Production collect is Clean. `collectExamples` remains the only export. Four files as locked: facade in `packages/scrap4ts/src/collect.ts` (CC 2), duck peel in `collect/ast.ts`, Visitor binds in `collect/visit.ts`, body walk / `largeCaseTable` / facts in `collect/body.ts`. Nested Visitor and `walkNodes` callbacks are CC-1 binds; decisions live in sibling functions. `largeCaseTable` is unsplit (CC 4, 100%). After the hoist, leftover CC ≤ 5 units were covered at the same `collectExamples` seam rather than split. oxc wraps optional calls in `ChainExpression` outside `calleeChain`'s start node, so `unwrapCall` / `unwrapOptional` share `unwrapNested`. Workspace-root crap4ts on `packages/scrap4ts/src/collect`: every in-scope production row CRAP ≤ 5 (worst 5.0). Existing scrap4ts and crap4ts tests green. `score.ts` untouched.
