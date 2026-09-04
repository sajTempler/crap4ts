export type CollectedExample = {
  name: string
  describePath: string[]
  line: number
  endLine: number
  rawLineCount: number
  assertions: number
  branches: number
  tableBranches: number
  setupDepth: number
  mocking: number
  helperCalls: number
  helperHiddenLines: number
  tempResources: number
  largeLiterals: number
  tableDriven: boolean
  phases: number
  subjectSymbols: ReadonlySet<string>
  assertFeatures: ReadonlySet<string>
  setupFeatures: ReadonlySet<string>
  fixtureFeatures: ReadonlySet<string>
  arrangeFeatures: ReadonlySet<string>
  literalFeatures: ReadonlySet<string>
  assertSignatures: string[]
  setupSignatures: string[]
  arrangeSignatures: string[]
  literalSignatures: string[]
}

export type ScoredExample = CollectedExample & {
  lineCount: number
  apiContract: boolean
  complexity: number
  complexityScore: number
  scrap: number
  smells: string[]
}

export type Extraction = {
  itNames: string[]
  examples: { name: string; describePath: string[]; line: number; endLine: number }[]
  netBenefit: number
  sharedForms: number
  variablePoints: number
  lineStart: number
  lineEnd: number
}

export type Summary = {
  exampleCount: number
  avgScrap: number
  maxScrap: number
  branchingExamples: number
  lowAssertionExamples: number
  zeroAssertionExamples: number
  mockingExamples: number
  helperHiddenExampleCount: number
  tableDrivenExamples: number
  coverageMatrixCandidates: number
  caseMatrixRepetition: number
  setupDuplicationScore: number
  assertionDuplicationScore: number
  fixtureDuplicationScore: number
  literalDuplicationScore: number
  arrangeDuplicationScore: number
  subjectRepetitionScore: number
  setupShapeDiversity: number
  assertShapeDiversity: number
  literalShapeDiversity: number
  arrangeShapeDiversity: number
  avgSetupSimilarity: number
  avgAssertSimilarity: number
  avgFixtureSimilarity: number
  avgLiteralSimilarity: number
  avgArrangeSimilarity: number
  avgSubjectSimilarity: number
  duplicationScore: number
  harmfulDuplicationScore: number
  effectiveDuplicationScore: number
  recommendedExtractionCount: number
  extractionPressureScore: number
  recommendedExtractions: Extraction[]
  fileScore: number
  fileLevel: PressureLevel
  remediation: Remediation
  actionability: Actionability
  actionabilityMessage: string
  actions: Action[]
}

export type PressureLevel = "STABLE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
export type Remediation = "STABLE" | "LOCAL" | "SPLIT"
export type Actionability =
  | "LEAVE_ALONE"
  | "AUTO_TABLE_DRIVE"
  | "AUTO_REFACTOR"
  | "MANUAL_SPLIT"
  | "REVIEW_FIRST"

export type Action = {
  confidence: number
  label: "HIGH" | "MEDIUM" | "LOW"
  text: string
}

export type BlockReport = {
  path: string[]
  summary: Summary
  worstExample: ScoredExample
}

export type Comparison = {
  verdict: "improved" | "worse" | "mixed" | "unchanged"
  fileScoreDelta: number
  avgScrapDelta: number
  maxScrapDelta: number
  harmfulDuplicationDelta: number
  extractionPressureDelta: number
  caseMatrixDelta: number
  helperHiddenDelta: number
}

export type FileReport = {
  path: string
  examples: ScoredExample[]
  summary: Summary
  blocks: BlockReport[]
  structureErrors: string[]
  parseError: string | undefined
  moduleMocks: number
  comparison: Comparison | undefined
}

type SummaryMetrics = Omit<
  Summary,
  | "fileScore"
  | "fileLevel"
  | "remediation"
  | "actionability"
  | "actionabilityMessage"
  | "actions"
>

type Smell = { label: string; penalty: number }

const COMPLEXITY = { cap: 25, riseRate: 0.18, floor: 1 }
const DUPLICATION = {
  threshold: 0.5,
  matrixMaxScrap: 18,
  matrixMaxLines: 12,
  matrixMaxAssertions: 1,
  matrixMaxBranches: 0,
  matrixMaxSetupDepth: 2,
  matrixMaxMocking: 0,
  matrixMaxTempResources: 0,
  matrixMaxHelperHiddenLines: 0,
  matrixMaxSubjectSymbols: 2,
}
const PRESSURE = {
  sizeFactors: [
    { upTo: 1, factor: 0.25 },
    { upTo: 2, factor: 0.4 },
    { upTo: 4, factor: 0.65 },
    { upTo: undefined, factor: 1 },
  ],
  weights: {
    avgScrap: 1.2,
    maxScrap: 0.6,
    effectiveDuplication: 0.8,
    lowAssertionRatio: 20,
    branchingRatio: 15,
    mockingRatio: 15,
    helperHiddenRatio: 12,
  },
  matrixCredit: 1.5,
  levels: { critical: 55, high: 35, medium: 18 },
  split: {
    avgScrap: 10,
    effectiveDuplication: 20,
    subjectRepetition: 12,
    exampleCount: 12,
    highPressureBlocks: 2,
    maxScrap: 35,
  },
}
const ACTIONABILITY = {
  matrix: {
    minCaseMatrixRepetition: 2,
    effectiveDuplicationDivisor: 3,
    maxScrap: 12,
    maxBranchingRatio: 0.15,
    maxMockingRatio: 0.2,
  },
  local: {
    lowAssertionRatio: 0.4,
    maxBranchingRatio: 0.3,
    maxMockingRatio: 0.35,
    maxScrap: 20,
    avgScrap: 12,
  },
  maxActions: 4,
}

export function saturatingComplexityScore(complexity: number): number {
  if (complexity <= 1) return COMPLEXITY.floor
  return (
    COMPLEXITY.floor +
    (COMPLEXITY.cap - COMPLEXITY.floor) * (1 - Math.exp(-COMPLEXITY.riseRate * (complexity - 1)))
  )
}

function assertionContract(example: CollectedExample): boolean {
  return (
    example.assertions <= 2 &&
    example.branches + example.tableBranches <= 4 &&
    example.tableBranches <= 1 &&
    example.mocking <= 0
  )
}

function helperContract(example: CollectedExample): boolean {
  return (
    example.helperCalls <= 1 &&
    example.helperHiddenLines <= 0 &&
    example.tempResources <= 0 &&
    example.largeLiterals <= 0
  )
}

function shapeContract(example: CollectedExample, lineCount: number): boolean {
  return example.subjectSymbols.size <= 4 && example.phases <= 1 && lineCount <= 18
}

function apiContract(example: CollectedExample, lineCount: number): boolean {
  return assertionContract(example) && helperContract(example) && shapeContract(example, lineCount)
}

function scoredSetupDepth(example: CollectedExample, isApiContract: boolean): number {
  return isApiContract ? Math.max(0, example.setupDepth - 2) : example.setupDepth
}

function scoredBranchPenalty(
  example: CollectedExample,
  tableDriven: boolean,
  isApiContract: boolean,
): number {
  const penalty = tableDriven ? example.tableBranches : example.branches + example.tableBranches
  return isApiContract ? Math.max(0, penalty - 2) : penalty
}

function noAssertionSmell(example: CollectedExample): Smell | undefined {
  if (example.assertions !== 0) return undefined
  return { label: "no-assertions", penalty: 10 }
}

function lowAssertionSmell(
  example: CollectedExample,
  lineCount: number,
  isApiContract: boolean,
): Smell | undefined {
  if (example.assertions !== 1) return undefined
  if (lineCount <= 10 || example.tableDriven || isApiContract) return undefined
  return { label: "low-assertion-density", penalty: 6 }
}

function multiplePhaseSmell(example: CollectedExample): Smell | undefined {
  if (example.phases <= 1) return undefined
  return { label: "multiple-phases", penalty: 5 }
}

function highMockingSmell(example: CollectedExample): Smell | undefined {
  if (example.mocking <= 3) return undefined
  return { label: "high-mocking", penalty: 4 }
}

function largeExampleSmell(
  example: CollectedExample,
  lineCount: number,
  isApiContract: boolean,
): Smell | undefined {
  if (lineCount <= 20 || isApiContract) return undefined
  return { label: "large-example", penalty: 4 }
}

function tempResourceSmell(example: CollectedExample): Smell | undefined {
  if (example.tempResources <= 0) return undefined
  return { label: "temp-resource-work", penalty: 3 }
}

function literalHeavySmell(example: CollectedExample): Smell | undefined {
  if (example.largeLiterals <= 0) return undefined
  return { label: "literal-heavy-setup", penalty: 3 }
}

function helperHiddenSmell(example: CollectedExample): Smell | undefined {
  if (example.helperHiddenLines <= 8) return undefined
  return { label: "helper-hidden-complexity", penalty: 4 }
}

function defined<T>(value: T | undefined): value is T {
  return value !== undefined
}

function smellEntries(
  example: CollectedExample,
  lineCount: number,
  isApiContract: boolean,
): Smell[] {
  return [
    noAssertionSmell(example),
    lowAssertionSmell(example, lineCount, isApiContract),
    multiplePhaseSmell(example),
    highMockingSmell(example),
    largeExampleSmell(example, lineCount, isApiContract),
    tempResourceSmell(example),
    literalHeavySmell(example),
    helperHiddenSmell(example),
  ].filter(defined)
}

export function scoreExample(example: CollectedExample): ScoredExample {
  const lineCount = example.rawLineCount + example.helperHiddenLines
  const isApiContract = apiContract(example, lineCount)
  const setup = scoredSetupDepth(example, isApiContract)
  const complexity =
    1 + example.branches + setup + example.helperCalls + Math.floor(example.helperHiddenLines / 8)
  const smells = smellEntries(example, lineCount, isApiContract)
  const branchPenalty = scoredBranchPenalty(example, example.tableDriven, isApiContract)
  const complexityScore = saturatingComplexityScore(
    1 + branchPenalty + setup + example.helperCalls,
  )
  const scrap = complexityScore + smells.reduce((sum, s) => sum + s.penalty, 0)
  return {
    ...example,
    lineCount,
    apiContract: isApiContract,
    complexity,
    complexityScore,
    scrap,
    smells: smells.map((s) => s.label),
  }
}

function bothEmpty(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === 0 && b.size === 0
}

function intersectionSize(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let n = 0
  for (const item of a) if (b.has(item)) n++
  return n
}

function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (bothEmpty(a, b)) return 0
  const intersection = intersectionSize(a, b)
  const union = a.size + b.size - intersection
  if (union === 0) return 0
  return intersection / union
}

function similarCount(
  examples: ScoredExample[],
  features: (example: ScoredExample) => ReadonlySet<string>,
): number {
  return examples.filter((example) => {
    const mine = features(example)
    if (mine.size === 0) return false
    return examples.some((other) => other !== example && jaccard(mine, features(other)) >= DUPLICATION.threshold)
  }).length
}

function pushPairSimilarity(
  pairs: number[],
  examples: ScoredExample[],
  i: number,
  left: ScoredExample,
  features: (example: ScoredExample) => ReadonlySet<string>,
): void {
  for (let j = i + 1; j < examples.length; j++) {
    const right = examples[j]
    if (!right) continue
    pairs.push(jaccard(features(left), features(right)))
  }
}

function pairSimilarities(
  examples: ScoredExample[],
  features: (example: ScoredExample) => ReadonlySet<string>,
): number[] {
  const pairs: number[] = []
  for (let i = 0; i < examples.length; i++) {
    const left = examples[i]
    if (!left) continue
    pushPairSimilarity(pairs, examples, i, left, features)
  }
  return pairs
}

function averageSimilarity(
  examples: ScoredExample[],
  features: (example: ScoredExample) => ReadonlySet<string>,
): number {
  const pairs = pairSimilarities(examples, features)
  if (pairs.length === 0) return 0
  return pairs.reduce((sum, n) => sum + n, 0) / pairs.length
}

function distinctShapes(
  examples: ScoredExample[],
  signatures: (example: ScoredExample) => string[],
): number {
  return new Set(examples.flatMap(signatures).filter((s) => s.length > 0)).size
}

function harmfulFeatures(example: ScoredExample): Set<string> {
  return new Set([
    ...example.setupFeatures,
    ...example.assertFeatures,
    ...example.fixtureFeatures,
    ...example.arrangeFeatures,
  ])
}

function matrixShapeOk(example: ScoredExample): boolean {
  if (example.tableDriven) return true
  return (
    example.subjectSymbols.size <= DUPLICATION.matrixMaxSubjectSymbols &&
    (example.assertFeatures.size > 0 || example.arrangeFeatures.size > 0)
  )
}

function matrixSizeOk(example: ScoredExample): boolean {
  const d = DUPLICATION
  return (
    example.scrap <= d.matrixMaxScrap &&
    example.lineCount <= d.matrixMaxLines &&
    example.assertions <= d.matrixMaxAssertions &&
    example.branches + example.tableBranches <= d.matrixMaxBranches
  )
}

function matrixNoiseOk(example: ScoredExample): boolean {
  const d = DUPLICATION
  return (
    example.setupDepth <= d.matrixMaxSetupDepth &&
    example.mocking <= d.matrixMaxMocking &&
    example.tempResources <= d.matrixMaxTempResources &&
    example.helperHiddenLines <= d.matrixMaxHelperHiddenLines
  )
}

function coverageMatrixCandidate(example: ScoredExample): boolean {
  return matrixSizeOk(example) && matrixNoiseOk(example) && matrixShapeOk(example)
}

function similarToAny(
  example: ScoredExample,
  examples: ScoredExample[],
  features: (example: ScoredExample) => ReadonlySet<string>,
): boolean {
  const mine = features(example)
  if (mine.size === 0) return false
  return examples.some((other) => other !== example && jaccard(mine, features(other)) >= DUPLICATION.threshold)
}

function coverageMatrixCount(examples: ScoredExample[]): number {
  return examples.filter(
    (example) =>
      coverageMatrixCandidate(example) &&
      (similarToAny(example, examples, (e) => e.setupFeatures) ||
        similarToAny(example, examples, (e) => e.arrangeFeatures) ||
        (similarToAny(example, examples, (e) => e.assertFeatures) &&
          similarToAny(example, examples, (e) => e.subjectSymbols))),
  ).length
}

function duplicationCost(sharedForms: number, instanceCount: number, variablePoints: number): number {
  if (sharedForms <= 3) return 0
  if (variablePoints > 4) return 0
  return (Math.max(0, sharedForms - 3) * (Math.max(0, instanceCount - 1) ** 1.5)) / (variablePoints + 1)
}

function linkIfSimilar(
  examples: ScoredExample[],
  adjacency: Set<number>[],
  i: number,
  j: number,
): void {
  const left = examples[i]
  const right = examples[j]
  if (!left || !right) return
  if (jaccard(harmfulFeatures(left), harmfulFeatures(right)) < DUPLICATION.threshold) return
  adjacency[i]?.add(j)
  adjacency[j]?.add(i)
}

function buildAdjacency(examples: ScoredExample[]): Set<number>[] {
  const adjacency: Set<number>[] = examples.map(() => new Set())
  for (let i = 0; i < examples.length; i++) {
    for (let j = i + 1; j < examples.length; j++) linkIfSimilar(examples, adjacency, i, j)
  }
  return adjacency
}

function walkComponent(start: number, adjacency: Set<number>[]): Set<number> {
  const seen = new Set<number>()
  const stack = [start]
  while (stack.length > 0) {
    const idx = stack.pop()
    if (idx === undefined || seen.has(idx)) continue
    seen.add(idx)
    for (const n of adjacency[idx] ?? []) stack.push(n)
  }
  return seen
}

function clusterFromSeen(seen: Set<number>, examples: ScoredExample[]): ScoredExample[] | undefined {
  if (seen.size <= 1) return undefined
  return [...seen]
    .sort((a, b) => a - b)
    .map((i) => examples[i])
    .filter(defined)
}

function takeComponent(
  remaining: Set<number>,
  adjacency: Set<number>[],
  examples: ScoredExample[],
): ScoredExample[] | undefined {
  const start = remaining.values().next().value
  if (start === undefined) return undefined
  const seen = walkComponent(start, adjacency)
  for (const idx of seen) remaining.delete(idx)
  return clusterFromSeen(seen, examples)
}

function connectedClusters(examples: ScoredExample[]): ScoredExample[][] {
  const adjacency = buildAdjacency(examples)
  const remaining = new Set(examples.map((_, i) => i))
  const clusters: ScoredExample[][] = []
  while (remaining.size > 0) {
    const cluster = takeComponent(remaining, adjacency, examples)
    if (cluster) clusters.push(cluster)
  }
  return clusters
}

function extractionFor(cluster: ScoredExample[]): Extraction {
  const featureSets = cluster.map(harmfulFeatures)
  const shared = featureSets.reduce((acc, set) => {
    const next = new Set<string>()
    for (const item of acc) if (set.has(item)) next.add(item)
    return next
  })
  const all = new Set<string>()
  for (const set of featureSets) for (const item of set) all.add(item)
  const sharedForms = shared.size
  const variablePoints = all.size - sharedForms
  const instances = cluster.length
  const duplicationBefore = duplicationCost(sharedForms, instances, variablePoints)
  const helperCost = sharedForms + variablePoints
  const netBenefit = Math.max(0, duplicationBefore - helperCost)
  return {
    itNames: cluster.map((e) => e.name),
    examples: cluster.map((e) => ({
      name: e.name,
      describePath: e.describePath,
      line: e.line,
      endLine: e.endLine,
    })),
    netBenefit,
    sharedForms,
    variablePoints,
    lineStart: Math.min(...cluster.map((e) => e.line)),
    lineEnd: Math.max(...cluster.map((e) => e.endLine)),
  }
}

function summarizeExtractions(examples: ScoredExample[]): {
  recommendedExtractionCount: number
  extractionPressureScore: number
  recommendedExtractions: Extraction[]
} {
  const recommendations = connectedClusters(examples)
    .filter((cluster) => !cluster.every(coverageMatrixCandidate))
    .map(extractionFor)
    .filter((r) => r.netBenefit > 0)
    .sort((a, b) => a.lineStart - b.lineStart || b.netBenefit - a.netBenefit)
  return {
    recommendedExtractionCount: recommendations.length,
    extractionPressureScore: recommendations.reduce((sum, r) => sum + r.netBenefit, 0),
    recommendedExtractions: recommendations,
  }
}

function ratio(n: number, d: number): number {
  return d > 0 ? n / d : 0
}

function summarizeExamples(examples: ScoredExample[], moduleMocks: number): SummaryMetrics {
  const total = examples.length
  const avgScrap = total > 0 ? examples.reduce((sum, e) => sum + e.scrap, 0) / total : 0
  const extraction = summarizeExtractions(examples)
  const setupDup = similarCount(examples, (e) => e.setupFeatures)
  const assertDup = similarCount(examples, (e) => e.assertFeatures)
  const fixtureDup = similarCount(examples, (e) => e.fixtureFeatures)
  const literalDup = similarCount(examples, (e) => e.literalFeatures)
  const arrangeDup = similarCount(examples, (e) => e.arrangeFeatures)
  const coverage = coverageMatrixCount(examples)
  return {
    exampleCount: total,
    avgScrap,
    maxScrap: total > 0 ? Math.max(...examples.map((e) => e.scrap)) : 0,
    branchingExamples: examples.filter((e) => e.branches + e.tableBranches > 0 && !e.tableDriven).length,
    lowAssertionExamples: examples.filter((e) => e.assertions <= 1).length,
    zeroAssertionExamples: examples.filter((e) => e.assertions === 0).length,
    mockingExamples: examples.filter((e) => e.mocking > 0).length + (moduleMocks > 0 ? 1 : 0),
    helperHiddenExampleCount: examples.filter((e) => e.helperHiddenLines > 0).length,
    tableDrivenExamples: examples.filter((e) => e.tableDriven).length,
    coverageMatrixCandidates: coverage,
    caseMatrixRepetition: coverage,
    setupDuplicationScore: setupDup,
    assertionDuplicationScore: assertDup,
    fixtureDuplicationScore: fixtureDup,
    literalDuplicationScore: literalDup,
    arrangeDuplicationScore: arrangeDup,
    subjectRepetitionScore: similarCount(examples, (e) => e.subjectSymbols),
    setupShapeDiversity: distinctShapes(examples, (e) => e.setupSignatures),
    assertShapeDiversity: distinctShapes(examples, (e) => e.assertSignatures),
    literalShapeDiversity: distinctShapes(examples, (e) => e.literalSignatures),
    arrangeShapeDiversity: distinctShapes(examples, (e) => e.arrangeSignatures),
    avgSetupSimilarity: averageSimilarity(examples, (e) => e.setupFeatures),
    avgAssertSimilarity: averageSimilarity(examples, (e) => e.assertFeatures),
    avgFixtureSimilarity: averageSimilarity(examples, (e) => e.fixtureFeatures),
    avgLiteralSimilarity: averageSimilarity(examples, (e) => e.literalFeatures),
    avgArrangeSimilarity: averageSimilarity(examples, (e) => e.arrangeFeatures),
    avgSubjectSimilarity: averageSimilarity(examples, (e) => e.subjectSymbols),
    duplicationScore: setupDup + assertDup + fixtureDup + literalDup + arrangeDup,
    harmfulDuplicationScore: setupDup + assertDup + fixtureDup + arrangeDup,
    effectiveDuplicationScore: extraction.extractionPressureScore,
    ...extraction,
  }
}

function smallStable(summary: SummaryMetrics, n: number): boolean {
  return (
    n <= 2 &&
    summary.maxScrap <= 10 &&
    summary.effectiveDuplicationScore <= 1 &&
    summary.helperHiddenExampleCount === 0 &&
    ratio(summary.zeroAssertionExamples, n) <= 0
  )
}

function generalStable(summary: SummaryMetrics, n: number): boolean {
  return (
    n > 0 &&
    summary.maxScrap <= 12 &&
    summary.effectiveDuplicationScore <= 3 &&
    ratio(summary.zeroAssertionExamples, n) <= 0 &&
    ratio(summary.lowAssertionExamples, n) <= 0.35
  )
}

function stableSummary(summary: SummaryMetrics): boolean {
  const n = summary.exampleCount
  return smallStable(summary, n) || generalStable(summary, n)
}

function sizeFactor(exampleCount: number): number {
  for (const row of PRESSURE.sizeFactors) {
    if (row.upTo === undefined || exampleCount <= row.upTo) return row.factor
  }
  return 1
}

function refactorPressureScore(summary: SummaryMetrics): number {
  const n = summary.exampleCount
  const w = PRESSURE.weights
  const base =
    w.avgScrap * summary.avgScrap +
    w.maxScrap * summary.maxScrap +
    w.effectiveDuplication * summary.effectiveDuplicationScore +
    w.lowAssertionRatio * ratio(summary.lowAssertionExamples, n) +
    w.branchingRatio * ratio(summary.branchingExamples, n) +
    w.mockingRatio * ratio(summary.mockingExamples, n) +
    w.helperHiddenRatio * ratio(summary.helperHiddenExampleCount, n)
  const credit = PRESSURE.matrixCredit * summary.caseMatrixRepetition
  return Math.max(0, sizeFactor(n) * base - credit)
}

function pressureLevel(summary: SummaryMetrics): PressureLevel {
  if (stableSummary(summary)) return "STABLE"
  const score = refactorPressureScore(summary)
  if (score >= PRESSURE.levels.critical) return "CRITICAL"
  if (score >= PRESSURE.levels.high) return "HIGH"
  if (score >= PRESSURE.levels.medium) return "MEDIUM"
  return "LOW"
}

function splitPressure(summary: SummaryMetrics): boolean {
  const s = PRESSURE.split
  return (
    summary.avgScrap >= s.avgScrap ||
    summary.effectiveDuplicationScore >= s.effectiveDuplication ||
    summary.subjectRepetitionScore >= s.subjectRepetition ||
    summary.helperHiddenExampleCount > 0
  )
}

function highPressureBlockCount(blocks: BlockReport[]): number {
  return blocks.filter((b) => {
    const level = pressureLevel(b.summary)
    return level === "HIGH" || level === "CRITICAL"
  }).length
}

function shouldSplit(summary: SummaryMetrics, blocks: BlockReport[]): boolean {
  const s = PRESSURE.split
  if (summary.exampleCount < s.exampleCount) return false
  const hot =
    highPressureBlockCount(blocks) >= s.highPressureBlocks || summary.maxScrap >= s.maxScrap
  return hot && splitPressure(summary)
}

function remediationMode(summary: SummaryMetrics, blocks: BlockReport[]): Remediation {
  if (stableSummary(summary)) return "STABLE"
  if (shouldSplit(summary, blocks)) return "SPLIT"
  return "LOCAL"
}

function mockingRatio(summary: SummaryMetrics): number {
  return ratio(summary.mockingExamples, summary.exampleCount)
}

function matrixHeavy(
  summary: SummaryMetrics,
  branchingRatio: number,
  mockRatio: number,
  maxScrap: number,
): boolean {
  const m = ACTIONABILITY.matrix
  return (
    summary.coverageMatrixCandidates > 0 &&
    summary.caseMatrixRepetition >=
      Math.max(m.minCaseMatrixRepetition, Math.floor(summary.effectiveDuplicationScore / m.effectiveDuplicationDivisor)) &&
    maxScrap <= m.maxScrap &&
    branchingRatio <= m.maxBranchingRatio &&
    mockRatio < m.maxMockingRatio
  )
}

function localNeed(
  summary: SummaryMetrics,
  zeroRatio: number,
  lowRatio: number,
  maxScrap: number,
): boolean {
  const local = ACTIONABILITY.local
  return (
    summary.effectiveDuplicationScore > 0 ||
    zeroRatio > 0 ||
    lowRatio > local.lowAssertionRatio ||
    maxScrap > local.maxScrap
  )
}

function localSafe(
  summary: SummaryMetrics,
  mode: Remediation,
  branchingRatio: number,
  mockRatio: number,
  zeroRatio: number,
  lowRatio: number,
  maxScrap: number,
): boolean {
  const local = ACTIONABILITY.local
  if (mode !== "LOCAL") return false
  if (!localNeed(summary, zeroRatio, lowRatio, maxScrap)) return false
  return branchingRatio <= local.maxBranchingRatio && mockRatio < local.maxMockingRatio
}

function aiActionability(
  summary: SummaryMetrics,
  mode: Remediation,
): { mode: Actionability; message: string } {
  const maxScrap = summary.maxScrap
  const zeroRatio = ratio(summary.zeroAssertionExamples, summary.exampleCount)
  const lowRatio = ratio(summary.lowAssertionExamples, summary.exampleCount)
  const branchingRatio = ratio(summary.branchingExamples, summary.exampleCount)
  const mockRatio = mockingRatio(summary)
  if (mode === "STABLE") {
    return {
      mode: "LEAVE_ALONE",
      message: "Leave this file alone unless explicitly requested; the current structure is stable enough.",
    }
  }
  if (matrixHeavy(summary, branchingRatio, mockRatio, maxScrap)) {
    return {
      mode: "AUTO_TABLE_DRIVE",
      message:
        "Safe to table-drive automatically into test.for; repetition looks like coverage-matrix structure rather than harmful design.",
    }
  }
  if (localSafe(summary, mode, branchingRatio, mockRatio, zeroRatio, lowRatio, maxScrap)) {
    return {
      mode: "AUTO_REFACTOR",
      message:
        "Safe to refactor automatically with local changes; focus on assertions, oversized examples, and duplicated scaffolding.",
    }
  }
  if (mode === "SPLIT") {
    return {
      mode: "MANUAL_SPLIT",
      message: "Do not auto-refactor locally first; split the file by responsibility before smaller cleanup.",
    }
  }
  return {
    mode: "REVIEW_FIRST",
    message: "Do not auto-refactor immediately; inspect the file shape before acting on the recommendations.",
  }
}

function splitAction(mode: Remediation): Action | undefined {
  if (mode !== "SPLIT") return undefined
  return {
    confidence: 3,
    label: "HIGH",
    text: "Split this spec file by responsibility before attempting local cleanup; the structural pressure is spread across multiple hotspots.",
  }
}

function matrixAction(summary: SummaryMetrics): Action | undefined {
  if (summary.coverageMatrixCandidates <= 0) return undefined
  return {
    confidence: 3,
    label: "HIGH",
    text: "Convert repeated low-complexity examples into test.for checks; treat this as coverage-matrix repetition, not harmful duplication.",
  }
}

function assertionAction(summary: SummaryMetrics): Action | undefined {
  const local = ACTIONABILITY.local
  const zeroRatio = ratio(summary.zeroAssertionExamples, summary.exampleCount)
  const lowRatio = ratio(summary.lowAssertionExamples, summary.exampleCount)
  if (zeroRatio <= 0 && lowRatio <= local.lowAssertionRatio) return undefined
  return {
    confidence: 3,
    label: "HIGH",
    text: "Strengthen assertions in weak examples before doing structural cleanup.",
  }
}

function oversizedAction(summary: SummaryMetrics, mode: Remediation): Action | undefined {
  if (mode !== "LOCAL" || summary.maxScrap <= ACTIONABILITY.local.maxScrap) return undefined
  return {
    confidence: 3,
    label: "HIGH",
    text: "Split oversized examples into narrower examples.",
  }
}

function duplicationAction(summary: SummaryMetrics): Action | undefined {
  if (summary.effectiveDuplicationScore <= 0) return undefined
  return {
    confidence: 2,
    label: "MEDIUM",
    text: "Extract shared setup or repeated assertion scaffolding only where harmful duplication is dominating.",
  }
}

function mockingAction(summary: SummaryMetrics): Action | undefined {
  if (mockingRatio(summary) <= ACTIONABILITY.local.maxMockingRatio) return undefined
  return {
    confidence: 2,
    label: "MEDIUM",
    text: "Reduce vi.spyOn / vi.fn and move coverage toward higher-level behaviors.",
  }
}

function branchingAction(summary: SummaryMetrics): Action | undefined {
  const branchingRatio = ratio(summary.branchingExamples, summary.exampleCount)
  if (branchingRatio <= ACTIONABILITY.local.maxBranchingRatio) return undefined
  return {
    confidence: 2,
    label: "MEDIUM",
    text: "Remove logic from specs or keep variation in explicit data tables rather than control flow.",
  }
}

function helperAction(summary: SummaryMetrics): Action | undefined {
  if (summary.helperHiddenExampleCount <= 0) return undefined
  return {
    confidence: 1,
    label: "LOW",
    text: "Be skeptical of helper extraction that only hides setup; helper-hidden complexity should still count as complexity.",
  }
}

function considerSplitAction(summary: SummaryMetrics, mode: Remediation): Action | undefined {
  if (mode !== "LOCAL" || summary.avgScrap <= ACTIONABILITY.local.avgScrap) return undefined
  return {
    confidence: 1,
    label: "LOW",
    text: "Consider splitting this file or block by responsibility.",
  }
}

function byConfidenceThenText(a: Action, b: Action): number {
  return b.confidence - a.confidence || a.text.localeCompare(b.text)
}

function actionRules(summary: SummaryMetrics, mode: Remediation): Action[] {
  if (mode === "STABLE") {
    return [
      {
        confidence: 3,
        label: "HIGH",
        text: "No refactor recommended; the file is structurally stable enough to leave alone.",
      },
    ]
  }
  return [
    splitAction(mode),
    matrixAction(summary),
    assertionAction(summary),
    oversizedAction(summary, mode),
    duplicationAction(summary),
    mockingAction(summary),
    branchingAction(summary),
    helperAction(summary),
    considerSplitAction(summary, mode),
  ]
    .filter(defined)
    .sort(byConfidenceThenText)
    .slice(0, ACTIONABILITY.maxActions)
}

function attachJudgment(partial: SummaryMetrics, blocks: BlockReport[]): Summary {
  const fileScore = refactorPressureScore(partial)
  const fileLevel = pressureLevel(partial)
  const remediation = remediationMode(partial, blocks)
  const actionability = aiActionability(partial, remediation)
  return {
    ...partial,
    fileScore,
    fileLevel,
    remediation,
    actionability: actionability.mode,
    actionabilityMessage: actionability.message,
    actions: actionRules(partial, remediation),
  }
}

function groupByDescribe(examples: ScoredExample[]): Map<string, ScoredExample[]> {
  const groups = new Map<string, ScoredExample[]>()
  for (const example of examples) {
    if (example.describePath.length === 0) continue
    const key = example.describePath.join("\0")
    const list = groups.get(key) ?? []
    list.push(example)
    groups.set(key, list)
  }
  return groups
}

function worstExample(blockExamples: ScoredExample[]): ScoredExample | undefined {
  return [...blockExamples].sort((a, b) => b.scrap - a.scrap)[0]
}

function blockReport(key: string, blockExamples: ScoredExample[]): BlockReport | undefined {
  const worst = worstExample(blockExamples)
  if (!worst) return undefined
  return {
    path: key.split("\0"),
    summary: attachJudgment(summarizeExamples(blockExamples, 0), []),
    worstExample: worst,
  }
}

function byPath(a: BlockReport, b: BlockReport): number {
  return a.path.length - b.path.length || a.path.join(" / ").localeCompare(b.path.join(" / "))
}

function summarizeBlocks(examples: ScoredExample[]): BlockReport[] {
  const blocks: BlockReport[] = []
  for (const [key, blockExamples] of groupByDescribe(examples)) {
    const block = blockReport(key, blockExamples)
    if (block) blocks.push(block)
  }
  return blocks.sort(byPath)
}

export function scoreFile(input: {
  path: string
  examples: CollectedExample[]
  moduleMocks?: number
  structureErrors?: string[]
  parseError?: string
}): FileReport {
  const moduleMocks = input.moduleMocks ?? 0
  const examples = input.examples.map(scoreExample)
  const blocks = summarizeBlocks(examples)
  const partial = summarizeExamples(examples, moduleMocks)
  const summary = attachJudgment(partial, blocks)
  return {
    path: input.path,
    examples,
    summary,
    blocks,
    structureErrors: input.structureErrors ?? [],
    parseError: input.parseError,
    moduleMocks,
    comparison: undefined,
  }
}

function isImproved(c: Omit<Comparison, "verdict">, extractionPressureDelta: number): boolean {
  return c.fileScoreDelta <= -5 && extractionPressureDelta <= 0 && c.maxScrapDelta <= 0
}

function isHelperRegression(c: Omit<Comparison, "verdict">, extractionPressureDelta: number): boolean {
  return c.helperHiddenDelta > 0 && extractionPressureDelta >= 0 && c.caseMatrixDelta <= 0
}

function isWorsening(c: Omit<Comparison, "verdict">, extractionPressureDelta: number): boolean {
  return extractionPressureDelta > 0 || c.maxScrapDelta > 0 || c.fileScoreDelta >= 5
}

function comparisonVerdict(
  c: Omit<Comparison, "verdict">,
  extractionPressureDelta: number,
): Comparison["verdict"] {
  if (isImproved(c, extractionPressureDelta)) return "improved"
  if (isHelperRegression(c, extractionPressureDelta) || isWorsening(c, extractionPressureDelta)) return "worse"
  if (c.fileScoreDelta === 0) return "unchanged"
  return "mixed"
}

export function compareReports(baseline: FileReport, current: FileReport): Comparison {
  const fileScoreDelta = current.summary.fileScore - baseline.summary.fileScore
  const extractionPressureDelta =
    current.summary.effectiveDuplicationScore - baseline.summary.effectiveDuplicationScore
  const comparison: Omit<Comparison, "verdict"> = {
    fileScoreDelta,
    avgScrapDelta: current.summary.avgScrap - baseline.summary.avgScrap,
    maxScrapDelta: current.summary.maxScrap - baseline.summary.maxScrap,
    harmfulDuplicationDelta:
      current.summary.harmfulDuplicationScore - baseline.summary.harmfulDuplicationScore,
    extractionPressureDelta,
    caseMatrixDelta: current.summary.caseMatrixRepetition - baseline.summary.caseMatrixRepetition,
    helperHiddenDelta: current.summary.helperHiddenExampleCount - baseline.summary.helperHiddenExampleCount,
  }
  return { ...comparison, verdict: comparisonVerdict(comparison, extractionPressureDelta) }
}
