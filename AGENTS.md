# TinyRoommate Agent Guide

## Read First

Before making product, UX, or workflow changes:

1. Read [docs/README.md](./docs/README.md).
2. Read the relevant files in `docs/`.
3. If the change touches custom character assets, also read [SPRITE-SPEC.md](./SPRITE-SPEC.md).

Treat `docs/` as the current source of truth for product, interaction, and workflow decisions.

## Repo-Specific Rules

- If code changes user-facing behavior, update the relevant docs in the same change.
- Do not leave docs and code silently diverged.
- `.pet-data/` is runtime data and is not checked into git.
- `.pet-data-template/` is the tracked template copied into `.pet-data/` on first launch.
- Follow the repo's existing Vanilla JS style: `var`/`function`, no TypeScript.
