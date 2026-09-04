/**
 * PROTOTYPE — throwaway. Signatures only. Production collect.ts is untouched.
 *
 * Public seam. cli.ts and collect.test.ts keep this call.
 * CC budget: 2 (fatal parse vs visit). Visitor object-literal methods
 * must not live here — they fold into this scoring unit.
 */

export type CollectResult = {
  examples: unknown[]
  structureErrors: string[]
  parseError: string | undefined
  moduleMocks: number
}

export function collectExamples(_filename: string, _sourceText: string): CollectResult {
  // parseSync → hasFatalParseError? parseFailure
  // else makeCollectCtx → new Visitor(oxcHandlers(ctx)).visit → result from ctx
  throw new Error("prototype stub")
}
