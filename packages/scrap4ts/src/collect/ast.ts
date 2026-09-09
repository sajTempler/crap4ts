function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export function ast(node: { type: string }): object {
  return node
}

export function read(node: object, key: string): unknown {
  return isRecord(node) ? node[key] : undefined
}

export function nodeType(node: object): string {
  const value = read(node, "type")
  return typeof value === "string" ? value : ""
}

export function child(node: object, key: string): object | undefined {
  const value = read(node, key)
  return isRecord(value) ? value : undefined
}

export function children(node: object, key: string): object[] {
  const value = read(node, key)
  if (!Array.isArray(value)) return []
  return value.filter((item): item is object => isRecord(item))
}

export function offset(node: object, key: "start" | "end"): number {
  const value = read(node, key)
  return typeof value === "number" ? value : 0
}

export function offsetToLine(sourceText: string, pos: number): number {
  let line = 1
  const end = Math.min(pos, sourceText.length)
  for (let i = 0; i < end; i++) {
    if (sourceText.charCodeAt(i) === 10) line++
  }
  return line
}

export function identifierName(node: object | undefined): string | undefined {
  if (!node) return undefined
  if (nodeType(node) === "Identifier" || nodeType(node) === "PrivateIdentifier") {
    const name = read(node, "name")
    return typeof name === "string" ? name : undefined
  }
  return undefined
}

function literalString(node: object): string | undefined {
  const value = read(node, "value")
  return typeof value === "string" ? value : undefined
}

function cookedTemplate(node: object): string | undefined {
  const first = children(node, "quasis")[0]
  if (!first) return undefined
  const cooked = read(child(first, "value") ?? {}, "cooked")
  return typeof cooked === "string" ? cooked : undefined
}

function namedString(node: object | undefined): string | undefined {
  if (!node) return undefined
  return stringValue(node)
}

export function stringValue(node: object): string | undefined {
  const t = nodeType(node)
  if (t === "Literal" || t === "StringLiteral") return literalString(node)
  if (t === "TemplateLiteral") return cookedTemplate(node)
  return undefined
}

function identChain(node: object): string[] {
  const name = identifierName(node)
  return name ? [name] : []
}

function isMemberExpr(t: string): boolean {
  return t === "MemberExpression" || t === "StaticMemberExpression" || t === "ComputedMemberExpression"
}

function memberChain(node: object): string[] {
  const object = child(node, "object")
  const property = child(node, "property")
  const propName = identifierName(property) ?? namedString(property)
  return [...(object ? calleeChain(object) : []), ...(propName ? [propName] : [])]
}

function unwrapNested(node: object, key: "callee" | "expression" | "tag"): string[] {
  const inner = child(node, key)
  return inner ? calleeChain(inner) : []
}

export function calleeChain(node: object): string[] {
  const t = nodeType(node)
  if (t === "Identifier") return identChain(node)
  if (isMemberExpr(t)) return memberChain(node)
  if (t === "CallExpression") return unwrapNested(node, "callee")
  if (t === "ChainExpression") return unwrapNested(node, "expression")
  if (t === "TaggedTemplateExpression") return unwrapNested(node, "tag")
  return []
}

export function argsOf(node: object): object[] {
  return children(node, "arguments")
}

export function callbackArg(node: object): object | undefined {
  const args = argsOf(node)
  for (let i = args.length - 1; i >= 0; i--) {
    const arg = args[i]
    if (!arg) continue
    const t = nodeType(arg)
    if (t === "ArrowFunctionExpression" || t === "FunctionExpression") return arg
  }
  return undefined
}

export function firstNameArg(node: object): string {
  for (const arg of argsOf(node)) {
    const name = stringValue(arg)
    if (name !== undefined) return name
  }
  return "(anonymous)"
}

export function isFunctionNode(node: object): boolean {
  const t = nodeType(node)
  return t === "ArrowFunctionExpression" || t === "FunctionExpression" || t === "FunctionDeclaration"
}

function isAstNode(value: unknown): value is object {
  return isRecord(value) && typeof value.type === "string"
}

function walkValue(value: unknown, visit: (n: object) => void): void {
  if (isAstNode(value)) {
    walkNodes(value, visit)
    return
  }
  if (!Array.isArray(value)) return
  for (const item of value) {
    if (isAstNode(item)) walkNodes(item, visit)
  }
}

export function walkNodes(node: object, visit: (n: object) => void): void {
  visit(node)
  for (const value of Object.values(node)) walkValue(value, visit)
}
