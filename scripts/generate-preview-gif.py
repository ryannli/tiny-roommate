#!/usr/bin/env python3
"""
Generate README/settings preview assets from a processed TinyRoommate sprite sheet.

Input must be the cleaned 8x9 PNG written to public/sprites/{name}.png.
This script creates an animated GIF for assets/previews/{name}.gif.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


FRAME_SIZE = 128
COLS = 8
ROWS = 9
DEFAULT_SEQUENCE = ["idle"]
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
        "--size",
        type=int,
        default=256,
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


def prepare_for_gif(frame: Image.Image, alpha_threshold: int = 128) -> Image.Image:
    """Prepare an RGBA frame for GIF export.

    GIF only supports 1-bit transparency. Semi-transparent edge pixels often
    carry color from the original background (e.g. magenta). When GIF makes
    them fully opaque, that color becomes visible fringe.

    Fix: for semi-transparent pixels that will become opaque, replace their
    RGB with the average color of nearby fully-opaque pixels. This way the
    edge blends into the subject instead of showing background bleed.
    """
    arr = np.array(frame).copy()
    h, w = arr.shape[:2]
    alpha = arr[:, :, 3]

    fully_opaque = alpha == 255
    will_be_opaque = (alpha >= alpha_threshold) & ~fully_opaque  # semi-transparent -> opaque

    # For each semi-transparent pixel that will become opaque,
    # replace its RGB with average of surrounding fully-opaque pixels
    ys, xs = np.where(will_be_opaque)
    for y, x in zip(ys, xs):
        # Sample neighbors in a 5x5 window
        y0, y1 = max(0, y - 2), min(h, y + 3)
        x0, x1 = max(0, x - 2), min(w, x + 3)
        region_opaque = fully_opaque[y0:y1, x0:x1]
        if region_opaque.any():
            region_rgb = arr[y0:y1, x0:x1, :3]
            arr[y, x, :3] = region_rgb[region_opaque].mean(axis=0).astype(np.uint8)

    # Snap alpha to binary
    arr[:, :, 3] = np.where(alpha >= alpha_threshold, 255, 0)
    return Image.fromarray(arr)


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

    sheet = Image.open(input_path).convert("RGBA")
    validate_sheet(sheet)
    frames = extract_frames(sheet, args.sequence, args.size)

    prepared = [prepare_for_gif(f) for f in frames]
    save_gif(prepared, output_path, args.frame_duration)

    print(f"Saved GIF: {output_path}")


if __name__ == "__main__":
    main()
