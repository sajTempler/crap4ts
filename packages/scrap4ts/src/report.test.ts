import { expect, test } from "vitest"
import { formatReport } from "./report.js"
import { scoreFile } from "./score.js"
import type { CollectedExample } from "./score.js"

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

test("guidance report is a Report with remediation and actionability, not a CRAP table", () => {
  const file = scoreFile({ path: "src/add.test.ts", examples: [collected()] })
  const report = formatReport([file], { verbose: false })
  expect(report).toContain("=== SCRAP Report ===")
  expect(report).toContain("src/add.test.ts")
  expect(report).toContain("remediation-mode: STABLE")
  expect(report).toContain("ai-actionability: LEAVE_ALONE")
  expect(report).toContain("why:")
  expect(report).not.toMatch(/^CRAP Report$/m)
  expect(report).not.toContain("Cov%")
})

test("verbose report dumps example metrics", () => {
  const file = scoreFile({ path: "src/add.test.ts", examples: [collected()] })
  const report = formatReport([file], { verbose: true })
  expect(report).toContain("SCRAP:")
  expect(report).toContain("assertions: 1")
  expect(report).toContain("smells: none")
})

test("recommended extractions print a one-liner as line N and a span as lines N-M", () => {
  const shared = new Set(["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"])
  const examples = Array.from({ length: 10 }, (_, i) =>
    collected({
      name: `pad${i}`,
      assertions: 2,
      setupFeatures: shared,
      subjectSymbols: new Set([`pad${i}`]),
      assertFeatures: new Set(),
      line: i === 0 ? 5 : 2,
      endLine: i === 0 ? 5 : 4,
    }),
  )
  const file = scoreFile({ path: "src/dup.test.ts", examples })
  const report = formatReport([file], { verbose: false })
  expect(report).toContain("recommended-extractions:")
  expect(report).toContain("line 5")
  expect(report).toContain("lines 2-4")
})
