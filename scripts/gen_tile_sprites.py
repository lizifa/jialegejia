#!/usr/bin/env python3
"""生成设计稿风格等距盲盒切图（无第三方依赖，保留已有 UUID）"""
from __future__ import annotations
import json, math, struct, zlib, uuid
from pathlib import Path

OUT = Path('/Volumes/bag/cocos/jialegejia/assets/resources/textures/tiles')
W = H = 192  # 更高清切图


def hex_rgb(h: str):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def darken(rgb, a=0.2):
    return tuple(max(0, int(c * (1 - a))) for c in rgb)


def lighten(rgb, a=0.25):
    return tuple(min(255, int(c + (255 - c) * a)) for c in rgb)


def mix(a, b, t):
    return tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(3))


def write_png(path: Path, rgba: list[list[tuple[int, int, int, int]]]):
    h = len(rgba)
    w = len(rgba[0])
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        for x in range(w):
            raw.extend(rgba[y][x])
    comp = zlib.compress(bytes(raw), 9)

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
    path.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', comp) + chunk(b'IEND', b''))


def new_canvas():
    return [[(0, 0, 0, 0) for _ in range(W)] for _ in range(H)]


def setp(img, x, y, rgba):
    if not (0 <= x < W and 0 <= y < H):
        return
    r, g, b, a = rgba
    if a <= 0:
        return
    br, bg, bb, ba = img[y][x]
    if ba == 0:
        img[y][x] = (r, g, b, a)
        return
    na = a + ba * (255 - a) // 255
    if na == 0:
        return
    nr = (r * a + br * ba * (255 - a) // 255) // na
    ng = (g * a + bg * ba * (255 - a) // 255) // na
    nb = (b * a + bb * ba * (255 - a) // 255) // na
    img[y][x] = (nr, ng, nb, na)


def fill_poly(img, pts, color, alpha=255):
    if len(pts) < 3:
        return
    ys = [p[1] for p in pts]
    y0, y1 = max(0, int(min(ys))), min(H - 1, int(max(ys)))
    for y in range(y0, y1 + 1):
        xs = []
        for i in range(len(pts)):
            x1, y1_ = pts[i]
            x2, y2 = pts[(i + 1) % len(pts)]
            if y1_ == y2:
                continue
            if (y < min(y1_, y2)) or (y >= max(y1_, y2)):
                continue
            t = (y - y1_) / (y2 - y1_)
            xs.append(x1 + t * (x2 - x1))
        xs.sort()
        for i in range(0, len(xs) - 1, 2):
            xa, xb = int(xs[i]), int(xs[i + 1])
            if xa > xb:
                xa, xb = xb, xa
            for x in range(max(0, xa), min(W, xb + 1)):
                setp(img, x, y, (*color, alpha))


def draw_line(img, x0, y0, x1, y1, color, width=2, alpha=255):
    steps = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
    r2 = width * width
    for i in range(steps + 1):
        t = i / steps
        x = x0 + (x1 - x0) * t
        y = y0 + (y1 - y0) * t
        for dx in range(-width - 1, width + 2):
            for dy in range(-width - 1, width + 2):
                if dx * dx + dy * dy <= r2:
                    setp(img, int(x + dx), int(y + dy), (*color, alpha))


def stroke_poly(img, pts, color, width=2, alpha=255):
    for i in range(len(pts)):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % len(pts)]
        draw_line(img, x1, y1, x2, y2, color, width, alpha)


def fill_circle(img, cx, cy, r, color, alpha=255):
    r2 = r * r
    for y in range(int(cy - r) - 1, int(cy + r) + 2):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r2:
                setp(img, x, y, (*color, alpha))


def fill_ellipse(img, cx, cy, rx, ry, color, alpha=255):
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            if ry == 0 or rx == 0:
                continue
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                setp(img, x, y, (*color, alpha))


def lerp_pt(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def quad_inset(pts, t=0.18):
    """四边形向中心内缩，做圆角窗/书页框"""
    cx = sum(p[0] for p in pts) / 4
    cy = sum(p[1] for p in pts) / 4
    return [(p[0] + (cx - p[0]) * t, p[1] + (cy - p[1]) * t) for p in pts]


def soft_shadow(img, cx, cy, size):
    """已关闭：贴图自带椭圆阴影会在棋盘堆成一大块灰椭圆"""
    return


def iso_params(size):
    # 与设计稿一致的矮胖等距比例（约 30°）
    w = size * 0.52
    h = size * 0.30
    d = size * 0.46
    top_z = d * 0.55
    return w, h, d, top_z


def iso_faces(cx, cy, size):
    w, h, d, top_z = iso_params(size)

    def P(x, y):
        return (cx + x, cy - y)

    top = [P(0, top_z + h), P(w, top_z), P(0, top_z - h), P(-w, top_z)]
    left = [P(-w, top_z), P(0, top_z - h), P(0, -top_z - h), P(-w, -top_z)]
    right = [P(w, top_z), P(0, top_z - h), P(0, -top_z - h), P(w, -top_z)]
    return top, left, right, (cx, cy - top_z * 0.02), (w, h, d, top_z)


def draw_solid_cube(img, cx, cy, size, base_hex, locked=False, alpha=255):
    top, left, right, face, _ = iso_faces(cx, cy, size)
    base = hex_rgb(base_hex)
    if locked:
        top_c, left_c, right_c = (248, 245, 238), (236, 232, 224), (224, 220, 212)
        edge = (168, 158, 142)
        a = 200
    else:
        top_c = lighten(base, 0.34)
        left_c = mix(base, lighten(base, 0.08), 0.35)
        right_c = darken(base, 0.22)
        edge = (74, 52, 34)
        a = alpha

    soft_shadow(img, cx, cy + size * 0.34, size)
    fill_poly(img, left, left_c, a)
    fill_poly(img, right, right_c, a)
    fill_poly(img, top, top_c, a)
    sw = 3 if locked else 4
    stroke_poly(img, left, edge, sw, min(255, a + 20))
    stroke_poly(img, right, edge, sw, min(255, a + 20))
    stroke_poly(img, top, edge, sw, min(255, a + 20))
    # 顶面高光
    if not locked:
        hi = quad_inset(top, 0.22)
        fill_poly(img, hi, lighten(top_c, 0.35), 70)
    return top, left, right, face


def draw_wire_cube(img, cx, cy, size):
    """遮挡态：半透明幽灵线框"""
    top, left, right, face, _ = iso_faces(cx, cy, size)
    soft_shadow(img, cx, cy + size * 0.34, size * 0.9)
    fill_poly(img, left, (236, 232, 224), 150)
    fill_poly(img, right, (224, 220, 212), 150)
    fill_poly(img, top, (248, 245, 238), 160)
    edge = (170, 160, 145)
    stroke_poly(img, left, edge, 3, 200)
    stroke_poly(img, right, edge, 3, 200)
    stroke_poly(img, top, edge, 3, 200)
    return top, left, right, face


def draw_glass_cube(img, cx, cy, size, tint_hex):
    """茶杯用：半透明橙框盲盒"""
    top, left, right, face, _ = iso_faces(cx, cy, size)
    tint = hex_rgb(tint_hex)
    soft_shadow(img, cx, cy + size * 0.34, size)
    # 先铺浅底，再叠橙色玻璃感
    fill_poly(img, left, (255, 236, 214), 210)
    fill_poly(img, right, (255, 228, 198), 220)
    fill_poly(img, top, (255, 244, 228), 200)
    fill_poly(img, left, lighten(tint, 0.35), 90)
    fill_poly(img, right, mix(tint, (255, 200, 140), 0.35), 100)
    fill_poly(img, top, lighten(tint, 0.55), 70)
    edge = (74, 52, 34)
    stroke_poly(img, left, edge, 4)
    stroke_poly(img, right, edge, 4)
    stroke_poly(img, top, edge, 4)
    stroke_poly(img, quad_inset(left, 0.14), edge, 2, 180)
    stroke_poly(img, quad_inset(right, 0.14), edge, 2, 180)
    return top, left, right, face


def draw_platform(img, cx, cy, size, base_hex):
    """小兔用：矮台座（开放舞台）"""
    w, h, d, top_z = iso_params(size)
    base = hex_rgb(base_hex)
    top_c = lighten(base, 0.28)
    left_c = mix(base, (255, 255, 255), 0.1)
    right_c = darken(base, 0.18)
    edge = (74, 52, 34)
    # 只画矮一层
    scale = 0.42
    tz = top_z * scale
    hh = h * 0.55

    def P(x, y):
        return (cx + x, cy - y + size * 0.12)

    top = [P(0, tz + hh), P(w, tz), P(0, tz - hh), P(-w, tz)]
    left = [P(-w, tz), P(0, tz - hh), P(0, -tz * 0.55 - hh), P(-w, -tz * 0.55)]
    right = [P(w, tz), P(0, tz - hh), P(0, -tz * 0.55 - hh), P(w, -tz * 0.55)]
    soft_shadow(img, cx, cy + size * 0.28, size)
    fill_poly(img, left, left_c)
    fill_poly(img, right, right_c)
    fill_poly(img, top, top_c)
    stroke_poly(img, left, edge, 4)
    stroke_poly(img, right, edge, 4)
    stroke_poly(img, top, edge, 4)
    return top, left, right, (cx, cy - size * 0.08)


def draw_book_pages(img, right):
    """右侧白框书页线"""
    panel = quad_inset(right, 0.16)
    fill_poly(img, panel, (255, 252, 246), 235)
    stroke_poly(img, panel, (74, 52, 34), 2)
    # 水平书页线（沿右面等距）
    for i in range(5):
        t = 0.18 + i * 0.14
        a = lerp_pt(panel[0], panel[3], t)
        b = lerp_pt(panel[1], panel[2], t)
        # 缩短一点
        a2 = lerp_pt(a, b, 0.08)
        b2 = lerp_pt(a, b, 0.92)
        draw_line(img, a2[0], a2[1], b2[0], b2[1], (210, 205, 198), 2)


def draw_window(img, face_pts, inset=0.2):
    panel = quad_inset(face_pts, inset)
    fill_poly(img, panel, (255, 250, 240), 245)
    stroke_poly(img, panel, (74, 52, 34), 2)
    return panel


def face_center(pts):
    return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))


def draw_cat(img, cx, cy, r):
    body = (160, 160, 172)
    fill_circle(img, cx, cy + r * 0.15, r * 0.85, body)
    fill_poly(img, [(cx - r * 0.65, cy - r * 0.15), (cx - r * 0.95, cy - r * 1.05), (cx - r * 0.15, cy - r * 0.45)], body)
    fill_poly(img, [(cx + r * 0.65, cy - r * 0.15), (cx + r * 0.95, cy - r * 1.05), (cx + r * 0.15, cy - r * 0.45)], body)
    fill_circle(img, cx - r * 0.28, cy + r * 0.05, r * 0.11, (50, 48, 55))
    fill_circle(img, cx + r * 0.28, cy + r * 0.05, r * 0.11, (50, 48, 55))
    fill_circle(img, cx, cy + r * 0.28, r * 0.1, (240, 150, 170))
    # 腮红
    fill_ellipse(img, cx - r * 0.55, cy + r * 0.35, r * 0.16, r * 0.1, (245, 180, 190), 140)
    fill_ellipse(img, cx + r * 0.55, cy + r * 0.35, r * 0.16, r * 0.1, (245, 180, 190), 140)


def draw_bear(img, cx, cy, r):
    fur = (196, 140, 95)
    fill_circle(img, cx - r * 0.7, cy - r * 0.45, r * 0.34, fur)
    fill_circle(img, cx + r * 0.7, cy - r * 0.45, r * 0.34, fur)
    fill_circle(img, cx, cy + r * 0.05, r, fur)
    fill_ellipse(img, cx, cy + r * 0.28, r * 0.48, r * 0.34, (232, 205, 165))
    fill_circle(img, cx - r * 0.26, cy - r * 0.02, r * 0.1, (70, 45, 28))
    fill_circle(img, cx + r * 0.26, cy - r * 0.02, r * 0.1, (70, 45, 28))
    fill_ellipse(img, cx, cy + r * 0.22, r * 0.12, r * 0.09, (70, 45, 28))


def draw_rabbit(img, cx, cy, r):
    fill_ellipse(img, cx - r * 0.38, cy - r * 0.95, r * 0.24, r * 0.62, (255, 255, 255))
    fill_ellipse(img, cx + r * 0.38, cy - r * 0.95, r * 0.24, r * 0.62, (255, 255, 255))
    fill_ellipse(img, cx - r * 0.38, cy - r * 0.9, r * 0.11, r * 0.36, (245, 185, 200))
    fill_ellipse(img, cx + r * 0.38, cy - r * 0.9, r * 0.11, r * 0.36, (245, 185, 200))
    fill_circle(img, cx, cy + r * 0.05, r * 0.95, (255, 255, 255))
    fill_circle(img, cx - r * 0.26, cy, r * 0.1, (50, 48, 55))
    fill_circle(img, cx + r * 0.26, cy, r * 0.1, (50, 48, 55))
    fill_circle(img, cx, cy + r * 0.25, r * 0.12, (245, 160, 176))
    fill_ellipse(img, cx - r * 0.5, cy + r * 0.32, r * 0.14, r * 0.09, (245, 180, 190), 150)
    fill_ellipse(img, cx + r * 0.5, cy + r * 0.32, r * 0.14, r * 0.09, (245, 180, 190), 150)


def draw_cup(img, cx, cy, r):
    # 黄心
    fill_circle(img, cx - r * 0.18, cy - r * 0.95, r * 0.22, (255, 210, 80))
    fill_circle(img, cx + r * 0.18, cy - r * 0.95, r * 0.22, (255, 210, 80))
    fill_poly(img, [(cx - r * 0.38, cy - r * 0.9), (cx, cy - r * 0.5), (cx + r * 0.38, cy - r * 0.9)], (255, 210, 80))
    # 杯身
    blue = (95, 145, 220)
    fill_poly(img, [
        (cx - r * 0.62, cy - r * 0.15),
        (cx + r * 0.62, cy - r * 0.15),
        (cx + r * 0.48, cy + r * 0.75),
        (cx - r * 0.48, cy + r * 0.75),
    ], blue)
    stroke_poly(img, [
        (cx - r * 0.62, cy - r * 0.15),
        (cx + r * 0.62, cy - r * 0.15),
        (cx + r * 0.48, cy + r * 0.75),
        (cx - r * 0.48, cy + r * 0.75),
    ], (74, 52, 34), 2)
    # 杯口
    fill_ellipse(img, cx, cy - r * 0.15, r * 0.62, r * 0.18, lighten(blue, 0.25))
    stroke_poly(img, [
        (cx - r * 0.62, cy - r * 0.15),
        (cx, cy - r * 0.32),
        (cx + r * 0.62, cy - r * 0.15),
        (cx, cy + 0.02),
    ], (74, 52, 34), 2)
    # 把手
    for a in range(-25, 55):
        ang = a / 40
        hx = cx + r * 0.72 + math.cos(ang) * r * 0.34
        hy = cy + r * 0.18 + math.sin(ang) * r * 0.34
        fill_circle(img, hx, hy, 2.4, blue)


def draw_gift(img, cx, cy, r):
    fill_poly(img, [
        (cx - r, cy - r * 0.7), (cx + r, cy - r * 0.7),
        (cx + r, cy + r * 0.85), (cx - r, cy + r * 0.85),
    ], (255, 150, 95))
    # 丝带
    for y in range(int(cy - r * 0.7), int(cy + r * 0.85)):
        for x in range(int(cx - r * 0.16), int(cx + r * 0.16)):
            setp(img, x, y, (255, 215, 90, 255))
    for y in range(int(cy - r * 0.12), int(cy + r * 0.12)):
        for x in range(int(cx - r), int(cx + r)):
            setp(img, x, y, (255, 215, 90, 255))
    stroke_poly(img, [
        (cx - r, cy - r * 0.7), (cx + r, cy - r * 0.7),
        (cx + r, cy + r * 0.85), (cx - r, cy + r * 0.85),
    ], (74, 52, 34), 2)
    # 蝴蝶结
    fill_circle(img, cx - r * 0.35, cy - r * 0.85, r * 0.22, (255, 215, 90))
    fill_circle(img, cx + r * 0.35, cy - r * 0.85, r * 0.22, (255, 215, 90))
    fill_circle(img, cx, cy - r * 0.75, r * 0.14, (255, 180, 70))


def draw_basket(img, cx, cy, r):
    # 篮身
    fill_ellipse(img, cx, cy + r * 0.2, r * 0.95, r * 0.55, (232, 150, 170))
    stroke_poly(img, [
        (cx - r * 0.95, cy + r * 0.2),
        (cx, cy + r * 0.75),
        (cx + r * 0.95, cy + r * 0.2),
        (cx, cy - r * 0.2),
    ], (74, 52, 34), 2)
    fill_circle(img, cx - r * 0.35, cy - r * 0.05, r * 0.28, (235, 95, 95))
    fill_circle(img, cx + r * 0.1, cy - r * 0.25, r * 0.28, (95, 150, 220))
    fill_circle(img, cx + r * 0.4, cy + r * 0.05, r * 0.26, (245, 200, 90))


# 颜色贴近设计稿
# 颜色对齐设计稿盲盒
DEFS = {
    'book_red': ('#E65A4E', 'book'),
    'book_blue': ('#6EC4E0', 'book'),
    'book_green': ('#6BCB7F', 'book'),
    'book_yellow': ('#F0CC55', 'book'),
    'book_orange': ('#F0994A', 'book'),
    'bear': ('#F3E2B0', 'bear'),
    'rabbit': ('#F6C2D0', 'rabbit'),
    'cat': ('#F2D06B', 'cat'),
    'cup': ('#F0A35A', 'cup'),
    'box': ('#E5C9A0', 'box'),
    'gift': ('#FF9A6A', 'gift'),
    'basket': ('#E8A0B0', 'basket'),
}


def read_uuid(meta_path: Path) -> str | None:
    if not meta_path.exists():
        return None
    try:
        return json.loads(meta_path.read_text(encoding='utf-8')).get('uuid')
    except Exception:
        return None


def write_image_meta(path: Path, uid: str, name: str, w: int, h: int):
    tex = f'{uid}@6c48a'
    sf = f'{uid}@f9941'
    meta = {
        'ver': '1.0.27',
        'importer': 'image',
        'imported': True,
        'uuid': uid,
        'files': ['.json', '.png'],
        'subMetas': {
            '6c48a': {
                'importer': 'texture',
                'uuid': tex,
                'displayName': name,
                'id': '6c48a',
                'name': 'texture',
                'userData': {
                    'wrapModeS': 'clamp-to-edge',
                    'wrapModeT': 'clamp-to-edge',
                    'imageUuidOrDatabaseUri': uid,
                    'isUuid': True,
                    'visible': False,
                    'minfilter': 'linear',
                    'magfilter': 'linear',
                    'mipfilter': 'none',
                    'anisotropy': 0,
                },
                'ver': '1.0.22',
                'imported': True,
                'files': ['.json'],
                'subMetas': {},
            },
            'f9941': {
                'importer': 'sprite-frame',
                'uuid': sf,
                'displayName': name,
                'id': 'f9941',
                'name': 'spriteFrame',
                'userData': {
                    'trimThreshold': 1,
                    'rotated': False,
                    'offsetX': 0,
                    'offsetY': 0,
                    'trimX': 0,
                    'trimY': 0,
                    'width': w,
                    'height': h,
                    'rawWidth': w,
                    'rawHeight': h,
                    'borderTop': 0,
                    'borderBottom': 0,
                    'borderLeft': 0,
                    'borderRight': 0,
                    'packable': True,
                    'pixelsToUnit': 100,
                    'pivotX': 0.5,
                    'pivotY': 0.5,
                    'meshType': 0,
                },
                'ver': '1.0.12',
                'imported': True,
                'files': ['.json'],
                'subMetas': {},
            },
        },
        'userData': {
            'type': 'sprite-frame',
            'fix': 'raw',
            'hasAlpha': True,
        },
    }
    path.write_text(json.dumps(meta, indent=2) + '\n', encoding='utf-8')


def gen_one(name: str, color: str, kind: str, locked=False):
    img = new_canvas()
    # 主体尽量铺满画布；略留边避免入槽裁切
    cx, cy, size = W / 2, H / 2 + 2, 162

    if locked:
        draw_wire_cube(img, cx, cy, size)
        return img

    if kind == 'book':
        top, left, right, face = draw_solid_cube(img, cx, cy, size, color)
        draw_book_pages(img, right)
    elif kind in ('cat', 'bear'):
        top, left, right, face = draw_solid_cube(img, cx, cy, size, color)
        # 双面圆角窗 + 角色贴纸（加大便于辨认）
        for face_pts in (left, right):
            panel = draw_window(img, face_pts, 0.18)
            fx, fy = face_center(panel)
            r = 24
            if kind == 'cat':
                draw_cat(img, fx, fy, r)
            else:
                draw_bear(img, fx, fy, r)
    elif kind == 'rabbit':
        top, left, right, face = draw_platform(img, cx, cy, size, color)
        draw_rabbit(img, face[0], face[1] - 12, 34)
    elif kind == 'cup':
        top, left, right, face = draw_glass_cube(img, cx, cy, size, color)
        draw_cup(img, face[0] + 2, face[1] + 10, 34)
    elif kind == 'gift':
        top, left, right, face = draw_solid_cube(img, cx, cy, size, color)
        panel = draw_window(img, right, 0.16)
        fx, fy = face_center(panel)
        draw_gift(img, fx, fy, 26)
    elif kind == 'box':
        top, left, right, face = draw_solid_cube(img, cx, cy, size, color)
        panel = draw_window(img, right, 0.16)
        fx, fy = face_center(panel)
        draw_line(img, fx - 18, fy - 12, fx + 18, fy - 12, (74, 52, 34), 2)
        draw_line(img, fx - 18, fy + 6, fx + 18, fy + 6, (74, 52, 34), 2)
        draw_line(img, fx, fy - 20, fx, fy + 16, (74, 52, 34), 2)
    elif kind == 'basket':
        top, left, right, face = draw_solid_cube(img, cx, cy, size, color)
        panel = draw_window(img, right, 0.16)
        fx, fy = face_center(panel)
        draw_basket(img, fx, fy, 26)
    else:
        draw_solid_cube(img, cx, cy, size, color)
    return img


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    textures = Path('/Volumes/bag/cocos/jialegejia/assets/resources/textures')
    textures.mkdir(parents=True, exist_ok=True)
    for folder in [textures, OUT]:
        mp = Path(str(folder) + '.meta')
        if not mp.exists():
            mp.write_text(json.dumps({
                'ver': '1.2.0', 'importer': 'directory', 'imported': True,
                'uuid': str(uuid.uuid4()), 'files': [], 'subMetas': {}, 'userData': {},
            }, indent=2) + '\n')

    # 通用 locked 幽灵块
    locked_png = OUT / 'locked.png'
    img = new_canvas()
    draw_wire_cube(img, W / 2, H / 2 + 6, 148)
    write_png(locked_png, img)
    uid = read_uuid(locked_png.with_suffix('.png.meta')) or str(uuid.uuid4())
    write_image_meta(locked_png.with_suffix('.png.meta'), uid, 'locked', W, H)
    print('wrote', locked_png.name)

    for name, (color, kind) in DEFS.items():
        for locked, suffix in [(False, ''), (True, '_locked')]:
            fname = f'{name}{suffix}'
            img = gen_one(name, color, kind, locked)
            png = OUT / f'{fname}.png'
            write_png(png, img)
            meta_p = png.with_suffix('.png.meta')
            uid = read_uuid(meta_p) or str(uuid.uuid4())
            write_image_meta(meta_p, uid, fname, W, H)
            print('wrote', png.name)
    print('done', OUT)


if __name__ == '__main__':
    main()
