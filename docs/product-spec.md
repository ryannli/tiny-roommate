# Product Spec

## One-Liner

TinyRoommate is a lightweight AI desktop companion that makes long hours feel a little less lonely.

## Product Intent

The pet should feel like a small living presence on the desktop:

- ambient, not demanding
- emotionally warm, not overly chatty
- useful in a soft way, not a productivity dashboard
- local-first and inspectable

## Core Experience

The default experience should look like this:

1. A small pet lives on the desktop and animates continuously.
2. Most of the time it quietly idles, walks, rests, or reacts to context.
3. Sometimes it says something short and relevant.
4. The owner can pet it, drag it, or talk to it, but the pet should not require constant management.

## Product Principles

### 1. The Pet Is the Main Character

The pet should remain the visual focus. Supporting UI exists to frame or support the pet, not to compete with it.

### 2. Calm by Default

The product should feel present but not noisy. Silence is often correct.

### 3. Emotion Over Instrumentation

Status UI is acceptable, but TinyRoommate should not drift into looking like a dashboard or widget tray.

### 4. Local, Readable, Hackable

The project should stay understandable to contributors:

- data stays local
- memory files are readable
- behavior should be inspectable
- major product decisions should live in docs, not only in code

## Current Feature Boundaries

### Pet Behavior

- autonomous idle behavior is part of the product, not just decoration
- reactions should feel short, cute, and contextual
- when the model is uncertain, graceful fallback is better than exposing internal reasoning or malformed output

### Human Interaction

- petting, dragging, and chatting are the primary direct interactions
- settings should feel lightweight and reversible
- customization should not require code changes for basic use

### Surface Area

- the app should stay visually small
- floating UI should avoid obscuring the pet whenever practical
- auxiliary windows should feel like extensions of the pet, not separate apps

## Non-Goals

TinyRoommate is not trying to be:

- a full desktop assistant
- a dense analytics tool
- a general-purpose chat app
- a maximally configurable framework before the core experience is stable

## Documentation Rule

If a PR changes any of the following, it should usually update a spec file:

- how the pet appears or reacts on screen
- speech bubble behavior or placement
- status UI behavior
- settings behavior or persistence rules
- interaction model
- major tone or product-direction decisions
