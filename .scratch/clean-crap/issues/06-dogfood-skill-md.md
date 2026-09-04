Type: task
Status: resolved
Blocked by: 05

## Question

Dogfood crap4ts on this workspace after every in-scope unit is Clean, and lock each package `SKILL.md` to the live Reports.

Confirm no in-scope production row exceeds CRAP 5. Rewrite SKILL.md samples if the live table disagrees. High scores elsewhere (tests, `.scratch`) must still exit 0.

## Answer

Workspace-root crap4ts on concatenated LCOV (`SF:` prefixed with `packages/<pkg>/`): 355 in-scope production rows, every one CRAP ≤ 5 (worst 5.0). 121 test and `.scratch` rows, all `N/A`. Exit 0.

Package-level crap4ts on `packages/crap4ts` matches: every production row ≤ 5.0; test rows `N/A`; exit 0. Live scrap4ts on `packages/scrap4ts` still exits 0 with HIGH/CRITICAL, `LOCAL`, `REVIEW_FIRST`, and `AUTO_REFACTOR`.

Both package `SKILL.md` samples were rewritten to that live output.