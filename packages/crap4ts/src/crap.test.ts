import { expect, test } from "vitest"
import { formatReport, score, sortByCrap, type CrapEntry } from "./crap.js"

test.for([
  { name: "CRAP at 100% coverage equals CC", cc: 5, cov: 100, expected: 5 },
  { name: "CRAP at 0% coverage equals CC squared plus CC", cc: 5, cov: 0, expected: 30 },
  { name: "CRAP at 50% coverage is the family worked example", cc: 4, cov: 50, expected: 6 },
  { name: "CRAP at 45% coverage matches the 8-complexity worked example", cc: 8, cov: 45, expected: 18.648 },
  { name: "missing coverage yields no CRAP score", cc: 3, cov: undefined, expected: undefined },
])("$name", ({ cc, cov, expected }) => {
  const actual = score(cc, cov)
  expect(actual === undefined).toBe(expected === undefined)
  expect(actual?.toFixed(3)).toEqual(expected?.toFixed(3))
})

test("sorts scored rows worst first and N/A last", () => {
  const entries: CrapEntry[] = [
    { name: "low", file: "a.ts", complexity: 1, coverage: 100, crap: 1 },
    { name: "none", file: "b.ts", complexity: 2, coverage: undefined, crap: undefined },
    { name: "high", file: "c.ts", complexity: 4, coverage: 0, crap: 20 },
  ]
  const sorted = sortByCrap(entries)
  expect(sorted.map((e) => e.name)).toEqual(["high", "low", "none"])
  expect(entries.map((e) => e.name)).toEqual(["low", "none", "high"])
})

test.for([
  {
    name: "report uses File as the second column and family widths",
    entries: [{ name: "Simple", file: "src/widget.ts", complexity: 1, coverage: 100, crap: 1 }],
    snippet: "Simple                         src/widget.ts                          1  100.0%      1.0",
  },
  {
    name: "report shows N/A when coverage is unknown",
    entries: [{ name: "ghost", file: "src/a.ts", complexity: 3, coverage: undefined, crap: undefined }],
    snippet: "N/A",
  },
])("$name", ({ entries, snippet }) => {
  const report = formatReport(entries)
  expect(report).toContain("CRAP Report")
  expect(report).toContain("File")
  expect(report).toContain(snippet)
})
