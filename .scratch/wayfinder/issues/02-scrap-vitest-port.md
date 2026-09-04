Type: research
Status: resolved
Blocked by:

## Question

Which Speclj SCRAP metrics, smells, and AI decision layers have a Vitest analog, which must be adapted, and which should be dropped?

The product intent is a real port of the decision layer (file/example scores, smells that exist on Vitest, duplication/extraction pressure, remediation and actionability), not a thin assertion counter and not a fake Speclj clone. Jest is out.

Primary sources: `/Users/szymon/herocoders/workspaces/scrap` (README and `src/scrap/`, not stale `scrap.md`) and official Vitest docs for `describe`/`it`/`test`, hooks, `expect`, `vi.mock` / `vi.spyOn`, file include patterns, and `test.each`.

Write findings to `docs/research/scrap-vitest-port.md` with a port / adapt / drop table and an explicit v1 surface.

## Answer

Port the decision layer in full (saturating complexity, eight smells, extraction pressure, `STABLE`/`LOCAL`/`SPLIT`, five `ai-actionability` modes). Adapt every detector to Vitest (`expect`/`assert`, `test.for`, `vi.spyOn` vs hoisted `vi.mock`, nested `describe` as a block path). Drop Speclj nesting rules, the paren scanner, `expectTypeOf` as a runtime assertion, and treating every `const` as setup-depth.

Parse with oxc-parser via the parser adapter (charting), not TypeScript 6 as the research note first suggested.

Detail: [docs/research/scrap-vitest-port.md](../../../docs/research/scrap-vitest-port.md)
