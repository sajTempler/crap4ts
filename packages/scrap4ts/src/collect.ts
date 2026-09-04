import { parseSync, Visitor } from "oxc-parser"
import type { CollectedExample } from "./score.js"
import { makeCollectCtx, oxcHandlers } from "./collect/visit.js"

export type CollectResult = {
  examples: CollectedExample[]
  structureErrors: string[]
  parseError: string | undefined
  moduleMocks: number
}

export function collectExamples(filename: string, sourceText: string): CollectResult {
  const parsed = parseSync(filename, sourceText)
  const fatal = parsed.errors.filter((e) => e.severity === "Error")
  if (fatal.length > 0) {
    return {
      examples: [],
      structureErrors: [],
      parseError: fatal.map((e) => e.message).join("\n"),
      moduleMocks: 0,
    }
  }
  const ctx = makeCollectCtx(sourceText, parsed.program)
  new Visitor(oxcHandlers(ctx)).visit(parsed.program)
  return {
    examples: ctx.examples,
    structureErrors: ctx.structureErrors,
    parseError: undefined,
    moduleMocks: ctx.moduleMocks,
  }
}
