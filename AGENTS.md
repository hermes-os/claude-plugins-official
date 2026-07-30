READ ~/.agents/AGENTS.md BEFORE ANYTHING (skip if missing).

# Repository Guide

- This is an external marketplace checkout. `origin` is the canonical
  Anthropic repository and `fork` is the writable fork.
- Keep local `main` fast-forwarded to `origin/main`. Develop and publish changes
  from focused branches that track `fork`; never rewrite published history
  without an explicit reason and lease.
- Keep changes scoped to the affected plugin and follow the structure and
  contribution guidance in `README.md`.
- Plugin dependencies and other generated artifacts such as `node_modules/`
  are not source and must not be committed.
- For `external_plugins/imessage`, install with `bun install --frozen-lockfile`
  and verify TypeScript/build behavior before delivery.
