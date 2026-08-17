"""Drop the white/grey paper out of the intro frames -> transparent PNG.

alpha = darkness of the pixel, ink recoloured white so it glows on the dark
intro stage. `inset` trims the dark rounded border baked into intro-2, which
would otherwise key as opaque white blobs in the corners.
"""
from PIL import Image, ImageChops
import sys

SRC = "/Users/muhammedshareefcv/Desktop/AlipsonBuilders/public/images/intro/"
JOBS = [("intro-1.png", 0.0), ("intro-2.jpeg", 0.02), ("intro-3.png", 0.0)]
FLOOR, GAIN = 22, 1.45  # kill paper haze, then lift the remaining ink

for name, inset in JOBS:
    im = Image.open(SRC + name).convert("RGB")
    if inset:
        w, h = im.size
        dx, dy = int(w * inset), int(h * inset)
        im = im.crop((dx, dy, w - dx, h - dy))
    alpha = ImageChops.invert(im.convert("L")).point(
        lambda v: min(255, max(0, int((v - FLOOR) * GAIN)))
    )
    out = Image.new("RGBA", im.size, (255, 255, 255, 0))
    out.putalpha(alpha)
    dst = SRC + name.rsplit(".", 1)[0] + "-keyed.png"
    out.save(dst, optimize=True)
    print(dst, out.size)

# self-check: a corner pixel (paper) must be transparent, and the darkest
# pixel in the source must survive as near-opaque ink.
for name, _ in JOBS:
    a = Image.open(SRC + name.rsplit(".", 1)[0] + "-keyed.png").getchannel("A")
    assert a.getpixel((2, 2)) <= 4, f"{name}: paper corner not keyed out"
    assert max(a.getdata()) > 200, f"{name}: ink lost"
print("ok", file=sys.stderr)
