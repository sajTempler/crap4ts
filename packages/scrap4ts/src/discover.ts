import type { Dirent } from "node:fs"
import { readdir, readFile } from "node:fs/promises"
import { join, relative, sep } from "node:path"
import { parseSync } from "oxc-parser"

const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", "target", "build", ".git"])
const CONFIG_NAMES = [
  "vitest.config.ts",
  "vitest.config.mts",
  "vitest.config.js",
  "vitest.config.mjs",
  "vite.config.ts",
  "vite.config.mts",
  "vite.config.js",
  "vite.config.mjs",
]

const DEFAULT_INCLUDE = [/\.(test|spec)\.[cm]?[jt]sx?$/]
const DEFAULT_EXCLUDE: RegExp[] = []

type GlobPiece = { out: string; end: number }
type TestGlobs = { include?: string[]; exclude?: string[] }

function toPosix(path: string): string {
  return path.split(sep).join("/")
}

function globStar(glob: string, i: number): GlobPiece {
  if (glob[i + 1] !== "*") return { out: "[^/]*", end: i }
  if (glob[i + 2] === "/") return { out: "(?:.*/)?", end: i + 2 }
  return { out: ".*", end: i + 1 }
}

function globQuestion(glob: string, i: number): GlobPiece {
  if (glob[i + 1] !== "(") return { out: "[^/]", end: i }
  const close = glob.indexOf(")", i)
  const inner = glob.slice(i + 2, close).replaceAll("|", "|")
  return { out: `(?:${inner})?`, end: close }
}

function globBrace(glob: string, i: number): GlobPiece {
  const close = glob.indexOf("}", i)
  const inner = glob.slice(i + 1, close).split(",").map(escapeRegExp).join("|")
  return { out: `(?:${inner})`, end: close }
}

function globClass(glob: string, i: number): GlobPiece {
  const close = glob.indexOf("]", i)
  return { out: glob.slice(i, close + 1), end: close }
}

function globPiece(glob: string, i: number, ch: string): GlobPiece {
  if (ch === "*") return globStar(glob, i)
  if (ch === "?") return globQuestion(glob, i)
  if (ch === "{") return globBrace(glob, i)
  if (ch === "[") return globClass(glob, i)
  return { out: escapeRegExp(ch), end: i }
}

function globToRegExp(glob: string): RegExp {
  let out = "^"
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i]
    if (ch === undefined) break
    const piece = globPiece(glob, i, ch)
    out += piece.out
    i = piece.end
  }
  out += "$"
  return new RegExp(out)
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function read(node: object, key: string): unknown {
  return isRecord(node) ? node[key] : undefined
}

function nodeType(node: object): string {
  const value = read(node, "type")
  return typeof value === "string" ? value : ""
}

function child(node: object, key: string): object | undefined {
  const value = read(node, key)
  return isRecord(value) ? value : undefined
}

function children(node: object, key: string): object[] {
  const value = read(node, key)
  if (!Array.isArray(value)) return []
  return value.filter((item): item is object => isRecord(item))
}

function stringField(node: object, key: string): string | undefined {
  const value = read(node, key)
  return typeof value === "string" ? value : undefined
}

function isLiteralNode(node: object): boolean {
  const t = nodeType(node)
  return t === "Literal" || t === "StringLiteral"
}

function identifierName(node: object | undefined): string | undefined {
  if (!node) return undefined
  if (nodeType(node) === "Identifier") return stringField(node, "name")
  if (isLiteralNode(node)) return stringField(node, "value")
  return undefined
}

function stringLiteral(node: object | undefined): string | undefined {
  if (!node) return undefined
  const t = nodeType(node)
  if (t === "Literal" || t === "StringLiteral") {
    const value = read(node, "value")
    return typeof value === "string" ? value : undefined
  }
  return undefined
}

function objectProps(node: object): { key: string; value: object }[] {
  return children(node, "properties").flatMap((prop) => {
    const key = identifierName(child(prop, "key"))
    const value = child(prop, "value")
    if (!key || !value) return []
    return [{ key, value }]
  })
}

function arrayStrings(node: object): string[] | undefined {
  if (nodeType(node) !== "ArrayExpression") return undefined
  const out: string[] = []
  for (const el of children(node, "elements")) {
    const s = stringLiteral(el)
    if (s === undefined) return undefined
    out.push(s)
  }
  return out
}

function propValue(props: { key: string; value: object }[], key: string): object | undefined {
  return props.find((p) => p.key === key)?.value
}

function testObject(n: object): object | undefined {
  if (nodeType(n) !== "ObjectExpression") return undefined
  const testProp = propValue(objectProps(n), "test")
  if (!testProp || nodeType(testProp) !== "ObjectExpression") return undefined
  return testProp
}

function globList(inner: { key: string; value: object }[], key: string): string[] | undefined {
  const node = propValue(inner, key)
  return node ? arrayStrings(node) : undefined
}

function readTestConfig(n: object): TestGlobs | undefined {
  const test = testObject(n)
  if (!test) return undefined
  const inner = objectProps(test)
  return { include: globList(inner, "include"), exclude: globList(inner, "exclude") }
}

function visitConfigArray(value: unknown[], found: { current: TestGlobs }): void {
  for (const item of value) {
    if (isRecord(item) && typeof item.type === "string") walkConfigNode(item, found)
  }
}

function visitConfigValue(value: unknown, found: { current: TestGlobs }): void {
  if (isRecord(value) && typeof value.type === "string") walkConfigNode(value, found)
  else if (Array.isArray(value)) visitConfigArray(value, found)
}

function walkConfigNode(n: object, found: { current: TestGlobs }): void {
  const cfg = readTestConfig(n)
  if (cfg) found.current = cfg
  for (const value of Object.values(n)) visitConfigValue(value, found)
}

function findTestConfig(node: object): TestGlobs {
  const found: { current: TestGlobs } = { current: {} }
  walkConfigNode(node, found)
  return found.current
}

async function loadPatterns(root: string): Promise<{ include: RegExp[]; exclude: RegExp[] }> {
  for (const name of CONFIG_NAMES) {
    const path = join(root, name)
    let text: string
    try {
      text = await readFile(path, "utf8")
    } catch {
      continue
    }
    const parsed = parseSync(name, text)
    const cfg = findTestConfig(parsed.program)
    const include = cfg.include?.map(globToRegExp) ?? DEFAULT_INCLUDE
    const exclude = cfg.exclude?.map(globToRegExp) ?? DEFAULT_EXCLUDE
    return { include, exclude }
  }
  return { include: DEFAULT_INCLUDE, exclude: DEFAULT_EXCLUDE }
}

function matches(path: string, patterns: RegExp[]): boolean {
  return patterns.some((re) => re.test(path) || re.test(path.split("/").pop() ?? path))
}

export async function findTestFiles(root: string, fragments: string[]): Promise<string[]> {
  const { include, exclude } = await loadPatterns(root)
  const files: string[] = []
  await walk(root, root, files, include, exclude)
  files.sort()
  if (fragments.length === 0) return files
  return files.filter((file) => fragments.some((fragment) => file.includes(fragment)))
}

async function visitDir(
  root: string,
  path: string,
  files: string[],
  include: RegExp[],
  exclude: RegExp[],
  name: string,
): Promise<void> {
  if (SKIP_DIRS.has(name)) return
  await walk(root, path, files, include, exclude)
}

function isTestD(name: string): boolean {
  return /\.test-d\.ts$/.test(name)
}

function isExcluded(rel: string, exclude: RegExp[]): boolean {
  return exclude.length > 0 && matches(rel, exclude)
}

function matchesInclude(entry: Dirent, rel: string, include: RegExp[]): boolean {
  return matches(rel, include) || matches(entry.name, include)
}

function isIncludedFile(entry: Dirent, rel: string, include: RegExp[], exclude: RegExp[]): boolean {
  if (!entry.isFile()) return false
  if (isTestD(entry.name) || isExcluded(rel, exclude)) return false
  return matchesInclude(entry, rel, include)
}

async function visitEntry(
  root: string,
  dir: string,
  files: string[],
  include: RegExp[],
  exclude: RegExp[],
  entry: Dirent,
): Promise<void> {
  const path = join(dir, entry.name)
  const rel = toPosix(relative(root, path))
  if (entry.isDirectory()) {
    await visitDir(root, path, files, include, exclude, entry.name)
    return
  }
  if (isIncludedFile(entry, rel, include, exclude)) files.push(rel)
}

async function walk(
  root: string,
  dir: string,
  files: string[],
  include: RegExp[],
  exclude: RegExp[],
): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    await visitEntry(root, dir, files, include, exclude, entry)
  }
}
