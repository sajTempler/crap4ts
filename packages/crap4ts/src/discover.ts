import type { Dirent } from "node:fs"
import { readdir } from "node:fs/promises"
import { join, relative, sep } from "node:path"

const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", "target", "build", ".git"])

export async function findSourceFiles(root: string, fragments: string[]): Promise<string[]> {
  const files: string[] = []
  await walk(root, root, files)
  files.sort()
  if (fragments.length === 0) return files
  return files.filter((file) => fragments.some((fragment) => file.includes(fragment)))
}

async function visitDir(root: string, path: string, files: string[], name: string): Promise<void> {
  if (SKIP_DIRS.has(name)) return
  await walk(root, path, files)
}

function visitFile(root: string, path: string, files: string[], name: string): void {
  if (isTypeScriptSource(name)) files.push(toPosix(relative(root, path)))
}

async function visitEntry(root: string, dir: string, files: string[], entry: Dirent): Promise<void> {
  const path = join(dir, entry.name)
  if (entry.isDirectory()) {
    await visitDir(root, path, files, entry.name)
    return
  }
  if (entry.isFile()) visitFile(root, path, files, entry.name)
}

async function walk(root: string, dir: string, files: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    await visitEntry(root, dir, files, entry)
  }
}

function isTypeScriptSource(name: string): boolean {
  if (/\.d\.(ts|mts|cts)$/.test(name)) return false
  return /\.(ts|tsx|mts|cts)$/.test(name)
}

function toPosix(path: string): string {
  return path.split(sep).join("/")
}
