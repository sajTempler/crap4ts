import { spawn } from "node:child_process"
import { mkdir, readFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { formatReport, score, sortByCrap, type CrapEntry } from "./crap.js"
import { coverageForRange, loadLcov, type LcovData } from "./coverage.js"
import { findSourceFiles } from "./discover.js"
import { oxcParser } from "./oxc-adapter.js"
import type { ParserAdapter, ScoringUnit } from "./parser.js"

export type CliResult = {
  exitCode: number
  stdout: string
}

export type CliDeps = {
  cwd?: string
  parser?: ParserAdapter
  runCoverage?: (command: string, cwd: string) => Promise<number>
}

const LCOV_PATH = "target/coverage/lcov.info"
const DEFAULT_COVERAGE_COMMAND =
  "vitest run --coverage --coverage.reporter=lcov --coverage.reportsDirectory=target/coverage"

const helpText = `Usage: crap4ts [path-fragment ...] [--coverage-command <cmd>]

Wipes target/coverage, runs coverage, computes CRAP scores, and prints a report sorted worst first.

Options:
  -h, --help                 Print this help message and exit.
  --coverage-command <cmd>   Run <cmd> to generate coverage instead of
                             "vitest run --coverage --coverage.reporter=lcov --coverage.reportsDirectory=target/coverage".
                             {lcov} becomes target/coverage/lcov.info when present; flags are not appended.

Arguments:
  path-fragment    Optional source path substring. When present, only matching
                   .ts / .tsx / .mts / .cts files are analyzed.
`

type Parsed =
  | { action: "help" }
  | { action: "error"; message: string }
  | { action: "analyze"; pathFragments: string[]; coverageCommand: string | undefined }

type Analyze = Extract<Parsed, { action: "analyze" }>

type FlagState = {
  pathFragments: string[]
  coverageCommand: string | undefined
}

type Take = { i: number; parsed?: Parsed }

function takeCoverageCommand(args: string[], i: number, flags: FlagState): Take {
  const value = args[i + 1]
  if (value === undefined) {
    return { i, parsed: { action: "error", message: "--coverage-command requires a command" } }
  }
  flags.coverageCommand = value
  return { i: i + 1 }
}

function takeFlag(args: string[], i: number, arg: string, flags: FlagState): Take {
  if (arg === "--coverage-command") return takeCoverageCommand(args, i, flags)
  return { i, parsed: { action: "error", message: `Unknown option: ${arg}` } }
}

function takeArg(args: string[], i: number, arg: string, flags: FlagState): Take {
  if (arg.startsWith("-")) return takeFlag(args, i, arg, flags)
  flags.pathFragments.push(arg)
  return { i }
}

function consumeArgs(args: string[]): Parsed {
  const flags: FlagState = { pathFragments: [], coverageCommand: undefined }
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

function resolveCoverageCommand(custom: string | undefined): string {
  if (custom === undefined) return DEFAULT_COVERAGE_COMMAND
  return custom.replaceAll("{lcov}", LCOV_PATH)
}

function spawnCoverage(command: string, cwd: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { cwd, shell: true, stdio: "inherit" })
    child.on("error", reject)
    child.on("close", (code) => resolve(code ?? 1))
  })
}

function failMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function entryFor(unit: ScoringUnit, lcov: LcovData | undefined): CrapEntry {
  const coverage = coverageForRange(lcov, unit.file, unit.startLine, unit.endLine)
  return {
    name: unit.name,
    file: unit.file,
    complexity: unit.complexity,
    coverage,
    crap: score(unit.complexity, coverage),
  }
}

async function collectEntries(
  cwd: string,
  files: string[],
  parser: ParserAdapter,
  lcov: LcovData | undefined,
): Promise<CrapEntry[]> {
  const entries: CrapEntry[] = []
  for (const file of files) {
    const sourceText = await readFile(join(cwd, file), "utf8")
    for (const unit of parser.scoringUnits(file, sourceText)) {
      entries.push(entryFor(unit, lcov))
    }
  }
  return entries
}

async function analyze(parsed: Analyze, deps: CliDeps): Promise<CliResult> {
  const cwd = deps.cwd ?? process.cwd()
  const parser = deps.parser ?? oxcParser
  const runCoverage = deps.runCoverage ?? spawnCoverage
  const coverageDir = join(cwd, "target/coverage")
  await rm(coverageDir, { recursive: true, force: true })
  await mkdir(coverageDir, { recursive: true })
  const code = await runCoverage(resolveCoverageCommand(parsed.coverageCommand), cwd)
  if (code !== 0) {
    return { exitCode: 1, stdout: `coverage command failed with exit code ${code}\n` }
  }
  const lcov = await loadLcov(join(cwd, LCOV_PATH))
  const files = await findSourceFiles(cwd, parsed.pathFragments)
  const entries = await collectEntries(cwd, files, parser, lcov)
  return { exitCode: 0, stdout: formatReport(sortByCrap(entries)) }
}

export async function run(args: string[], deps: CliDeps = {}): Promise<CliResult> {
  const parsed = parseArgs(args)
  if (parsed.action === "help") return { exitCode: 0, stdout: helpText }
  if (parsed.action === "error") return { exitCode: 1, stdout: `${parsed.message}\n\n${helpText}` }
  try {
    return await analyze(parsed, deps)
  } catch (error) {
    return { exitCode: 1, stdout: `${failMessage(error)}\n` }
  }
}
