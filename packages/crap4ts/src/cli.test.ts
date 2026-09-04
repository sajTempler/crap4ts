import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "vitest"
import { run } from "./cli.js"
import type { ParserAdapter } from "./parser.js"

async function withDir(files: Record<string, string>, fn: (cwd: string) => Promise<void>) {
  const cwd = await mkdtemp(join(tmpdir(), "crap4ts-"))
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

const canned: ParserAdapter = {
  scoringUnits(filename) {
    return [{ name: "foo", file: filename, startLine: 1, endLine: 2, complexity: 1 }]
  },
}

function silentCoverage(lcov?: string) {
  return async (_command: string, cwd: string) => {
    if (lcov !== undefined) {
      await mkdir(join(cwd, "target/coverage"), { recursive: true })
      await writeFile(join(cwd, "target/coverage/lcov.info"), lcov)
    }
    return 0
  }
}

test("crap4ts --help prints usage and exits 0", async () => {
  const result = await run(["--help"])
  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain("Usage: crap4ts")
  expect(result.stdout).toContain("--coverage-command")
  expect(result.stdout).toContain("-h")
})

test("crap4ts -h prints usage and exits 0", async () => {
  const result = await run(["-h"])
  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain("Usage: crap4ts")
})

test("unknown flags print a message plus usage and exit 1", async () => {
  const result = await run(["--changed"])
  expect(result.exitCode).toBe(1)
  expect(result.stdout).toContain("Unknown option: --changed")
  expect(result.stdout).toContain("Usage: crap4ts")
})

test("missing --coverage-command value is a tool failure", async () => {
  const result = await run(["--coverage-command"])
  expect(result.exitCode).toBe(1)
  expect(result.stdout).toContain("--coverage-command requires a command")
  expect(result.stdout).toContain("Usage: crap4ts")
})

test("default oxc adapter scores a discovered file", async () => {
  await withDir({ "src/simple.ts": "export function simple() { return 1 }\n" }, async (cwd) => {
    const result = await run([], { cwd, runCoverage: silentCoverage() })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("simple")
    expect(result.stdout).toContain("src/simple.ts")
  })
})

test("prints a CRAP table after wipe-run-analyze", async () => {
  await withDir({ "src/foo.ts": "export function foo() { return 1 }\n" }, async (cwd) => {
    const result = await run([], {
      cwd,
      parser: canned,
      runCoverage: silentCoverage(`SF:src/foo.ts
DA:1,1
DA:2,1
end_of_record
`),
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("CRAP Report")
    expect(result.stdout).toContain("foo")
    expect(result.stdout).toContain("src/foo.ts")
    expect(result.stdout).toContain("100.0%")
  })
})

test("missing LCOV is N/A and still exits 0", async () => {
  await withDir({ "src/foo.ts": "export function foo() { return 1 }\n" }, async (cwd) => {
    const result = await run([], { cwd, parser: canned, runCoverage: silentCoverage() })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("N/A")
  })
})

test("path fragments OR-filter discovered files", async () => {
  await withDir(
    {
      "src/combat.ts": "export function fight() { return 1 }\n",
      "src/move.ts": "export function walk() { return 1 }\n",
    },
    async (cwd) => {
      const parser: ParserAdapter = {
        scoringUnits(filename) {
          const name = filename.includes("combat") ? "fight" : "walk"
          return [{ name, file: filename, startLine: 1, endLine: 1, complexity: 1 }]
        },
      }
      const result = await run(["combat"], { cwd, parser, runCoverage: silentCoverage() })
      expect(result.stdout).toContain("fight")
      expect(result.stdout).not.toContain("walk")
    },
  )
})

test("skips declaration files, node_modules, dist, and coverage dirs", async () => {
  await withDir(
    {
      "src/keep.ts": "export function keep() { return 1 }\n",
      "src/skip.d.ts": "export function skip(): void\n",
      "node_modules/lib.ts": "export function dep() { return 1 }\n",
      "dist/out.ts": "export function built() { return 1 }\n",
      "coverage/cov.ts": "export function cov() { return 1 }\n",
      "target/coverage/old.ts": "export function old() { return 1 }\n",
    },
    async (cwd) => {
      const names: string[] = []
      const parser: ParserAdapter = {
        scoringUnits(filename) {
          names.push(filename)
          return [{ name: "keep", file: filename, startLine: 1, endLine: 1, complexity: 1 }]
        },
      }
      await run([], { cwd, parser, runCoverage: silentCoverage() })
      expect(names).toEqual(["src/keep.ts"])
    },
  )
})

test("wipes target/coverage then runs the coverage command", async () => {
  await withDir({ "src/foo.ts": "export function foo() { return 1 }\n" }, async (cwd) => {
    await mkdir(join(cwd, "target/coverage"), { recursive: true })
    await writeFile(join(cwd, "target/coverage/stale.txt"), "nope")
    const commands: string[] = []
    const result = await run([], {
      cwd,
      parser: canned,
      runCoverage: async (command, dir) => {
        commands.push(command)
        try {
          await readFile(join(dir, "target/coverage/stale.txt"))
          throw new Error("stale coverage survived the wipe")
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
        }
        return 0
      },
    })
    expect(result.exitCode).toBe(0)
    expect(commands).toEqual([
      "vitest run --coverage --coverage.reporter=lcov --coverage.reportsDirectory=target/coverage",
    ])
  })
})

test("substitutes {lcov} in --coverage-command and does not append flags", async () => {
  await withDir({ "src/foo.ts": "export function foo() { return 1 }\n" }, async (cwd) => {
    const commands: string[] = []
    await run(["--coverage-command", "nyc --reporter=lcov --report-dir {lcov}"], {
      cwd,
      parser: canned,
      runCoverage: async (command) => {
        commands.push(command)
        return 0
      },
    })
    expect(commands).toEqual(["nyc --reporter=lcov --report-dir target/coverage/lcov.info"])
  })
})

test("coverage command failure exits 1", async () => {
  await withDir({ "src/foo.ts": "export function foo() { return 1 }\n" }, async (cwd) => {
    const result = await run([], { cwd, parser: canned, runCoverage: async () => 1 })
    expect(result.exitCode).toBe(1)
    expect(result.stdout).not.toContain("CRAP Report")
  })
})

test("parse failure exits 1", async () => {
  await withDir({ "src/foo.ts": "export function foo() { return 1 }\n" }, async (cwd) => {
    const parser: ParserAdapter = {
      scoringUnits() {
        throw new Error("boom")
      },
    }
    const result = await run([], { cwd, parser, runCoverage: silentCoverage() })
    expect(result.exitCode).toBe(1)
    expect(result.stdout).toContain("boom")
  })
})
