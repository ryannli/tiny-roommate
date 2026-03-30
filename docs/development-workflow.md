# Development Workflow

This file defines the expected workflow for both humans and coding agents.

## Goal

Keep the codebase and the design intent in sync.

The project should not rely on tribal knowledge or scattered chat history to explain why something works the way it does.

## Required Workflow

### Before Changing Code

1. Read [docs/README.md](./README.md).
2. Read the relevant spec files for the area you are touching.
3. If the change affects assets or custom characters, also read:
   - [SPRITE-SPEC.md](../SPRITE-SPEC.md)

### While Making Changes

- If the change alters behavior, UX, or workflow, update the relevant docs in the same PR.
- This includes porting or restoring behavior from another branch when the current branch docs do not already describe it.
- If the implementation no longer matches the current docs, do not silently leave them diverged.
- If a change is intentionally spec-breaking, update the spec first or in the same patch.
- If docs are intentionally not updated, make that explicit in the PR and give a short reason.

### Before Merging

- summarize which spec files were consulted
- summarize which spec files changed
- in the PR, check exactly one: `Docs updated in this PR` or `Docs intentionally not updated in this PR`
- if docs were intentionally not updated, fill in the bypass reason so reviewers know it was a conscious choice
- run tests relevant to the change
- run a production build for UI/runtime changes

## What Usually Requires a Docs Update

- speech bubble positioning or sizing behavior
- settings behavior, persistence, or performance expectations
- cursor/interaction behavior
- layout rules around the pet
- memory / brain protocol changes
- product direction or tone changes
- contributor workflow changes

## What Usually Does Not Require a Docs Update

- pure refactors with no behavior change
- test-only changes
- internal cleanup that preserves the same contract
- renames or comments that do not affect meaning
- small fixes that restore already-documented behavior without changing the contract

If unsure, prefer a small docs update over silence.

Even when a docs update is not needed, the PR should still explicitly mark that choice and explain why.

## Testing Philosophy

Prefer tests that lock down the actual rule:

- extract layout math into pure functions
- extract state normalization into pure functions
- test those functions directly

This is usually better than trying to protect everything with brittle screenshot tests.

## Local Development

Common commands:

```bash
npm install
npm run tauri:dev
npm test
npm run build
```

Use `npm run tauri:dev` for the full desktop app and `npm run build` before merging UI/runtime changes.

## Agent-Friendly Rules

This repository should be easy for Claude Code, Codex, and other coding agents to follow.

Agent expectations:

- read the docs first
- treat `docs/` as the current product/design source of truth
- update docs when changing behavior
- if docs are not updated, explicitly mark the PR as a docs bypass and give a reason
- mention docs touched in the final summary
- avoid heuristic patches when a clearer contract or helper can be introduced instead

## Review Template

For most behavior-facing PRs, reviewers should be able to answer:

1. Which spec does this follow?
2. Did the PR intentionally change the spec?
3. What tests protect the new rule?
4. Does the shipped behavior still match the documented intent?
