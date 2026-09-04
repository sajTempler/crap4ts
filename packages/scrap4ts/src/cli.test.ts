import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "vitest"
import { run } from "./cli.js"

async function withDir(files: Record<string, string>, fn: (cwd: string) => Promise<void>) {
  const cwd = await mkdtemp(join(tmpdir(), "scrap4ts-"))
  try {
    for (const [rel, content] of Object.entries(files)) {
      const path = join(cwd, rel)
      await mkdir(join(path, ".."), { recursive: true })
      await writeFile(path, content)
    }
    await fn(cwd)
  } finally {
    await rm(cwd, { recursive: true, force: true })
  }
}

const simpleTest = `import { expect, it } from "vitest"
it("adds", () => {
  expect(1 + 1).toBe(2)
})
`

test("scrap4ts --help prints usage and exits 0", async () => {
  const result = await run(["--help"])
  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain("Usage: scrap4ts")
  expect(result.stdout).toContain("--verbose")
  expect(result.stdout).toContain("--json")
  expect(result.stdout).toContain("--write-baseline")
  expect(result.stdout).toContain("--compare")
})

test("scrap4ts -h prints usage and exits 0", async () => {
  const result = await run(["-h"])
  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain("Usage: scrap4ts")
})

test("unknown flags print a message plus usage and exit 1", async () => {
  const result = await run(["--changed"])
  expect(result.exitCode).toBe(1)
  expect(result.stdout).toContain("Unknown option: --changed")
  expect(result.stdout).toContain("Usage: scrap4ts")
})

test("missing --compare path is a tool failure", async () => {
  const result = await run(["--compare"])
  expect(result.exitCode).toBe(1)
  expect(result.stdout).toContain("--compare requires a path")
  expect(result.stdout).toContain("Usage: scrap4ts")
})

test("prints a SCRAP guidance report for a discovered Vitest file", async () => {
  await withDir({ "src/add.test.ts": simpleTest }, async (cwd) => {
    const result = await run([], { cwd })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("=== SCRAP Report ===")
    expect(result.stdout).toContain("src/add.test.ts")
    expect(result.stdout).toContain("remediation-mode:")
    expect(result.stdout).toContain("ai-actionability:")
  })
})

test("path fragments OR-filter discovered test files", async () => {
  await withDir(
    {
      "src/combat.test.ts": `import { expect, it } from "vitest"\nit("fights", () => { expect(1).toBe(1) })\n`,
      "src/move.test.ts": `import { expect, it } from "vitest"\nit("walks", () => { expect(1).toBe(1) })\n`,
    },
    async (cwd) => {
      const result = await run(["combat"], { cwd })
      expect(result.stdout).toContain("combat.test.ts")
      expect(result.stdout).not.toContain("move.test.ts")
    },
  )
})

test("skips production sources, type tests, and node_modules", async () => {
  await withDir(
    {
      "src/add.ts": "export function add(a: number, b: number) { return a + b }\n",
      "src/add.test.ts": simpleTest,
      "src/add.test-d.ts": "export {}\n",
      "node_modules/lib.test.ts": simpleTest,
    },
    async (cwd) => {
      const result = await run([], { cwd })
      expect(result.stdout).toContain("src/add.test.ts")
      expect(result.stdout).not.toContain("add.ts")
      expect(result.stdout).not.toContain("test-d")
      expect(result.stdout).not.toContain("node_modules")
    },
  )
})

test("--json emits JSON, not a Report", async () => {
  await withDir({ "src/add.test.ts": simpleTest }, async (cwd) => {
    const result = await run(["--json"], { cwd })
    expect(result.exitCode).toBe(0)
    const doc = JSON.parse(result.stdout) as { baselineVersion: number; reports: { path: string }[] }
    expect(doc.baselineVersion).toBe(1)
    expect(doc.reports[0]?.path).toBe("src/add.test.ts")
    expect(result.stdout).not.toContain("=== SCRAP Report ===")
  })
})

test("--verbose dumps example metrics", async () => {
  await withDir({ "src/add.test.ts": simpleTest }, async (cwd) => {
    const result = await run(["--verbose"], { cwd })
    expect(result.stdout).toContain("assertions:")
    expect(result.stdout).toContain("SCRAP:")
  })
})

test("--write-baseline writes under target/scrap/", async () => {
  await withDir({ "src/add.test.ts": simpleTest }, async (cwd) => {
    const result = await run(["--write-baseline"], { cwd })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("Baseline written: target/scrap/spec.json")
    const written = await readFile(join(cwd, "target/scrap/spec.json"), "utf8")
    const doc = JSON.parse(written) as { baselineVersion: number }
    expect(doc.baselineVersion).toBe(1)
  })
})

test("--compare attaches a verdict", async () => {
  await withDir({ "src/add.test.ts": simpleTest }, async (cwd) => {
    await run(["--write-baseline"], { cwd })
    const result = await run(["--compare", "target/scrap/spec.json"], { cwd })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("verdict:")
  })
})

test("invalid baseline report entries are a tool failure", async () => {
  await withDir(
    {
      "src/add.test.ts": simpleTest,
      "target/scrap/bad.json": `{"baselineVersion":1,"reports":[null]}`,
    },
    async (cwd) => {
      const result = await run(["--compare", "target/scrap/bad.json"], { cwd })
      expect(result.exitCode).toBe(1)
      expect(result.stdout).toContain("invalid baseline JSON")
    },
  )
})

test("honors vitest.config.ts test.include", async () => {
  await withDir(
    {
      "vitest.config.ts": `export default { test: { include: ["checks/**/*.ts"] } }\n`,
      "checks/foo.ts": simpleTest,
      "src/add.test.ts": simpleTest,
    },
    async (cwd) => {
      const result = await run([], { cwd })
      expect(result.stdout).toContain("checks/foo.ts")
      expect(result.stdout).not.toContain("add.test.ts")
    },
  )
})

test("parse errors exit 1", async () => {
  await withDir({ "src/broken.test.ts": "it('x', () => {\n" }, async (cwd) => {
    const result = await run([], { cwd })
    expect(result.exitCode).toBe(1)
  })
})
