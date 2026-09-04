import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { collectExamples } from "./collect.js"
import { findTestFiles } from "./discover.js"
import { formatReport, renderJson, toBaseline, type BaselineDocument } from "./report.js"
import { compareReports, scoreFile, type FileReport, type Summary } from "./score.js"

export type CliResult = {
  exitCode: number
  stdout: string
}

export type CliDeps = {
  cwd?: string
}

const helpText = `Usage: scrap4ts [path-fragment ...] [--verbose] [--json] [--write-baseline] [--compare PATH]

Scores Vitest examples and prints a SCRAP guidance report.

Options:
  -h, --help            Print this help message and exit.
  --verbose             Show full per-file, block, and example metrics.
  --json                Emit the report as JSON.
  --write-baseline      Write a baseline report under target/scrap/.
  --compare PATH        Compare the current report to a saved baseline JSON file.

Arguments:
  path-fragment    Optional test path substring. When present, only matching
                   discovered test files are scored.
`

type Parsed =
  | { action: "help" }
  | { action: "error"; message: string }
  | {
      action: "analyze"
      pathFragments: string[]
      verbose: boolean
      json: boolean
      writeBaseline: boolean
      compare: string | undefined
    }

type Analyze = Extract<Parsed, { action: "analyze" }>

type FlagState = {
  pathFragments: string[]
  verbose: boolean
  json: boolean
  writeBaseline: boolean
  compare: string | undefined
}

const SUMMARY_NUMBERS = [
  "fileScore",
  "avgScrap",
  "maxScrap",
  "effectiveDuplicationScore",
  "harmfulDuplicationScore",
  "caseMatrixRepetition",
  "helperHiddenExampleCount",
] as const

function takeCompare(args: string[], i: number, flags: FlagState): { i: number; parsed?: Parsed } {
  const value = args[i + 1]
  if (value === undefined) {
    return { i, parsed: { action: "error", message: "--compare requires a path" } }
  }
  flags.compare = value
  return { i: i + 1 }
}

function takeFlag(args: string[], i: number, arg: string, flags: FlagState): { i: number; parsed?: Parsed } {
  if (arg === "--verbose") {
    flags.verbose = true
    return { i }
  }
  if (arg === "--json") {
    flags.json = true
    return { i }
  }
  if (arg === "--write-baseline") {
    flags.writeBaseline = true
    return { i }
  }
  if (arg === "--compare") return takeCompare(args, i, flags)
  return { i, parsed: { action: "error", message: `Unknown option: ${arg}` } }
}

function takeArg(args: string[], i: number, arg: string, flags: FlagState): { i: number; parsed?: Parsed } {
  if (arg.startsWith("-")) return takeFlag(args, i, arg, flags)
  flags.pathFragments.push(arg)
  return { i }
}

function consumeArgs(args: string[]): Parsed {
  const flags: FlagState = {
    pathFragments: [],
    verbose: false,
    json: false,
    writeBaseline: false,
    compare: undefined,
  }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === undefined) break
    const next = takeArg(args, i, arg, flags)
    if (next.parsed) return next.parsed
    i = next.i
  }
  return { action: "analyze", ...flags }
}

function parseArgs(args: string[]): Parsed {
  if (args.includes("--help") || args.includes("-h")) return { action: "help" }
  return consumeArgs(args)
}

function baselineOutputPath(fragments: string[]): string {
  const namePart = fragments
    .join("_")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+/, "")
    .replace(/_+$/, "")
  return `target/scrap/${namePart.length > 0 ? namePart : "spec"}.json`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isNumber(value: unknown): value is number {
  return typeof value === "number"
}

function hasSummaryNumbers(value: Record<string, unknown>): boolean {
  for (const key of SUMMARY_NUMBERS) {
    if (!isNumber(value[key])) return false
  }
  return true
}

function isSummary(value: unknown): value is Summary {
  return isRecord(value) && hasSummaryNumbers(value)
}

function stringPaths(paths: unknown): string[] {
  return Array.isArray(paths) ? paths.filter((p) => typeof p === "string") : []
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((e) => typeof e === "string") : []
}

function parseBaselineEntry(item: unknown): BaselineDocument["reports"][number] {
  if (!isRecord(item) || typeof item.path !== "string" || !isSummary(item.summary)) {
    throw new Error("invalid baseline JSON")
  }
  return {
    path: item.path,
    summary: item.summary,
    structureErrors: stringList(item.structureErrors),
    parseError: typeof item.parseError === "string" ? item.parseError : undefined,
  }
}

function parseBaselineReports(items: unknown[]): BaselineDocument["reports"] {
  const reports: BaselineDocument["reports"] = []
  for (const item of items) reports.push(parseBaselineEntry(item))
  return reports
}

function parseBaseline(raw: unknown): BaselineDocument {
  if (!isRecord(raw) || raw.baselineVersion !== 1 || !Array.isArray(raw.reports)) {
    throw new Error("invalid baseline JSON")
  }
  return {
    baselineVersion: 1,
    paths: stringPaths(raw.paths),
    reports: parseBaselineReports(raw.reports),
  }
}

function loadBaseline(text: string): BaselineDocument {
  return parseBaseline(JSON.parse(text))
}

function stubFromBaseline(entry: BaselineDocument["reports"][number]): FileReport {
  return {
    path: entry.path,
    examples: [],
    summary: entry.summary,
    blocks: [],
    structureErrors: entry.structureErrors,
    parseError: entry.parseError,
    moduleMocks: 0,
    comparison: undefined,
  }
}

async function scoreOne(cwd: string, file: string): Promise<FileReport> {
  const sourceText = await readFile(join(cwd, file), "utf8")
  const collected = collectExamples(file, sourceText)
  return scoreFile({
    path: file,
    examples: collected.examples,
    moduleMocks: collected.moduleMocks,
    structureErrors: collected.structureErrors,
    parseError: collected.parseError,
  })
}

async function scoreFiles(cwd: string, fragments: string[]): Promise<FileReport[]> {
  const files = await findTestFiles(cwd, fragments)
  const reports: FileReport[] = []
  for (const file of files) reports.push(await scoreOne(cwd, file))
  return reports
}

async function attachComparison(cwd: string, comparePath: string, reports: FileReport[]): Promise<void> {
  const baseline = loadBaseline(await readFile(join(cwd, comparePath), "utf8"))
  const byPath = new Map(baseline.reports.map((r) => [r.path, r]))
  for (const report of reports) {
    const prior = byPath.get(report.path)
    if (prior) report.comparison = compareReports(stubFromBaseline(prior), report)
  }
}

async function writeBaselineFile(cwd: string, fragments: string[], reports: FileReport[]): Promise<string> {
  const baselinePath = baselineOutputPath(fragments)
  const out = join(cwd, baselinePath)
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, JSON.stringify(toBaseline(fragments, reports)))
  return `\nBaseline written: ${baselinePath}`
}

function renderStdout(parsed: Analyze, reports: FileReport[]): string {
  return parsed.json
    ? renderJson(parsed.pathFragments, reports)
    : formatReport(reports, { verbose: parsed.verbose })
}

async function emit(cwd: string, parsed: Analyze, reports: FileReport[]): Promise<string> {
  let stdout = renderStdout(parsed, reports)
  if (parsed.writeBaseline) stdout += await writeBaselineFile(cwd, parsed.pathFragments, reports)
  return stdout
}

function hasFileErrors(report: FileReport): boolean {
  return report.structureErrors.length > 0 || report.parseError !== undefined
}

function failMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function analyze(parsed: Analyze, cwd: string): Promise<CliResult> {
  try {
    const reports = await scoreFiles(cwd, parsed.pathFragments)
    if (parsed.compare !== undefined) await attachComparison(cwd, parsed.compare, reports)
    const stdout = await emit(cwd, parsed, reports)
    return { exitCode: reports.some(hasFileErrors) ? 1 : 0, stdout }
  } catch (error) {
    return { exitCode: 1, stdout: `${failMessage(error)}\n` }
  }
}

export async function run(args: string[], deps: CliDeps = {}): Promise<CliResult> {
  const parsed = parseArgs(args)
  if (parsed.action === "help") return { exitCode: 0, stdout: helpText }
  if (parsed.action === "error") return { exitCode: 1, stdout: `${parsed.message}\n\n${helpText}` }
  return analyze(parsed, deps.cwd ?? process.cwd())
}
