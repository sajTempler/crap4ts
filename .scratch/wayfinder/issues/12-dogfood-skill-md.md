Type: task
Status: resolved
Blocked by: 11

## Question

Dogfood crap4ts and scrap4ts on this workspace and lock SKILL.md wording to the live Reports.

Both binaries exist. Run them from the workspace against this repo's own packages. Fix `packages/crap4ts/SKILL.md` and `packages/scrap4ts/SKILL.md` if the live output disagrees. High scores, `SPLIT`, and `REVIEW_FIRST` must not fail the process.

## Answer

Both binaries ran against this repo's own packages. Exit 0 with high CRAP (`analyzeBody` 95.6 on scrap4ts), `REVIEW_FIRST`, and `LOCAL`/`STABLE` (no `SPLIT` in this run).

Live CRAP table: `Function` / `File` / `CC` / `Cov%` / `CRAP`, worst first, `N/A` last. Test files are scored; Vitest omits them from LCOV so those rows are `N/A`. Live SCRAP Report: `=== SCRAP Report ===`, then `refactor-pressure`, `remediation-mode`, `ai-actionability`, `ai-guidance`, `why` / `worst-examples` / `how`, then a `Worst Examples` footer. `where:` is absent when the file has no `describe` blocks.

Default crap4ts coverage needs `@vitest/coverage-v8` on the target project and `vitest` on PATH. Catalog pin `4.1.11`; both packages now depend on it. Bare `node dist/bin.js` fails with `vitest: command not found`; `pnpm exec -- node dist/bin.js` inside a package works.

SKILL.md samples and setup commands were rewritten to that live output.
