import { readFile } from "node:fs/promises"

export type LineHits = Map<number, number>
export type LcovData = Map<string, LineHits>

type ParseState = {
  out: LcovData
  currentFile: string | undefined
  currentLines: LineHits
}

function flush(state: ParseState): void {
  if (state.currentFile !== undefined) {
    state.out.set(state.currentFile, state.currentLines)
  }
  state.currentFile = undefined
  state.currentLines = new Map()
}

function onSf(state: ParseState, line: string): void {
  flush(state)
  state.currentFile = normalizePath(line.slice(3))
  state.currentLines = new Map()
}

function onDa(state: ParseState, line: string): void {
  if (state.currentFile === undefined) return
  const da = /^DA:(\d+),(\d+)/.exec(line)
  if (!da) return
  state.currentLines.set(Number(da[1]), Number(da[2]))
}

function parseLine(state: ParseState, raw: string): void {
  const line = raw.trim()
  if (line.startsWith("SF:")) {
    onSf(state, line)
    return
  }
  if (line === "end_of_record") {
    flush(state)
    return
  }
  onDa(state, line)
}

export function parseLcov(text: string): LcovData {
  const state: ParseState = { out: new Map(), currentFile: undefined, currentLines: new Map() }
  for (const raw of text.split(/\r?\n/)) parseLine(state, raw)
  flush(state)
  return state.out
}

export async function loadLcov(path: string): Promise<LcovData | undefined> {
  try {
    const text = await readFile(path, "utf8")
    return parseLcov(text)
  } catch (error) {
    if (isNotFound(error)) return undefined
    throw error
  }
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"
}

function hitsInRange(hits: LineHits, startLine: number, endLine: number): { total: number; covered: number } {
  let total = 0
  let covered = 0
  for (const [line, count] of hits) {
    if (line < startLine || line > endLine) continue
    total++
    if (count > 0) covered++
  }
  return { total, covered }
}

function ratio(counts: { total: number; covered: number }): number {
  if (counts.total === 0) return 0
  return (100 * counts.covered) / counts.total
}

export function coverageForRange(
  lcov: LcovData | undefined,
  file: string,
  startLine: number,
  endLine: number,
): number | undefined {
  if (!lcov) return undefined
  const hits = linesForFile(lcov, file)
  if (!hits) return undefined
  return ratio(hitsInRange(hits, startLine, endLine))
}

function linesForFile(lcov: LcovData, file: string): LineHits | undefined {
  const normalized = normalizePath(file)
  const exact = lcov.get(normalized)
  if (exact) return exact
  for (const [candidate, hits] of lcov) {
    if (suffixMatch(candidate, normalized) || suffixMatch(normalized, candidate)) {
      return hits
    }
  }
  return undefined
}

function suffixMatch(path: string, suffix: string): boolean {
  const pathParts = pathSegments(path)
  const suffixParts = pathSegments(suffix)
  if (suffixParts.length === 0 || suffixParts.length > pathParts.length) return false
  const offset = pathParts.length - suffixParts.length
  return suffixParts.every((part, i) => pathParts[offset + i] === part)
}

function pathSegments(path: string): string[] {
  return normalizePath(path).split("/").filter((part) => part.length > 0)
}

export function normalizePath(path: string): string {
  let decoded = path
  try {
    decoded = decodeURIComponent(path)
  } catch {
    decoded = path
  }
  return decoded.replaceAll("\\", "/").replace(/^file:/, "").replace(/^\.\//, "").replace(/\/+/g, "/")
}
