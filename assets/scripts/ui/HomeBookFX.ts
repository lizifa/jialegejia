/**
 * 首页诗匣：斜俯视（约 3/4）构图
 * 五首诗预生成实体页栈；翻页只掀顶页，正反字不销毁重建
 */
import { BlockInputEvents, Graphics, Label, Node, Tween, UIOpacity, UITransform, Vec3, tween } from 'cc';
import { Brand, Colors } from '../core/Config';
import { POEMS, Verse, verseCharSequence } from '../core/Literature';
import { addLabel, colorFromHex, makeNode, mountIsoFaceGlyph, sparkBurst, burstStars } from './UIKit';

const COVER = '#C45C3A';
const COVER_TOP = '#E07858';
const COVER_SIDE = '#9A3E28';
const PAGE = '#FFF8F0';
const PAGE_LEFT = '#F3E8D6';
const PAGE_BACK = '#E8D8C0';
const GOLD = '#E8C98A';
/** 印在纸上的墨色（偏暖、略透，避免硬浮层） */
const INK = '#6B5848';
const INK_SOFT = '#8A7664';

/** 首页翻页：五首短诗 = 五张实体页 */
const BOOK_VERSES: Verse[] = [
    POEMS.find((p) => p.id === 'p1_jingyesi')!,
    POEMS.find((p) => p.id === 'p1_chunxiao')!,
    POEMS.find((p) => p.id === 'p2_denglou')!,
    POEMS.find((p) => p.id === 'p1_minnong')!,
    POEMS.find((p) => p.id === 'p1_yonger')!,
].filter(Boolean);

/** 页内嵌字：小号柔墨；相对页心居中，轻贴合页面 */
const FACE = 12;
const FACE_FONT = 7;
const INK_BLUR = '#C4B09A';
/** 静置字整体透明度（更像洇在纸里） */
const INK_OPACITY = 168;
/** 右页字距 / 行距（UV）——略收紧，页心更稳 */
const CHAR_U = 0.115;
const CHAR_V = 0.28;
const PAGE_MARGIN_U = 0.2;
const PAGE_MARGIN_V = 0.2;
/** 页心略偏书口，躲开书脊红条 */
const PAGE_CENTER_U = 0.54;

function verseFlyChars(v: Verse): string[] {
    return verseCharSequence(v).slice(0, 8);
}

function onlyHan(s: string): string[] {
    const out: string[] = [];
    for (const ch of s) {
        if (ch >= '\u4e00' && ch <= '\u9fff') out.push(ch);
    }
    return out;
}

/** 合上匣用的等距（保留立体盒感） */
function iso(x: number, y: number, z = 0): { x: number; y: number } {
    return { x: (x - y) * 0.86, y: (x + y) * 0.42 + z };
}

/**
 * 摊开书投影：左右对称（±x 同高），对齐首页中轴
 * x: 左右（书脊 0），depth: 页顶为负 / 页底为正，up: 抬起
 */
function bookProj(x: number, depth: number, up: number): Pt {
    return {
        x: x * 0.96 + depth * 0.16,
        y: -depth * 0.4 + up * 0.92 - 6,
    };
}

type Pt = { x: number; y: number };

function fillQuad(g: Graphics, a: Pt, b: Pt, c: Pt, d: Pt, hex: string, alpha = 255) {
    g.fillColor = colorFromHex(hex, alpha);
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.lineTo(c.x, c.y);
    g.lineTo(d.x, d.y);
    g.close();
    g.fill();
}

function strokeQuad(g: Graphics, a: Pt, b: Pt, c: Pt, d: Pt, hex: string, alpha = 160, w = 1.4) {
    g.strokeColor = colorFromHex(hex, alpha);
    g.lineWidth = w;
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.lineTo(c.x, c.y);
    g.lineTo(d.x, d.y);
    g.close();
    g.stroke();
}

/** 合上书尺寸（局部坐标） */
const CLOSED = { w: 88, d: 112, h: 22 };
/** 打开后单页（参考讲经台式摊开轮廓，尺寸配合首页主视觉居中） */
const PAGE_W = 92;
const PAGE_D = 96;
const PAGE_H = 10;
/** 书脊凹下去、页沿抬起 —— 形成浅 V / 顶部 M 形 */
const GUTTER_DROP = 12;
const WING_LIFT = 14;
/** 讲桌倾角：页顶（远）更高 —— 不宜过大，否则视觉中心偏移 */
const LECTERN_TILT = 16;

export interface HomeBookHandle {
    root: Node;
    play: () => void;
}

export function mountHomeFlipBook(
    parent: Node,
    x: number,
    y: number,
    scale = 1,
    opts?: {
        autoPlayDelay?: number;
        /** 打开后自动翻页间隔（秒），默认 1.8；<=0 关闭 */
        autoFlipInterval?: number;
        tip?: (s: string) => void;
    },
): HomeBookHandle {
    const root = makeNode('homeBook', parent, 360 * scale, 260 * scale);
    root.setPosition(x, y, 0);
    root.setScale(scale, scale, 1);

    // 地面软影（相对整书居中）
    const shadow = makeNode('shadow', root, 280, 80);
    shadow.setPosition(0, -62, 0);
    const sg = shadow.addComponent(Graphics);
    sg.fillColor = colorFromHex('#3D2A1F', 38);
    sg.ellipse(0, 0, 110, 24);
    sg.fill();

    // 合上态（保留节点，默认不显示——首页直接摊开）
    const closedNode = makeNode('closed', root, 240, 200);
    closedNode.setPosition(0, 0, 0);
    closedNode.active = false;
    paintClosedBook(closedNode);
    const closedInk = makeNode('closedInk', closedNode, 200, 160);
    placeClosedCoverGlyphs(closedInk, Brand.name);

    // 打开态：书壳 + 实体页栈
    const openNode = makeNode('open', root, 360, 260);
    openNode.setPosition(0, 0, 0);
    openNode.active = true;
    const openG = openNode.addComponent(Graphics);
    paintOpenBook(openG);

    const leafLayer = makeNode('leaves', openNode, 360, 260);
    leafLayer.setPosition(0, 0, 0);

    // 翻页纸（只画卷曲纸面；字来自实体页，不销毁重建）
    const flipNode = makeNode('flip', openNode, 220, 180);
    flipNode.setPosition(0, 0, 0);
    flipNode.active = false;
    const flipG = flipNode.addComponent(Graphics);

    const pageCount = Math.max(1, BOOK_VERSES.length);
    const leaves: LeafPage[] = BOOK_VERSES.map((verse, i) =>
        buildLeafPage(leafLayer, verse, i + 1, i),
    );

    let busy = false;
    let opened = true;
    /** 当前右页下标；已翻到左边的是 [0, cursor) */
    let cursor = 0;
    let autoFlipStarted = false;
    const autoFlipInterval = opts?.autoFlipInterval ?? 1.8;
    const autoTick = { t: 0 };

    const syncRestStack = (opts?: { forcePose?: boolean }) => {
        for (let i = 0; i < pageCount; i++) {
            // 首页只露右页文案，左页保持空白书页
            if (i === cursor) applyLeafRestPose(leaves[i]!, 'right', { force: opts?.forcePose });
            else applyLeafRestPose(leaves[i]!, 'hidden');
            // 翻页时可能临时挂到 openNode，静置一律收回 leafLayer
            if (leaves[i]!.root.parent !== leafLayer) {
                leaves[i]!.root.setParent(leafLayer);
            }
        }
        leaves[cursor]!.root.setSiblingIndex(leafLayer.children.length - 1);
    };

    syncRestStack({ forcePose: true });

    const flipOnce = async () => {
        const from = cursor;
        const to = (cursor + 1) % pageCount;
        const leaf = leaves[from]!;
        const next = leaves[to]!;

        // 下层始终铺好下一页；若本就在右页静置，勿重排字（避免落页闪一下）
        applyLeafRestPose(next, 'right', { force: !next.root.active });
        if (next.root.parent !== leafLayer) next.root.setParent(leafLayer);
        next.root.setSiblingIndex(0);

        // 翻页纸不透明：字必须画在 flip 纸面之上，否则整页发白
        leaf.root.active = true;
        leaf.root.setParent(openNode);
        flipNode.active = true;
        flipNode.setSiblingIndex(openNode.children.length - 1);
        leaf.root.setSiblingIndex(openNode.children.length - 1);

        await animateCurledPageTurn(flipNode, flipG, leaf, {
            // 纸面还在时先收掉掀起页，再清纸，避免背面字硬切闪动
            onBeforeClear: () => {
                if (!root.isValid) return;
                cursor = to;
                if (leaf.root.parent !== leafLayer) leaf.root.setParent(leafLayer);
                applyLeafRestPose(leaf, 'hidden');
                // 下层字已在正确静置位，只提层、不重算姿态
                applyLeafRestPose(next, 'right', { force: false });
                if (next.root.parent !== leafLayer) next.root.setParent(leafLayer);
                next.root.setSiblingIndex(leafLayer.children.length - 1);
                for (let i = 0; i < pageCount; i++) {
                    if (i === cursor) continue;
                    applyLeafRestPose(leaves[i]!, 'hidden');
                    if (leaves[i]!.root.parent !== leafLayer) {
                        leaves[i]!.root.setParent(leafLayer);
                    }
                }
            },
        });
        if (!root.isValid) return;

        flipNode.active = false;
        spawnFlyingKnowledge(root, verseFlyChars(BOOK_VERSES[cursor]!));
    };

    const stopAutoFlip = () => {
        Tween.stopAllByTarget(autoTick);
        autoFlipStarted = false;
    };

    const startAutoFlip = () => {
        if (autoFlipInterval <= 0 || autoFlipStarted || !root.isValid) return;
        autoFlipStarted = true;
        const loop = () => {
            if (!root.isValid || !opened) {
                stopAutoFlip();
                return;
            }
            tween(autoTick)
                .delay(autoFlipInterval)
                .call(() => {
                    if (!root.isValid || !opened) {
                        stopAutoFlip();
                        return;
                    }
                    if (!busy) {
                        busy = true;
                        void flipOnce()
                            .catch(() => undefined)
                            .then(() => {
                                busy = false;
                                loop();
                            });
                    } else {
                        loop();
                    }
                })
                .start();
        };
        loop();
    };

    const play = () => {
        if (busy || !root.isValid) return;
        busy = true;

        const run = async () => {
            stopAutoFlip();
            await flipOnce();
            busy = false;
            startAutoFlip();
        };
        void run().catch(() => {
            busy = false;
            if (opened) startAutoFlip();
        });
    };

    openNode.addComponent(BlockInputEvents);
    openNode.on(Node.EventType.TOUCH_END, (e) => {
        e.propagationStopped = true;
        play();
    });

    idleBookBreathe(root);
    startAutoFlip();

    return { root, play };
}

/** 合上封面顶面：按顶面中心屏幕坐标横排，避免 iso 左右高低错位 */
function placeClosedCoverGlyphs(ink: Node, title: string) {
    ink.removeAllChildren();
    const chars = onlyHan(title);
    if (!chars.length) chars.push('诗', '匣');
    const { w, d, h } = CLOSED;
    // 顶面视觉中心
    const a = iso(-w * 0.35, -d * 0.15, h);
    const b = iso(w * 0.35, d * 0.15, h);
    const cx = (a.x + b.x) * 0.5;
    const cy = (a.y + b.y) * 0.5;
    const n = chars.length;
    const step = 36;
    const start = -((n - 1) * step) * 0.5;
    chars.forEach((ch, i) => {
        const cell = makeNode(`c${i}`, ink, 58, 58);
        cell.setPosition(cx + start + i * step, cy, 0);
        mountIsoFaceGlyph(cell, ch, {
            fontSize: 28,
            faceSize: 58,
            color: '#FFF6EE',
            name: 'GlyphEmb',
            offsetY: 0,
        });
    });
}

type FlipFace = 'front' | 'back' | 'static';
type FlipGlyph = {
    node: Node;
    /** 翻页网格用的右页 UV */
    u: number;
    v: number;
    face: FlipFace;
    /** 静置落在左页时的 UV（正文已左右对调） */
    uLeft: number;
};

type LeafPage = {
    index: number;
    verse: Verse;
    root: Node;
    front: FlipGlyph[];
    back: FlipGlyph[];
};

/** 预生成一张实体页：正反面字一次铺好，翻页不再销毁重建 */
function buildLeafPage(parent: Node, verse: Verse, pageNum: number, index: number): LeafPage {
    const root = makeNode(`leaf${index}`, parent, 200, 200);
    root.setPosition(0, 0, 0);
    const ink = makeNode('ink', root, 200, 200);
    ink.setPosition(0, 0, 0);

    const front = layoutRightPageInk(ink, verse, pageNum, 1).map((g) => {
        const isPg = /pg$/i.test(g.node.name);
        g.face = 'front';
        g.uLeft = isPg ? g.u : 1 - g.u;
        g.node.name = `F_${g.node.name}`;
        return g;
    });
    const back = layoutRightPageInk(ink, verse, pageNum, 1).map((g) => {
        const isPg = /pg$/i.test(g.node.name);
        g.face = 'back';
        g.uLeft = isPg ? g.u : 1 - g.u;
        g.node.name = `B_${g.node.name}`;
        g.node.active = false;
        return g;
    });
    return { index, verse, root, front, back };
}

function applyLeafRestPose(
    leaf: LeafPage,
    side: 'left' | 'right' | 'hidden',
    opts?: { force?: boolean },
) {
    if (!leaf.root.isValid) return;
    if (side === 'hidden') {
        leaf.front.forEach((g) => {
            if (g.node.isValid) g.node.active = false;
        });
        leaf.back.forEach((g) => {
            if (g.node.isValid) g.node.active = false;
        });
        leaf.root.active = false;
        return;
    }
    leaf.root.active = true;
    leaf.front.forEach((g) => {
        if (!g.node.isValid) return;
        if (side === 'right') {
            // 已在右页静置时跳过重排，否则 Label 重建会闪一下
            if (!opts?.force && g.node.active) {
                g.node.active = true;
                return;
            }
            orientBookPageGlyph(g.node, 1, g.u, g.v, 0, 'static');
            g.node.active = true;
        } else {
            g.node.active = false;
        }
    });
    leaf.back.forEach((g) => {
        if (!g.node.isValid) return;
        if (side === 'left') {
            if (!opts?.force && g.node.active) {
                g.node.active = true;
                return;
            }
            orientBookPageGlyph(g.node, -1, g.uLeft, g.v, 0, 'static');
            g.node.active = true;
        } else {
            g.node.active = false;
        }
    });
}

/** 右页：诗行沿页面 UV 居中 + 页码 */
function layoutRightPageInk(parent: Node, v: Verse, page: number, side: -1 | 1): FlipGlyph[] {
    const out: FlipGlyph[] = [];
    const rows = v.lines.map((ln) => onlyHan(ln)).filter((r) => r.length > 0).slice(0, 5);
    const maxCols = Math.max(1, ...rows.map((r) => r.length));
    const rowN = Math.max(1, rows.length);
    const contentW = (maxCols - 1) * CHAR_U;
    const contentH = (rowN - 1) * CHAR_V;
    let u0 = PAGE_CENTER_U - contentW * 0.5;
    let v0 = -contentH * 0.5;
    u0 = Math.max(PAGE_MARGIN_U, Math.min(u0, 1 - PAGE_MARGIN_U - contentW));
    v0 = Math.max(-1 + PAGE_MARGIN_V, Math.min(v0, 1 - PAGE_MARGIN_V - contentH));

    rows.forEach((chars, row) => {
        const vv = v0 + row * CHAR_V;
        chars.forEach((ch, col) => {
            const u = u0 + col * CHAR_U;
            const cell = placeOnOpenPage(parent, ch, side, u, vv, `b${row}_${col}`);
            out.push({ node: cell, u, v: vv, face: 'front', uLeft: 1 - u });
        });
    });

    const marks = ['一', '二', '三', '四', '五', '六'];
    const mark = marks[(page - 1) % marks.length] ?? '一';
    const cell = placeOnOpenPage(parent, mark, side, 0.86, 0.78, 'pg', INK_SOFT, 10, 6);
    out.push({ node: cell, u: 0.86, v: 0.78, face: 'front', uLeft: 0.86 });
    return out;
}

function placeOnOpenPage(
    parent: Node,
    ch: string,
    side: -1 | 1,
    u: number,
    v: number,
    name: string,
    color = INK,
    faceSize = FACE,
    fontSize = FACE_FONT,
) {
    const cell = mountBookPageInk(parent, ch, {
        name,
        color,
        faceSize,
        fontSize,
    });
    orientBookPageGlyph(cell, side, u, v, 0, 'static');
    return cell;
}

/**
 * 铰链翻页：只掀一张实体页（正反字预先钉好），不做落页重建
 * onBeforeClear：清纸前先交接静置页，避免背面字/下层字硬切闪动
 */
function animateCurledPageTurn(
    flipNode: Node,
    g: Graphics,
    leaf: LeafPage,
    opts?: { onBeforeClear?: () => void },
): Promise<void> {
    return new Promise((resolve) => {
        flipNode.active = true;
        const state = { t: 0 };
        const allGlyphs = leaf.front.concat(leaf.back);

        const draw = (t: number) => {
            g.clear();
            const tipTh = curlTheta(1, t);

            if (t > 0.04 && t < 0.92) {
                const tip = curlPagePoint(0.92, 0, t);
                const root = spinePoint(0);
                g.fillColor = colorFromHex('#3D2A1F', Math.floor(40 + Math.sin(tipTh) * 28));
                g.ellipse((tip.x + root.x) * 0.5, tip.y - 10, 36 + Math.sin(tipTh) * 22, 14);
                g.fill();
            }

            const order: number[] = [];
            for (let i = 0; i < FLIP_STRIPS; i++) order.push(i);
            if (tipTh > Math.PI * 0.5) order.reverse();

            for (const i of order) {
                const [a, b, c, d] = flipStripCorners(i, t);
                const um = (i + 0.5) / FLIP_STRIPS;
                const th = curlTheta(um, t);
                const front = th < Math.PI * 0.5;
                const hex = front
                    ? i % 2 === 0
                        ? PAGE
                        : '#FFF4E8'
                    : i % 2 === 0
                      ? PAGE_BACK
                      : '#E4D4BC';
                fillQuad(g, a, b, c, d, hex, 255);

                if (i === FLIP_STRIPS - 1 && th > 0.12 && th < Math.PI - 0.12) {
                    const u1 = 1;
                    const r = 8 + u1 * PAGE_W;
                    const thick = 4;
                    const bx = Math.cos(th) * r;
                    const bz =
                        Math.sin(th) * r * 0.52 +
                        PAGE_H +
                        u1 * WING_LIFT * 0.2 -
                        thick;
                    const b2 = bookProj(bx, -PAGE_D, bz);
                    const c2 = bookProj(bx, PAGE_D, bz);
                    fillQuad(g, b, b2, c2, c, COVER_SIDE, 255);
                }
            }

            strokeQuad(
                g,
                curlPagePoint(0, -1, t),
                curlPagePoint(1, -1, t),
                curlPagePoint(1, 1, t),
                curlPagePoint(0, 1, t),
                '#C4A36A',
                180,
                1.3,
            );

            allGlyphs.forEach((gph) => {
                if (!gph.node.isValid) return;
                orientBookPageGlyph(gph.node, 1, gph.u, gph.v, t, gph.face);
            });
            // 每帧把字层压在翻页纸之上，避免被不透明条带盖成空白页
            const lp = leaf.root.parent;
            if (lp && flipNode.parent === lp) {
                flipNode.setSiblingIndex(Math.max(0, lp.children.length - 2));
                leaf.root.setSiblingIndex(lp.children.length - 1);
            }
        };

        draw(0);
        tween(state)
            .to(
                0.85,
                { t: 1 },
                {
                    easing: 'quadInOut',
                    onUpdate: () => draw(state.t),
                },
            )
            .call(() => {
                draw(1);
                try {
                    opts?.onBeforeClear?.();
                } catch {
                    /* ignore settle errors */
                }
                // 掀起页已收起后再清纸，避免背面字突然消失闪一下
                g.clear();
                resolve();
            })
            .start();
    });
}

/**
 * 嵌入书页：柔墨 + 轻洇影，降低「浮在纸上」感
 */
function mountBookPageInk(
    parent: Node,
    ch: string,
    opts?: { name?: string; color?: string; faceSize?: number; fontSize?: number },
): Node {
    const faceSize = opts?.faceSize ?? FACE;
    const fontSize = opts?.fontSize ?? FACE_FONT;
    const color = opts?.color ?? INK;
    const cell = makeNode(opts?.name ?? 'ink', parent, faceSize, faceSize);
    const op = cell.addComponent(UIOpacity);
    op.opacity = INK_OPACITY;

    const soft = addLabel(cell, 'Soft', ch, fontSize + 1, INK_BLUR, faceSize, faceSize, false);
    soft.isBold = false;
    soft.enableOutline = false;
    soft.enableShadow = false;
    soft.overflow = Label.Overflow.SHRINK;
    soft.horizontalAlign = Label.HorizontalAlign.CENTER;
    soft.verticalAlign = Label.VerticalAlign.CENTER;
    soft.lineHeight = fontSize + 2;
    soft.cacheMode = Label.CacheMode.NONE;
    soft.node.setPosition(0.5, -0.4, 0);
    soft.node.setScale(1.05, 1.05, 1);
    const softOp = soft.node.addComponent(UIOpacity);
    softOp.opacity = 85;

    const lab = addLabel(cell, 'Ink', ch, fontSize, color, faceSize, faceSize, false);
    lab.isBold = false;
    lab.enableOutline = false;
    lab.enableShadow = false;
    lab.overflow = Label.Overflow.SHRINK;
    lab.horizontalAlign = Label.HorizontalAlign.CENTER;
    lab.verticalAlign = Label.VerticalAlign.CENTER;
    lab.lineHeight = fontSize + 1;
    lab.cacheMode = Label.CacheMode.NONE;
    lab.node.setPosition(0, 0, 0);
    const iut = lab.node.getComponent(UITransform);
    if (iut) (iut as UITransform & { hitTest: () => boolean }).hitTest = () => false;
    const sut = soft.node.getComponent(UITransform);
    if (sut) (sut as UITransform & { hitTest: () => boolean }).hitTest = () => false;
    const cut = cell.getComponent(UITransform);
    if (cut) (cut as UITransform & { hitTest: () => boolean }).hitTest = () => false;

    return cell;
}

/**
 * 纸面局部基矢：行向贴合 u，字向可读（大致朝屏幕右），并按透视压扁
 */
function openPageBasis(
    side: -1 | 1,
    u: number,
    v: number,
): { p: Pt; angle: number; sx: number; sy: number } {
    const p = openSurfacePoint(side, u, v);
    const du = 0.05;
    const dv = 0.05;
    const pu = openSurfacePoint(side, Math.min(1, Math.max(0, u + du)), v);
    const pv = openSurfacePoint(side, u, Math.min(1, Math.max(-1, v + dv)));

    // 行向（页面 u）；若指向左则翻成阅读方向（屏幕大致向右）
    let tx = pu.x - p.x;
    let ty = pu.y - p.y;
    if (tx < 0) {
        tx = -tx;
        ty = -ty;
    }
    let angle = (Math.atan2(ty, tx) * 180) / Math.PI;
    // 用页纵方向微调，避免只跟 u 时在书脊附近发飘
    const vx = pv.x - p.x;
    const vy = pv.y - p.y;
    const vAng = (Math.atan2(vy, vx) * 180) / Math.PI - 90;
    let vNorm = vAng;
    while (vNorm > 90) vNorm -= 180;
    while (vNorm < -90) vNorm += 180;
    angle = angle * 0.72 + vNorm * 0.28;

    const lenU = Math.hypot(pu.x - p.x, pu.y - p.y) / du;
    const lenV = Math.hypot(pv.x - p.x, pv.y - p.y) / dv;
    const pref = openSurfacePoint(side, PAGE_CENTER_U, 0);
    const prefU = openSurfacePoint(side, PAGE_CENTER_U + du, 0);
    const prefV = openSurfacePoint(side, PAGE_CENTER_U, dv);
    const refU = Math.max(1e-3, Math.hypot(prefU.x - pref.x, prefU.y - pref.y) / du);
    const refV = Math.max(1e-3, Math.hypot(prefV.x - pref.x, prefV.y - pref.y) / dv);
    const sx = Math.max(0.78, Math.min(1.06, lenU / refU));
    const sy = Math.max(0.68, Math.min(0.98, (lenV / refV) * 0.9));
    return { p, angle, sx, sy };
}

/**
 * 静置：钉在书页 UV，行向跟随纸面
 * 翻页：钉在条带网格上跟随纸面
 */
function orientBookPageGlyph(
    node: Node,
    side: -1 | 1,
    u: number,
    v: number,
    t: number,
    face: FlipFace = 'static',
) {
    if (!node?.isValid) return;

    if (face === 'static' || !(t > 0.001 && side === 1)) {
        const emb = openPageBasis(side, u, v);
        node.setPosition(emb.p.x, emb.p.y, 0);
        node.angle = emb.angle;
        node.setScale(emb.sx, emb.sy, 1);
        const op = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
        // 近书脊略淡，更像落在凹槽阴影里
        const gutter = Math.max(0, 1 - u);
        op.opacity = Math.floor(INK_OPACITY * (0.88 + (1 - gutter) * 0.12));
        node.active = true;
        return;
    }

    const mesh = flipMeshBasis(u, v, t);
    node.setPosition(mesh.p.x, mesh.p.y, 0);

    const th = curlTheta(Math.min(1, Math.max(0, u)), t);
    const align = face === 'front' ? Math.PI * 0.5 - th : th - Math.PI * 0.5;
    const op = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
    if (align <= -0.18) {
        node.active = false;
        return;
    }
    node.active = true;
    const fade = Math.max(0.15, Math.min(1, (align + 0.18) / 0.4));
    // 落页前背面字柔和收掉，避免静置切掉时闪一下（静置左页本来就不留字）
    const settleOut =
        face === 'back' && t > 0.78 ? Math.max(0, 1 - (t - 0.78) / 0.22) : 1;
    op.opacity = Math.floor(INK_OPACITY * fade * settleOut * (face === 'back' ? 0.94 : 1));
    if (settleOut <= 0.02 && face === 'back') {
        node.active = false;
        return;
    }
    node.angle = mesh.angle;
    node.setScale(mesh.sx, mesh.sy, 1);
}

/**
 * 静置摊开曲面（参考图轮廓，bookProj 保证左右同高、相对首页居中）
 * side: -1 左页 / 1 右页；u: 0 书脊→1 书口；v: -1 页顶→1 页底
 */
function openSurfacePoint(side: -1 | 1, u: number, v: number): Pt {
    const uu = Math.min(1, Math.max(0, u));
    const vv = Math.min(1, Math.max(-1, v));
    const x = side * (8 + uu * PAGE_W);
    const depth = vv * PAGE_D;
    const up =
        PAGE_H +
        (1 - uu) * -GUTTER_DROP +
        uu * WING_LIFT * 0.45 +
        -vv * LECTERN_TILT * 0.55 +
        Math.sin(uu * Math.PI) * 4 * (1 - Math.abs(vv) * 0.2);
    return bookProj(x, depth, up);
}

/** 装订槽中线（左右页 u=0 的中点），保证脊线垂直对齐 */
function spinePoint(v: number): Pt {
    const l = openSurfacePoint(-1, 0, v);
    const r = openSurfacePoint(1, 0, v);
    return { x: (l.x + r.x) * 0.5, y: (l.y + r.y) * 0.5 };
}

/** smoothstep */
function smstep(a: number, b: number, x: number): number {
    const t = Math.min(1, Math.max(0, (x - a) / Math.max(1e-6, b - a)));
    return t * t * (3 - 2 * t);
}

/**
 * 翻页角：整页绕书脊铰链 0→π；外缘略领先，形成轻卷曲（不做夸张扭曲）
 */
function curlTheta(u: number, t: number): number {
    const lead = smstep(0, 1, t * 1.08 - (1 - u) * 0.18);
    return lead * Math.PI;
}

/**
 * 右页绕装订线翻到左侧：x 用 cos 扫半圆，抬升用 sin
 * t=0 贴合右页静置面；t=1 落在左页上方
 */
function curlPagePoint(u: number, v: number, t: number): Pt {
    if (t <= 0.001) return openSurfacePoint(1, u, v);
    const uu = Math.min(1, Math.max(0, u));
    const vv = Math.min(1, Math.max(-1, v));
    const th = curlTheta(uu, t);
    const r = 8 + uu * PAGE_W;
    const x = Math.cos(th) * r;
    const depth = vv * PAGE_D;
    const restUp =
        PAGE_H +
        (1 - uu) * -GUTTER_DROP +
        uu * WING_LIFT * 0.45 +
        -vv * LECTERN_TILT * 0.55 +
        Math.sin(uu * Math.PI) * 4 * (1 - Math.abs(vv) * 0.2);
    const lift = Math.sin(th) * r * 0.52;
    return bookProj(x, depth, restUp + lift);
}

/** 翻页绘制条带数：纸面与贴字必须共用 */
const FLIP_STRIPS = 12;

function lerpPt(a: Pt, b: Pt, k: number): Pt {
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

function flipStripCorners(i: number, t: number): [Pt, Pt, Pt, Pt] {
    const u0 = i / FLIP_STRIPS;
    const u1 = (i + 1) / FLIP_STRIPS;
    return [
        curlPagePoint(u0, -1, t),
        curlPagePoint(u1, -1, t),
        curlPagePoint(u1, 1, t),
        curlPagePoint(u0, 1, t),
    ];
}

/**
 * 字落点 = 当前绘制条带四边形上的双线性插值（与 fillQuad 同一平面）
 * 这样字不会跑到曲面弦线外，看起来才是「印在纸上」一起翻
 */
function flipMeshBasis(
    u: number,
    v: number,
    t: number,
): { p: Pt; angle: number; sx: number; sy: number; front: boolean } {
    const uu = Math.min(1, Math.max(0, u));
    const vv = Math.min(1, Math.max(-1, v));
    const i = Math.min(FLIP_STRIPS - 1, Math.floor(uu * FLIP_STRIPS - 1e-9));
    const u0 = i / FLIP_STRIPS;
    const u1 = (i + 1) / FLIP_STRIPS;
    const fu = (uu - u0) / Math.max(1e-6, u1 - u0);
    const fv = (vv + 1) * 0.5;

    const [a, b, c, d] = flipStripCorners(i, t);
    const top = lerpPt(a, b, fu);
    const bot = lerpPt(d, c, fu);
    const p = lerpPt(top, bot, fv);

    const midL = lerpPt(a, d, fv);
    const midR = lerpPt(b, c, fv);
    const midT = lerpPt(a, b, fu);
    const midB = lerpPt(d, c, fu);
    const rx = midR.x - midL.x;
    const ry = midR.y - midL.y;
    const tx = midT.x - midB.x;
    const ty = midT.y - midB.y;

    // 静止时同条带尺寸作基准，按纸面压缩比例缩放
    const [a0, b0, c0, d0] = flipStripCorners(i, 0);
    const midL0 = lerpPt(a0, d0, fv);
    const midR0 = lerpPt(b0, c0, fv);
    const midT0 = lerpPt(a0, b0, fu);
    const midB0 = lerpPt(d0, c0, fu);
    const refR = Math.max(1e-3, Math.hypot(midR0.x - midL0.x, midR0.y - midL0.y));
    const refT = Math.max(1e-3, Math.hypot(midT0.x - midB0.x, midT0.y - midB0.y));
    const curR = Math.hypot(rx, ry);
    const curT = Math.hypot(tx, ty);

    const angle = (Math.atan2(-tx, ty) * 180) / Math.PI;
    const sx = Math.max(0.12, Math.min(1.15, curR / refR));
    const sy = Math.max(0.12, Math.min(1.15, curT / refT));
    const front = curlTheta(uu, t) < Math.PI * 0.5;
    return { p, angle, sx, sy, front };
}

/** 斜俯视合上书：顶面 + 封面正面 + 书口侧 */
function paintClosedBook(node: Node) {
    const g = node.addComponent(Graphics);
    const { w, d, h } = CLOSED;
    const t0 = iso(-w, -d, h);
    const t1 = iso(w, -d, h);
    const t2 = iso(w, d, h);
    const t3 = iso(-w, d, h);
    const f0 = iso(-w, d, h);
    const f1 = iso(w, d, h);
    const f2 = iso(w, d, 0);
    const f3 = iso(-w, d, 0);
    const s0 = iso(w, -d, h);
    const s1 = iso(w, d, h);
    const s2 = iso(w, d, 0);
    const s3 = iso(w, -d, 0);

    // 地面接触影
    const sh0 = iso(-w * 0.9, -d * 0.9, 0);
    const sh1 = iso(w * 1.05, -d * 0.9, 0);
    const sh2 = iso(w * 1.05, d * 1.05, 0);
    const sh3 = iso(-w * 0.9, d * 1.05, 0);
    fillQuad(g, sh0, sh1, sh2, sh3, '#3D2A1F', 30);

    fillQuad(g, s0, s1, s2, s3, COVER_SIDE);
    fillQuad(g, f0, f1, f2, f3, COVER);
    fillQuad(g, t0, t1, t2, t3, COVER_TOP);
    strokeQuad(g, t0, t1, t2, t3, GOLD, 200, 2);
    strokeQuad(g, f0, f1, f2, f3, '#3D2A1F', 120, 1.4);

    // 顶面金线
    const g0 = iso(-w * 0.7, -d * 0.55, h + 0.5);
    const g1 = iso(w * 0.7, -d * 0.55, h + 0.5);
    const g2 = iso(w * 0.7, d * 0.55, h + 0.5);
    const g3 = iso(-w * 0.7, d * 0.55, h + 0.5);
    strokeQuad(g, g0, g1, g2, g3, GOLD, 180, 1.6);

    // 小印
    const p0 = iso(w * 0.35, d * 0.15, h + 0.5);
    g.strokeColor = colorFromHex(GOLD, 210);
    g.lineWidth = 1.6;
    g.roundRect(p0.x - 10, p0.y - 10, 20, 20, 2);
    g.stroke();
}

/**
 * 摊开轮廓（对齐参考图 + 首页中轴）：
 * 简托板 + 浅 V 双页 + 顶部 M 形 + 页叠 —— 全部走 bookProj
 */
function paintOpenBook(g: Graphics) {
    g.clear();
    const STRIPS = 8;

    // 地面软影（中轴）
    g.fillColor = colorFromHex('#3D2A1F', 34);
    g.ellipse(0, -58, 130, 26);
    g.fill();

    // —— 木质书托（收窄，避免把书视觉中心顶偏）——
    const boardFarL = bookProj(-PAGE_W - 18, -PAGE_D - 10, -4);
    const boardFarR = bookProj(PAGE_W + 18, -PAGE_D - 10, LECTERN_TILT * 0.2);
    const boardNearR = bookProj(PAGE_W + 22, PAGE_D + 14, -14);
    const boardNearL = bookProj(-PAGE_W - 22, PAGE_D + 14, -14);
    fillQuad(g, boardFarL, boardFarR, boardNearR, boardNearL, '#8B5A32', 210);
    const ledgeA = bookProj(-PAGE_W - 20, PAGE_D + 6, -8);
    const ledgeB = bookProj(PAGE_W + 20, PAGE_D + 6, -8);
    const ledgeC = bookProj(PAGE_W + 20, PAGE_D + 20, -16);
    const ledgeD = bookProj(-PAGE_W - 20, PAGE_D + 20, -16);
    fillQuad(g, ledgeA, ledgeB, ledgeC, ledgeD, '#6E4424', 230);
    strokeQuad(g, boardFarL, boardFarR, boardNearR, boardNearL, '#4A2E18', 110, 1.3);

    // —— 页叠厚度 ——
    for (let i = 4; i >= 1; i--) {
        const drop = i * 2.8;
        const inflate = i * 1.8;
        const a = bookProj(-PAGE_W - inflate, -PAGE_D + 2, -drop);
        const b = bookProj(PAGE_W + inflate, -PAGE_D + 2, -drop + 2);
        const c = bookProj(PAGE_W + inflate + 1, PAGE_D + 4, -drop - 6);
        const d = bookProj(-PAGE_W - inflate - 1, PAGE_D + 4, -drop - 6);
        fillQuad(g, a, b, c, d, i % 2 === 0 ? PAGE_BACK : '#E6D4BC', 195);
    }
    fillQuad(
        g,
        bookProj(-PAGE_W - 10, -PAGE_D, -2),
        bookProj(-PAGE_W - 3, -PAGE_D, PAGE_H),
        bookProj(-PAGE_W - 3, PAGE_D, PAGE_H - 8),
        bookProj(-PAGE_W - 10, PAGE_D, -10),
        COVER_SIDE,
        220,
    );
    fillQuad(
        g,
        bookProj(PAGE_W + 3, -PAGE_D, PAGE_H),
        bookProj(PAGE_W + 10, -PAGE_D, -2),
        bookProj(PAGE_W + 10, PAGE_D, -10),
        bookProj(PAGE_W + 3, PAGE_D, PAGE_H - 8),
        COVER_SIDE,
        220,
    );

    // —— 左右页（浅 V / 顶边 M）——
    const paintWing = (side: -1 | 1, hex: string) => {
        for (let i = 0; i < STRIPS; i++) {
            const u0 = i / STRIPS;
            const u1 = (i + 1) / STRIPS;
            const a = openSurfacePoint(side, u0, -1);
            const b = openSurfacePoint(side, u1, -1);
            const c = openSurfacePoint(side, u1, 1);
            const d = openSurfacePoint(side, u0, 1);
            const shade = 255 - Math.floor((1 - (u0 + u1) * 0.5) * 24) - (i % 2) * 5;
            fillQuad(g, a, b, c, d, hex, Math.max(205, shade));
        }
        strokeQuad(
            g,
            openSurfacePoint(side, 0, -1),
            openSurfacePoint(side, 1, -1),
            openSurfacePoint(side, 1, 1),
            openSurfacePoint(side, 0, 1),
            '#C4A36A',
            150,
            1.5,
        );
    };
    paintWing(-1, PAGE_LEFT);
    paintWing(1, PAGE);

    fillQuad(
        g,
        openSurfacePoint(-1, 0.02, -1),
        openSurfacePoint(1, 0.02, -1),
        openSurfacePoint(1, 0.02, 1),
        openSurfacePoint(-1, 0.02, 1),
        COVER_SIDE,
        220,
    );
    // 书脊金线：沿装订槽自上而下（左右页中点），不再斜穿
    g.strokeColor = colorFromHex(GOLD, 200);
    g.lineWidth = 2;
    const spineTop = spinePoint(-0.98);
    const spineBot = spinePoint(0.98);
    g.moveTo(spineTop.x, spineTop.y);
    g.lineTo(spineBot.x, spineBot.y);
    g.stroke();

    // 顶边 M 形：左翼 → 脊谷 → 右翼（脊谷用 spinePoint，避免错位）
    g.strokeColor = colorFromHex('#B8956A', 150);
    g.lineWidth = 1.5;
    const mL = openSurfacePoint(-1, 1, -1);
    const mR = openSurfacePoint(1, 1, -1);
    const mMid = spinePoint(-1);
    g.moveTo(mL.x, mL.y);
    g.lineTo(mMid.x, mMid.y);
    g.lineTo(mR.x, mR.y);
    g.stroke();

    for (let i = 1; i <= 4; i++) {
        const o = i * 2.2;
        g.strokeColor = colorFromHex(PAGE_BACK, 150);
        g.lineWidth = 1.1;
        const aa = bookProj(PAGE_W + 8 + o, -PAGE_D + o, PAGE_H + WING_LIFT * 0.25 - o);
        const bb = bookProj(PAGE_W + 8 + o, PAGE_D - o, PAGE_H - 6 - o);
        g.moveTo(aa.x, aa.y);
        g.lineTo(bb.x, bb.y);
        g.stroke();
    }
}

/** 合上书淡出，打开书淡入展开 */
function animateClosedToOpen(closed: Node, open: Node): Promise<void> {
    return new Promise((resolve) => {
        const cop = closed.getComponent(UIOpacity) || closed.addComponent(UIOpacity);
        open.active = true;
        open.setScale(0.72, 0.88, 1);
        const oop = open.getComponent(UIOpacity) || open.addComponent(UIOpacity);
        oop.opacity = 0;

        // 合上书：沿书口轴「掀起」—— scaleX 收 + 略抬 + 左转
        tween(closed)
            .to(
                0.34,
                {
                    scale: new Vec3(0.15, 1.05, 1),
                    position: new Vec3(-36, 6, 0),
                    eulerAngles: new Vec3(0, 0, -8),
                },
                { easing: 'quadIn' },
            )
            .start();
        tween(cop)
            .to(0.34, { opacity: 0 })
            .call(() => {
                closed.active = false;
                closed.setScale(1, 1, 1);
                closed.setPosition(0, 0, 0);
                closed.setRotationFromEuler(0, 0, 0);
                cop.opacity = 255;
            })
            .start();

        tween(oop).delay(0.18).to(0.28, { opacity: 255 }, { easing: 'sineOut' }).start();
        tween(open)
            .delay(0.18)
            .to(0.36, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .call(() => resolve())
            .start();
    });
}

/**
 * 知识飞出：由小变大飞升，到达高度后爆炸
 */
function spawnFlyingKnowledge(parent: Node, chars: string[]) {
    const palette = [Colors.brown, COVER, GOLD, '#E8A878', '#C45C3A', '#8B5A32'];
    chars.forEach((ch, i) => {
        const n = makeNode(`fly${i}`, parent, 48, 48);
        const start = iso(20 + (i % 3) * 12, -8 + (i % 2) * 10, 16);
        n.setPosition(start.x, start.y, 0);
        n.setScale(0.12, 0.12, 1);
        const col = palette[i % palette.length]!;
        addLabel(n, 'c', ch, 26 + (i % 3) * 2, col, 48, 48, true);
        const op = n.addComponent(UIOpacity);
        op.opacity = 0;

        // 杂乱抛物线：左右乱飞、顶点高度不一，爆炸点可落在上升段/顶点/下落段
        const side = Math.random() < 0.5 ? -1 : 1;
        const span = 48 + Math.random() * 110;
        const apexH = 48 + Math.random() * 88;
        const midX = start.x + side * span * (0.25 + Math.random() * 0.25) + (Math.random() * 28 - 14);
        const midY = start.y + apexH * (0.35 + Math.random() * 0.25);
        const apexX = start.x + side * span * (0.5 + Math.random() * 0.25) + (Math.random() * 36 - 18);
        const apexY = start.y + apexH;
        const endX = start.x + side * span * (0.85 + Math.random() * 0.45) + (Math.random() * 40 - 20);
        const endY = start.y + apexH * (0.1 + Math.random() * 0.55);
        const delay = i * 0.04 + Math.random() * 0.08;
        const spin0 = (Math.random() - 0.5) * 40;
        const spin1 = spin0 + side * (18 + Math.random() * 36);
        const spin2 = spin1 + (Math.random() - 0.5) * 50;
        // 0=升到半空炸 1=近顶点炸 2=越过顶点下落再炸
        const explodeAt = Math.random() < 0.32 ? 0 : Math.random() < 0.55 ? 1 : 2;
        const peakScale = 0.95 + Math.random() * 0.25;

        const boom = () => {
            if (!n.isValid || !parent.isValid) return;
            explodeStarDust(parent, n.position.x, n.position.y, col);
            n.destroy();
        };

        tween(op).delay(delay).to(0.1, { opacity: 255 }).start();
        const tw = tween(n).delay(delay).to(
            0.22 + Math.random() * 0.12,
            {
                position: new Vec3(midX, midY, 0),
                scale: new Vec3(peakScale * 0.55, peakScale * 0.55, 1),
                eulerAngles: new Vec3(0, 0, spin0),
            },
            { easing: 'quadOut' },
        );
        if (explodeAt === 0) {
            tw.call(boom).start();
            return;
        }
        tw.to(
            0.24 + Math.random() * 0.14,
            {
                position: new Vec3(apexX, apexY, 0),
                scale: new Vec3(peakScale * (explodeAt === 1 ? 1 : 0.85), peakScale * (explodeAt === 1 ? 1 : 0.85), 1),
                eulerAngles: new Vec3(0, 0, spin1),
            },
            { easing: 'sineOut' },
        );
        if (explodeAt === 1) {
            tw.call(boom).start();
            return;
        }
        tw.to(
            0.2 + Math.random() * 0.16,
            {
                position: new Vec3(endX, endY, 0),
                scale: new Vec3(peakScale, peakScale, 1),
                eulerAngles: new Vec3(0, 0, spin2),
            },
            { easing: 'quadIn' },
        )
            .call(boom)
            .start();
    });
}

/** 星屑爆炸：金星 + 彩屑向外崩开 */
function explodeStarDust(parent: Node, x: number, y: number, hex: string) {
    sparkBurst(parent, x, y, 14, hex);
    sparkBurst(parent, x, y, 10, GOLD);
    burstStars(parent, x, y);

    // 额外一圈细星点
    for (let i = 0; i < 10; i++) {
        const n = makeNode(`st${i}`, parent, 16, 16);
        n.setPosition(x, y, 0);
        const lab = addLabel(n, 't', i % 2 === 0 ? '✦' : '✧', 12 + (i % 3) * 2, i % 2 === 0 ? GOLD : '#FFF6EE', 18, 18);
        lab.node.setPosition(0, 0, 0);
        const op = n.addComponent(UIOpacity);
        op.opacity = 255;
        const ang = (Math.PI * 2 * i) / 10 + Math.random() * 0.3;
        const dist = 36 + Math.random() * 55;
        tween(n)
            .to(
                0.4 + Math.random() * 0.15,
                {
                    position: new Vec3(x + Math.cos(ang) * dist, y + Math.sin(ang) * dist + 12, 0),
                    scale: new Vec3(0.2, 0.2, 1),
                    eulerAngles: new Vec3(0, 0, (Math.random() - 0.5) * 180),
                },
                { easing: 'quadOut' },
            )
            .call(() => {
                if (n.isValid) n.destroy();
            })
            .start();
        tween(op).delay(0.1).to(0.35, { opacity: 0 }).start();
    }
}

function idleHintPulse(node: Node) {
    if (!node?.isValid) return;
    Tween.stopAllByTarget(node);
    const op = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
    op.opacity = 160;
    tween(op)
        .to(0.9, { opacity: 255 }, { easing: 'sineInOut' })
        .to(0.9, { opacity: 140 }, { easing: 'sineInOut' })
        .union()
        .repeatForever()
        .start();
}

function idleBookBreathe(node: Node) {
    const sx = node.scale.x;
    const sy = node.scale.y;
    tween(node)
        .to(1.6, { scale: new Vec3(sx * 1.012, sy * 1.012, 1) }, { easing: 'sineInOut' })
        .to(1.6, { scale: new Vec3(sx, sy, 1) }, { easing: 'sineInOut' })
        .union()
        .repeatForever()
        .start();
}
