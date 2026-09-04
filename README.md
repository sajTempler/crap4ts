# crap4ts

Two sibling tools in one repo: **CRAP** for TypeScript production code, **SCRAP** for Vitest tests. They share a report style and nothing else of their scores.

Run `crap4ts` on the module you are about to change. Pin the worst function with tests, refactor, rerun. If the tests themselves are a mess, run `scrap4ts` first, and believe `LEAVE_ALONE` / `REVIEW_FIRST` when it says so.

`crap4ts` prints the family CRAP table. `scrap4ts` prints the SCRAP guidance report. High scores do not fail the process.

See [packages/crap4ts/SKILL.md](packages/crap4ts/SKILL.md) and [packages/scrap4ts/SKILL.md](packages/scrap4ts/SKILL.md) for setup and flags.

## Local install

Skills stay in the packages. Symlink them into `~/.agents/skills` (Claude already aliases that folder; Cursor already loads it). Do not copy.

```bash
mkdir -p ~/.agents/skills/crap4ts ~/.agents/skills/scrap4ts
ln -sfn "$PWD/packages/crap4ts/SKILL.md" ~/.agents/skills/crap4ts/SKILL.md
ln -sfn "$PWD/packages/scrap4ts/SKILL.md" ~/.agents/skills/scrap4ts/SKILL.md
```

Binaries, after `pnpm build`:

```bash
pnpm add --global --ignore-workspace "$PWD/packages/crap4ts" "$PWD/packages/scrap4ts"
```

That puts `crap4ts` and `scrap4ts` on PATH. Run them from a Vitest project.
