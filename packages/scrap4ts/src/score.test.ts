import { expect, test } from "vitest"
import { compareReports, scoreFile, type CollectedExample } from "./score.js"

function collected(overrides: Partial<CollectedExample> = {}): CollectedExample {
  return {
    name: "adds",
    describePath: ["Math"],
    line: 2,
    endLine: 4,
    rawLineCount: 3,
    assertions: 1,
    branches: 0,
    tableBranches: 0,
    setupDepth: 0,
    mocking: 0,
    helperCalls: 0,
    helperHiddenLines: 0,
    tempResources: 0,
    largeLiterals: 0,
    tableDriven: false,
    phases: 1,
    subjectSymbols: new Set(["add"]),
    assertFeatures: new Set(["expect"]),
    setupFeatures: new Set(),
    fixtureFeatures: new Set(),
    arrangeFeatures: new Set(),
    literalFeatures: new Set(),
    assertSignatures: [],
    setupSignatures: [],
    arrangeSignatures: [],
    literalSignatures: [],
    ...overrides,
  }
}

function monster(overrides: Partial<CollectedExample> = {}): CollectedExample {
  return collected({
    name: "monster",
    assertions: 0,
    assertFeatures: new Set(),
    branches: 20,
    setupDepth: 15,
    helperCalls: 10,
    mocking: 4,
    phases: 2,
    rawLineCount: 50,
    tempResources: 1,
    largeLiterals: 1,
    subjectSymbols: new Set(["monster"]),
    ...overrides,
  })
}

function pads(n: number, overrides: Partial<CollectedExample> = {}): CollectedExample[] {
  return Array.from({ length: n }, (_, i) =>
    collected({
      name: `pad${i}`,
      subjectSymbols: new Set([`pad${i}`]),
      assertFeatures: new Set(),
      ...overrides,
    }),
  )
}

test("a shallow single-assertion example scores 1.0 with no smells", () => {
  const file = scoreFile({ path: "src/add.test.ts", examples: [collected()], moduleMocks: 0 })
  const example = file.examples[0]
  expect(example?.scrap).toBe(1)
  expect(example?.complexityScore).toBe(1)
  expect(example?.smells).toEqual([])
  expect(file.summary.remediation).toBe("STABLE")
  expect(file.summary.actionability).toBe("LEAVE_ALONE")
})

test("no-assertions adds penalty 10 and opens AUTO_REFACTOR", () => {
  const file = scoreFile({
    path: "src/empty.test.ts",
    examples: [collected({ name: "todo", assertions: 0, assertFeatures: new Set() })],
  })
  expect(file.examples[0]?.smells).toEqual(["no-assertions"])
  expect(file.examples[0]?.scrap).toBe(11)
  expect(file.summary.remediation).toBe("LOCAL")
  expect(file.summary.actionability).toBe("AUTO_REFACTOR")
})

test("saturating complexity at input 2 matches the curve 1 + 24*(1-exp(-0.18))", () => {
  const file = scoreFile({
    path: "src/branch.test.ts",
    examples: [collected({ assertions: 3, branches: 1 })],
  })
  expect(file.examples[0]?.complexityScore).toBeCloseTo(4.9535, 3)
})

test("example-level mocking above 3 is high-mocking", () => {
  const file = scoreFile({
    path: "src/mock.test.ts",
    examples: [collected({ mocking: 4 })],
  })
  expect(file.examples[0]?.smells).toContain("high-mocking")
})

test("file-level module mocks do not mark every example high-mocking", () => {
  const file = scoreFile({
    path: "src/mock.test.ts",
    examples: [collected(), collected({ name: "other" })],
    moduleMocks: 2,
  })
  expect(file.examples.every((e) => !e.smells.includes("high-mocking"))).toBe(true)
  expect(file.summary.mockingExamples).toBe(1)
})

test("one assertion over 10 lines is low-assertion-density", () => {
  const file = scoreFile({
    path: "src/smells.test.ts",
    examples: [collected({ name: "sparse", assertions: 1, rawLineCount: 19 })],
  })
  expect(file.examples[0]?.smells).toContain("low-assertion-density")
  expect(file.examples[0]?.smells).not.toContain("no-assertions")
})

test("phases above 1 is multiple-phases", () => {
  const file = scoreFile({
    path: "src/smells.test.ts",
    examples: [collected({ name: "phased", phases: 2 })],
  })
  expect(file.examples[0]?.smells).toContain("multiple-phases")
  expect(file.examples[0]?.smells).not.toContain("large-example")
})

test("more than 20 lines is large-example", () => {
  const file = scoreFile({
    path: "src/smells.test.ts",
    examples: [collected({ name: "huge", rawLineCount: 21, assertions: 2 })],
  })
  expect(file.examples[0]?.smells).toContain("large-example")
  expect(file.examples[0]?.smells).not.toContain("low-assertion-density")
})

test("a temp resource is temp-resource-work", () => {
  const file = scoreFile({
    path: "src/smells.test.ts",
    examples: [collected({ name: "tmp", tempResources: 1 })],
  })
  expect(file.examples[0]?.smells).toContain("temp-resource-work")
  expect(file.examples[0]?.smells).not.toContain("literal-heavy-setup")
})

test("a large literal is literal-heavy-setup", () => {
  const file = scoreFile({
    path: "src/smells.test.ts",
    examples: [collected({ name: "blob", largeLiterals: 1 })],
  })
  expect(file.examples[0]?.smells).toContain("literal-heavy-setup")
  expect(file.examples[0]?.smells).not.toContain("temp-resource-work")
})

test("helper-hidden lines above 8 is helper-hidden-complexity", () => {
  const file = scoreFile({
    path: "src/smells.test.ts",
    examples: [collected({ name: "hidden", helperHiddenLines: 9, helperCalls: 1 })],
  })
  expect(file.examples[0]?.smells).toContain("helper-hidden-complexity")
  expect(file.examples[0]?.smells).toContain("low-assertion-density")
})

test("repeated shallow siblings become AUTO_TABLE_DRIVE toward test.for", () => {
  const siblings = ["a", "b", "c"].map((name) =>
    collected({
      name,
      describePath: ["Suite"],
      subjectSymbols: new Set(["add"]),
      assertFeatures: new Set(["expect", "toBe"]),
      setupFeatures: new Set(["before"]),
    }),
  )
  const file = scoreFile({ path: "src/table.test.ts", examples: siblings })
  expect(file.summary.coverageMatrixCandidates).toBeGreaterThan(0)
  expect(file.summary.remediation).not.toBe("STABLE")
  expect(file.summary.actionability).toBe("AUTO_TABLE_DRIVE")
  expect(file.summary.actions.some((a) => a.text.includes("test.for"))).toBe(true)
})

test("blocks sort by path depth then by joined title", () => {
  const file = scoreFile({
    path: "src/blocks.test.ts",
    examples: [
      collected({ name: "nested", describePath: ["Suite", "Inner"] }),
      collected({ name: "zebra", describePath: ["Zebra"] }),
      collected({ name: "apple", describePath: ["Apple"] }),
    ],
  })
  expect(file.blocks.map((b) => b.path)).toEqual([["Apple"], ["Zebra"], ["Suite", "Inner"]])
})

test("twelve examples with a high-scrap outlier stay LOCAL when split pressure is absent", () => {
  const file = scoreFile({ path: "src/local.test.ts", examples: [monster(), ...pads(11)] })
  expect(file.summary.exampleCount).toBe(12)
  expect(file.summary.maxScrap).toBeGreaterThanOrEqual(35)
  expect(file.summary.remediation).toBe("LOCAL")
})

test("split pressure via helper-hidden complexity is SPLIT", () => {
  const file = scoreFile({
    path: "src/split.test.ts",
    examples: [monster(), ...pads(10), collected({ name: "hidden", helperHiddenLines: 1, subjectSymbols: new Set(["hidden"]), assertFeatures: new Set() })],
  })
  expect(file.summary.remediation).toBe("SPLIT")
  expect(file.summary.actionability).toBe("MANUAL_SPLIT")
})

test("split pressure via average SCRAP is SPLIT", () => {
  const file = scoreFile({
    path: "src/split.test.ts",
    examples: [monster(), ...pads(11, { assertions: 0 })],
  })
  expect(file.summary.avgScrap).toBeGreaterThanOrEqual(10)
  expect(file.summary.remediation).toBe("SPLIT")
})

test("split pressure via subject repetition is SPLIT", () => {
  const file = scoreFile({
    path: "src/split.test.ts",
    examples: [monster({ subjectSymbols: new Set(["add"]) }), ...pads(11, { subjectSymbols: new Set(["add"]) })],
  })
  expect(file.summary.subjectRepetitionScore).toBeGreaterThanOrEqual(12)
  expect(file.summary.remediation).toBe("SPLIT")
})

test("split pressure via extraction net-benefit is SPLIT", () => {
  const shared = new Set(["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"])
  const cluster = pads(11, { assertions: 2, setupFeatures: shared })
  const file = scoreFile({ path: "src/split.test.ts", examples: [monster(), ...cluster] })
  expect(file.summary.effectiveDuplicationScore).toBeGreaterThanOrEqual(20)
  expect(file.summary.remediation).toBe("SPLIT")
})

test("duplication cost of ten identical setups is 127 net-benefit", () => {
  const shared = new Set(["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"])
  const examples = pads(10, { assertions: 2, setupFeatures: shared })
  const file = scoreFile({ path: "src/dup.test.ts", examples })
  expect(file.summary.recommendedExtractionCount).toBe(1)
  expect(file.summary.effectiveDuplicationScore).toBeCloseTo(127, 5)
})

test("duplication cost is zero when variable points exceed 4", () => {
  const left = collected({
    name: "left",
    assertions: 2,
    assertFeatures: new Set(),
    setupFeatures: new Set(["s1", "s2", "s3", "s4", "s5", "v1", "v2", "v3"]),
  })
  const right = collected({
    name: "right",
    assertions: 2,
    assertFeatures: new Set(),
    setupFeatures: new Set(["s1", "s2", "s3", "s4", "s5", "v4", "v5"]),
  })
  const file = scoreFile({ path: "src/dup.test.ts", examples: [left, right] })
  expect(file.summary.setupDuplicationScore).toBe(2)
  expect(file.summary.recommendedExtractionCount).toBe(0)
  expect(file.summary.effectiveDuplicationScore).toBe(0)
})

test("compareReports is unchanged when the file is identical", () => {
  const file = scoreFile({ path: "src/add.test.ts", examples: [collected()] })
  expect(compareReports(file, file).verdict).toBe("unchanged")
})

test("compareReports is improved when fileScore drops by 5+ without regressions", () => {
  const baseline = scoreFile({ path: "src/x.test.ts", examples: [monster()] })
  const current = scoreFile({ path: "src/x.test.ts", examples: [collected()] })
  const comparison = compareReports(baseline, current)
  expect(comparison.fileScoreDelta).toBeLessThanOrEqual(-5)
  expect(comparison.maxScrapDelta).toBeLessThanOrEqual(0)
  expect(comparison.verdict).toBe("improved")
})

test("compareReports is worse when helper-hidden complexity grows", () => {
  const baseline = scoreFile({ path: "src/x.test.ts", examples: [collected()] })
  const current = scoreFile({
    path: "src/x.test.ts",
    examples: [collected({ helperHiddenLines: 9, helperCalls: 1 })],
  })
  const comparison = compareReports(baseline, current)
  expect(comparison.helperHiddenDelta).toBeGreaterThan(0)
  expect(comparison.verdict).toBe("worse")
})

test("compareReports is mixed when fileScore moves a little", () => {
  const baseline = scoreFile({ path: "src/x.test.ts", examples: [collected(), collected({ name: "b" })] })
  const current = scoreFile({ path: "src/x.test.ts", examples: [collected()] })
  const comparison = compareReports(baseline, current)
  expect(Math.abs(comparison.fileScoreDelta)).toBeGreaterThan(0)
  expect(Math.abs(comparison.fileScoreDelta)).toBeLessThan(5)
  expect(comparison.verdict).toBe("mixed")
})
