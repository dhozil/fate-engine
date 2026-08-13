"""Generate favicon.ico (multi-size) matching the Fate Engine theme:
dark cosmic orb + gold constellation ring + gold fate star."""

from PIL import Image, ImageDraw

SIZE = 256


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def draw_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = size / 256.0  # scale factor

    def P(x, y):
        return (x * s, y * s)

    # rounded dark background
    bg_top = (42, 26, 74)
    bg_bot = (10, 7, 23)
    for y in range(size):
        t = y / size
        col = lerp(bg_top, bg_bot, t)
        d.line([(0, y), (size, y)], fill=col + (255,))

    # gold border
    d.rounded_rectangle([P(4, 4), P(252, 252)], radius=56 * s, outline=(255, 215, 106, 70), width=max(1, int(3 * s)))

    # constellation dots
    gold = (255, 215, 106)
    for (cx, cy, r, o) in [(48, 60, 4, 230), (80, 44, 3, 150), (192, 56, 4, 200), (216, 88, 3, 150), (40, 192, 3, 180), (208, 200, 3, 180)]:
        d.ellipse([P(cx - r, cy - r), P(cx + r, cy + r)], fill=gold + (o,))

    # constellation lines
    for pts, o in [([(48, 60), (80, 44), (192, 56), (216, 88)], 90), ([(80, 44), (112, 64), (192, 56)], 70), ([(40, 192), (208, 200)], 80)]:
        for i in range(len(pts) - 1):
            d.line([P(*pts[i]), P(*pts[i + 1])], fill=gold + (o,), width=max(1, int(2 * s)))

    # tilted orbital rings
    d.ellipse([P(28, 128), P(228, 228)], outline=(255, 190, 90, 150), width=max(1, int(4 * s)))
    d.ellipse([P(40, 108), P(216, 208)], outline=(255, 190, 90, 90), width=max(1, int(3 * s)))

    # glowing orb (violet gradient ball)
    orb_c = (128, 32)  # center
    orb_r = 48 * s
    for y in range(int(orb_c[1] - orb_r), int(orb_c[1] + orb_r) + 1):
        for x in range(int(orb_c[0] - orb_r), int(orb_c[0] + orb_r) + 1):
            dist = ((x - orb_c[0]) ** 2 + (y - orb_c[1]) ** 2) ** 0.5
            if dist <= orb_r:
                t = dist / orb_r
                # highlight at top-left
                hl = 1.0 - min(1.0, ((x - (orb_c[0] - orb_r * 0.3)) ** 2 + (y - (orb_c[1] - orb_r * 0.35)) ** 2) ** 0.5 / orb_r)
                base = lerp((255, 255, 255), (122, 77, 255), t * 0.9)
                col = lerp(base, (255, 255, 255), hl * 0.4)
                d.point((x, y), fill=col + (255,))

    # gold fate star (4-point sparkle) at center of orb
    star_c = (128, 128)
    star_r = 40 * s
    for ang in (0, 90):
        import math
        a = math.radians(ang)
        x1 = star_c[0] - math.cos(a) * star_r
        y1 = star_c[1] - math.sin(a) * star_r
        x2 = star_c[0] + math.cos(a) * star_r
        y2 = star_c[1] + math.sin(a) * star_r
        d.line([(x1, y1), (x2, y2)], fill=gold, width=max(2, int(7 * s)))

    # star core
    d.ellipse([P(124, 124), P(132, 132)], fill=(255, 235, 180, 255))

    return img


if __name__ == "__main__":
    icon = draw_icon(SIZE)
    # export PNG (hi-res) + ICO (256px; browsers auto-resize favicons)
    icon.save("public/favicon.png", "PNG")
    icon.save("public/favicon.ico", "ICO", sizes=[(256, 256)])
    print("favicon.ico + favicon.png generated")
