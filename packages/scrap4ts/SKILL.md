---
name: scrap4ts
description: Use when the user asks for a SCRAP report, Vitest test-structure analysis, or guidance on whether to refactor test files
---

# scrap4ts - SCRAP Metric for Vitest

Computes the **SCRAP** structural quality score for Vitest examples (`it` / `test`) and the file-level guidance derived from them. SCRAP is aimed at test code the way CRAP is aimed at production code. It does not print a CRAP table.

## Setup

Run from the root of a Vitest project:

```bash
pnpm exec scrap4ts
```

From this repo, after `pnpm build`:

```bash
node packages/scrap4ts/dist/bin.js
```

Or inside a package:

```bash
pnpm exec -- node dist/bin.js
```

## Usage

```bash
# Score discovered Vitest files
scrap4ts

# Filter to path fragments (substring match, several are OR)
scrap4ts src/combat movement

# Full per-file, block, and example metrics
scrap4ts --verbose

# Machine-readable JSON (not a Report)
scrap4ts --json

# Write a baseline under target/scrap/
scrap4ts --write-baseline

# Compare the current run to a saved baseline
scrap4ts --compare target/scrap/baseline.json
```

Discovery uses `vitest.config.*` `test.include` / `test.exclude` when that file exists, otherwise Vitest's default include/exclude.

### Output

A guidance Report. Header `=== SCRAP Report ===`, then one block per file, then a `Worst Examples` footer. This is a live run of scrap4ts on `packages/scrap4ts`:

```
=== SCRAP Report ===

src/cli.test.ts
  refactor-pressure: HIGH (50.1)
  remediation-mode: LOCAL
  ai-actionability: REVIEW_FIRST
  ai-guidance: Do not auto-refactor immediately; inspect the file shape before acting on the recommendations.
  why:
    avg-scrap: 13.9
    max-scrap: 21.255768174295255
    recommended-extraction-count: 0
    extraction-pressure-score: 0.0
    harmful-duplication-score: 18
    effective-duplication-score: 0
    coverage-matrix-candidates: 0
    case-matrix-repetition: 0
    subject-repetition-score: 13
    helper-hidden-example-count: 10
    low-assertion-ratio: 0.07
    branching-ratio: 0.71
    mocking-ratio: 0.00
  worst-examples:
    parse errors exit 1 -> SCRAP 21.3 [low-assertion-density, temp-resource-work, helper-hidden-complexity]
    prints a SCRAP guidance report for a discovered Vitest file -> SCRAP 19.3 [large-example, temp-resource-work, helper-hidden-complexity]
    path fragments OR-filter discovered test files -> SCRAP 19.3 [large-example, temp-resource-work, helper-hidden-complexity]
    skips production sources, type tests, and node_modules -> SCRAP 19.3 [large-example, temp-resource-work, helper-hidden-complexity]
    --json emits JSON, not a Report -> SCRAP 19.3 [large-example, temp-resource-work, helper-hidden-complexity]
  how:
    HIGH: Split oversized examples into narrower examples.
    MEDIUM: Remove logic from specs or keep variation in explicit data tables rather than control flow.
    LOW: Be skeptical of helper extraction that only hides setup; helper-hidden complexity should still count as complexity.
    LOW: Consider splitting this file or block by responsibility.

src/collect.test.ts
  refactor-pressure: LOW (17.1)
  remediation-mode: LOCAL
  ai-actionability: REVIEW_FIRST
  ai-guidance: Do not auto-refactor immediately; inspect the file shape before acting on the recommendations.

Worst Examples:
  1. src/score.test.ts :: compareReports is improved when fileScore drops by 5+ without regressions  SCRAP 32.2
```

`where:` prints only when the file has `describe` blocks. `recommended-extractions:` prints only when extractions were recommended.

`remediation-mode` is `STABLE`, `LOCAL`, or `SPLIT`. `ai-actionability` is `LEAVE_ALONE`, `AUTO_TABLE_DRIVE`, `AUTO_REFACTOR`, `MANUAL_SPLIT`, or `REVIEW_FIRST`. High scores, `SPLIT`, and `REVIEW_FIRST` do not fail the process.

`--verbose` replaces the guidance block with per-file, block, and example metrics (`SCRAP:`, `assertions:`, `smells:`). `--json` is not a Report.

## How It Works

1. Discovers Vitest test files and applies path-fragment filters
2. Collects examples with oxc in scrap4ts (not crap4ts's parser adapter)
3. Scores each example with the Speclj saturating decision layer, adapted to Vitest (`test.for` / `test.each` is one table-driven example; nested `describe` is a block path)
4. Prints the guidance Report (or JSON / baseline / compare when those flags are set)
