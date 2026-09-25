"""
Generate BlockVote app icons (Android launcher + web favicon/PWA) from one square logo.

Usage:
  python scripts/generate-icons.py path/to/logo-1024.png
"""
import math
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RES = os.path.join(ROOT, "app", "src", "main", "res")
WEB_APP = os.path.join(ROOT, "Voting", "app")
WEB_PUBLIC = os.path.join(ROOT, "Voting", "public")

BG = (4, 18, 55)  # tile navy, matches the logo background edge
# Radius (source px, 1024 canvas) that contains every logo element.
CONTENT_RADIUS = 362

DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}


def load_logo(path):
    im = Image.open(path).convert("RGB")
    if im.size != (1024, 1024):
        im = im.resize((1024, 1024), Image.LANCZOS)
    return im


def tile_alpha(im):
    """
    Alpha mask of the rounded tile. Only the black area connected to the image
    corners becomes transparent, so dark pixels inside the logo stay opaque.
    """
    blue = im.getchannel("B")
    dark = blue.point(lambda b: 0 if b < 30 else 255)
    for corner in [(0, 0), (1023, 0), (0, 1023), (1023, 1023)]:
        if dark.getpixel(corner) == 0:
            ImageDraw.floodfill(dark, corner, 128)
    outside = dark.point(lambda v: 255 if v == 128 else 0)
    alpha = ImageChops.invert(outside)
    # Soft edge: keep partial alpha along the anti-aliased tile border only.
    edge_soft = blue.point(lambda b: max(0, min(255, int((b - 6) * 255 / 30))))
    border = outside.filter(ImageFilter.MaxFilter(5))
    alpha = Image.composite(edge_soft, alpha, border)
    return alpha.filter(ImageFilter.GaussianBlur(0.5))


def rounded_tile(im):
    out = im.convert("RGBA")
    out.putalpha(tile_alpha(im))
    return out


def full_bleed(im):
    """Logo with the black corners replaced by the tile colour (for OS-masked icons)."""
    bg = Image.new("RGB", im.size, BG)
    return Image.composite(im, bg, tile_alpha(im))


def radial_mask(size, inner, outer):
    mask = Image.new("L", (size, size), 0)
    px = mask.load()
    c = (size - 1) / 2
    for y in range(size):
        for x in range(size):
            d = math.hypot(x - c, y - c)
            if d <= inner:
                px[x, y] = 255
            elif d < outer:
                px[x, y] = int(255 * (outer - d) / (outer - inner))
    return mask


def adaptive_foreground(im, px_size):
    """
    108dp adaptive foreground. Logo content is kept inside the ~66dp safe zone
    and faded into transparency so it blends with the solid BG background layer.
    """
    art = full_bleed(im).convert("RGBA")
    art.putalpha(radial_mask(1024, 400, 470))
    # Content radius lands at ~35dp: the artwork fills the ~36dp launcher mask edge to edge.
    canvas_src = int(CONTENT_RADIUS * 108 / 35)
    canvas = Image.new("RGBA", (canvas_src, canvas_src), (0, 0, 0, 0))
    off = (canvas_src - 1024) // 2
    canvas.alpha_composite(art, (off, off))
    return canvas.resize((px_size, px_size), Image.LANCZOS)


def circle_icon(im, px_size):
    src = full_bleed(im)
    r = CONTENT_RADIUS + 12
    box = (512 - r, 512 - r, 512 + r, 512 + r)
    crop = src.crop(box).convert("RGBA")
    big = crop.size[0]
    mask = Image.new("L", (big * 4, big * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, big * 4 - 1, big * 4 - 1), fill=255)
    mask = mask.resize((big, big), Image.LANCZOS)
    crop.putalpha(mask)
    return crop.resize((px_size, px_size), Image.LANCZOS)


def maskable(im, px_size):
    """PWA maskable icon: content inside the central 80% safe zone on a solid background."""
    fg = adaptive_foreground(im, px_size)
    out = Image.new("RGBA", (px_size, px_size), BG + (255,))
    out.alpha_composite(fg)
    return out


def save(img, *parts, **kw):
    path = os.path.join(*parts)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, **kw)
    print("wrote", os.path.relpath(path, ROOT))


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    im = load_logo(sys.argv[1])
    tile = rounded_tile(im)

    # ── Android ────────────────────────────────────────────────────────────
    for name, scale in DENSITIES.items():
        legacy = int(48 * scale)
        save(tile.resize((legacy, legacy), Image.LANCZOS), RES, f"mipmap-{name}", "ic_launcher.webp", lossless=True)
        save(circle_icon(im, legacy), RES, f"mipmap-{name}", "ic_launcher_round.webp", lossless=True)
        save(adaptive_foreground(im, int(108 * scale)), RES, f"mipmap-{name}", "ic_launcher_foreground.png")
    save(tile.resize((512, 512), Image.LANCZOS), RES, "drawable-nodpi", "blockvote_logo.png")

    # ── Web ────────────────────────────────────────────────────────────────
    save(tile.resize((512, 512), Image.LANCZOS), WEB_APP, "icon.png")
    save(full_bleed(im).resize((180, 180), Image.LANCZOS), WEB_APP, "apple-icon.png")
    save(tile.resize((192, 192), Image.LANCZOS), WEB_PUBLIC, "icons", "icon-192.png")
    save(tile.resize((512, 512), Image.LANCZOS), WEB_PUBLIC, "icons", "icon-512.png")
    save(maskable(im, 512), WEB_PUBLIC, "icons", "maskable-512.png")
    save(tile.resize((256, 256), Image.LANCZOS), WEB_PUBLIC, "logo.png")
    save(tile.resize((1024, 1024), Image.LANCZOS), WEB_PUBLIC, "logo-1024.png")

    # Preview of what a circular launcher mask shows.
    preview = Image.new("RGBA", (432, 432), BG + (255,))
    preview.alpha_composite(adaptive_foreground(im, 432))
    m = Image.new("L", (432, 432), 0)
    ImageDraw.Draw(m).ellipse((72, 72, 360, 360), fill=255)
    bgc = Image.new("RGBA", (432, 432), (255, 255, 255, 255))
    preview_out = Image.composite(preview, bgc, m).crop((64, 64, 368, 368))
    save(preview_out, ROOT, "build", "icon-preview", "adaptive-circle.png")


if __name__ == "__main__":
    main()
