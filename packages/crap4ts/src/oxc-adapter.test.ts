import { expect, test } from "vitest"
import { oxcParser } from "./oxc-adapter.js"

function byName(source: string, filename = "fixture.ts") {
  const units = oxcParser.scoringUnits(filename, source)
  return new Map(units.map((u) => [u.name, u]))
}

test("names module-scope function-likes with the locked grammar", () => {
  const source = `
export function add(a: number, b: number): number { return a + b }
export const parse = (s: string): number => { return Number(s) }
export default function (x: boolean) { return x }
export class Box {
  constructor(private x: number) {}
  get value() { return this.x }
  set value(n: number) { this.x = n }
  static empty() { return new Box(0) }
  #secret() { return this.x }
  map() { return this.x }
  field = () => this.x
}
export const api = { ping() { return true } }
namespace N { export function f() { return 1 } }
const anon = class { m() { return 1 } }
const computed = { ["k"]() { return 1 } }
`
  const units = byName(source)
  expect([...units.keys()]).toEqual(
    expect.arrayContaining([
      "add",
      "parse",
      "default",
      "Box.constructor",
      "Box.get value",
      "Box.set value",
      "Box.static empty",
      "Box.#secret",
      "Box.map",
      "Box.field",
      "api.ping",
      "N.f",
      "(anonymous).m",
      "computed.(computed)",
    ]),
  )
})

test("nested callbacks are not rows; their CC folds into the parent", () => {
  const source = `
export function withMap(xs: number[]) {
  return xs.map((x) => (x ? 1 : 0))
}
`
  const units = oxcParser.scoringUnits("a.ts", source)
  expect(units.map((u) => u.name)).toEqual(["withMap"])
  expect(units[0]?.complexity).toBe(2)
})

test("overload stubs, declare, abstracts, and interface methods are not rows", () => {
  const source = `
function overloads(x: string): string
function overloads(x: number): number
function overloads(x: string | number): string | number { return x }
declare function ambient(): void
interface SkipMe { method(): void }
abstract class Abs { abstract missing(): void; present() { return 1 } }
`
  expect(oxcParser.scoringUnits("a.ts", source).map((u) => u.name)).toEqual(["overloads", "Abs.present"])
})

test("CC counts family decision points and ignores ??, ?., and type wrappers", () => {
  const source = `
export function branchy(x: number | undefined, y: number) {
  if (x && x < 10) return 1
  switch (x) {
    case 1:
      return 2
    default:
      return 3
  }
  try { return y ? 1 : 0 } catch { return 0 }
  return (x ?? y) || 0
}
export function optional(o: { a?: { b: number } }) {
  return o?.a?.b
}
export function typed(x: unknown) {
  return (x as number) satisfies number
}
export function looped(xs: number[]) {
  for (const x of xs) { void x }
  while (false) {}
}
`
  const units = byName(source)
  expect(units.get("branchy")?.complexity).toBe(8)
  expect(units.get("optional")?.complexity).toBe(1)
  expect(units.get("typed")?.complexity).toBe(1)
  expect(units.get("looped")?.complexity).toBe(3)
})

test("JSX && and ternary count; parse failure throws", () => {
  const source = `
export function View(flag: boolean) {
  return <div>{flag && (flag ? <span /> : null)}</div>
}
`
  expect(oxcParser.scoringUnits("a.tsx", source)[0]?.complexity).toBe(3)
  expect(() => oxcParser.scoringUnits("a.ts", "function oops( {")).toThrow()
})

test("pattern bindings still name the method after the object key", () => {
  const units = oxcParser.scoringUnits("a.ts", "const { ping } = { ping() { return true } }\n")
  expect(units.map((u) => u.name)).toEqual(["(anonymous).ping"])
})

test("filename is copied onto each unit as file", () => {
  const units = oxcParser.scoringUnits("src/widget.ts", "export function simple() { return 1 }\n")
  expect(units[0]?.file).toBe("src/widget.ts")
  expect(units[0]?.startLine).toBe(1)
  expect(units[0]?.endLine).toBeGreaterThanOrEqual(1)
})
