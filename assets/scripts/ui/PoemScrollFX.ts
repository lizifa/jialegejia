/**
 * 古绢画轴：自左向右缓缓舒展
 * 哑光古绢织纹 · 锦边 · 乌木鎏金轴头（与散页匣同形）· 水墨随卷显现
 */
import { Graphics, Label, Mask, Node, Tween, UIOpacity, UITransform, Vec3, tween } from 'cc';
import { Colors } from '../core/Config';
import { MidAutumnColors, isMidAutumn } from '../core/Festival';
import { Verse } from '../core/Literature';
import { addLabel, colorFromHex, makeNode } from './UIKit';

export type ScrollOpenMeta = {
    root: Node;
    clip: Node;
    clipUI: UITransform;
    sheet: Node;
    rollerL: Node;
    rollerR: Node;
    titleNode: Node;
    titleSeal: Node;
    bodyNode: Node;
    nextSeal: Node;
    mistLayer: Node;
    half: number;
    paperW: number;
    paperH: number;
};

export type PoemScrollBuilt = {
    root: Node;
    sheet: Node;
    bodyLabel: Label;
    nextLabel: Label;
    nextSealG: Graphics;
    barG: Graphics | null;
    meta: ScrollOpenMeta;
};

function setOp(node: Node, a: number) {
    const op = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
    op.opacity = a;
}

/** 乌木卷轴头 + 鎏金轴帽（与散页匣同色；轴帽更饱满，对齐参考图） */
function drawEbonyGoldRoller(g: Graphics, h: number) {
    const rw = 18;
    // 投影
    g.fillColor = colorFromHex('#120E0C', 70);
    g.ellipse(3, 0, rw * 0.65, h * 0.46);
    g.fill();
    // 乌木圆柱（纸贴其内侧）
    g.fillColor = colorFromHex('#2A211C', 255);
    g.roundRect(-rw * 0.5, -h * 0.5, rw, h, 8);
    g.fill();
    g.fillColor = colorFromHex('#45362E', 230);
    g.roundRect(-rw * 0.2, -h * 0.5, rw * 0.38, h, 6);
    g.fill();
    g.fillColor = colorFromHex('#6B5648', 85);
    g.roundRect(-2.5, -h * 0.46, 2.2, h * 0.92, 1);
    g.fill();
    // 纸缘接缝细线
    g.strokeColor = colorFromHex('#1A1410', 120);
    g.lineWidth = 1;
    g.moveTo(rw * 0.48, -h * 0.46);
    g.lineTo(rw * 0.48, h * 0.46);
    g.stroke();
    // 鎏金圆柱轴帽
    const cap = (dir: 1 | -1) => {
        const cy = dir * (h * 0.5);
        g.fillColor = colorFromHex('#B8893E', 255);
        g.ellipse(0, cy + dir * 1.5, rw * 0.62, 5);
        g.fill();
        g.fillColor = colorFromHex('#D4B06A', 255);
        g.ellipse(0, cy + dir * 5, rw * 0.52, 4.2);
        g.fill();
        g.fillColor = colorFromHex('#F0E0A8', 220);
        g.ellipse(-1.5, cy + dir * 5.5, rw * 0.22, 2);
        g.fill();
        g.fillColor = colorFromHex('#E8D080', 240);
        g.ellipse(0, cy + dir * 8.5, rw * 0.38, 2.6);
        g.fill();
    };
    cap(1);
    cap(-1);
}

/**
 * 轻宣纸：细边、无厚锦边（参考图轻纸画轴）
 */
function drawSilkPaper(g: Graphics, w: number, h: number) {
    // 底影
    g.fillColor = colorFromHex('#1E1610', 28);
    g.ellipse(6, -h * 0.48, w * 0.46, 10);
    g.fill();

    // 宣纸主色
    g.fillColor = colorFromHex('#F6F0E2', 255);
    g.rect(-w * 0.5, -h * 0.5, w, h);
    g.fill();

    // 岁月晕染
    g.fillColor = colorFromHex('#E8DCC4', 55);
    g.ellipse(-w * 0.2, h * 0.04, w * 0.36, h * 0.38);
    g.fill();
    g.fillColor = colorFromHex('#FFFCF4', 48);
    g.ellipse(w * 0.18, -h * 0.06, w * 0.32, h * 0.34);
    g.fill();

    // 淡织纹
    g.strokeColor = colorFromHex('#D2C4A8', 18);
    g.lineWidth = 1;
    const rows = Math.floor(h / 3.4);
    for (let i = 0; i < rows; i++) {
        const yy = -h * 0.5 + 4 + i * 3.4;
        if (yy > h * 0.5 - 4) break;
        g.moveTo(-w * 0.5 + 3, yy);
        g.lineTo(w * 0.5 - 3, yy);
        g.stroke();
    }

    // 近轴卷影（纸贴轴）
    g.fillColor = colorFromHex('#C8B898', 50);
    g.rect(-w * 0.5, -h * 0.5 + 2, 8, h - 4);
    g.fill();
    g.fillColor = colorFromHex('#C8B898', 38);
    g.rect(w * 0.5 - 7, -h * 0.5 + 2, 7, h - 4);
    g.fill();

    // 细描边（非厚锦边）
    g.strokeColor = colorFromHex('#C4B08A', 110);
    g.lineWidth = 1.2;
    g.rect(-w * 0.5 + 0.5, -h * 0.5 + 0.5, w - 1, h - 1);
    g.stroke();
    g.strokeColor = colorFromHex('#A89070', 55);
    g.lineWidth = 1;
    g.rect(-w * 0.5 + 2.5, -h * 0.5 + 2.5, w - 5, h - 5);
    g.stroke();
}

/** 淡墨远山 */
function drawInkLandscape(g: Graphics, w: number, h: number) {
    const ink = '#6A6E72';
    g.fillColor = colorFromHex(ink, 26);
    g.moveTo(-w * 0.5, -h * 0.02);
    g.quadraticCurveTo(-w * 0.25, h * 0.2, 0, 0);
    g.quadraticCurveTo(w * 0.22, -h * 0.22, w * 0.5, -h * 0.05);
    g.lineTo(w * 0.5, -h * 0.5 + 14);
    g.lineTo(-w * 0.5, -h * 0.5 + 14);
    g.close();
    g.fill();

    g.fillColor = colorFromHex(ink, 40);
    g.moveTo(-w * 0.5, -h * 0.16);
    g.quadraticCurveTo(-w * 0.15, 0.02 * h, w * 0.08, -h * 0.14);
    g.quadraticCurveTo(w * 0.3, -h * 0.3, w * 0.5, -h * 0.18);
    g.lineTo(w * 0.5, -h * 0.5 + 14);
    g.lineTo(-w * 0.5, -h * 0.5 + 14);
    g.close();
    g.fill();

    g.fillColor = colorFromHex(ink, 52);
    g.moveTo(-w * 0.5, -h * 0.28);
    g.quadraticCurveTo(-w * 0.1, -h * 0.12, w * 0.12, -h * 0.28);
    g.quadraticCurveTo(w * 0.35, -h * 0.4, w * 0.5, -h * 0.3);
    g.lineTo(w * 0.5, -h * 0.5 + 14);
    g.lineTo(-w * 0.5, -h * 0.5 + 14);
    g.close();
    g.fill();
}

function drawTitleSeal(g: Graphics, size: number, lacquer: string) {
    g.fillColor = colorFromHex(lacquer, 225);
    g.roundRect(-size * 0.5, -size * 0.5, size, size, 2);
    g.fill();
    g.strokeColor = colorFromHex('#FFF0E0', 75);
    g.lineWidth = 1;
    g.roundRect(-size * 0.5 + 2, -size * 0.5 + 2, size - 4, size - 4, 1);
    g.stroke();
}

function mountMist(parent: Node, w: number, h: number): Node {
    const layer = makeNode('mist', parent, w, h);
    for (let i = 0; i < 5; i++) {
        const p = makeNode(`m${i}`, layer, 80, 40);
        const x0 = -w * 0.32 + i * (w * 0.16);
        const y0 = -h * 0.06 + (i % 2) * 8;
        p.setPosition(x0, y0, 0);
        const g = p.addComponent(Graphics);
        g.fillColor = colorFromHex('#F4F0E6', 38);
        g.ellipse(0, 0, 26 + i * 2, 9);
        g.fill();
        g.ellipse(12, 1, 16, 7);
        g.fill();
        setOp(p, 80 + i * 10);
        const op = p.getComponent(UIOpacity)!;
        const base = p.position.clone();
        tween(p)
            .to(3.4 + i * 0.35, { position: new Vec3(base.x + 20, base.y + 3, 0) }, { easing: 'sineInOut' })
            .to(3.4 + i * 0.35, { position: base }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();
        tween(op)
            .to(2.6, { opacity: 45 + i * 6 }, { easing: 'sineInOut' })
            .to(2.6, { opacity: 95 + i * 8 }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();
    }
    return layer;
}

export function paintScrollNextSeal(
    g: Graphics,
    label: Label,
    opts: { char: string; sub: string; done: boolean; sheetW: number; sheetH: number },
) {
    const lacquer = isMidAutumn() ? MidAutumnColors.lacquer : '#A63A2C';
    const fill = opts.done ? Colors.highlight : lacquer;
    const size = 48;
    g.clear();
    g.fillColor = colorFromHex(fill, 235);
    g.roundRect(-size * 0.5, -size * 0.5, size, size, 2);
    g.fill();
    g.strokeColor = colorFromHex('#FFF5E8', 160);
    g.lineWidth = 1.6;
    g.roundRect(-size * 0.5 + 3, -size * 0.5 + 3, size - 6, size - 6, 1);
    g.stroke();

    label.string = opts.char;
    label.fontSize = opts.char.length > 1 ? 16 : 26;
    label.color = colorFromHex('#FFF8F0');
    label.isBold = true;

    const sub = g.node.getChildByName('sub');
    if (sub) {
        const lab = sub.getComponent(Label);
        if (lab) lab.string = opts.sub;
    }
    // sheet 中心锚点
    g.node.setPosition(opts.sheetW * 0.5 - 42, 6, 0);
}

export function mountPoemScroll(
    parent: Node,
    verse: Verse,
    cardW: number,
    centerY: number,
    cardH: number,
    bodyText: string,
): PoemScrollBuilt {
    const fest = isMidAutumn();
    const lacquer = fest ? MidAutumnColors.lacquer : '#A63A2C';
    const ink = '#2A2622';
    const paperH = Math.max(128, cardH);
    const paperW = cardW;
    const rollerSpan = 22;

    const root = makeNode('poemHud', parent, paperW + rollerSpan * 2 + 16, paperH + 40);
    root.setPosition(0, centerY, 0);

    const glow = makeNode('skylight', root, paperW + 80, paperH + 60);
    const gg = glow.addComponent(Graphics);
    gg.fillColor = colorFromHex('#F2EADF', 50);
    gg.ellipse(0, 6, paperW * 0.52, paperH * 0.68);
    gg.fill();
    setOp(glow, 170);

    const shadow = makeNode('shadow', root, paperW, 28);
    shadow.setPosition(4, -paperH * 0.5 - 2, 0);
    const sg = shadow.addComponent(Graphics);
    sg.fillColor = colorFromHex('#1E1610', 34);
    sg.ellipse(0, 0, paperW * 0.46, 11);
    sg.fill();

    /**
     * 左锚点遮罩：自左向右舒展
     * 先露出题签一侧，再铺开诗文
     */
    const clip = makeNode('clip', root, paperW, paperH);
    const clipUI = clip.getComponent(UITransform)!;
    clipUI.setAnchorPoint(0, 0.5);
    clip.setPosition(-paperW * 0.5, 0, 0);
    clip.addComponent(Mask).type = Mask.Type.GRAPHICS_RECT;
    clipUI.setContentSize(26, paperH);

    const sheet = makeNode('sheet', clip, paperW, paperH);
    // 完整宣纸相对 clip 左缘居中放置，展开时从左往右露出
    sheet.getComponent(UITransform)!.setAnchorPoint(0.5, 0.5);
    sheet.setPosition(paperW * 0.5, 0, 0);

    drawSilkPaper(sheet.addComponent(Graphics), paperW, paperH);

    const landscape = makeNode('landscape', sheet, paperW, paperH);
    drawInkLandscape(landscape.addComponent(Graphics), paperW, paperH);
    setOp(landscape, 0);

    const mistLayer = mountMist(sheet, paperW, paperH);
    setOp(mistLayer, 0);

    const titleColX = -paperW * 0.5 + 54;
    const titleLab = addLabel(sheet, 'title', verse.title, 32, ink, 96, 42, true);
    titleLab.spacingX = 2;
    titleLab.node.setPosition(titleColX, 14, 0);

    const sealNode = makeNode('titleSeal', sheet, 20, 20);
    sealNode.setPosition(titleColX, -18, 0);
    drawTitleSeal(sealNode.addComponent(Graphics), 18, lacquer);
    addLabel(sealNode, 'ch', (verse.title && verse.title[0]) || '诗', 11, '#FFF8F0', 18, 18, true).node.setPosition(
        0,
        0,
        0,
    );

    const div = makeNode('div', sheet, 4, paperH - 32);
    div.setPosition(-paperW * 0.5 + 100, 0, 0);
    const dg = div.addComponent(Graphics);
    dg.strokeColor = colorFromHex('#B0A090', 110);
    dg.lineWidth = 1;
    dg.moveTo(0, paperH * 0.4);
    dg.lineTo(0, -paperH * 0.4);
    dg.stroke();

    const body = addLabel(sheet, 'body', bodyText, 19, '#3A342E', paperW - 210, paperH - 42, true);
    body.lineHeight = 25;
    body.overflow = Label.Overflow.SHRINK;
    body.node.setPosition(-4, 0, 0);

    const nextNode = makeNode('nextSeal', sheet, 60, 76);
    nextNode.setPosition(paperW * 0.5 - 42, 6, 0);
    const nextSealG = nextNode.addComponent(Graphics);
    const nextLabel = addLabel(nextNode, 'prog', '', 26, '#FFF8F0', 48, 48, true);
    nextLabel.node.setPosition(0, 4, 0);
    const sub = addLabel(nextNode, 'sub', '下一个', 11, lacquer, 60, 18, true);
    sub.node.name = 'sub';
    sub.node.setPosition(0, -32, 0);

    const barNode = makeNode('bar', sheet, paperW - 48, 5);
    barNode.setPosition(0, -paperH * 0.5 + 15, 0);
    const barG = barNode.addComponent(Graphics);

    const makeRoller = (name: string) => {
        const n = makeNode(name, root, 36, paperH + 36);
        drawEbonyGoldRoller(n.addComponent(Graphics), paperH + 8);
        return n;
    };
    const rollerL = makeRoller('rollerL');
    const rollerR = makeRoller('rollerR');
    // 初始卷在左侧，轴身压住纸缘（与开轴/收束同形）
    const press = 5;
    rollerL.setPosition(-paperW * 0.5 + press, 0, 0);
    rollerR.setPosition(-paperW * 0.5 + 24 - press * 0.2, 0, 0);
    rollerL.setRotationFromEuler(0, 0, 0);
    rollerR.setRotationFromEuler(0, 0, 0);

    setOp(titleLab.node, 0);
    setOp(sealNode, 0);
    setOp(body.node, 0);
    setOp(nextNode, 0);
    setOp(div, 0);

    const meta: ScrollOpenMeta = {
        root,
        clip,
        clipUI,
        sheet,
        rollerL,
        rollerR,
        titleNode: titleLab.node,
        titleSeal: sealNode,
        bodyNode: body.node,
        nextSeal: nextNode,
        mistLayer,
        half: paperW * 0.5,
        paperW,
        paperH,
    };

    bindGentleTap(meta);
    return { root, sheet, bodyLabel: body, nextLabel, nextSealG, barG, meta };
}

function bindGentleTap(meta: ScrollOpenMeta) {
    const { root, nextSeal } = meta;
    root.off(Node.EventType.TOUCH_END);
    root.on(Node.EventType.TOUCH_END, () => {
        if (!nextSeal.isValid) return;
        Tween.stopAllByTarget(nextSeal);
        tween(nextSeal)
            .to(0.12, { scale: new Vec3(1.08, 1.08, 1) }, { easing: 'sineOut' })
            .to(0.28, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
            .start();
    });
}

/** 自左向右匀速舒展 · 水墨渐显 · 轻推镜头
 * 轴头始终竖直、压住纸缘，开轴前后形态与散页匣端头一致
 */
export function playPoemScrollOpen(meta: ScrollOpenMeta, dur = 2.2) {
    const {
        root,
        clip,
        clipUI,
        sheet,
        rollerL,
        rollerR,
        titleNode,
        titleSeal,
        bodyNode,
        nextSeal,
        mistLayer,
        half,
        paperW,
        paperH,
    } = meta;

    const leftX = -paperW * 0.5;
    const startW = 26;
    // 轴心压入纸缘，全程同形，收束也不外扩
    const press = 5;
    const leftRest = leftX + press;
    const rightRest = half - press;
    clipUI.setAnchorPoint(0, 0.5);
    clip.setPosition(leftX, 0, 0);
    clipUI.setContentSize(startW, paperH);

    if (rollerL.isValid) {
        rollerL.setRotationFromEuler(0, 0, 0);
        rollerL.setPosition(leftRest, 0, 0);
        rollerL.setSiblingIndex(root.children.length - 1);
    }
    if (rollerR.isValid) {
        rollerR.setRotationFromEuler(0, 0, 0);
        rollerR.setPosition(leftX + startW - press, 0, 0);
        rollerR.setSiblingIndex(root.children.length - 1);
    }

    const rootBase = root.position.clone();
    root.setScale(0.97, 0.97, 1);
    tween(root)
        .to(
            dur + 0.45,
            { scale: new Vec3(1.03, 1.03, 1), position: new Vec3(rootBase.x, rootBase.y + 3, 0) },
            { easing: 'sineInOut' },
        )
        .start();

    const landscape = sheet.getChildByName('landscape');
    if (landscape) setOp(landscape, 0);
    setOp(mistLayer, 0);

    const state = { w: startW };
    tween(state)
        .to(
            dur,
            { w: paperW },
            {
                easing: 'sineInOut',
                onUpdate: () => {
                    if (!clip.isValid) return;
                    clipUI.setContentSize(state.w, paperH);
                    const rightEdge = leftX + state.w;
                    if (rollerR.isValid) {
                        rollerR.setRotationFromEuler(0, 0, 0);
                        rollerR.setPosition(rightEdge - press, 0, 0);
                    }
                    if (rollerL.isValid) {
                        rollerL.setRotationFromEuler(0, 0, 0);
                        rollerL.setPosition(leftRest, 0, 0);
                    }
                    const t = Math.min(1, (state.w - startW) / Math.max(1, paperW - startW));
                    if (landscape?.isValid) setOp(landscape, Math.floor(28 + t * 210));
                    if (mistLayer.isValid) setOp(mistLayer, Math.floor(t * 200));
                },
            },
        )
        .call(() => {
            if (rollerR.isValid) {
                tween(rollerR)
                    .to(0.22, { position: new Vec3(rightRest, 0, 0) }, { easing: 'sineOut' })
                    .start();
            }
            if (rollerL.isValid) {
                tween(rollerL)
                    .to(0.22, { position: new Vec3(leftRest, 0, 0) }, { easing: 'sineOut' })
                    .start();
            }
        })
        .start();

    const fadeIn = (node: Node, delay: number, fromY = 8) => {
        if (!node?.isValid) return;
        const base = node.position.clone();
        node.setPosition(base.x, base.y - fromY, 0);
        setOp(node, 0);
        const op = node.getComponent(UIOpacity)!;
        tween(op).delay(delay).to(0.5, { opacity: 255 }, { easing: 'sineOut' }).start();
        tween(node).delay(delay).to(0.55, { position: base }, { easing: 'sineOut' }).start();
    };

    // 左→右：题签较早显现
    const t0 = dur * 0.28;
    fadeIn(titleNode, t0, 8);
    fadeIn(titleSeal, t0 + 0.15, 5);
    fadeIn(bodyNode, dur * 0.55, 8);
    fadeIn(nextSeal, dur * 0.72, 10);
    const div = sheet.getChildByName('div');
    if (div) fadeIn(div, t0 + 0.2, 0);
}

export function attachScrollMeta(root: Node, meta: ScrollOpenMeta) {
    (root as Node & { _scrollMeta?: ScrollOpenMeta })._scrollMeta = meta;
}

export function readScrollMeta(root: Node | null): ScrollOpenMeta | null {
    if (!root) return null;
    return (root as Node & { _scrollMeta?: ScrollOpenMeta })._scrollMeta ?? null;
}
