/**
 * PROTOTYPE — throwaway.
 * Internal module. "This callback costs this much."
 * analyzeBody's nested walkNodes callback is today's CC 66. After extract,
 * analyzeBody orchestrates; visitBodyNode / visitCall / visitBranch are
 * sibling scoring units. Helper recursion stays analyzeBody.
 *
 * No detector table. Vitest body metrics are a closed set.
 */

export type BodyMetrics = {
  assertions: number
  branches: number
  tableBranches: number
  // …today's fields, unchanged
}

export function analyzeBody(
  _callback: object | undefined,
  _sourceText: string,
  _subjects: Set<string>,
  _helpers: Map<string, object>,
  _helperStack: Set<string>,
): BodyMetrics {
  // if !callback → empty
  // bodyStatements, countAssertPhases, collectStatementShapes
  // walkExampleBody → walkNodes(callback, bind visitBodyNode)
  throw new Error("prototype stub")
}

export function visitBodyNode(_ctx: unknown, _node: object): void {
  // CC 5 cap: CallExpression / TryStatement / !insideAssertion→visitBranch / visitLiteral / Identifier
}

export function normalize(_node: object): unknown {
  // split today's CC 20: normalizeAtom / normalizeComposite, not a plugin Map
  return "node"
}

export function collectFileFacts(_program: object): {
  subjects: Set<string>
  helpers: Map<string, object>
  extendBindings: Map<string, number>
} {
  // collectImports / collectHelpers / collectExtendBindings as siblings,
  // each with a CC-1 visitor bind so walk callbacks do not fold
  return { subjects: new Set(), helpers: new Map(), extendBindings: new Map() }
}
