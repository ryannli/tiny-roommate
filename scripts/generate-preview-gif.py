#!/usr/bin/env python3
"""
Generate README/settings preview assets from a processed TinyRoommate sprite sheet.

Input must be the cleaned 8x9 PNG written to public/sprites/{name}.png.
This script creates:
1. an animated GIF for assets/previews/{name}.gif
2. an optional still PNG for assets/previews/{name}.png
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


FRAME_SIZE = 128
COLS = 8
ROWS = 9
DEFAULT_SEQUENCE = ["idle", "looking_around", "walk", "happy", "playful"]
STATE_ROWS = {
    "idle": 0,
    "walk": 1,
    "looking_around": 2,
    "sleep": 3,
    "work": 4,
    "playful": 5,
    "happy": 6,
    "sad": 7,
    "drag": 8,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate TinyRoommate preview GIF/PNG assets")
    parser.add_argument("input", help="Processed sprite sheet PNG, usually public/sprites/<name>.png")
    parser.add_argument("-o", "--output", required=True, help="Output GIF path")
    parser.add_argument(
        "--still-output",
        help="Optional still PNG path. Defaults to the GIF path with a .png extension.",
    )
    parser.add_argument(
        "--size",
        type=int,
        default=96,
        help="Output frame size for preview assets",
    )
    parser.add_argument(
        "--frame-duration",
        type=int,
        default=120,
        help="Frame duration in milliseconds",
    )
    parser.add_argument(
        "--sequence",
        nargs="+",
        default=DEFAULT_SEQUENCE,
        help="Ordered animation states to include in the preview GIF",
    )
    return parser.parse_args()


def validate_sheet(sheet: Image.Image) -> None:
    expected = (FRAME_SIZE * COLS, FRAME_SIZE * ROWS)
    if sheet.size != expected:
        raise SystemExit(
            f"Expected a {expected[0]}x{expected[1]} processed sheet, got {sheet.width}x{sheet.height}"
        )


def extract_frames(sheet: Image.Image, sequence: list[str], size: int) -> list[Image.Image]:
    frames: list[Image.Image] = []

    for state in sequence:
        row = STATE_ROWS.get(state)
        if row is None:
            valid = ", ".join(STATE_ROWS.keys())
            raise SystemExit(f"Unknown state '{state}'. Valid states: {valid}")

        for col in range(COLS):
            frame = sheet.crop(
                (
                    col * FRAME_SIZE,
                    row * FRAME_SIZE,
                    (col + 1) * FRAME_SIZE,
                    (row + 1) * FRAME_SIZE,
                )
            )
            if size != FRAME_SIZE:
                frame = frame.resize((size, size), Image.Resampling.LANCZOS)
            frames.append(frame)

    return frames


def save_still(frame: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.save(path)


def save_gif(frames: list[Image.Image], path: Path, frame_duration: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    first, rest = frames[0], frames[1:]
    first.save(
        path,
        save_all=True,
        append_images=rest,
        loop=0,
        duration=frame_duration,
        disposal=2,
        optimize=False,
    )


def main() -> None:
    args = parse_args()
    input_path = Path(args.input)
    output_path = Path(args.output)
    still_path = Path(args.still_output) if args.still_output else output_path.with_suffix(".png")

    sheet = Image.open(input_path).convert("RGBA")
    validate_sheet(sheet)
    frames = extract_frames(sheet, args.sequence, args.size)

    save_gif(frames, output_path, args.frame_duration)
    save_still(frames[0], still_path)

    print(f"Saved GIF: {output_path}")
    print(f"Saved PNG: {still_path}")


if __name__ == "__main__":
    main()
