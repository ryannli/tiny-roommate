# TinyRoommate Docs

This `docs/` folder is the current source of truth for product, interaction, and workflow decisions.

When a PR changes user-facing behavior, design intent, or developer workflow, the relevant docs here should be updated in the same change.

## Read Order

1. [Product Spec](./product-spec.md)
2. [Interaction Spec](./interaction-spec.md)
3. [Development Workflow](./development-workflow.md)

## Asset Docs

Asset and character pipeline docs still live at the repo root:

- [Sprite Spec](../SPRITE-SPEC.md)

## Working Rule

- Specs are for alignment and review.
- Code should follow the specs.
- If the product direction changes, update the spec in the same PR as the code.
- If a change is intentionally spec-neutral, call that out in the PR summary.
