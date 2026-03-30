# Contributing to TinyRoommate

Thanks for contributing.

TinyRoommate uses a docs-first workflow so product behavior does not drift through scattered code changes alone.

## Start Here

Before changing product behavior, UI, or workflow:

1. Read [docs/README.md](../docs/README.md).
2. Read the relevant spec files in `docs/`.
3. If your change touches custom character assets, also read [SPRITE-SPEC.md](../SPRITE-SPEC.md).

## Core Rule

If a PR changes user-facing behavior, design intent, or workflow:

- update the relevant docs in the same PR, or
- explicitly mark the PR as a docs bypass and explain why docs were not updated

Silent divergence between docs and code is not acceptable.

## Docs Bypass

Docs bypass is allowed when the author is intentionally making a spec-neutral change and is aware of that choice.

Typical examples:

- pure refactors with no behavior change
- test-only changes
- internal cleanup that preserves the current contract
- small fixes that restore already-documented behavior

If you use the bypass path, say so clearly in the PR and give a short reason.

## Validation

For UI or runtime changes, before merging:

- run relevant tests
- run a production build

Common commands:

```bash
npm install
npm test
npm run build
npm run tauri:dev
```

## PR Checklist

Every PR should make it easy for reviewers to answer:

1. Which spec did this follow?
2. Did the PR update docs or intentionally bypass docs?
3. What tests protect the behavior?
4. Does the shipped result still match the documented intent?
