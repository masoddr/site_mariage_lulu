"""Prepare Lucie's artwork for the website.

The PNG files received from Lucie are exported on oversized canvases: up to 55%
of `presence.png` is fully transparent padding. Left as-is, that padding becomes
invisible box area in CSS and silently breaks any layout built on the images.

This script rebuilds a clean copy of every asset by cropping it to its opaque
bounding box, so an image's box in the browser matches what the eye sees.

The source directory is never modified. Run it again whenever Lucie sends
updated artwork:

    python scripts/prepare_assets.py

Astro handles the WebP/AVIF conversion and the responsive `srcset` itself at
build time (`astro:assets`), so this script deliberately stays PNG-only.
"""

from __future__ import annotations

import argparse
import logging
import sys
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

logger = logging.getLogger(__name__)

# Alpha below this value is treated as fully transparent when measuring content.
ALPHA_THRESHOLD = 8

# Transparent pixels kept around the content, to avoid clipping antialiased edges.
SAFETY_MARGIN_PX = 2

DEFAULT_SOURCE_DIR = Path("assets-source")
DEFAULT_OUTPUT_DIR = Path("src/assets/images")

# `enveloppe-fermee.png` ships a drop shadow baked into the artwork, drawn in a
# light beige. It reads as a shadow over a white page, but as an ugly white halo
# over the dark backdrop of the home page. Its alpha histogram is cleanly
# bimodal (body >= 240, halo <= 143, almost nothing between), so cutting the
# alpha channel at 144 removes the halo and keeps the antialiased edge. A real
# CSS drop shadow is applied in `Envelope.astro` instead, which adapts to any
# background.
#
# Keyed by path relative to the source directory. Assets absent from this map
# keep their alpha untouched: the other files only carry sub-1% antialiasing,
# and cutting those would make their edges jagged.
ALPHA_CUTOFFS: dict[str, int] = {
    "envelope/enveloppe-fermee.png": 144,
}


class AssetPreparationError(Exception):
    """Raised when an asset cannot be prepared."""


@dataclass(frozen=True)
class CropReport:
    """Outcome of cropping a single asset."""

    source: Path
    destination: Path
    canvas: tuple[int, int]
    content: tuple[int, int]
    source_bytes: int
    output_bytes: int

    @property
    def aspect_ratio(self) -> float:
        """Width / height of the cropped image."""
        return self.content[0] / self.content[1]

    @property
    def bytes_saved(self) -> int:
        """Bytes removed by the crop (may be negative on re-encode)."""
        return self.source_bytes - self.output_bytes


def opaque_bounding_box(image: Image.Image) -> tuple[int, int, int, int]:
    """Return the bounding box of the visible content of an RGBA image.

    Args:
        image (Image.Image): Image to inspect, converted to RGBA beforehand.

    Returns:
        tuple[int, int, int, int]: Left, upper, right and lower pixel bounds.

    Raises:
        AssetPreparationError: If the image is fully transparent.
    """
    mask = image.getchannel("A").point(lambda a: 255 if a > ALPHA_THRESHOLD else 0)
    bbox = mask.getbbox()
    if bbox is None:
        raise AssetPreparationError("image is fully transparent")
    return bbox


def expand_box(
    box: tuple[int, int, int, int],
    margin: int,
    bounds: tuple[int, int],
) -> tuple[int, int, int, int]:
    """Grow a bounding box by `margin`, clamped to the image bounds.

    Args:
        box (tuple[int, int, int, int]): Box to expand.
        margin (int): Pixels to add on each side.
        bounds (tuple[int, int]): Width and height of the source image.

    Returns:
        tuple[int, int, int, int]: The expanded, clamped box.
    """
    left, upper, right, lower = box
    width, height = bounds
    return (
        max(0, left - margin),
        max(0, upper - margin),
        min(width, right + margin),
        min(height, lower + margin),
    )


def remove_alpha_halo(image: Image.Image, cutoff: int) -> Image.Image:
    """Drop the diffuse halo of an RGBA image by rescaling its alpha channel.

    Alpha values at or below `cutoff` become fully transparent; values above are
    stretched linearly back to the full 0-255 range, which preserves a thin
    antialiased edge instead of producing a hard, jagged cut.

    Args:
        image (Image.Image): Image to clean, in RGBA mode.
        cutoff (int): Alpha value below which pixels are discarded.

    Returns:
        Image.Image: A new RGBA image with the halo removed.
    """
    span = 255 - cutoff
    alpha = image.getchannel("A").point(
        lambda a: 0 if a <= cutoff else min(255, round((a - cutoff) * 255 / span))
    )
    cleaned = image.copy()
    cleaned.putalpha(alpha)
    return cleaned


def prepare_asset(source: Path, destination: Path, alpha_cutoff: int | None = None) -> CropReport:
    """Crop one asset to its visible content and write it to `destination`.

    The crop is applied to the image in its original mode. Some of Lucie's
    exports are palette PNGs (`mode == "P"`), and converting those to RGBA
    before saving would inflate them by several hundred kilobytes.

    Args:
        source (Path): PNG file to read.
        destination (Path): PNG file to write; parent directories are created.
        alpha_cutoff (int | None): When set, remove the diffuse alpha halo below
            this value. Forces an RGBA output, since a palette image cannot hold
            a graded alpha channel.

    Returns:
        CropReport: Details of what was cropped, for logging and reporting.

    Raises:
        AssetPreparationError: If the source image holds no visible pixel.
    """
    with Image.open(source) as raw:
        raw.load()
        original = raw.copy()

    if alpha_cutoff is not None:
        original = remove_alpha_halo(original.convert("RGBA"), alpha_cutoff)

    try:
        box = opaque_bounding_box(original.convert("RGBA"))
    except AssetPreparationError as exc:
        raise AssetPreparationError(f"{source}: {exc}") from exc

    box = expand_box(box, SAFETY_MARGIN_PX, original.size)
    cropped = original.crop(box)

    destination.parent.mkdir(parents=True, exist_ok=True)
    # `transparency` is not carried over by `crop`, so it is passed explicitly
    # to keep the transparent index of palette PNGs.
    save_kwargs: dict[str, object] = {"format": "PNG", "optimize": True}
    transparency = original.info.get("transparency")
    if transparency is not None:
        save_kwargs["transparency"] = transparency
    cropped.save(destination, **save_kwargs)

    return CropReport(
        source=source,
        destination=destination,
        canvas=original.size,
        content=cropped.size,
        source_bytes=source.stat().st_size,
        output_bytes=destination.stat().st_size,
    )


def prepare_all(source_dir: Path, output_dir: Path) -> list[CropReport]:
    """Crop every PNG found under `source_dir`, mirroring the tree structure.

    Args:
        source_dir (Path): Directory holding the pristine artwork.
        output_dir (Path): Directory to (re)generate.

    Returns:
        list[CropReport]: One report per processed file, sorted by source path.

    Raises:
        AssetPreparationError: If `source_dir` holds no PNG file.
    """
    sources = sorted(source_dir.rglob("*.png"))
    if not sources:
        raise AssetPreparationError(f"no PNG file found under {source_dir}")

    reports: list[CropReport] = []
    for source in sources:
        relative = source.relative_to(source_dir)
        destination = output_dir / relative
        alpha_cutoff = ALPHA_CUTOFFS.get(relative.as_posix())
        report = prepare_asset(source, destination, alpha_cutoff)
        logger.info(
            "%-24s %4dx%-4d -> %4dx%-4d  ratio %.2f  %+d KiB%s",
            source.name,
            *report.canvas,
            *report.content,
            report.aspect_ratio,
            -report.bytes_saved // 1024,
            "  (halo retiré)" if alpha_cutoff is not None else "",
        )
        reports.append(report)
    return reports


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse the command line arguments."""
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--source-dir",
        type=Path,
        default=DEFAULT_SOURCE_DIR,
        help=f"pristine artwork directory (default: {DEFAULT_SOURCE_DIR})",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"directory to regenerate (default: {DEFAULT_OUTPUT_DIR})",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    """Entry point. Returns a shell exit code."""
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    args = parse_args(argv)

    try:
        reports = prepare_all(args.source_dir, args.output_dir)
    except (AssetPreparationError, OSError) as exc:
        logger.error("Asset preparation failed: %s", exc)
        return 1

    saved = sum(report.bytes_saved for report in reports)
    logger.info("")
    logger.info("%d assets prepared in %s", len(reports), args.output_dir)
    logger.info("Total size change: %+d KiB", -saved // 1024)
    return 0


if __name__ == "__main__":
    sys.exit(main())
