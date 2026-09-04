Type: grilling
Status: resolved
Blocked by:

## Question

What are the two package names, binary names, and workspace layout?

Already settled: two packages, two binaries, one local repo, not published yet. Candidate: pnpm workspace with `packages/crap4ts` and `packages/scrap4ts`, bins `crap4ts` and `scrap4ts`. Alternatives: npm workspaces, different npm names (`@unclebob/crap4ts`), or a third shared package (see [Do crap4ts and scrap4ts share a kernel package?](06-shared-kernel.md)).

## Answer

pnpm workspaces (`packages/*`). Private root `package.json` name `crap4ts-workspace` (must not collide with either CLI package).

| directory | npm `name` | binary | `SKILL.md` |
| --- | --- | --- | --- |
| `packages/crap4ts` | `crap4ts` | `crap4ts` | package root |
| `packages/scrap4ts` | `scrap4ts` | `scrap4ts` | package root |

No third directory until [Do crap4ts and scrap4ts share a kernel package?](06-shared-kernel.md). No npm scope. Pin **pnpm 12.0.0** (not the moving `next-12` tag) in both repo `mise.toml` (`pnpm = "12.0.0"`) and root `"packageManager": "pnpm@12.0.0"`.
