---
name: crap4ts
description: Use when the user asks for a CRAP report, cyclomatic complexity analysis, or code quality metrics on a TypeScript project
---

# crap4ts - CRAP Metric for TypeScript

Computes the **CRAP** (Change Risk Anti-Pattern) score for every body-bearing TypeScript function-like that is not nested in another function. CRAP combines cyclomatic complexity with Vitest LCOV coverage to identify scoring units that are both complex and under-tested.

## Setup

The target project needs Vitest and a coverage provider (`@vitest/coverage-v8` or istanbul). `vitest` must be on PATH; `pnpm exec` / `npm exec` put it there.

From a Node project that depends on crap4ts:

```bash
pnpm exec crap4ts
```

From this repo, after `pnpm build`, run inside a package so Vitest resolves:

```bash
pnpm exec -- node dist/bin.js
```

Bare `node packages/crap4ts/dist/bin.js` from the workspace root fails with `vitest: command not found`. Use `pnpm exec --` or pass `--coverage-command`.

## Usage

```bash
# Analyze all .ts / .tsx / .mts / .cts files under the cwd
crap4ts

# Filter to path fragments (substring match, several are OR)
crap4ts src/combat movement
```

crap4ts deletes `target/coverage`, runs `vitest run --coverage --coverage.reporter=lcov --coverage.reportsDirectory=target/coverage`, reads `target/coverage/lcov.info`, and prints the report. Pass `--coverage-command` to replace that command. `{lcov}` in the command becomes `target/coverage/lcov.info`.

### Output

A table sorted by CRAP score, worst first. This is the top of a live run of crap4ts on `packages/crap4ts`:

```
CRAP Report
===========
Function                       File                                  CC    Cov%     CRAP
----------------------------------------------------------------------------------------
hitsInRange                    src/coverage.ts                        5  100.0%      5.0
linesForFile                   src/coverage.ts                        5  100.0%      5.0
sortByCrap                     src/crap.ts                            5  100.0%      5.0
bindingName                    src/oxc-adapter.ts                     5  100.0%      5.0
consumeArgs                    src/cli.ts                             4  100.0%      4.0
```

Test files are scored. Vitest omits them from LCOV, so those rows are `N/A`, not 0%. High scores do not fail the process.

## Interpreting Scores

| CRAP Score | Meaning |
|-----------|---------|
| 1-5       | Clean - low complexity, well tested |
| 5-30      | Moderate - consider refactoring or adding tests |
| 30+       | Crappy - high complexity with poor coverage |

A missing LCOV file, or a file with no `SF` match, is `N/A`, not 0%.

## How It Works

1. Deletes `target/coverage` and runs the coverage command
2. Finds `.ts` / `.tsx` / `.mts` / `.cts` files, skipping `.js`, `.d.ts`, `node_modules`, `dist`, and coverage dirs
3. Extracts non-nested scoring units with line ranges
4. Computes cyclomatic complexity (`if`, loops, switch cases including `default`, `catch`, `&&`, `||`, ternary)
5. Joins LCOV `DA` lines to each unit's source span
6. Applies CRAP formula: `CC² × (1 - cov)³ + CC`
7. Sorts by CRAP score descending and prints the report

## Troubleshooting

- **`vitest: command not found`**: run via `pnpm exec --` so `node_modules/.bin` is on PATH, or pass `--coverage-command`.
- **`Cannot find dependency '@vitest/coverage-v8'`**: add `@vitest/coverage-v8` (or istanbul) as a dev dependency of the target project.
- **All coverage `N/A`**: the coverage command did not write `target/coverage/lcov.info`, or `SF` paths did not suffix-match the discovered files.
