/**
 * PROTOTYPE — throwaway.
 * Internal module. The oxc Visitor lives here so its methods are scoring
 * units of *this* file's functions, not of collectExamples.
 *
 * Pattern: oxcHandlers(ctx) returns one-line forwards. Nested bind
 * callbacks contain no if/&&/|| — those decisions are in onCall / onTest.
 */

export type CollectCtx = {
  sourceText: string
  subjects: Set<string>
  helpers: Map<string, object>
  extendBindings: Map<string, number>
  examples: unknown[]
  structureErrors: string[]
  moduleMocks: number
  suites: { title: string; setupDepth: number; tableDriven: boolean }[]
  describeCallbacks: Set<object>
  testCallbacks: Set<object>
  inTest: number
}

export function oxcHandlers(_ctx: CollectCtx): object {
  // CallExpression: (node) => onCallExpression(ctx, ast(node))  — CC 1 bind
  // Arrow/Function enter/exit → enterFunction / exitFunction
  return {}
}

export function classifyCall(
  _chain: string[],
  _extendBindings: Map<string, number>,
): "describe" | "test" | "hook" | "ok-hook" | "file-mock" | "other" {
  // split today's CC 10: isFileMock, classifyHook, classifySuiteOrTest
  return "other"
}

export function onCallExpression(_ctx: CollectCtx, _n: object): void {
  // CC ≤ 5: kind switch, each arm a tail call (onFileMock / onHook / onDescribe / onTest)
}
