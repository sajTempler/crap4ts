/**
 * PROTOTYPE — throwaway. The type scoring and CLI would import.
 * No oxc types, no TypeScript compiler types.
 *
 * Lives in packages/crap4ts. scrap4ts does not share this type.
 * TypeScript 7.1 is a future ParserAdapter; v1 does not ship a throwing stub.
 *
 * Name grammar (both adapters must match):
 *   function foo / const foo = () =>     foo
 *   export default function ()           default
 *   class Box { m() }                    Box.m
 *   constructor                          Box.constructor
 *   getter / setter                      Box.get value / Box.set value
 *   #secret                              Box.#secret
 *   static empty                         Box.static empty
 *   class field arrow                    Box.field
 *   const api = { ping() }               api.ping
 *   namespace N { function f }           N.f
 *   no name / computed key               (anonymous) / (computed)
 */

export type ScoringUnit = {
  name: string
  file: string
  /** 1-based, inclusive, full node span (family grain). */
  startLine: number
  endLine: number
  complexity: number
}

/**
 * filename is the dialect hint (extension) and ScoringUnit.file.
 * The adapter does not read the filesystem.
 * Parse failure throws (tool failure, not a high score).
 * CC is counted inside the adapter.
 */
export type ParserAdapter = {
  scoringUnits(filename: string, sourceText: string): ScoringUnit[]
}
