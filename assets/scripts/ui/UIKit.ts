import {
    BlockInputEvents,
    Color,
    EventTouch,
    Graphics,
    Label,
    Layers,
    Mask,
    Node,
    ScrollView,
    UIOpacity,
    UITransform,
    Vec3,
    tween,
    UIRenderer,
} from 'cc';
import { Anim, Colors, Design, darken, hexToRgb, lighten } from '../core/Config';

export function ensureUI(node: Node, w: number, h: number, ax = 0.5, ay = 0.5): UITransform {
    let ui = node.getComponent(UITransform);
    if (!ui) ui = node.addComponent(UITransform);
    ui.setContentSize(w, h);
    ui.setAnchorPoint(ax, ay);
    return ui;
}

export function colorFromHex(hex: string, a = 255): Color {
    const { r, g, b } = hexToRgb(hex.startsWith('#') ? hex : `#${hex}`);
    return new Color(r, g, b, a);
}

export function makeNode(name: string, parent: Node, w = 0, h = 0): Node {
    const n = new Node(name);
    n.layer = Layers.Enum.UI_2D;
    parent.addChild(n);
    // 即使 w/h 为 0 也挂 UITransform，避免部分 API 取组件为空
    ensureUI(n, w || 1, h || 1);
    if (!w && !h) {
        const ui = n.getComponent(UITransform)!;
        ui.setContentSize(0, 0);
    }
    return n;
}

export function fillRect(g: Graphics, w: number, h: number, hex: string, radius = 0, ax = 0.5, ay = 0.5): void {
    const c = colorFromHex(hex);
    g.clear();
    g.fillColor = c;
    if (w <= 0 || h <= 0) return;
    const x = -w * ax;
    const y = -h * ay;
    // 圆角不能 ≥ 短边一半，否则部分环境下 Graphics.roundRect 会卡死
    const r = Math.max(0, Math.min(radius, w * 0.5 - 0.1, h * 0.5 - 0.1));
    if (r > 0.5) g.roundRect(x, y, w, h, r);
    else g.rect(x, y, w, h);
    g.fill();
}

export function strokeRect(
    g: Graphics,
    w: number,
    h: number,
    hex: string,
    lineWidth = 2,
    radius = 0,
    ax = 0.5,
    ay = 0.5,
): void {
    if (w <= 0 || h <= 0) return;
    const c = colorFromHex(hex);
    g.strokeColor = c;
    g.lineWidth = lineWidth;
    const x = -w * ax;
    const y = -h * ay;
    const r = Math.max(0, Math.min(radius, w * 0.5 - 0.1, h * 0.5 - 0.1));
    if (r > 0.5) g.roundRect(x, y, w, h, r);
    else g.rect(x, y, w, h);
    g.stroke();
}

export function addBg(parent: Node, name: string, w: number, h: number, hex: string, radius = 0): Node {
    const n = makeNode(name, parent, w, h);
    const g = n.addComponent(Graphics);
    fillRect(g, w, h, hex, radius);
    return n;
}

/**
 * 纵向滚动列表：root(ScrollView) → view(Mask) → content(顶对齐)
 * content 高度不足视口时仍可点选，超出则可下拉。
 */
export function makeVerticalScroll(
    parent: Node,
    name: string,
    w: number,
    viewH: number,
    contentH: number,
): { root: Node; view: Node; content: Node; scroll: ScrollView } {
    const root = makeNode(name, parent, w, viewH);
    const scroll = root.addComponent(ScrollView);
    scroll.horizontal = false;
    scroll.vertical = true;
    scroll.inertia = true;
    scroll.brake = 0.6;
    scroll.elastic = true;
    scroll.cancelInnerEvents = true;

    const view = makeNode('view', root, w, viewH);
    const mask = view.addComponent(Mask);
    mask.type = Mask.Type.GRAPHICS_RECT;

    const h = Math.max(viewH, contentH);
    const content = makeNode('content', view, w, h);
    ensureUI(content, w, h, 0.5, 1);
    content.setPosition(0, viewH * 0.5, 0);

    scroll.content = content;
    return { root, view, content, scroll };
}

/** 点击条目：滑动超过阈值则视为滚动，不触发点击 */
export function onTapWithoutScroll(node: Node, onTap: () => void, threshold = 12): void {
    let start = new Vec3();
    let moved = false;
    node.addComponent(BlockInputEvents);
    node.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
        const p = e.getUILocation();
        start.set(p.x, p.y, 0);
        moved = false;
    });
    node.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => {
        const p = e.getUILocation();
        if (Math.abs(p.x - start.x) > threshold || Math.abs(p.y - start.y) > threshold) moved = true;
    });
    node.on(Node.EventType.TOUCH_END, () => {
        if (!moved) onTap();
    });
}

/**
 * 绘制与等距盲盒预制体同透视的散页匣底框（六边形轮廓，比例对齐 gen_tile_sprites.iso_params）
 */
export function drawIsoSlot(
    g: Graphics,
    size: number,
    fillHex: string,
    strokeHex: string,
    lineWidth = 2,
    fillOnly = false,
): void {
    g.clear();
    // 与 gen_tile_sprites.iso_params 一致
    const w = size * 0.52;
    const h = size * 0.3;
    const d = size * 0.46;
    const topZ = d * 0.52;
    const pts: [number, number][] = [
        [0, topZ + h],
        [w, topZ],
        [w, -topZ],
        [0, -topZ - h],
        [-w, -topZ],
        [-w, topZ],
    ];
    const path = () => {
        g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
        g.close();
    };
    if (fillHex) {
        g.fillColor = colorFromHex(fillHex);
        path();
        g.fill();
    }
    g.strokeColor = colorFromHex(strokeHex);
    g.lineWidth = lineWidth;
    path();
    g.stroke();
    if (fillOnly) return;
    // 顶面菱形辅助线，强化与方块同角度
    g.lineWidth = Math.max(1, lineWidth - 0.5);
    g.moveTo(0, topZ + h * 0.15);
    g.lineTo(w * 0.85, topZ * 0.15);
    g.lineTo(0, -h * 0.35);
    g.lineTo(-w * 0.85, topZ * 0.15);
    g.close();
    g.stroke();
}

export function addLabel(
    parent: Node,
    name: string,
    text: string,
    fontSize: number,
    hex: string,
    w = 400,
    h = 60,
    bold = false,
): Label {
    const n = makeNode(name, parent, w, h);
    const label = n.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 6;
    label.color = colorFromHex(hex);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.SHRINK;
    if (bold) label.isBold = true;
    return label;
}

export interface BtnHandle {
    node: Node;
    setEnabled: (on: boolean) => void;
    setLabel: (t: string) => void;
}

export function addButton(
    parent: Node,
    name: string,
    text: string,
    w: number,
    h: number,
    bgHex: string,
    onClick: () => void,
    opts?: { fontSize?: number; textHex?: string; radius?: number; disabled?: boolean; flat?: boolean },
): BtnHandle {
    const radius = opts?.radius ?? Design.radius;
    const fontSize = opts?.fontSize ?? 28;
    const textHex = opts?.textHex ?? Colors.btnText;
    const flat = !!opts?.flat;
    const node = makeNode(name, parent, w, h);
    const g = node.addComponent(Graphics);
    const label = addLabel(node, 'txt', text, fontSize, textHex, w - 16, h - 8, true);
    label.node.setPosition(0, 0, 0);

    let enabled = !opts?.disabled;
    const paint = () => {
        g.clear();
        const face = enabled ? bgHex : Colors.btnDisabled;
        if (flat) {
            // 扁平钮：无底部厚边，避免通关页次级钮底部像一截椭圆
            fillRect(g, w, h, face, radius);
            g.strokeColor = colorFromHex(Colors.brown);
            g.lineWidth = 2;
            g.roundRect(-w * 0.5 + 1, -h * 0.5 + 1, w - 2, h - 2, Math.max(0, radius - 1));
            g.stroke();
        } else {
            // 底部厚边模拟设计稿立体钮
            const rim = darken(face, 0.22);
            fillRect(g, w, h, rim, radius);
            g.fillColor = colorFromHex(face);
            const inset = 3;
            const r2 = Math.max(0, Math.min(radius - 1, (w - inset * 2) * 0.5 - 0.1, (h - inset * 2) * 0.5 - 0.1));
            g.roundRect(-w * 0.5 + inset * 0.3, -h * 0.5 + inset, w - inset * 0.6, h - inset * 1.35, r2);
            g.fill();
            g.strokeColor = colorFromHex(Colors.brown);
            g.lineWidth = 2;
            g.roundRect(-w * 0.5 + 1, -h * 0.5 + 1, w - 2, h - 2, Math.max(0, radius - 1));
            g.stroke();
        }
        label.color = colorFromHex(enabled ? textHex : Colors.text);
        const op = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
        op.opacity = enabled ? 255 : Math.floor(255 * 0.55);
    };
    paint();

    node.addComponent(BlockInputEvents);
    node.on(Node.EventType.TOUCH_START, () => {
        if (!enabled) return;
        tween(node).to(Anim.btnMs, { scale: new Vec3(0.94, 0.94, 1) }, { easing: 'quadOut' }).start();
    });
    node.on(Node.EventType.TOUCH_CANCEL, () => {
        paint();
        tween(node).to(Anim.btnMs, { scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' }).start();
    });
    node.on(Node.EventType.TOUCH_END, () => {
        paint();
        tween(node)
            .to(Anim.btnMs, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .call(() => {
                if (enabled) onClick();
            })
            .start();
    });

    return {
        node,
        setEnabled: (on: boolean) => {
            enabled = on;
            paint();
        },
        setLabel: (t: string) => {
            label.string = t;
        },
    };
}

export function addCircleBtn(
    parent: Node,
    name: string,
    glyph: string,
    size: number,
    onClick: () => void,
): Node {
    const node = makeNode(name, parent, size, size);
    const g = node.addComponent(Graphics);
    // 设计稿：白底圆钮 + 深棕描边
    g.fillColor = colorFromHex('#FFFFFF');
    g.circle(0, 0, size / 2 - 1);
    g.fill();
    g.strokeColor = colorFromHex(Colors.brown);
    g.lineWidth = 2.5;
    g.circle(0, 0, size / 2 - 2);
    g.stroke();
    const lab = addLabel(node, 'g', glyph, Math.floor(size * 0.44), Colors.brown, size, size, true);
    lab.node.setPosition(0, 0, 0);
    node.addComponent(BlockInputEvents);
    node.on(Node.EventType.TOUCH_START, () => {
        tween(node).to(Anim.btnMs, { scale: new Vec3(0.92, 0.92, 1) }).start();
    });
    node.on(Node.EventType.TOUCH_END, () => {
        tween(node)
            .to(Anim.btnMs, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .call(onClick)
            .start();
    });
    node.on(Node.EventType.TOUCH_CANCEL, () => {
        tween(node).to(Anim.btnMs, { scale: new Vec3(1, 1, 1) }).start();
    });
    return node;
}

/** 绘制等距感方块 */
export function drawTileCube(g: Graphics, size: number, baseHex: string, locked: boolean): void {
    g.clear();
    const s = size;
    const top = lighten(baseHex, locked ? 0.05 : 0.22);
    const left = darken(baseHex, 0.12);
    const right = darken(baseHex, 0.25);
    const face = locked ? darken(baseHex, 0.15) : baseHex;

    const hw = s * 0.48;
    const hh = s * 0.28;
    const depth = s * 0.22;

    // top face
    g.fillColor = colorFromHex(top, locked ? 180 : 255);
    g.moveTo(0, hh + depth * 0.2);
    g.lineTo(hw, depth * 0.2);
    g.lineTo(0, -hh + depth * 0.2);
    g.lineTo(-hw, depth * 0.2);
    g.close();
    g.fill();

    // left face
    g.fillColor = colorFromHex(left, locked ? 180 : 255);
    g.moveTo(-hw, depth * 0.2);
    g.lineTo(0, -hh + depth * 0.2);
    g.lineTo(0, -hh - depth);
    g.lineTo(-hw, -depth);
    g.close();
    g.fill();

    // right face
    g.fillColor = colorFromHex(right, locked ? 180 : 255);
    g.moveTo(hw, depth * 0.2);
    g.lineTo(0, -hh + depth * 0.2);
    g.lineTo(0, -hh - depth);
    g.lineTo(hw, -depth);
    g.close();
    g.fill();

    // front-ish book lines
    g.strokeColor = colorFromHex(darken(face, 0.3), locked ? 140 : 200);
    g.lineWidth = 2;
    g.moveTo(-hw * 0.55, -depth * 0.15);
    g.lineTo(-hw * 0.15, -hh * 0.55 - depth * 0.15);
    g.stroke();
    g.moveTo(-hw * 0.35, -depth * 0.35);
    g.lineTo(hw * 0.05, -hh * 0.7 - depth * 0.2);
    g.stroke();
}

export function drawStars(parent: Node, count: number, size = 36, gap = 44): Node {
    const root = makeNode('stars', parent, gap * 3, size);
    for (let i = 0; i < 3; i++) {
        const lab = addLabel(root, `s${i}`, i < count ? '★' : '☆', size, i < count ? Colors.star : Colors.slotBorder, size + 8, size + 8);
        lab.node.setPosition((i - 1) * gap, 0, 0);
    }
    return root;
}

export function fadeMask(parent: Node, on = true): Node {
    const n = addBg(parent, 'mask', Design.width * 2, Design.height * 2, '#000000');
    const op = n.addComponent(UIOpacity);
    op.opacity = 0;
    n.addComponent(BlockInputEvents);
    tween(op)
        .to(Anim.maskMs, { opacity: on ? Math.floor(255 * 0.6) : 0 })
        .start();
    return n;
}

export function popupSlideUp(panel: Node, fromY = -400): void {
    panel.setPosition(0, fromY, 0);
    panel.setScale(1, 1, 1);
    tween(panel)
        .to(Anim.popupMs, { position: new Vec3(0, 0, 0) }, { easing: 'backOut' })
        .start();
}

export function popupScaleIn(panel: Node): void {
    panel.setScale(0.6, 0.6, 1);
    tween(panel)
        .to(Anim.popupMs, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
        .start();
}

/** 轻量星星粒子 */
export function burstStars(parent: Node, x: number, y: number): void {
    for (let i = 0; i < 6; i++) {
        const n = makeNode(`p${i}`, parent, 20, 20);
        n.setPosition(x, y, 0);
        const lab = addLabel(n, 't', '✦', 18, Colors.star, 24, 24);
        lab.node.setPosition(0, 0, 0);
        const ang = (Math.PI * 2 * i) / 6;
        const dist = 40 + Math.random() * 30;
        tween(n)
            .to(0.35, {
                position: new Vec3(x + Math.cos(ang) * dist, y + Math.sin(ang) * dist, 0),
                scale: new Vec3(0.2, 0.2, 1),
            }, { easing: 'quadOut' })
            .call(() => n.destroy())
            .start();
    }
}

export function setOpacity(node: Node, a: number): void {
    const op = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
    op.opacity = a;
}

/** 首页轻漂浮 */
export function idleFloat(node: Node, amp = 10, duration = 1.6, delay = 0): void {
    const base = node.position.clone();
    tween(node)
        .delay(delay)
        .to(duration, { position: new Vec3(base.x, base.y + amp, 0) }, { easing: 'sineInOut' })
        .to(duration, { position: base }, { easing: 'sineInOut' })
        .union()
        .repeatForever()
        .start();
}

/** 轻晃动（角度） */
export function idleSway(node: Node, deg = 6, duration = 1.2, delay = 0): void {
    tween(node)
        .delay(delay)
        .to(duration, { eulerAngles: new Vec3(0, 0, deg) }, { easing: 'sineInOut' })
        .to(duration, { eulerAngles: new Vec3(0, 0, -deg) }, { easing: 'sineInOut' })
        .union()
        .repeatForever()
        .start();
}

/** 角色弹跳（落地压扁再弹起） */
export function idleHop(node: Node, hopY = 28, duration = 0.55, delay = 0): void {
    const base = node.position.clone();
    const up = new Vec3(base.x, base.y + hopY, 0);
    tween(node)
        .delay(delay)
        .to(duration * 0.45, { position: up, scale: new Vec3(0.92, 1.08, 1) }, { easing: 'quadOut' })
        .to(duration * 0.55, { position: base, scale: new Vec3(1.06, 0.9, 1) }, { easing: 'quadIn' })
        .to(0.08, { scale: new Vec3(1, 1, 1) }, { easing: 'sineOut' })
        .delay(0.35)
        .union()
        .repeatForever()
        .start();
}

/** 主按钮呼吸缩放 */
export function idleBreathe(node: Node, amp = 0.035, duration = 0.9, delay = 0): void {
    tween(node)
        .delay(delay)
        .to(duration, { scale: new Vec3(1 + amp, 1 + amp, 1) }, { easing: 'sineInOut' })
        .to(duration, { scale: new Vec3(1 - amp * 0.4, 1 - amp * 0.4, 1) }, { easing: 'sineInOut' })
        .union()
        .repeatForever()
        .start();
}

/** 入场：从小到大弹入 */
export function popIn(node: Node, delay = 0, from = 0.55): void {
    node.setScale(from, from, 1);
    const op = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
    op.opacity = 0;
    tween(op).delay(delay).to(0.28, { opacity: 255 }).start();
    tween(node)
        .delay(delay)
        .to(0.38, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
        .start();
}

// silence unused import lint for UIRenderer if any
void UIRenderer;
