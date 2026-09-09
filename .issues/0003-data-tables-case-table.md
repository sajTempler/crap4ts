---
labels: wayfinder:task
blocked-by: [0002-double-charge-chained-helpers]
blocks: [0004-helper-hidden-threshold]
---
## Question

**`it.each` / `test.for` table arg vs callback line count**

Currently, the inline array argument for `.each` is included in `rawLineCount`, causing `large-example` smells for data tables. Also, named const arrays (Identifiers) are treated as branches rather than tables.

Fix direction: Treat a large `it.each`/`test.for` first arg as a case table (giving it case table credit) rather than body bloat. Update the AST parsing logic so that both inline arrays and Identifier references can be properly credited as tables without bloating `rawLineCount`.
