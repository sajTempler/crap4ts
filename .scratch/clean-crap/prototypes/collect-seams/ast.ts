/**
 * PROTOTYPE — throwaway.
 * Internal module. Duck-typed oxc peel. Not a parser adapter, not shared with crap4ts.
 * Two callers (visit.ts, body.ts) so this seam is real.
 */

export function walkNodes(_node: object, _visit: (n: object) => void): void {
  // split today's CC 8: walkNodes → walkValue → isAstNode
}

export function calleeChain(_node: object): string[] {
  // split today's CC 12: dispatch + memberChain / unwrapCall / unwrapOptional
  return []
}

export function stringValue(_node: object | undefined): string | undefined {
  // split today's CC 8: literalString vs cookedTemplate
  return undefined
}

export function largeCaseTable(_node: object): boolean {
  // CC 4, 0% coverage. MOVE HERE, DO NOT SPLIT. Cover via collectExamples.
  return false
}
