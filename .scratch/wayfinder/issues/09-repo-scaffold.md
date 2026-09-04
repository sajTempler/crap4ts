Type: task
Status: resolved
Blocked by:

## Question

Scaffold the local pnpm workspace so both packages compile and our own tests run, before any scoring logic.

Do: pin pnpm 12.0.0 (`mise.toml` + root `"packageManager"`); private root name `crap4ts-workspace`; `packages/crap4ts` and `packages/scrap4ts` with unscoped names matching binaries; TypeScript 7 `tsc`; Node ESM; Vitest for *our* tests. Empty bin stubs that print `--help` are enough. No git init.

Layout and names: [What are the two package names, binary names, and workspace layout?](05-package-layout.md). CLI help text: [What is the v1 CLI contract?](08-cli-contract.md). Use tdd.

## Answer

pnpm workspace is up: root name `crap4ts-workspace`, `packageManager` `pnpm@12.0.0`, `mise.toml` pins `pnpm = "12.0.0"`. Catalog pins TypeScript 7.0.2, Vitest 4.1.11, `@types/node` 26.4.0.

| directory | npm `name` | binary | help |
| --- | --- | --- | --- |
| `packages/crap4ts` | `crap4ts` | `dist/bin.js` | Usage line plus `--coverage-command` |
| `packages/scrap4ts` | `scrap4ts` | `dist/bin.js` | Usage line plus `--verbose` / `--json` / `--write-baseline` / `--compare` |

Each package is Node ESM, compiles with `tsc`, and has a `SKILL.md` at its root. The CLI seam is `run(args) → { exitCode, stdout }`; stubs print help for `-h` / `--help` (and currently for any other argv too). No scoring yet. `pnpm test` and `pnpm build` both pass. No git init.

