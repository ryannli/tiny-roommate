# Sprite Sheet Spec

## Grid Layout

- **8 columns × 9 rows** (72 frames total)
- Each cell is a square frame
- Background: pure magenta `#FF00FF`
- Recommended output: 4K+ (e.g. 4096×4608, each frame 512×512)
- Final output: 1024×1152 (each frame 128×128)

## Row Definitions

| Row | State | Description | Loop? |
|-----|-------|-------------|-------|
| 0 | idle | Relaxed, gentle breathing, occasional blink | Yes |
| 1 | walk | Walking forward, full body | Yes |
| 2 | looking_around | Head turning left/right, curious | Yes |
| 3 | sleep | Curled up, eyes closed, gentle breathing | Yes |
| 4 | work | At keyboard/laptop, focused | Yes |
| 5 | playful | Playing with toy, lighthearted | No |
| 6 | happy | Bright expression, joyful, hearts/sparkles | No |
| 7 | sad | Dejected, looking down, low energy | Yes |
| 8 | drag | Being held/carried, limbs dangling | Yes |

## Generation Prompt

Copy and customize for AI image generation (Gemini, Midjourney, etc.):

```
Generate a sprite sheet for an animated desktop pet character.

LAYOUT:
- 8 columns × 9 rows grid
- Each cell is a square frame (equal width and height)
- Aspect ratio: 8:9
- Recommended output: 4K+ (e.g. 4096×4608, giving 512×512 per frame)

BACKGROUND:
- Every pixel outside the character must be pure magenta #FF00FF
- No gradients, no shadows on background, no texture, no noise
- The character itself must not contain magenta or near-magenta colors
- No magenta reflections, outlines, or glow on the character

ANIMATION:
- Each row is one animation loop; frames progress left to right
- Adjacent frames must transition smoothly — no sudden jumps
- Character should stay centered in each frame
- Keep consistent size and proportions across all 72 frames

ROW DEFINITIONS (top to bottom):
- Row 1: Idle — relaxed, gentle breathing motion, occasional blink. Not static.
- Row 2: Walking — movement animation suggesting walking forward
- Row 3: Looking Around — head/body turning left and right, curious
- Row 4: Sleeping — eyes closed, resting, gentle breathing. No yawning (it loops).
- Row 5: Working — focused expression, sitting at a tiny keyboard
- Row 6: Playful — having fun with a small toy, lighthearted energy
- Row 7: Happy — bright expression, joyful body language, small hearts or sparkles
- Row 8: Sad — dejected, looking down, low energy, lonely
- Row 9: Being Held — picked up or carried, limbs dangling, mildly annoyed

CHARACTER: [describe your character]
STYLE: [e.g. "cute, photo-realistic" or "pixel art" or "chibi anime"]
```

## Processing

After generating, run:

```bash
python3 scripts/process-spritesheet-v3.py input.png \
  -o public/sprites/your_character.png \
  --cols 8 --rows 9 --target 128
```

Then add your character to `index.html` and `src/characters.js`. See [README](README.md#make-it-yours) for details.
