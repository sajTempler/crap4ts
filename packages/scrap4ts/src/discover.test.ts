import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "vitest"
import { findTestFiles } from "./discover.js"

async function withDir(files: Record<string, string>, fn: (cwd: string) => Promise<void>) {
  const cwd = await mkdtemp(join(tmpdir(), "scrap4ts-discover-"))
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

test("non-string include entries fall back to default test globs", async () => {
  await withDir(
    {
      "vitest.config.ts": `export default { test: { include: [42] } }\n`,
      "src/add.test.ts": simpleTest,
    },
    async (cwd) => {
      const files = await findTestFiles(cwd, [])
      expect(files).toContain("src/add.test.ts")
    },
  )
})

test("identifier include entries fall back to default test globs", async () => {
  await withDir(
    {
      "vitest.config.ts": `const pattern = "checks/**/*.ts"
export default { test: { include: [pattern] } }
`,
      "src/add.test.ts": simpleTest,
      "checks/foo.ts": simpleTest,
    },
    async (cwd) => {
      const files = await findTestFiles(cwd, [])
      expect(files).toContain("src/add.test.ts")
      expect(files).not.toContain("checks/foo.ts")
    },
  )
})

test("quoted config keys still honor include globs", async () => {
  await withDir(
    {
      "vitest.config.ts": `export default { "test": { "include": ["src/**/*.test.ts"] } }\n`,
      "src/add.test.ts": simpleTest,
    },
    async (cwd) => {
      const files = await findTestFiles(cwd, [])
      expect(files).toEqual(["src/add.test.ts"])
    },
  )
})

test("include globs treat ? as one path character and ?(group) as optional", async () => {
  await withDir(
    {
      "vitest.config.ts": `export default { test: { include: ["src/*.tes?.ts", "lib/?(extra.ts)"] } }\n`,
      "src/add.test.ts": simpleTest,
      "lib/extra.ts": simpleTest,
    },
    async (cwd) => {
      const files = await findTestFiles(cwd, [])
      expect(files).toContain("src/add.test.ts")
      expect(files).toContain("lib/extra.ts")
    },
  )
})
