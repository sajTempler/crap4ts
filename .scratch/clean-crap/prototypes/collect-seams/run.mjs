/**
 * PROTOTYPE — throwaway. Do not import from packages/scrap4ts.
 *
 * Question: what extract seams make every production scoring unit in
 * collect.ts Clean (CC ≤ 5) without changing SCRAP scores?
 *
 * Nested arrows are not scoring units — their CC folds into the parent.
 * That is why collectExamples is 26 and analyzeBody is 66: oxc Visitor
 * methods and the walkNodes callback live inside those functions.
 *
 * Run: node .scratch/clean-crap/prototypes/collect-seams/run.mjs
 */

const recommended = [
  {
    file: "packages/scrap4ts/src/collect.ts",
    exports: "collectExamples, CollectResult",
    hides: "parseSync, FileWalk-shaped CollectCtx, oxc Visitor wiring",
    takes: ["collectExamples 26 → facade CC 2"],
  },
  {
    file: "packages/scrap4ts/src/collect/ast.ts",
    exports: "(internal) walkNodes, calleeChain, stringValue, duck peel",
    hides: "object-field poking, oxc node shapes",
    takes: ["calleeChain 12", "stringValue 8", "walkNodes 8"],
  },
  {
    file: "packages/scrap4ts/src/collect/visit.ts",
    exports: "(internal) oxcHandlers(ctx), classifyCall",
    hides: "suite stack, inTest, structure errors, example assemble",
    takes: ["classifyCall 10", "Visitor callbacks that today fold into collectExamples"],
  },
  {
    file: "packages/scrap4ts/src/collect/body.ts",
    exports: "(internal) analyzeBody, file facts",
    hides: "BodyMetrics, helper fold, phase/shape/walk",
    takes: [
      "analyzeBody 66",
      "normalize 20",
      "isPrimaryAssertion 13",
      "collectExtendBindings 10",
      "collectImports 9",
      "collectHelpers 8",
      "isAssertionRelated 7",
      "largeLiteral 7",
      "largeCaseTable 4 — move, do not split",
    ],
  },
]

console.log("collect.ts extract-seams prototype")
console.log("Public seam stays collectExamples(filename, sourceText) → CollectResult")
console.log("Internals are not the test surface. Cover largeCaseTable through that seam.")
console.log("")
console.log("Recommended: four files, functions + CollectCtx, no plugin table, no collectWith.")
console.log("")
for (const row of recommended) {
  console.log(row.file)
  console.log("  exports:", row.exports)
  console.log("  hides:  ", row.hides)
  for (const unit of row.takes) console.log("  takes:  ", unit)
  console.log("")
}
console.log("Rejected in this stub:")
console.log("  - collectWith / detector registry (Vitest callees are closed; one production adapter)")
console.log("  - two exported classes as the public seam (callers already have the right function)")
console.log("  - 12 shallow files (classify.ts of five CC-3 functions fails the deletion test)")
