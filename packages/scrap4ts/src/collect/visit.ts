import type { VisitorObject } from "oxc-parser"
import type { CollectedExample } from "../score.js"
import { analyzeBody, collectFileFacts } from "./body.js"
import {
  ast,
  calleeChain,
  callbackArg,
  firstNameArg,
  offset,
  offsetToLine,
} from "./ast.js"

const DESCRIBE = new Set(["describe", "suite"])
const TEST = new Set(["it", "test"])
const HOOKS = new Set(["beforeEach", "beforeAll", "afterEach", "afterAll", "aroundEach", "aroundAll"])
const HOOKS_OK_IN_TEST = new Set(["onTestFinished", "onTestFailed"])
const FILE_MOCKS = new Set(["mock", "hoisted"])
const TABLE_METHODS = new Set(["for", "each"])

type Suite = { title: string; setupDepth: number; tableDriven: boolean }

export type CollectCtx = {
  sourceText: string
  subjects: Set<string>
  helpers: Map<string, object>
  extendBindings: Map<string, number>
  examples: CollectedExample[]
  structureErrors: string[]
  moduleMocks: number
  suites: Suite[]
  describeCallbacks: Set<object>
  testCallbacks: Set<object>
  inTest: number
}

export function makeCollectCtx(sourceText: string, program: object): CollectCtx {
  const facts = collectFileFacts(program)
  return {
    sourceText,
    subjects: facts.subjects,
    helpers: facts.helpers,
    extendBindings: facts.extendBindings,
    examples: [],
    structureErrors: [],
    moduleMocks: 0,
    suites: [{ title: "", setupDepth: 0, tableDriven: false }],
    describeCallbacks: new Set(),
    testCallbacks: new Set(),
    inTest: 0,
  }
}

function isFileMock(chain: string[]): boolean {
  const root = chain[0]
  return root === "vi" && chain[1] !== undefined && FILE_MOCKS.has(chain[1])
}

function classifyHook(root: string): "ok-hook" | "hook" | undefined {
  if (HOOKS_OK_IN_TEST.has(root)) return "ok-hook"
  if (HOOKS.has(root)) return "hook"
  return undefined
}

function classifySuiteOrTest(
  root: string,
  extendBindings: Map<string, number>,
): "describe" | "test" | undefined {
  if (DESCRIBE.has(root)) return "describe"
  if (TEST.has(root) || extendBindings.has(root)) return "test"
  return undefined
}

function classifyCall(
  chain: string[],
  extendBindings: Map<string, number>,
): "describe" | "test" | "hook" | "ok-hook" | "file-mock" | "other" {
  const root = chain[0]
  if (!root) return "other"
  if (isFileMock(chain)) return "file-mock"
  const hook = classifyHook(root)
  if (hook) return hook
  return classifySuiteOrTest(root, extendBindings) ?? "other"
}

function currentSuite(ctx: CollectCtx): Suite {
  const top = ctx.suites[ctx.suites.length - 1]
  if (top !== undefined) return top
  const root = { title: "", setupDepth: 0, tableDriven: false }
  ctx.suites.push(root)
  return root
}

function hasTableMethod(chain: string[]): boolean {
  return chain.some((p) => TABLE_METHODS.has(p))
}

function onFileMock(ctx: CollectCtx): void {
  ctx.moduleMocks++
}

function onHook(ctx: CollectCtx, chain: string[]): void {
  if (ctx.inTest > 0) {
    ctx.structureErrors.push(`${chain[0]} nested in test`)
  } else {
    currentSuite(ctx).setupDepth++
  }
}

function onDescribe(ctx: CollectCtx, n: object, chain: string[]): void {
  if (ctx.inTest > 0) ctx.structureErrors.push("describe nested in test")
  ctx.suites.push({
    title: firstNameArg(n),
    setupDepth: currentSuite(ctx).setupDepth,
    tableDriven: hasTableMethod(chain) || currentSuite(ctx).tableDriven,
  })
  const cb = callbackArg(n)
  if (cb) ctx.describeCallbacks.add(cb)
}

function isTableFactory(chain: string[], cb: object | undefined): boolean {
  return hasTableMethod(chain) && !cb
}

function fixtureSetupBump(chain: string[], extendBindings: Map<string, number>): number {
  const named = extendBindings.get(chain[0] ?? "")
  if (named !== undefined) return named
  return chain.includes("extend") ? 1 : 0
}

function collectTestExample(
  ctx: CollectCtx,
  n: object,
  chain: string[],
  cb: object | undefined,
): CollectedExample {
  const metrics = analyzeBody(cb, ctx.sourceText, ctx.subjects, ctx.helpers, new Set())
  const start = offsetToLine(ctx.sourceText, offset(n, "start"))
  const end = offsetToLine(ctx.sourceText, Math.max(offset(n, "start"), offset(n, "end") - 1))
  const isTableTest = hasTableMethod(chain)
  const tableDriven = isTableTest || currentSuite(ctx).tableDriven || metrics.tableDriven
  const tableBranches = isTableTest ? Math.max(1, metrics.tableBranches) : metrics.tableBranches
  let rawLineCount = Math.max(1, end - start + 1)
  if (isTableTest && cb) {
    const cbStart = offsetToLine(ctx.sourceText, offset(cb, "start"))
    const cbEnd = offsetToLine(ctx.sourceText, Math.max(offset(cb, "start"), offset(cb, "end") - 1))
    rawLineCount = Math.max(1, cbEnd - cbStart + 1)
  }
  const fixtureBump = fixtureSetupBump(chain, ctx.extendBindings)
  return {
    name: firstNameArg(n),
    describePath: ctx.suites.map((s) => s.title).filter((t) => t.length > 0),
    line: start,
    endLine: end,
    rawLineCount,
    assertions: metrics.assertions,
    branches: metrics.branches,
    tableBranches,
    setupDepth: currentSuite(ctx).setupDepth + fixtureBump + metrics.setupBump,
    mocking: metrics.mocking,
    helperCalls: metrics.helperCalls,
    helperHiddenLines: metrics.helperHiddenLines,
    tempResources: metrics.tempResources,
    largeLiterals: metrics.largeLiterals,
    tableDriven,
    phases: metrics.phases,
    subjectSymbols: metrics.subjectSymbols,
    assertFeatures: metrics.assertFeatures,
    setupFeatures: metrics.setupFeatures,
    fixtureFeatures: metrics.fixtureFeatures,
    arrangeFeatures: metrics.arrangeFeatures,
    literalFeatures: metrics.literalFeatures,
    assertSignatures: metrics.assertSignatures,
    setupSignatures: metrics.setupSignatures,
    arrangeSignatures: metrics.arrangeSignatures,
    literalSignatures: metrics.literalSignatures,
  }
}

function onTest(ctx: CollectCtx, n: object, chain: string[]): void {
  const cb = callbackArg(n)
  if (isTableFactory(chain, cb)) return
  if (ctx.inTest > 0) {
    ctx.structureErrors.push("test nested in test")
    return
  }
  if (cb) ctx.testCallbacks.add(cb)
  ctx.examples.push(collectTestExample(ctx, n, chain, cb))
}

function onCallExpression(ctx: CollectCtx, n: object): void {
  const chain = calleeChain(n)
  const kind = classifyCall(chain, ctx.extendBindings)
  if (kind === "file-mock") return onFileMock(ctx)
  if (kind === "hook") return onHook(ctx, chain)
  if (kind === "describe") return onDescribe(ctx, n, chain)
  if (kind === "test") return onTest(ctx, n, chain)
}

function enterFunction(ctx: CollectCtx, n: object): void {
  if (ctx.testCallbacks.has(n)) ctx.inTest++
}

function exitFunction(ctx: CollectCtx, n: object): void {
  if (ctx.testCallbacks.has(n)) ctx.inTest--
  if (ctx.describeCallbacks.has(n) && ctx.suites.length > 1) ctx.suites.pop()
}

export function oxcHandlers(ctx: CollectCtx): VisitorObject {
  return {
    CallExpression: (node) => onCallExpression(ctx, ast(node)),
    ArrowFunctionExpression: (node) => enterFunction(ctx, ast(node)),
    "ArrowFunctionExpression:exit": (node) => exitFunction(ctx, ast(node)),
    FunctionExpression: (node) => enterFunction(ctx, ast(node)),
    "FunctionExpression:exit": (node) => exitFunction(ctx, ast(node)),
  }
}
