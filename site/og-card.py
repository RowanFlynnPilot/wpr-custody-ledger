# Draws public/og-image.png, the 1200x630 card shown when the Ledger is shared (og:image / twitter:image).
# Same layout as the Watch Ledger's card. The row of marks is drawn from the newest report, so
# deploy.yml runs this on every deploy and the image is not committed:
#     python site/og-card.py        (after `npm ci` in site/: the fonts come from @fontsource)
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SITE = Path(__file__).resolve().parent
FONTS = SITE / "node_modules" / "@fontsource"
OUT = SITE / "public" / "og-image.png"

W, H, LEFT, RIGHT = 1200, 630, 80, 1120
CREAM, INK, INK_SOFT = "#f6f2e9", "#1f2421", "#55594f"
TEAL, TEAL_DEEP, RUST, RUST_DEEP = "#3a867c", "#2c6b62", "#b5543b", "#8f3f2a"
PEOPLE_PER_MARK = 500


def font(family: str, weight: int, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / family / "files" / f"{family}-latin-{weight}-normal.woff"), size)


def fitted(draw: ImageDraw.ImageDraw, text: str, family: str, weight: int, size: int) -> ImageFont.FreeTypeFont:
    """The largest size up to `size` at which `text` fits between the margins."""
    while draw.textlength(text, font=font(family, weight, size)) > RIGHT - LEFT:
        size -= 1
    return font(family, weight, size)


def wrap(draw: ImageDraw.ImageDraw, text: str, face: ImageFont.FreeTypeFont, width: int) -> list[str]:
    lines, line = [], ""
    for word in text.split():
        if line and draw.textlength(f"{line} {word}", font=face) > width:
            lines.append(line)
            line = word
        else:
            line = f"{line} {word}".strip()
    return lines + [line]


def main() -> None:
    latest = json.loads((SITE.parent / "data" / "latest.json").read_text(encoding="utf-8"))
    marks = round(latest["population"] / PEOPLE_PER_MARK)
    within = round(latest["capacity"] / PEOPLE_PER_MARK)
    if not 0 < within < marks:
        raise ValueError(f"The card assumes more people than capacity; got {marks} marks, {within} within capacity")

    image = Image.new("RGB", (W, H), CREAM)
    draw = ImageDraw.Draw(image)
    draw.rectangle([0, 0, W, 10], fill=TEAL_DEEP)
    draw.rectangle([LEFT, 86, RIGHT, 88], fill=INK)  # the newspaper double rule
    draw.rectangle([LEFT, 92, RIGHT, 92], fill=INK)

    draw.text((LEFT, 112), "A NEWSROOM DATA PROJECT  ·  WAUSAU PILOT & REVIEW", font=font("jetbrains-mono", 400, 21), fill=TEAL)
    title = "The Custody Ledger"
    draw.text((LEFT - 4, 150), title, font=fitted(draw, title, "fraunces", 900, 130), fill=INK)

    dek = font("fraunces", 400, 35)
    lines = wrap(draw, "How many people Wisconsin holds in state prison, every week since 1999, "
                       "against what its prisons were designed to hold.", dek, RIGHT - LEFT)
    for i, line in enumerate(lines):
        draw.text((LEFT, 306 + i * 46), line, font=dek, fill=INK)

    top, bottom = 470, 530
    pitch = (RIGHT - LEFT) / marks
    for i in range(marks):
        x = LEFT + i * pitch
        fill, edge = (TEAL, TEAL_DEEP) if i < within else (RUST, RUST_DEEP)
        draw.rectangle([x, top, x + pitch * 0.56, bottom], fill=fill, outline=edge, width=2)

    caption = (f"Each mark is {PEOPLE_PER_MARK} people in state prison; the {marks - within} in rust "
               "are beyond design capacity.")
    draw.text((LEFT, 552), caption, font=fitted(draw, caption, "jetbrains-mono", 400, 21), fill=INK_SOFT)

    OUT.parent.mkdir(exist_ok=True)
    image.save(OUT, optimize=True)
    print(f"{OUT.name}: {marks} marks, {marks - within} beyond capacity")


if __name__ == "__main__":
    main()
