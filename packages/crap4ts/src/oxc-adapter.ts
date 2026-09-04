/** oxc-backed ParserAdapter. Scoring and CLI import the ParserAdapter type, not oxc types. */

import { parseSync, Visitor } from "oxc-parser"
import type { ParserAdapter, ScoringUnit } from "./parser.js"

type WalkCtx = {
  filename: string
  sourceText: string
  units: ScoringUnit[]
  stack: object[]
  depth: number
  current: ScoringUnit | undefined
}

function offsetToLine(sourceText: string, offset: number): number {
  let line = 1
  const end = Math.min(offset, sourceText.length)
  for (let i = 0; i < end; i++) {
    if (sourceText.charCodeAt(i) === 10) line++
  }
  return line
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function read(node: object, key: string): unknown {
  if (isRecord(node)) return node[key]
  return undefined
}

function nodeType(node: object): string {
  const value = read(node, "type")
  return typeof value === "string" ? value : ""
}

function child(node: object, key: string): object | undefined {
  const value = read(node, key)
  return isRecord(value) ? value : undefined
}

function stringField(node: object, key: string): string | undefined {
  const value = read(node, key)
  return typeof value === "string" ? value : undefined
}

function namedKey(key: object, prefix: string): string {
  const name = stringField(key, "name")
  if (name === undefined) return "(anonymous)"
  return `${prefix}${name}`
}

function keyName(key: object | undefined): string {
  if (!key) return "(anonymous)"
  const t = nodeType(key)
  if (t === "PrivateIdentifier") return namedKey(key, "#")
  if (t === "Identifier") return namedKey(key, "")
  return "(computed)"
}

function qualifiedMember(owner: string, node: object, kind: string): string {
  const quals: string[] = []
  if (read(node, "static") === true) quals.push("static")
  if (kind === "get") quals.push("get")
  if (kind === "set") quals.push("set")
  const tail = [...quals, keyName(child(node, "key"))].join(" ")
  return `${owner}.${tail}`
}

function bindingName(id: object | undefined): string | undefined {
  if (!id) return undefined
  if (nodeType(id) === "Identifier") return stringField(id, "name")
  if (nodeType(id) === "Literal" || nodeType(id) === "StringLiteral") return stringField(id, "value")
  return undefined
}

function findLast(stack: object[], pred: (n: object) => boolean): object | undefined {
  for (let i = stack.length - 1; i >= 0; i--) {
    const node = stack[i]
    if (node && pred(node)) return node
  }
  return undefined
}

function isType(type: string): (n: object) => boolean {
  return (n) => nodeType(n) === type
}

function isClass(n: object): boolean {
  return nodeType(n) === "ClassDeclaration" || nodeType(n) === "ClassExpression"
}

function namespacePrefix(stack: object[]): string {
  const names = stack
    .filter(isType("TSModuleDeclaration"))
    .map((n) => bindingName(child(n, "id")))
    .filter((name): name is string => name !== undefined)
  return names.length > 0 ? `${names.join(".")}.` : ""
}

function className(stack: object[]): string {
  const cls = findLast(stack, isClass)
  return bindingName(cls ? child(cls, "id") : undefined) ?? "(anonymous)"
}

function childId(node: object | undefined): object | undefined {
  if (!node) return undefined
  return child(node, "id")
}

function fromMethod(stack: object[], prefix: string): string | undefined {
  const method = findLast(stack, isType("MethodDefinition"))
  if (!method) return undefined
  const owner = `${prefix}${className(stack)}`
  if (read(method, "kind") === "constructor") return `${owner}.constructor`
  return qualifiedMember(owner, method, String(read(method, "kind") ?? "method"))
}

function fromField(stack: object[], prefix: string): string | undefined {
  const field = findLast(stack, isType("PropertyDefinition"))
  if (!field) return undefined
  return qualifiedMember(`${prefix}${className(stack)}`, field, "method")
}

function fromProperty(stack: object[], prefix: string): string | undefined {
  const prop = findLast(stack, isType("Property"))
  if (!prop) return undefined
  const objName = bindingName(childId(findLast(stack, isType("VariableDeclarator")))) ?? "(anonymous)"
  return `${prefix}${objName}.${keyName(child(prop, "key"))}`
}

function fromFunction(stack: object[], prefix: string, fn: object): string | undefined {
  const fnName = bindingName(child(fn, "id"))
  if (fnName) return `${prefix}${fnName}`
  const bound = bindingName(childId(findLast(stack, isType("VariableDeclarator"))))
  if (bound) return `${prefix}${bound}`
  return undefined
}

function fromDefault(stack: object[], prefix: string): string {
  if (findLast(stack, isType("ExportDefaultDeclaration"))) return "default"
  return `${prefix}(anonymous)`
}

function unitName(stack: object[], fn: object): string {
  const prefix = namespacePrefix(stack)
  return (
    fromMethod(stack, prefix) ??
    fromField(stack, prefix) ??
    fromProperty(stack, prefix) ??
    fromFunction(stack, prefix, fn) ??
    fromDefault(stack, prefix)
  )
}

function hasBody(node: object): boolean {
  return read(node, "body") != null
}

function offset(node: object, key: "start" | "end"): number {
  const value = read(node, key)
  return typeof value === "number" ? value : 0
}

function makeWalkCtx(filename: string, sourceText: string): WalkCtx {
  return { filename, sourceText, units: [], stack: [], depth: 0, current: undefined }
}

function enterFn(ctx: WalkCtx, node: object): void {
  ctx.stack.push(node)
  if (ctx.depth === 0 && hasBody(node)) {
    const start = offset(node, "start")
    const end = offset(node, "end")
    ctx.current = {
      name: unitName(ctx.stack, node),
      file: ctx.filename,
      startLine: offsetToLine(ctx.sourceText, start),
      endLine: offsetToLine(ctx.sourceText, Math.max(start, end - 1)),
      complexity: 1,
    }
    ctx.units.push(ctx.current)
  }
  ctx.depth++
}

function exitFn(ctx: WalkCtx): void {
  ctx.depth--
  ctx.stack.pop()
  if (ctx.depth === 0) ctx.current = undefined
}

function bump(ctx: WalkCtx): void {
  if (ctx.depth >= 1 && ctx.current) ctx.current.complexity++
}

function onLogical(ctx: WalkCtx, node: object): void {
  const op = read(node, "operator")
  if (op === "&&" || op === "||") bump(ctx)
}

function push(ctx: WalkCtx, node: object): void {
  ctx.stack.push(node)
}

function pop(ctx: WalkCtx): void {
  ctx.stack.pop()
}

function oxcHandlers(ctx: WalkCtx) {
  return {
    FunctionDeclaration: (node: object) => enterFn(ctx, node),
    "FunctionDeclaration:exit": () => exitFn(ctx),
    FunctionExpression: (node: object) => enterFn(ctx, node),
    "FunctionExpression:exit": () => exitFn(ctx),
    ArrowFunctionExpression: (node: object) => enterFn(ctx, node),
    "ArrowFunctionExpression:exit": () => exitFn(ctx),

    MethodDefinition: (node: object) => push(ctx, node),
    "MethodDefinition:exit": () => pop(ctx),
    PropertyDefinition: (node: object) => push(ctx, node),
    "PropertyDefinition:exit": () => pop(ctx),
    Property: (node: object) => push(ctx, node),
    "Property:exit": () => pop(ctx),
    VariableDeclarator: (node: object) => push(ctx, node),
    "VariableDeclarator:exit": () => pop(ctx),
    ClassDeclaration: (node: object) => push(ctx, node),
    "ClassDeclaration:exit": () => pop(ctx),
    ClassExpression: (node: object) => push(ctx, node),
    "ClassExpression:exit": () => pop(ctx),
    ExportDefaultDeclaration: (node: object) => push(ctx, node),
    "ExportDefaultDeclaration:exit": () => pop(ctx),
    TSModuleDeclaration: (node: object) => push(ctx, node),
    "TSModuleDeclaration:exit": () => pop(ctx),

    IfStatement: () => bump(ctx),
    ForStatement: () => bump(ctx),
    ForInStatement: () => bump(ctx),
    ForOfStatement: () => bump(ctx),
    WhileStatement: () => bump(ctx),
    DoWhileStatement: () => bump(ctx),
    SwitchCase: () => bump(ctx),
    CatchClause: () => bump(ctx),
    ConditionalExpression: () => bump(ctx),
    LogicalExpression: (node: object) => onLogical(ctx, node),
  }
}

function throwIfFatal(errors: ReadonlyArray<{ severity: string; message: string }>): void {
  const messages = errors.filter((e) => e.severity === "Error").map((e) => e.message)
  if (messages.length > 0) throw new Error(messages.join("\n"))
}

export const oxcParser: ParserAdapter = {
  scoringUnits(filename, sourceText): ScoringUnit[] {
    const result = parseSync(filename, sourceText)
    throwIfFatal(result.errors)
    const ctx = makeWalkCtx(filename, sourceText)
    new Visitor(oxcHandlers(ctx)).visit(result.program)
    return ctx.units
  },
}
