import type { Action, BlockReport, Comparison, FileReport, ScoredExample, Summary } from "./score.js"

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function fmt1(n: number): string {
  return round1(n).toFixed(1)
}

function fmt2(n: number): string {
  return n.toFixed(2)
}

function formatSmells(smells: string[]): string {
  return smells.length > 0 ? smells.join(", ") : "none"
}

function formatLineRange(example: { line: number; endLine: number }): string {
  return example.line === example.endLine ? `line ${example.line}` : `lines ${example.line}-${example.endLine}`
}

function pathLabel(parts: string[]): string {
  return parts.join(" / ")
}

function whySection(summary: Summary): string {
  const lines = [
    ["avg-scrap", fmt1(summary.avgScrap)],
    ["max-scrap", String(summary.maxScrap)],
    ["recommended-extraction-count", String(summary.recommendedExtractionCount)],
    ["extraction-pressure-score", fmt1(summary.extractionPressureScore)],
    ["harmful-duplication-score", String(summary.harmfulDuplicationScore)],
    ["effective-duplication-score", String(summary.effectiveDuplicationScore)],
    ["coverage-matrix-candidates", String(summary.coverageMatrixCandidates)],
    ["case-matrix-repetition", String(summary.caseMatrixRepetition)],
    ["subject-repetition-score", String(summary.subjectRepetitionScore)],
    ["helper-hidden-example-count", String(summary.helperHiddenExampleCount)],
    ["low-assertion-ratio", fmt2(ratio(summary.lowAssertionExamples, summary.exampleCount))],
    ["branching-ratio", fmt2(ratio(summary.branchingExamples, summary.exampleCount))],
    ["mocking-ratio", fmt2(ratio(summary.mockingExamples, summary.exampleCount))],
  ]
  return `  why:\n${lines.map(([k, v]) => `    ${k}: ${v}`).join("\n")}\n`
}

function ratio(n: number, d: number): number {
  return d > 0 ? n / d : 0
}

function comparisonSection(comparison: Comparison | undefined): string {
  if (!comparison) return ""
  const lines = [
    `  comparison:`,
    `    verdict: ${comparison.verdict}`,
    `    file-score-delta: ${fmt1(comparison.fileScoreDelta)}`,
    `    avg-scrap-delta: ${fmt1(comparison.avgScrapDelta)}`,
    `    max-scrap-delta: ${comparison.maxScrapDelta}`,
    `    harmful-duplication-delta: ${comparison.harmfulDuplicationDelta}`,
    `    case-matrix-delta: ${comparison.caseMatrixDelta}`,
    `    helper-hidden-delta: ${comparison.helperHiddenDelta}`,
  ]
  if (comparison.verdict === "worse") {
    lines.push("    recommendation: Refactor appears negative; consider reverting or simplifying helper extraction.")
  }
  return `${lines.join("\n")}\n`
}

function whereSection(blocks: BlockReport[]): string {
  const top = [...blocks]
    .sort((a, b) => b.summary.fileScore - a.summary.fileScore)
    .slice(0, 3)
  if (top.length === 0) return ""
  const lines = top.map((block) => {
    const worst = block.worstExample
    return `    ${pathLabel(block.path)} -> ${block.summary.fileLevel}, avg-scrap ${fmt1(block.summary.avgScrap)}, harmful duplication ${block.summary.harmfulDuplicationScore}, worst ${worst.name} (SCRAP ${fmt1(worst.scrap)})`
  })
  return `  where:\n${lines.join("\n")}\n`
}

function worstSection(examples: ScoredExample[]): string {
  const top = [...examples].sort((a, b) => b.scrap - a.scrap).slice(0, 5)
  if (top.length === 0) return ""
  const lines = top.map((example) => {
    const smells = example.smells.length > 0 ? ` [${formatSmells(example.smells)}]` : ""
    return `    ${pathLabel([...example.describePath, example.name])} -> SCRAP ${fmt1(example.scrap)}${smells}`
  })
  return `  worst-examples:\n${lines.join("\n")}\n`
}

function extractionsSection(summary: Summary): string {
  if (summary.recommendedExtractions.length === 0) return ""
  const lines = summary.recommendedExtractions.slice(0, 5).map((ex) => {
    return `    ${ex.itNames.join(", ")} -> ${ex.examples.map(formatLineRange).join("; ")}, benefit ${fmt1(ex.netBenefit)}, F ${ex.sharedForms}, V ${ex.variablePoints}`
  })
  return `  recommended-extractions:\n${lines.join("\n")}\n`
}

function howSection(actions: Action[]): string {
  if (actions.length === 0) return ""
  return `  how:\n${actions.map((a) => `    ${a.label}: ${a.text}`).join("\n")}\n`
}

function renderGuidance(file: FileReport): string {
  const s = file.summary
  const refactorPressure =
    s.fileLevel === "STABLE" ? "STABLE" : `${s.fileLevel} (${fmt1(s.fileScore)})`
  return [
    file.path,
    `  refactor-pressure: ${refactorPressure}`,
    `  remediation-mode: ${s.remediation}`,
    `  ai-actionability: ${s.actionability}`,
    `  ai-guidance: ${s.actionabilityMessage}`,
    whySection(s).trimEnd(),
    comparisonSection(file.comparison).trimEnd(),
    whereSection(file.blocks).trimEnd(),
    worstSection(file.examples).trimEnd(),
    extractionsSection(s).trimEnd(),
    howSection(s.actions).trimEnd(),
  ]
    .filter((line) => line.length > 0)
    .join("\n")
}

function verboseSummary(summary: Summary): string {
  const n = summary.exampleCount
  const lines = [
    ["avg-scrap", fmt1(summary.avgScrap)],
    ["max-scrap", fmt1(summary.maxScrap)],
    ["branching-examples", `${summary.branchingExamples}/${n}`],
    ["low-assertion-examples", `${summary.lowAssertionExamples}/${n}`],
    ["zero-assertion-examples", `${summary.zeroAssertionExamples}/${n}`],
    ["mocking-examples", `${summary.mockingExamples}/${n}`],
    ["recommended-extraction-count", String(summary.recommendedExtractionCount)],
    ["extraction-pressure-score", fmt1(summary.extractionPressureScore)],
    ["duplication-score", String(summary.duplicationScore)],
    ["harmful-duplication-score", String(summary.harmfulDuplicationScore)],
    ["effective-duplication-score", String(summary.effectiveDuplicationScore)],
    ["coverage-matrix-candidates", String(summary.coverageMatrixCandidates)],
    ["case-matrix-repetition", String(summary.caseMatrixRepetition)],
    ["subject-repetition-score", String(summary.subjectRepetitionScore)],
    ["helper-hidden-example-count", String(summary.helperHiddenExampleCount)],
    ["setup-duplication-score", String(summary.setupDuplicationScore)],
    ["assertion-duplication-score", String(summary.assertionDuplicationScore)],
    ["fixture-duplication-score", String(summary.fixtureDuplicationScore)],
    ["literal-duplication-score", String(summary.literalDuplicationScore)],
    ["arrange-duplication-score", String(summary.arrangeDuplicationScore)],
    ["avg-setup-similarity", fmt2(summary.avgSetupSimilarity)],
    ["avg-assert-similarity", fmt2(summary.avgAssertSimilarity)],
    ["avg-arrange-similarity", fmt2(summary.avgArrangeSimilarity)],
  ]
  return lines.map(([k, v]) => `  ${k}: ${v}`).join("\n") + "\n"
}

function verboseBlocks(blocks: BlockReport[]): string {
  if (blocks.length === 0) return ""
  const body = blocks.map((block) => {
    const s = block.summary
    const worst = block.worstExample
    return [
      `    ${pathLabel(block.path)}`,
      `      examples: ${s.exampleCount}`,
      `      avg-scrap: ${fmt1(s.avgScrap)}`,
      `      max-scrap: ${fmt1(s.maxScrap)}`,
      `      recommended-extraction-count: ${s.recommendedExtractionCount}`,
      `      extraction-pressure-score: ${fmt1(s.extractionPressureScore)}`,
      `      harmful-duplication-score: ${s.harmfulDuplicationScore}`,
      `      coverage-matrix-candidates: ${s.coverageMatrixCandidates}`,
      `      case-matrix-repetition: ${s.caseMatrixRepetition}`,
      `      worst-example: ${worst.name} (SCRAP ${fmt1(worst.scrap)})`,
    ].join("\n")
  })
  return `\n  blocks:\n${body.join("\n")}`
}

function verboseExamples(examples: ScoredExample[]): string {
  const top = [...examples].sort((a, b) => b.scrap - a.scrap).slice(0, 5)
  if (top.length === 0) return ""
  const body = top.map((example) =>
    [
      `    ${pathLabel([...example.describePath, example.name])}`,
      `      SCRAP: ${fmt1(example.scrap)}`,
      `      complexity: ${example.complexity}`,
      `      complexity-score: ${fmt1(example.complexityScore)}`,
      `      lines: ${example.lineCount}`,
      `      raw-lines: ${example.rawLineCount}`,
      `      assertions: ${example.assertions}`,
      `      branches: ${example.branches + example.tableBranches}`,
      `      setup-depth: ${example.setupDepth}`,
      `      mocking: ${example.mocking}`,
      `      helper-calls: ${example.helperCalls}`,
      `      helper-hidden-lines: ${example.helperHiddenLines}`,
      `      table-driven: ${example.tableDriven ? "yes" : "no"}`,
      `      smells: ${formatSmells(example.smells)}`,
    ].join("\n"),
  )
  return `\n${body.join("\n")}`
}

function renderVerbose(file: FileReport): string {
  const errors =
    file.structureErrors.length > 0
      ? `  structure-errors:\n${file.structureErrors.map((e) => `    ${e}`).join("\n")}\n`
      : ""
  const parse = file.parseError ? `  parse-error: ${file.parseError}\n` : ""
  return `${file.path}\n${errors}${parse}${comparisonSection(file.comparison)}${verboseSummary(file.summary)}${extractionsSection(file.summary)}${verboseBlocks(file.blocks)}${verboseExamples(file.examples)}`
}

export function formatReport(files: FileReport[], options: { verbose: boolean }): string {
  const body = files.map((file) => (options.verbose ? renderVerbose(file) : renderGuidance(file)))
  const worst = files
    .flatMap((file) => file.examples.map((example) => ({ file: file.path, example })))
    .sort((a, b) => b.example.scrap - a.example.scrap)
    .slice(0, 10)
  const worstBlock =
    worst.length === 0
      ? ""
      : `\n\nWorst Examples:\n${worst
          .map(
            (row, i) =>
              `  ${i + 1}. ${row.file} :: ${pathLabel([...row.example.describePath, row.example.name])}  SCRAP ${fmt1(row.example.scrap)}`,
          )
          .join("\n")}`
  return `=== SCRAP Report ===\n\n${body.join("\n\n")}${worstBlock}\n`
}

export type BaselineDocument = {
  baselineVersion: 1
  paths: string[]
  reports: {
    path: string
    summary: Summary
    structureErrors: string[]
    parseError: string | undefined
  }[]
}

export function toBaseline(paths: string[], files: FileReport[]): BaselineDocument {
  return {
    baselineVersion: 1,
    paths,
    reports: files.map((file) => ({
      path: file.path,
      summary: file.summary,
      structureErrors: file.structureErrors,
      parseError: file.parseError,
    })),
  }
}

export function renderJson(paths: string[], files: FileReport[]): string {
  return JSON.stringify(toBaseline(paths, files))
}
