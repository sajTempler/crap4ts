---
labels: wayfinder:task
status: resolved
assignee: Antigravity
blocked-by: [0002-double-charge-chained-helpers]
blocks: [0004-helper-hidden-threshold]
---
## Question

**`it.each` / `test.for` table arg vs callback line count**

Currently, the inline array argument for `.each` is included in `rawLineCount`, causing `large-example` smells for data tables. Also, named const arrays (Identifiers) are treated as branches rather than tables.

Fix direction: Treat a large `it.each`/`test.for` first arg as a case table (giving it case table credit) rather than body bloat. Update the AST parsing logic so that both inline arrays and Identifier references can be properly credited as tables without bloating `rawLineCount`.

## Answer

Updated `collectTestExample` in `packages/scrap4ts/src/collect/visit.ts` and `calleeChain` in `packages/scrap4ts/src/collect/ast.ts`.
- For table-driven tests (`it.each` / `test.for` where `hasTableMethod(chain)` is true), `rawLineCount` is calculated using the callback (`cb`) line span rather than the entire call spanning the inline table argument.
- Table-driven tests are credited as case tables (`tableBranches = Math.max(1, metrics.tableBranches)`), ensuring both inline arrays and named const array identifier references receive case table credit and do not trigger `large-example` smells.
- Verified with tests in `packages/scrap4ts/src/collect.test.ts` for large inline tables, named const array identifiers with `it.each` and `test.for`, and scoring assertions verifying that large tables do not trigger `large-example` smells.
