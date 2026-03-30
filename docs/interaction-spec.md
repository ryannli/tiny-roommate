# Interaction Spec

This file captures the current UI and interaction decisions that should stay stable unless intentionally redesigned.

## Window Composition

The transparent main window has three conceptual layers:

1. the pet sprite
2. supporting status UI
3. transient conversational UI

The pet is the anchor. The other layers should adapt around it.

## Status UI

The `Days Together` label and hearts are supporting metadata, not the main event.

Current rules:

- they live in a reserved top-right area of the main window
- they should read as "next to" the pet, not "on top of" the pet
- they should not cover the pet's face or central silhouette
- when they need a nudge, bias them farther toward the outer top-right corner rather than inward over the pet
- if their measured size changes, the window layout should adapt to them

## Speech Bubble

Speech bubbles should feel natural and non-mechanical, but still respect a few strong constraints.

### Placement

- bubble candidates should come from the upper arc around the pet
- the allowed family is `top-left`, `top`, and `top-right`
- side placements are not part of the intended design
- placement can be slightly randomized within a small range so repeated bubbles do not feel rigid
- randomness should stay bounded and subtle
- short bubbles should be allowed to sit closer to the pet, while taller bubbles should leave a bit more breathing room
- while the pet is dragged, the bubble should stay visually anchored to the pet instead of accumulating offset
- when the pet crosses to another display, the bubble should follow onto that display and clamp against that display's visible work area

### Collision Avoidance

- bubbles should avoid covering the pet whenever reasonable
- especially avoid covering the face or the main body silhouette
- if space is limited, clamping inside the visible screen area is acceptable, but upper placements are still preferred

### Bubble Shape

- bubbles should prefer a landscape shape
- avoid narrow, tall boxes when the text can be laid out wider
- overlay and inline fallback should use the same geometry rules

## Cursor / Hover Language

- the custom SVG cursor is the intended hover language for the pet
- avoid mixing multiple cursor styles unless there is a deliberate redesign

## Settings Behavior

Settings should feel live, light, and trustworthy.

Current rules:

- opening settings should reflect the pet's live current state
- the settings window should remain draggable by its header instead of feeling pinned to a fixed screen slot
- the Pet Name and Call me fields should share the first compact row when space allows
- the AI provider chooser should appear before character selection in the settings flow
- changing character should preview immediately in the main window, including imported custom characters
- changing scale should preview immediately in the main window
- changing the AI provider should take effect in the current session for the next AI-backed action, without requiring a restart
- reopening settings should preserve the current saved or previewed value, not jump back to an unrelated default
- if the settings window reloads or temporarily loses its local state, it should rehydrate from the live main-window snapshot instead of overwriting config with blank fields
- default scale should come from the runtime screen-aware default until the user explicitly saves an override
- closing settings should feel instant, without waiting on slow disk work

## Direct Chat Interaction

Current rules:

- a single click should interrupt autonomous walking immediately and return the pet to idle
- single click should never open the chat input
- double click is the only direct gesture that opens the chat input
- if the chat input is already open, a single click on the pet should dismiss it

## Regression Strategy

For interaction-heavy behavior, prefer protecting the rules instead of only protecting the pixels.

Examples:

- bubble placement logic should live in pure layout helpers when possible
- settings persistence/normalization rules should live in pure state helpers when possible
- tests should assert the intended placement/state constraints directly

Screenshot review can still be useful, but it should not be the only defense against regressions.
