---
labels: wayfinder:task
status: resolved
assignee: Antigravity
blocked-by: []
blocks: [0003-data-tables-case-table]
---
## Question

**Fix double-charging of helpers on `helper().method()`**

Currently, `chargeHelper` uses `chain[0]`. For `createQueryClient().fetchQuery(...)`, `absorbHelper` runs twice, drastically inflating `helperCalls` and `helperHiddenLines`.

Fix direction: Charge a helper once per example (or per syntactic helper expression), not once per CallExpression whose receiver chain starts with that helper.
Add a collect test next to `same-file helpers charge helper-hidden lines` in `src/collect.test.ts`.

## Answer

Updated `chargeHelper` in `packages/scrap4ts/src/collect/body.ts` to check `if (chain.length !== 1) return`.
- Direct calls to top-level helper functions (e.g. `createQueryClient()`) evaluate to a single-element callee chain `["createQueryClient"]` (length 1) and are charged normally.
- Chained calls on receiver methods (e.g. `createQueryClient().fetchQuery(...)`) evaluate to multi-element chains `["createQueryClient", "fetchQuery"]` (length > 1) and are skipped so the helper is not double-charged.
- Verified with new test `same-file helpers with chained method calls charge helper only once` in `packages/scrap4ts/src/collect.test.ts`.

