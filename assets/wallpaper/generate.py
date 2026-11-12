"""Фон приложения: фигуры из logo.svg, один масштаб, плотная упаковка без наложений.

    python3 assets/wallpaper/generate.py

Пишет background.svg и, если в системе есть rsvg-convert, растрирует
background.png (2160x4680) и preview.png (540x1170). Параметры — в константах ниже.
"""
import math
import random
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
LOGO = HERE.parent / 'images' / 'logo.svg'

W, H = 2160.0, 4680.0      # экран телефона в двойном разрешении
GAP = 44.0                 # минимальный просвет между фигурами
TARGET = 520.0             # самая длинная сторона фигуры — как на логотипе
JITTER = 0.07              # разброс размера
COLS, ROWS = 5, 11         # слоты упаковки
STROKE = 6.4
OPACITY = 0.22
SEED = 11
BG = '#0B0B12'
GRADIENT = [(0.0, (0x4B, 0x5B, 0xFF)), (1.0, (0xE4, 0xFF, 0x4F))]


def parse_path(d):
    """Точки подпутей; кривые сэмплируются, дуги в логотипе не встречаются."""
    toks = re.findall(r'[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:[eE][-+]?\d+)?', d)
    subs, cur = [], None
    i, cx, cy, start = 0, 0.0, 0.0, (0.0, 0.0)
    cmd = None

    def add(p):
        nonlocal cur
        if cur is None:
            cur = []
            subs.append(cur)
        cur.append(p)

    def num():
        nonlocal i
        v = float(toks[i])
        i += 1
        return v

    def cubic(p0, p1, p2, p3, n=12):
        for k in range(1, n + 1):
            t = k / n
            mt = 1 - t
            yield (mt ** 3 * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t ** 3 * p3[0],
                   mt ** 3 * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t ** 3 * p3[1])

    while i < len(toks):
        if re.match(r'[A-Za-z]', toks[i]):
            cmd = toks[i]
            i += 1
            if cmd in 'Zz':
                cx, cy = start
                if cur is not None:
                    cur.append(start)
                cur = None
                continue
        rel = cmd.islower()
        c = cmd.upper()
        if c == 'M':
            x, y = num(), num()
            if rel:
                x, y = x + cx, y + cy
            cx, cy = start = (x, y)
            add((cx, cy))
            cmd = 'l' if rel else 'L'
        elif c == 'L':
            x, y = num(), num()
            if rel:
                x, y = x + cx, y + cy
            cx, cy = x, y
            add((cx, cy))
        elif c == 'H':
            x = num()
            cx = x + cx if rel else x
            add((cx, cy))
        elif c == 'V':
            y = num()
            cy = y + cy if rel else y
            add((cx, cy))
        elif c in 'CS':
            if c == 'C':
                x1, y1 = num(), num()
                if rel:
                    x1, y1 = x1 + cx, y1 + cy
            else:
                x1, y1 = cx, cy
            x2, y2, x, y = num(), num(), num(), num()
            if rel:
                x2, y2, x, y = x2 + cx, y2 + cy, x + cx, y + cy
            for p in cubic((cx, cy), (x1, y1), (x2, y2), (x, y)):
                add(p)
            cx, cy = x, y
        elif c == 'Q':
            x1, y1, x, y = num(), num(), num(), num()
            if rel:
                x1, y1, x, y = x1 + cx, y1 + cy, x + cx, y + cy
            for k in range(1, 13):
                t = k / 12
                mt = 1 - t
                add((mt * mt * cx + 2 * mt * t * x1 + t * t * x, mt * mt * cy + 2 * mt * t * y1 + t * t * y))
            cx, cy = x, y
        else:
            raise SystemExit('unsupported path command: ' + c)
    return [s for s in subs if len(s) > 2]


def simplify(pts, tol):
    if len(pts) < 4:
        return pts

    def d2(p, a, b):
        ax, ay = a
        dx, dy = b[0] - ax, b[1] - ay
        if dx == dy == 0:
            return (p[0] - ax) ** 2 + (p[1] - ay) ** 2
        t = max(0.0, min(1.0, ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy)))
        return (p[0] - (ax + t * dx)) ** 2 + (p[1] - (ay + t * dy)) ** 2

    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        best, idx = -1, -1
        for k in range(i + 1, j):
            dd = d2(pts[k], pts[i], pts[j])
            if dd > best:
                best, idx = dd, k
        if best > tol * tol:
            keep[idx] = True
            stack.append((i, idx))
            stack.append((idx, j))
    return [p for p, k in zip(pts, keep) if k]


def bbox(pts):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def seg_dist(p1, p2, p3, p4):
    def pt_seg(p, a, b):
        ax, ay = a
        dx, dy = b[0] - ax, b[1] - ay
        if dx == dy == 0:
            return math.hypot(p[0] - ax, p[1] - ay)
        t = max(0.0, min(1.0, ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy)))
        return math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy))

    def orient(a, b, c):
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])

    if orient(p1, p2, p3) * orient(p1, p2, p4) < 0 and orient(p3, p4, p1) * orient(p3, p4, p2) < 0:
        return 0.0
    return min(pt_seg(p3, p1, p2), pt_seg(p4, p1, p2), pt_seg(p1, p3, p4), pt_seg(p2, p3, p4))


def poly_dist(a, b):
    best = 1e9
    for i in range(len(a)):
        a1, a2 = a[i], a[(i + 1) % len(a)]
        for j in range(len(b)):
            d = seg_dist(a1, a2, b[j], b[(j + 1) % len(b)])
            if d < best:
                best = d
                if best <= 0:
                    return 0.0
    return best


def boxes_near(bb1, bb2, gap):
    for sx in (-W, 0, W):
        if (bb1[0] + sx < bb2[2] + gap and bb2[0] < bb1[2] + sx + gap
                and bb1[1] < bb2[3] + gap and bb2[1] < bb1[3] + gap):
            return True
    return False


def grad_color(t):
    t = min(1.0, max(0.0, t))
    for i in range(len(GRADIENT) - 1):
        a, ca = GRADIENT[i]
        b, cb = GRADIENT[i + 1]
        if t <= b:
            k = (t - a) / (b - a)
            return '#%02X%02X%02X' % tuple(round(ca[j] + (cb[j] - ca[j]) * k) for j in range(3))
    return '#%02X%02X%02X' % GRADIENT[-1][1]


def logo_shapes():
    """Фигуры логотипа в координатах холста 2048, без мелких штрихов и засечек."""
    src = LOGO.read_text()
    s = 1.8600193

    def place(p):
        x = (p[0] * 0.1 - 630.5) * s + 1024.0
        y = (1434.0 - p[1] * 0.1 - 753.5) * s + 1024.0
        return x, y

    shapes = []
    for fill, body in re.findall(r'<g [^>]*fill="([^"]+)"[^>]*>(.*?)</g>', src, re.S):
        for d in re.findall(r'<path d="([^"]+)"', body):
            for sub in parse_path(d):
                pts = [place(p) for p in sub]
                x0, y0, x1, y1 = bbox(pts)
                if min(x1 - x0, y1 - y0) >= 100:
                    shapes.append({'fill': fill, 'pts': pts, 'w': x1 - x0, 'h': y1 - y0})
    return shapes


def round_shape(s):
    cx = (bbox(s['pts'])[0] + bbox(s['pts'])[2]) / 2
    cy = (bbox(s['pts'])[1] + bbox(s['pts'])[3]) / 2
    m = max(s['w'], s['h'])
    return simplify([((p[0] - cx) / m, (p[1] - cy) / m) for p in s['pts']], 1.2 / TARGET)


def main():
    shapes = logo_shapes()
    basis = [round_shape(s) for s in shapes]

    rng = random.Random(SEED)
    placed = []

    def fits(pts):
        bb = bbox(pts)
        for q in placed:
            if boxes_near(bb, q['bbox'], GAP) and any(
                    poly_dist(pts, [(x + sx, y) for x, y in q['pts']]) < GAP for sx in (-W, 0, W)):
                return False
        return True

    def rot(shape, ang, sc, ox, oy):
        c, sn = math.cos(ang), math.sin(ang)
        return [(ox + (p[0] * c - p[1] * sn) * sc, oy + (p[0] * sn + p[1] * c) * sc) for p in shape]

    cells = [((i + 0.5) * W / COLS, (j + 0.5) * H / ROWS) for i in range(COLS) for j in range(ROWS)]
    rng.shuffle(cells)
    for sx0, sy0 in cells:
        for _ in range(400):
            shape = basis[rng.randrange(len(basis))]
            ang = rng.choice([rng.uniform(0, math.tau), rng.uniform(-0.35, 0.35) + rng.choice([0, math.pi])])
            pts = rot(shape, ang, TARGET * (1 + rng.uniform(-JITTER, JITTER)),
                      sx0 + rng.uniform(-0.45, 0.45) * W / COLS,
                      sy0 + rng.uniform(-0.45, 0.45) * H / ROWS)
            if fits(pts):
                placed.append({'pts': pts, 'bbox': bbox(pts)})
                break

    check(placed)

    def path_d(pts):
        return 'M ' + ' L '.join('%.1f,%.1f' % pt for pt in pts) + ' Z'

    out = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">' % (W, H, W, H)]
    for p in placed:
        xs = [pt[0] for pt in p['pts']]
        shifts = [0] + ([W] if min(xs) < 0 else []) + ([-W] if max(xs) > W else [])
        color = grad_color((p['bbox'][1] + p['bbox'][3]) / 2 / H)
        for dx in shifts:
            pts = [(x + dx, y) for x, y in p['pts']]
            out.append('<path d="%s" fill="none" stroke="%s" stroke-width="%.2f" stroke-opacity="%.2f" '
                       'stroke-linejoin="round" stroke-linecap="round"/>' % (path_d(pts), color, STROKE, OPACITY))
    out.append('</svg>')
    (HERE / 'background.svg').write_text('\n'.join(out) + '\n')
    print('background.svg: %d фигур' % len(placed))

    if shutil.which('rsvg-convert'):
        subprocess.run(['rsvg-convert', '-w', str(int(W)), '-h', str(int(H)),
                        str(HERE / 'background.svg'), '-o', str(HERE / 'background.png')], check=True)
        preview = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">' % (W, H, W, H),
                   '<rect width="%d" height="%d" fill="%s"/>' % (W, H, BG),
                   *out[1:-1], '</svg>']
        tmp = HERE / '.preview.svg'
        tmp.write_text('\n'.join(preview) + '\n')
        subprocess.run(['rsvg-convert', '-w', '540', '-h', '1170', str(tmp), '-o', str(HERE / 'preview.png')], check=True)
        tmp.unlink()
    else:
        print('rsvg-convert не найден: PNG не обновлён', file=sys.stderr)


def check(placed):
    """Никакие два контура не ближе GAP, в том числе копии через край."""
    for i in range(len(placed)):
        for j in range(i + 1, len(placed)):
            a, b = placed[i]['pts'], placed[j]['pts']
            if len(a) == len(b) and all(abs(a[k][0] - b[k][0]) < 1.5 and abs(a[k][1] - b[k][1]) < 1.5
                                        for k in range(len(a))):
                continue  # одна и та же фигура
            for sx in (-W, 0, W):
                if poly_dist(a, [(x + sx, y) for x, y in b]) < GAP:
                    raise SystemExit('фигуры %d и %d ближе %s' % (i, j, GAP))


if __name__ == '__main__':
    main()
