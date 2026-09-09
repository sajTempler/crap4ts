import { expect, test } from "vitest"
import { collectExamples } from "./collect.js"
import { scoreFile } from "./score.js"

test("collects it and test with one expect as a single assertion", () => {
  const source = `
import { expect, it, test } from "vitest"
import { add } from "../src/add.js"

it("adds", () => {
  expect(add(1, 2)).toBe(3)
})

test("also adds", () => {
  expect(add(2, 2)).toBe(4)
})
`
  const result = collectExamples("src/add.test.ts", source)
  expect(result.parseError).toBeUndefined()
  expect(result.structureErrors).toEqual([])
  expect(result.examples.map((e) => e.name)).toEqual(["adds", "also adds"])
  expect(result.examples[0]?.assertions).toBe(1)
  expect(result.examples[0]?.subjectSymbols.has("add")).toBe(true)
  expect(result.examples[0]?.setupDepth).toBe(0)
})

test("two expect calls are two assertions; matcher chains stay one", () => {
  const source = `
import { expect, it } from "vitest"
it("pair", () => {
  expect(1).toBe(1)
  expect(2).to.equal(2)
})
`
  const result = collectExamples("src/pair.test.ts", source)
  expect(result.examples[0]?.assertions).toBe(2)
  expect(result.examples[0]?.phases).toBe(1)
})

test("nested describe is a block path, not a structure error", () => {
  const source = `
import { describe, expect, it } from "vitest"
describe("outer", () => {
  describe("inner", () => {
    it("ok", () => { expect(1).toBe(1) })
  })
})
`
  const result = collectExamples("src/nested.test.ts", source)
  expect(result.structureErrors).toEqual([])
  expect(result.examples[0]?.describePath).toEqual(["outer", "inner"])
})

test("test.for is one table-driven example", () => {
  const source = `
import { expect, test } from "vitest"
test.for([[1, 2], [2, 3]])("adds", ([a, b]) => {
  expect(a + 1).toBe(b)
})
`
  const result = collectExamples("src/table.test.ts", source)
  expect(result.examples).toHaveLength(1)
  expect(result.examples[0]?.tableDriven).toBe(true)
  expect(result.examples[0]?.tableBranches).toBe(1)
  expect(result.examples[0]?.name).toBe("adds")
})

test("it.each with large inline table uses callback line count and gets case table credit", () => {
  const source = `
import { expect, it } from "vitest"
it.each([
  [1, 1],
  [2, 2],
  [3, 3],
  [4, 4],
  [5, 5],
  [6, 6],
  [7, 7],
  [8, 8],
  [9, 9],
  [10, 10],
  [11, 11],
  [12, 12],
  [13, 13],
  [14, 14],
  [15, 15],
  [16, 16],
  [17, 17],
  [18, 18],
  [19, 19],
  [20, 20],
  [21, 21],
  [22, 22],
])("matches %i", (a, b) => {
  expect(a).toBe(b)
})
`
  const result = collectExamples("src/large-table.test.ts", source)
  expect(result.examples).toHaveLength(1)
  expect(result.examples[0]?.tableDriven).toBe(true)
  expect(result.examples[0]?.tableBranches).toBe(1)
  expect(result.examples[0]?.rawLineCount).toBe(3)
  const scored = scoreFile(result)
  expect(scored.examples[0]?.smells).not.toContain("large-example")
})

test("it.each and test.for with named const array identifier get case table credit and callback line count", () => {
  const source = `
import { expect, it, test } from "vitest"
const cases = [
  [1, 2],
  [3, 4],
]
it.each(cases)("it adds", ([a, b]) => {
  expect(a + 1).toBe(b)
})
test.for(cases)("test adds", ([a, b]) => {
  expect(a + 1).toBe(b)
})
`
  const result = collectExamples("src/identifier-table.test.ts", source)
  expect(result.examples).toHaveLength(2)
  expect(result.examples[0]?.tableDriven).toBe(true)
  expect(result.examples[0]?.tableBranches).toBe(1)
  expect(result.examples[0]?.rawLineCount).toBe(3)
  expect(result.examples[1]?.tableDriven).toBe(true)
  expect(result.examples[1]?.tableBranches).toBe(1)
  expect(result.examples[1]?.rawLineCount).toBe(3)
})

test("vi.mock is file-level; vi.spyOn is example-level", () => {
  const source = `
import { expect, it, vi } from "vitest"
vi.mock("./mod.js")
it("spies", () => {
  const spy = vi.spyOn(console, "log")
  expect(spy).toHaveBeenCalledTimes(0)
})
`
  const result = collectExamples("src/mock.test.ts", source)
  expect(result.moduleMocks).toBe(1)
  expect(result.examples[0]?.mocking).toBe(1)
})

test("test nested in test is a structure error; hooks in test too except onTestFinished", () => {
  const source = `
import { beforeEach, expect, it, onTestFinished } from "vitest"
it("outer", () => {
  it("inner", () => { expect(1).toBe(1) })
  beforeEach(() => {})
  onTestFinished(() => {})
})
`
  const result = collectExamples("src/bad.test.ts", source)
  expect(result.structureErrors).toContain("test nested in test")
  expect(result.structureErrors).toContain("beforeEach nested in test")
  expect(result.structureErrors.some((e) => e.includes("onTestFinished"))).toBe(false)
})

test("const does not increment setup-depth; beforeEach on the suite does", () => {
  const source = `
import { beforeEach, describe, expect, it } from "vitest"
describe("s", () => {
  beforeEach(() => {})
  it("uses const", () => {
    const x = 1
    expect(x).toBe(1)
  })
})
`
  const result = collectExamples("src/setup.test.ts", source)
  expect(result.examples[0]?.setupDepth).toBe(1)
})

test("expectTypeOf is not a runtime assertion", () => {
  const source = `
import { expectTypeOf, it } from "vitest"
it("types", () => {
  expectTypeOf(1).toEqualTypeOf<number>()
})
`
  const result = collectExamples("src/types.test.ts", source)
  expect(result.examples[0]?.assertions).toBe(0)
})

test("same-file helpers charge helper-hidden lines", () => {
  const source = `
import { expect, it } from "vitest"
function makeUser() {
  return { name: "a" }
}
it("uses helper", () => {
  const user = makeUser()
  expect(user.name).toBe("a")
})
`
  const result = collectExamples("src/helper.test.ts", source)
  expect(result.examples[0]?.helperCalls).toBe(1)
  expect(result.examples[0]?.helperHiddenLines).toBeGreaterThan(0)
})

test("same-file helpers with chained method calls charge helper only once", () => {
  const source = `
import { expect, it } from "vitest"
function createQueryClient() {
  return {
    fetchQuery: () => ({
      then: (fn: any) => fn("data"),
    }),
  }
}
it("uses chained helper", () => {
  createQueryClient().fetchQuery().then((d: any) => d)
  expect(1).toBe(1)
})
`
  const result = collectExamples("src/chained-helper.test.ts", source)
  expect(result.examples[0]?.helperCalls).toBe(1)
  expect(result.examples[0]?.helperHiddenLines).toBe(7)
})



test("body for-of, forEach, and map over row tuples count as a large case table", () => {
  const source = `
import { expect, it } from "vitest"
it("for-of rows", () => {
  for (const row of [{ a: 1 }, { a: 2 }]) {
    expect(row.a).toBeTruthy()
  }
})
it("forEach rows", () => {
  ;[[1], [2]].forEach((row) => {
    expect(row).toBeTruthy()
  })
})
it("map rows", () => {
  const id = { map: (rows) => rows }
  id.map([{ a: 1 }, { a: 2 }])
  expect(1).toBe(1)
})
`
  const result = collectExamples("src/case-table.test.ts", source)
  expect(result.examples.map((e) => e.tableDriven)).toEqual([true, true, true])
  expect(result.examples.every((e) => (e.tableBranches ?? 0) >= 1)).toBe(true)
})

test("coverable collect helpers fire at the collectExamples seam", () => {
  const source = `
import assert from "node:assert"
import { expect, it, test } from "vitest"
const withTwo = test.extend({ a: 1, b: 2 })
const withNone = test.extend()
it(\`templated\`, () => {
  expect(1).toBe(1)
})
it(name, () => {
  expect(1).toBe(1)
})
it("expr", () => expect(1).toBe(1))
it("lits", () => [1, "a", true, null, /x/])
it("member", () => Math.PI)
it("awaited", async () => await 1)
it("logic", () => {
  const x = 1 && 2 || 3
  expect(x).toBe(2)
})
it("optional", () => {
  Math.max?.(1)
  expect(1).toBe(1)
})
it("computed", () => {
  Math["max"](1, 2)
  expect(1).toBe(1)
})
it("assert id", () => {
  assert(true)
})
it("assert member", () => {
  assert.equal(1, 1)
})
withTwo("two fixtures", () => {
  expect(1).toBe(1)
})
withNone("default bump", () => {
  expect(1).toBe(1)
})
`
  const result = collectExamples("src/cover.test.ts", source)
  expect(result.parseError).toBeUndefined()
  const byName = Object.fromEntries(result.examples.map((e) => [e.name, e]))
  expect(byName.templated?.assertions).toBe(1)
  expect(byName.expr?.assertions).toBe(1)
  expect(byName.logic?.branches).toBeGreaterThan(0)
  expect(byName["assert id"]?.assertions).toBe(1)
  expect(byName["assert member"]?.assertions).toBe(1)
  expect(byName["two fixtures"]?.setupDepth).toBe(2)
  expect(byName["default bump"]?.setupDepth).toBe(1)
})

test("short, primitive, and identifier iterables are not large case tables", () => {
  const source = `
import { expect, it } from "vitest"
it("one row", () => {
  for (const row of [{ a: 1 }]) {
    expect(row.a).toBe(1)
  }
})
it("primitives", () => {
  for (const n of [1, 2]) {
    expect(n).toBeTruthy()
  }
})
it("identifier", () => {
  const rows = [{ a: 1 }, { a: 2 }]
  for (const row of rows) {
    expect(row.a).toBeTruthy()
  }
})
`
  const result = collectExamples("src/not-table.test.ts", source)
  expect(result.examples.map((e) => e.tableDriven)).toEqual([false, false, false])
  expect(result.examples[1]?.branches).toBeGreaterThan(0)
})
