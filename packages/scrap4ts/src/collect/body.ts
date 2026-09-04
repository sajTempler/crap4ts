import {
  argsOf,
  calleeChain,
  child,
  children,
  identifierName,
  isFunctionNode,
  nodeType,
  offset,
  offsetToLine,
  read,
  stringValue,
  walkNodes,
} from "./ast.js"

const VITEST_CALLEES = new Set([
  "describe",
  "suite",
  "it",
  "test",
  "beforeEach",
  "beforeAll",
  "afterEach",
  "afterAll",
  "aroundEach",
  "aroundAll",
  "onTestFinished",
  "onTestFailed",
])
const SKIP_ASSERT = new Set(["assertions", "hasAssertions", "anything", "TypeOf"])
const EXAMPLE_MOCKS = new Set(["spyOn", "fn", "stubGlobal", "stubEnv", "doMock"])
const TEMP_CALLEES = new Set([
  "mkdtemp",
  "mkdir",
  "tmpdir",
  "writeFile",
  "readFile",
  "writeFileSync",
  "readFileSync",
  "exec",
  "spawn",
  "execSync",
  "spawnSync",
])

type BodyMetrics = {
  assertions: number
  branches: number
  tableBranches: number
  mocking: number
  helperCalls: number
  helperHiddenLines: number
  tempResources: number
  largeLiterals: number
  tableDriven: boolean
  phases: number
  setupBump: number
  subjectSymbols: Set<string>
  assertFeatures: Set<string>
  setupFeatures: Set<string>
  fixtureFeatures: Set<string>
  arrangeFeatures: Set<string>
  literalFeatures: Set<string>
  assertSignatures: string[]
  setupSignatures: string[]
  arrangeSignatures: string[]
  literalSignatures: string[]
}

type WalkCtx = {
  sourceText: string
  subjects: Set<string>
  helpers: Map<string, object>
  helperStack: Set<string>
  metrics: BodyMetrics
  spans: { start: number; end: number }[]
}

function importLocals(stmt: object): string[] {
  const names: string[] = []
  for (const spec of children(stmt, "specifiers")) {
    const local = identifierName(child(spec, "local"))
    if (local) names.push(local)
  }
  return names
}

function addSubjectImports(source: string, names: string[], subjects: Set<string>): void {
  const base = source.split("/").pop() ?? source
  if (/helper/i.test(base)) return
  for (const n of names) subjects.add(n)
}

function importSource(stmt: object): string {
  const sourceNode = child(stmt, "source")
  if (!sourceNode) return ""
  return stringValue(sourceNode) ?? ""
}

function addImport(stmt: object, subjects: Set<string>, vitest: Set<string>): void {
  if (nodeType(stmt) !== "ImportDeclaration") return
  const source = importSource(stmt)
  const names = importLocals(stmt)
  if (source === "vitest") {
    for (const n of names) vitest.add(n)
    return
  }
  addSubjectImports(source, names, subjects)
}

function collectImports(program: object): { subjects: Set<string>; vitest: Set<string> } {
  const subjects = new Set<string>()
  const vitest = new Set<string>()
  for (const stmt of children(program, "body")) addImport(stmt, subjects, vitest)
  return { subjects, vitest }
}

function addFnHelper(node: object, helpers: Map<string, object>): void {
  const name = identifierName(child(node, "id"))
  if (name && !VITEST_CALLEES.has(name)) helpers.set(name, node)
}

function addVarHelper(node: object, helpers: Map<string, object>): void {
  const name = identifierName(child(node, "id"))
  const init = child(node, "init")
  if (!name || !init) return
  if (isFunctionNode(init)) helpers.set(name, init)
}

function addHelper(node: object, helpers: Map<string, object>): void {
  if (nodeType(node) === "FunctionDeclaration") addFnHelper(node, helpers)
  if (nodeType(node) === "VariableDeclarator") addVarHelper(node, helpers)
}

function collectHelpers(program: object): Map<string, object> {
  const helpers = new Map<string, object>()
  walkNodes(program, (node) => addHelper(node, helpers))
  return helpers
}

function isExtendCall(chain: string[]): boolean {
  return chain.includes("extend") && (chain.includes("test") || chain.includes("it"))
}

function extendFixtureCount(init: object): number {
  const cfg = argsOf(init)[0]
  if (cfg && nodeType(cfg) === "ObjectExpression") return children(cfg, "properties").length
  return 1
}

function extendBindingFromInit(name: string, init: object): { name: string; count: number } | undefined {
  if (nodeType(init) !== "CallExpression") return undefined
  const chain = calleeChain(init)
  if (!isExtendCall(chain)) return undefined
  return { name, count: extendFixtureCount(init) }
}

function extendBindingOf(node: object): { name: string; count: number } | undefined {
  if (nodeType(node) !== "VariableDeclarator") return undefined
  const name = identifierName(child(node, "id"))
  const init = child(node, "init")
  if (!name || !init) return undefined
  return extendBindingFromInit(name, init)
}

function addExtendBinding(node: object, bindings: Map<string, number>): void {
  const binding = extendBindingOf(node)
  if (binding) bindings.set(binding.name, binding.count)
}

function collectExtendBindings(program: object): Map<string, number> {
  const bindings = new Map<string, number>()
  walkNodes(program, (node) => addExtendBinding(node, bindings))
  return bindings
}

export function collectFileFacts(program: object): {
  subjects: Set<string>
  helpers: Map<string, object>
  extendBindings: Map<string, number>
} {
  return {
    subjects: collectImports(program).subjects,
    helpers: collectHelpers(program),
    extendBindings: collectExtendBindings(program),
  }
}

function isExpectMember(callee: object): boolean {
  if (nodeType(callee) !== "MemberExpression" && nodeType(callee) !== "StaticMemberExpression") return false
  return identifierName(child(callee, "object")) === "expect"
}

function isExpectAssertion(callee: object, chain: string[]): boolean {
  const second = chain[1]
  if (second !== undefined && SKIP_ASSERT.has(second)) return false
  if (nodeType(callee) === "Identifier") return true
  return isExpectMember(callee)
}

function isAssertAssertion(callee: object, chain: string[]): boolean {
  if (chain[1] === "Type") return false
  if (nodeType(callee) === "Identifier") return true
  return identifierName(child(callee, "object")) === "assert"
}

function isPrimaryAssertion(node: object): boolean {
  const callee = child(node, "callee")
  if (!callee) return false
  const chain = calleeChain(node)
  const root = chain[0]
  if (root === "expect") return isExpectAssertion(callee, chain)
  if (root === "assert") return isAssertAssertion(callee, chain)
  return false
}

function isCountedExpect(second: string | undefined): boolean {
  return second === undefined || !SKIP_ASSERT.has(second)
}

function isAssertionChain(chain: string[]): boolean {
  const root = chain[0]
  if (root === "expect") return isCountedExpect(chain[1])
  if (root === "assert") return chain[1] !== "Type"
  return false
}

function isAssertionRelated(node: object): boolean {
  if (nodeType(node) !== "CallExpression") return false
  return isAssertionChain(calleeChain(node))
}

function isTempCall(chain: string[]): boolean {
  return chain.some((part) => TEMP_CALLEES.has(part) || /tmp/i.test(part) || part.includes("Temp"))
}

function largeStringLiteral(node: object): boolean {
  const value = read(node, "value")
  return typeof value === "string" && value.split("\n").length > 5
}

function largeTemplate(node: object, sourceText: string): boolean {
  return sourceText.slice(offset(node, "start"), offset(node, "end")).split("\n").length > 5
}

function largeCollection(t: string, node: object): boolean {
  if (t === "ArrayExpression") return children(node, "elements").length > 10
  if (t === "ObjectExpression") return children(node, "properties").length > 10
  return false
}

function largeLiteral(node: object, sourceText: string): boolean {
  const t = nodeType(node)
  if (t === "Literal" || t === "StringLiteral") return largeStringLiteral(node)
  if (t === "TemplateLiteral") return largeTemplate(node, sourceText)
  return largeCollection(t, node)
}

function largeCaseTable(node: object): boolean {
  if (nodeType(node) !== "ArrayExpression") return false
  const elements = children(node, "elements")
  if (elements.length < 2) return false
  return elements.every((el) => {
    const t = nodeType(el)
    return t === "ArrayExpression" || t === "ObjectExpression"
  })
}

function isLiteralType(t: string): boolean {
  return t === "Literal" || t === "StringLiteral" || t === "NumericLiteral" || t === "BooleanLiteral"
}

function normalizeLiteralValue(value: unknown): string | undefined {
  if (typeof value === "string") return "string"
  if (typeof value === "number") return "number"
  if (typeof value === "boolean") return "boolean"
  if (value === null) return "null"
  return undefined
}

function normalizeAtom(node: object, t: string): unknown | undefined {
  if (t === "Identifier") return "id"
  if (isLiteralType(t)) return normalizeLiteralValue(read(node, "value"))
  if (t === "TemplateLiteral") return "string"
  return undefined
}

function normalizeList(tag: string, nodes: object[]): unknown[] {
  return [tag, ...nodes.map(normalize)]
}

function normalizeMember(node: object): unknown {
  const object = child(node, "object")
  return ["member", object ? normalize(object) : "id", identifierName(child(node, "property")) ?? "id"]
}

function normalizeAwait(node: object): unknown {
  const arg = child(node, "argument")
  return ["await", arg ? normalize(arg) : "id"]
}

function normalizeExpr(node: object, t: string): unknown {
  if (t === "MemberExpression" || t === "StaticMemberExpression") return normalizeMember(node)
  if (t === "AwaitExpression") return normalizeAwait(node)
  return t || "node"
}

function normalizeComposite(node: object, t: string): unknown {
  if (t === "ArrayExpression") return normalizeList("array", children(node, "elements"))
  if (t === "ObjectExpression") return normalizeList("object", children(node, "properties"))
  if (t === "CallExpression") return ["call", ...calleeChain(node), ...argsOf(node).map(normalize)]
  return normalizeExpr(node, t)
}

function normalize(node: object): unknown {
  const t = nodeType(node)
  const atom = normalizeAtom(node, t)
  if (atom !== undefined) return atom
  return normalizeComposite(node, t)
}

function shapeFeatures(value: unknown): Set<string> {
  const out = new Set<string>()
  const walk = (item: unknown) => {
    out.add(JSON.stringify(item))
    if (Array.isArray(item)) for (const childValue of item) walk(childValue)
  }
  walk(value)
  return out
}

function emptyMetrics(): BodyMetrics {
  return {
    assertions: 0,
    branches: 0,
    tableBranches: 0,
    mocking: 0,
    helperCalls: 0,
    helperHiddenLines: 0,
    tempResources: 0,
    largeLiterals: 0,
    tableDriven: false,
    phases: 0,
    setupBump: 0,
    subjectSymbols: new Set(),
    assertFeatures: new Set(),
    setupFeatures: new Set(),
    fixtureFeatures: new Set(),
    arrangeFeatures: new Set(),
    literalFeatures: new Set(),
    assertSignatures: [],
    setupSignatures: [],
    arrangeSignatures: [],
    literalSignatures: [],
  }
}

function bodyStatements(callback: object): object[] {
  const bodyNode = child(callback, "body")
  if (bodyNode && nodeType(bodyNode) === "BlockStatement") return children(bodyNode, "body")
  if (bodyNode) return [bodyNode]
  return []
}

function noteAssertion(n: object, found: { value: boolean }): void {
  if (nodeType(n) === "CallExpression" && isPrimaryAssertion(n)) found.value = true
}

function statementHasAssertion(stmt: object): boolean {
  const found = { value: false }
  walkNodes(stmt, (n) => noteAssertion(n, found))
  return found.value
}

function statementPhase(stmt: object): "setup" | "assert" | "action" {
  if (statementHasAssertion(stmt)) return "assert"
  if (nodeType(stmt) === "TryStatement") return "setup"
  return "action"
}

function countAssertPhases(statements: object[]): number {
  const phases = statements.map(statementPhase)
  let phaseCount = 0
  let prev: "setup" | "assert" | "action" | undefined
  for (const phase of phases) {
    if (phase === "assert" && prev !== "assert") phaseCount++
    prev = phase
  }
  return phaseCount
}

function addFeatures(sigs: string[], set: Set<string>, signature: string, features: Set<string>): void {
  sigs.push(signature)
  for (const f of features) set.add(f)
}

function recordStatementShape(stmt: object, metrics: BodyMetrics): void {
  const normalized = normalize(stmt)
  const signature = JSON.stringify(normalized)
  const features = shapeFeatures(normalized)
  if (statementHasAssertion(stmt)) addFeatures(metrics.assertSignatures, metrics.assertFeatures, signature, features)
  else if (nodeType(stmt) === "TryStatement") addFeatures(metrics.setupSignatures, metrics.setupFeatures, signature, features)
  else addFeatures(metrics.arrangeSignatures, metrics.arrangeFeatures, signature, features)
}

function collectStatementShapes(statements: object[], metrics: BodyMetrics): void {
  for (const stmt of statements) recordStatementShape(stmt, metrics)
}

function addAssertionSpan(node: object, spans: { start: number; end: number }[]): void {
  if (nodeType(node) === "CallExpression" && isAssertionRelated(node)) {
    spans.push({ start: offset(node, "start"), end: offset(node, "end") })
  }
}

function collectAssertionSpans(callback: object): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = []
  walkNodes(callback, (node) => addAssertionSpan(node, spans))
  return spans
}

function spanContainsInner(span: { start: number; end: number }, start: number, end: number): boolean {
  return start >= span.start && end <= span.end && (start !== span.start || end !== span.end)
}

function insideAssertion(node: object, spans: { start: number; end: number }[]): boolean {
  const start = offset(node, "start")
  const end = offset(node, "end")
  return spans.some((span) => spanContainsInner(span, start, end))
}

function countExampleMock(chain: string[], metrics: BodyMetrics): void {
  if (chain[0] === "vi" && chain[1] !== undefined && EXAMPLE_MOCKS.has(chain[1])) metrics.mocking++
}

function mergeHelperMetrics(into: BodyMetrics, inner: BodyMetrics): void {
  into.assertions += inner.assertions
  into.branches += inner.branches
  into.tableBranches += inner.tableBranches
  into.mocking += inner.mocking
  into.tempResources += inner.tempResources
  into.largeLiterals += inner.largeLiterals
  into.helperCalls += inner.helperCalls
  into.helperHiddenLines += inner.helperHiddenLines
}

function absorbHelper(w: WalkCtx, calleeName: string): void {
  w.metrics.helperCalls++
  const helper = w.helpers.get(calleeName)
  if (!helper) return
  const start = offsetToLine(w.sourceText, offset(helper, "start"))
  const end = offsetToLine(w.sourceText, Math.max(offset(helper, "start"), offset(helper, "end") - 1))
  w.metrics.helperHiddenLines += Math.max(1, end - start + 1)
  mergeHelperMetrics(
    w.metrics,
    analyzeBody(helper, w.sourceText, w.subjects, w.helpers, new Set([...w.helperStack, calleeName])),
  )
}

function chargeHelper(w: WalkCtx, chain: string[]): void {
  const calleeName = chain[0]
  if (!calleeName || !w.helpers.has(calleeName) || w.helperStack.has(calleeName)) return
  absorbHelper(w, calleeName)
}

function callHasCaseTable(node: object): boolean {
  const callee = child(node, "callee")
  const recv = callee ? child(callee, "object") : undefined
  return argsOf(node).some(largeCaseTable) || (recv !== undefined && largeCaseTable(recv))
}

function noteTableCall(w: WalkCtx, node: object, chain: string[]): void {
  if (!chain.includes("forEach") && !chain.includes("map")) return
  if (!callHasCaseTable(node)) return
  w.metrics.tableDriven = true
  w.metrics.tableBranches++
}

function visitCall(w: WalkCtx, node: object): void {
  const chain = calleeChain(node)
  if (isPrimaryAssertion(node)) {
    w.metrics.assertions++
    return
  }
  countExampleMock(chain, w.metrics)
  if (isTempCall(chain)) w.metrics.tempResources++
  chargeHelper(w, chain)
  noteTableCall(w, node, chain)
}

function isLoopNode(t: string): boolean {
  return (
    t === "ForStatement" ||
    t === "ForInStatement" ||
    t === "ForOfStatement" ||
    t === "WhileStatement" ||
    t === "DoWhileStatement"
  )
}

function isOtherBranch(t: string): boolean {
  return t === "IfStatement" || t === "CatchClause" || t === "ConditionalExpression" || t === "SwitchCase"
}

function isBranchNode(t: string): boolean {
  return isLoopNode(t) || isOtherBranch(t)
}

function countLoopBranch(w: WalkCtx, node: object): void {
  const right = child(node, "right") ?? child(node, "init")
  if (right && largeCaseTable(right)) {
    w.metrics.tableDriven = true
    w.metrics.tableBranches++
    return
  }
  w.metrics.branches++
}

function countBranch(w: WalkCtx, node: object, t: string): void {
  if (t === "ForOfStatement" || t === "ForInStatement" || t === "ForStatement") {
    countLoopBranch(w, node)
    return
  }
  w.metrics.branches++
}

function countLogicBranch(w: WalkCtx, node: object): void {
  const op = read(node, "operator")
  if (op === "&&" || op === "||") w.metrics.branches++
}

function visitBranch(w: WalkCtx, node: object, t: string): void {
  if (isBranchNode(t)) countBranch(w, node, t)
  if (t === "LogicalExpression") countLogicBranch(w, node)
}

function visitLiteral(w: WalkCtx, node: object): void {
  if (!largeLiteral(node, w.sourceText)) return
  w.metrics.largeLiterals++
  const sig = JSON.stringify(normalize(node))
  w.metrics.literalSignatures.push(sig)
  w.metrics.literalFeatures.add(sig)
}

function isSubjectName(name: string, subjects: Set<string>): boolean {
  return subjects.has(name) && !VITEST_CALLEES.has(name) && name !== "expect" && name !== "vi" && name !== "assert"
}

function visitSubject(w: WalkCtx, node: object): void {
  const name = identifierName(node)
  if (name && isSubjectName(name, w.subjects)) w.metrics.subjectSymbols.add(name)
}

function visitBodyNode(w: WalkCtx, node: object): void {
  const t = nodeType(node)
  if (t === "CallExpression") visitCall(w, node)
  if (t === "TryStatement") w.metrics.setupBump++
  if (!insideAssertion(node, w.spans)) visitBranch(w, node, t)
  visitLiteral(w, node)
  if (t === "Identifier") visitSubject(w, node)
}

export function analyzeBody(
  callback: object | undefined,
  sourceText: string,
  subjects: Set<string>,
  helpers: Map<string, object>,
  helperStack: Set<string>,
): BodyMetrics {
  if (!callback) return emptyMetrics()
  const metrics = emptyMetrics()
  const statements = bodyStatements(callback)
  metrics.phases = countAssertPhases(statements)
  collectStatementShapes(statements, metrics)
  const spans = collectAssertionSpans(callback)
  const w: WalkCtx = { sourceText, subjects, helpers, helperStack, metrics, spans }
  walkNodes(callback, (node) => visitBodyNode(w, node))
  return metrics
}
