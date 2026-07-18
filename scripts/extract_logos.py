"""
Extract the official IO SKY brand assets from the uploaded brand sheet.

The hero (top) band of the sheet is a textured render with grain, which
breaks any thresholding-based transparency mask. The lower tiles
("PRIMARY LOGO", "ICON ONLY", "MINIMUM SIZING") are clean studio renders
on a flat dark blue panel, so we crop from those tiles instead.

Outputs (all PNG, transparent):
- io-sky-primary.png   (mark + "IO SKY" wordmark, no tagline)
- io-sky-mark.png      (Icon Only mark)
- io-sky-favicon.png   (square mark padded to 256×256)
"""

from pathlib import Path
import numpy as np
from PIL import Image

SRC = Path("/home/ubuntu/upload/echteIOSkyLogo.png")
OUT = Path("/home/ubuntu/webdev-static-assets")
OUT.mkdir(parents=True, exist_ok=True)


def transparent_crop(im: Image.Image, threshold: int = 90) -> Image.Image:
    """Treat very dark pixels as background, then crop to content bbox.
    Pixels above the threshold remain fully opaque; intermediates get a
    smooth alpha so anti-aliased edges of the wordmark stay clean."""
    rgba = im.convert("RGBA")
    arr = np.array(rgba).astype(np.int16)
    rgb = arr[..., :3]
    brightness = rgb.sum(axis=2) // 3  # 0..255
    alpha = np.clip((brightness - threshold) * 6, 0, 255).astype(np.uint8)
    arr[..., 3] = alpha
    out = Image.fromarray(arr.astype(np.uint8), "RGBA")
    a = np.array(out)[..., 3]
    ys, xs = np.where(a > 8)
    if len(xs) == 0:
        return out
    return out.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def main():
    src = Image.open(SRC).convert("RGB")
    W, H = src.size  # 1536 × 1024

    # ---- Primary logo tile ------------------------------------------------
    # Top-left tile of the lower grid, labelled "PRIMARY LOGO".
    # Empirically: x in [3.7%, 27.5%] · y in [47%, 60%]
    primary_tile = src.crop((int(W * 0.030), int(H * 0.495),
                             int(W * 0.290), int(H * 0.605)))
    primary = transparent_crop(primary_tile, threshold=70)
    primary.save(OUT / "io-sky-primary.png")
    print("primary", primary.size)

    # ---- Icon Only tile ---------------------------------------------------
    icon_tile = src.crop((int(W * 0.31), int(H * 0.495),
                          int(W * 0.46), int(H * 0.605)))
    mark = transparent_crop(icon_tile, threshold=70)
    mark.save(OUT / "io-sky-mark.png")
    print("mark   ", mark.size)

    # ---- Favicon ---------------------------------------------------------
    side = max(mark.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(mark, ((side - mark.size[0]) // 2,
                        (side - mark.size[1]) // 2), mark)
    canvas.thumbnail((256, 256), Image.LANCZOS)
    canvas.save(OUT / "io-sky-favicon.png")

    # Also 32x32 ico-friendly variant
    fav32 = canvas.resize((32, 32), Image.LANCZOS)
    fav32.save(OUT / "io-sky-favicon-32.png")
    print("favicon", canvas.size, "+ 32x32")


if __name__ == "__main__":
    main()
