Type: research
Status: resolved
Blocked by: 01

## Question

How do we map Vitest coverage onto a scoring unit's source range so CRAP coverage is honest?

Family tools wipe coverage, rerun tests, then join by file and line range. This repo will run Vitest with coverage and read LCOV, with a custom coverage command allowed.

Settle:

- Default command (`vitest run --coverage` plus LCOV reporter) and artifact path (`coverage/lcov.info` vs `target/coverage/` like the family).
- v8 vs istanbul: which LCOV we consume, and whether function records (`FN`/`FNDA`) or statement/line ranges are the join key.
- Path aliases, `rootDir`, source maps from Vite, monorepo package paths.
- Missing file → `N/A` (family) vs 0%.

Primary sources: https://vitest.dev/guide/coverage, https://vitest.dev/config/coverage, lcov spec / Istanbul LCOV reporter, crap4clj LCOV join and crap4go coverprofile join. Write to `docs/research/vitest-lcov-coverage-mapping.md`.

## Answer

Join LCOV `SF:` + `DA:line,count` to the scoring unit's file and line span. Ignore `FN`/`FNDA`. Default command is `vitest run --coverage --coverage.reporter=lcov --coverage.reportsDirectory=target/coverage` → `target/coverage/lcov.info`. Bare `--coverage` does not write LCOV. v8 and istanbul both emit that same Istanbul LCOV. Missing `SF` is `N/A`, not 0%. Paths: Vitest `config.root`, then family normalize + suffix match.

Detail: [docs/research/vitest-lcov-coverage-mapping.md](../../../docs/research/vitest-lcov-coverage-mapping.md)
