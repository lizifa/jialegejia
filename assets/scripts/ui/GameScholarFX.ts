/**
 * 对局页「书生意气」氛围：水墨月夜 · 花灯 · 木牌 · 乌木匣 · 竖钮道具
 */
import { Graphics, Label, Node, UIOpacity, Vec3, tween } from 'cc';
import { Design } from '../core/Config';
import { SafeLayout } from '../core/SafeArea';
import { addLabel, bindJellyPress, colorFromHex, drawIsoSlot, idleSway, makeNode } from './UIKit';
import { disableHit } from './pages/PageKit';

const GOLD = '#D4B06A';
const INK = '#8A8E92';
const WOOD = '#3A2E26';
const WOOD_LITE = '#5A4A3A';
const PAPER = '#F7F1E6';

/** 浅宣纸 + 极淡山水（不压暗画面） */
export function mountScholarBackdrop(parent: Node, safe: SafeLayout, hangDrop = 48): Node {
    const visH = safe.visH;
    const W = Design.width;
    const root = makeNode('ScholarBackdrop', parent, W, visH);
    root.setSiblingIndex(0);

    const paper = makeNode('paper', root, W, visH);
    const pg = paper.addComponent(Graphics);
    // 浅宣纸
    pg.fillColor = colorFromHex(PAPER);
    pg.rect(-W * 0.5, -visH * 0.5, W, visH);
    pg.fill();
    // 顶部略暖的天光，避免发黑
    pg.fillColor = colorFromHex('#FFF8EC', 90);
    pg.ellipse(0, visH * 0.42, 520, 180);
    pg.fill();
    // 极淡纤维
    for (let i = 0; i < 18; i++) {
        const x = ((i * 97) % 700) - 350;
        const y = ((i * 53) % 1100) - 550;
        pg.fillColor = colorFromHex('#E2D6C0', 16 + (i % 3) * 5);
        pg.circle(x, y * (visH / 1280), 1.1 + (i % 3) * 0.5);
        pg.fill();
    }
    disableHit(paper);

    const shan = makeNode('shanshui', root, W, visH);
    const g = shan.addComponent(Graphics);

    // 浅月（更透、更淡）
    const moonX = 20;
    const moonY = visH * 0.3;
    g.fillColor = colorFromHex('#FFF8E8', 35);
    g.circle(moonX, moonY, 120);
    g.fill();
    g.fillColor = colorFromHex('#FFFCF2', 70);
    g.circle(moonX, moonY, 78);
    g.fill();
    g.fillColor = colorFromHex('#FFFFFF', 110);
    g.circle(moonX, moonY, 48);
    g.fill();

    // 远山：刻意压低透明度
    g.fillColor = colorFromHex(INK, 10);
    g.moveTo(-W * 0.5, visH * 0.0);
    g.quadraticCurveTo(-260, visH * 0.14, -60, visH * 0.04);
    g.quadraticCurveTo(100, -visH * 0.05, 240, visH * 0.02);
    g.quadraticCurveTo(340, visH * 0.1, W * 0.5, 0);
    g.lineTo(W * 0.5, -visH * 0.5);
    g.lineTo(-W * 0.5, -visH * 0.5);
    g.close();
    g.fill();

    g.fillColor = colorFromHex(INK, 16);
    g.moveTo(-W * 0.5, -visH * 0.08);
    g.quadraticCurveTo(-280, visH * 0.06, -140, -visH * 0.04);
    g.quadraticCurveTo(-20, -visH * 0.14, 120, -visH * 0.06);
    g.quadraticCurveTo(260, -visH * 0.16, W * 0.5, -visH * 0.1);
    g.lineTo(W * 0.5, -visH * 0.5);
    g.lineTo(-W * 0.5, -visH * 0.5);
    g.close();
    g.fill();

    g.fillColor = colorFromHex(INK, 22);
    g.moveTo(-W * 0.5, -visH * 0.22);
    g.quadraticCurveTo(-200, -visH * 0.1, -40, -visH * 0.2);
    g.quadraticCurveTo(100, -visH * 0.3, 220, -visH * 0.22);
    g.quadraticCurveTo(320, -visH * 0.32, W * 0.5, -visH * 0.26);
    g.lineTo(W * 0.5, -visH * 0.5);
    g.lineTo(-W * 0.5, -visH * 0.5);
    g.close();
    g.fill();

    // 左下亭：更淡
    const tingX = -200;
    const tingY = -visH * 0.06;
    g.fillColor = colorFromHex(INK, 24);
    g.ellipse(tingX, tingY - 14, 40, 12);
    g.fill();
    g.rect(tingX - 2, tingY - 6, 4, 20);
    g.fill();
    g.moveTo(tingX - 16, tingY + 10);
    g.lineTo(tingX, tingY + 22);
    g.lineTo(tingX + 16, tingY + 10);
    g.close();
    g.fill();

    disableHit(shan);
    setOp(shan, 160);

    // 薄雾更浅
    const mistRoot = makeNode('mist', root, W, visH);
    [
        [-220, visH * 0.08, 1.15],
        [60, visH * 0.02, 1.0],
        [200, -visH * 0.1, 1.1],
        [-80, -visH * 0.18, 1.2],
    ].forEach(([mx, my, sc], i) => {
        const n = makeNode(`mist${i}`, mistRoot, 160, 60);
        n.setPosition(mx, my, 0);
        const mg = n.addComponent(Graphics);
        mg.fillColor = colorFromHex('#FFFFFF', 40);
        mg.ellipse(0, 0, 52 * sc, 13 * sc);
        mg.fill();
        mg.ellipse(28 * sc, 2, 36 * sc, 10 * sc);
        mg.fill();
        setOp(n, 70);
        const base = n.position.clone();
        const op = n.getComponent(UIOpacity)!;
        tween(n)
            .to(4.5 + i * 0.4, { position: new Vec3(base.x + 22, base.y + 3, 0) }, { easing: 'sineInOut' })
            .to(4.5 + i * 0.4, { position: base }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();
        tween(op)
            .to(3.4, { opacity: 40 }, { easing: 'sineInOut' })
            .to(3.4, { opacity: 85 }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();
    });
    disableHit(mistRoot);

    mountScholarLanterns(root, safe, hangDrop);

    const brandY = safe.half - Math.max(36, safe.topInset * 0.35) - hangDrop * 0.2;
    const brand = addLabel(root, 'brand', '诗匣', 24, '#3A3228', 120, 34, true);
    brand.spacingX = 8;
    brand.node.setPosition(0, brandY, 0);
    setOp(brand.node, 190);
    const seal = makeNode('brandSeal', root, 16, 16);
    seal.setPosition(48, brandY - 2, 0);
    const sg = seal.addComponent(Graphics);
    sg.fillColor = colorFromHex('#A63A2C', 150);
    sg.roundRect(-7, -7, 14, 14, 1.5);
    sg.fill();
    setOp(seal, 140);
    disableHit(seal);

    return root;
}

function setOp(node: Node, a: number) {
    const op = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
    op.opacity = a;
}

/**
 * 写实感花灯：宣纸透光层 · 叶纹 · 鎏金配件 · 丝流苏 · 枝叶
 */
function mountScholarLanterns(parent: Node, safe: SafeLayout, hangDrop: number) {
    const top = safe.half - Math.max(10, safe.topInset * 0.2) - hangDrop;

    const drawLantern = (name: string, x: number, flip: 1 | -1) => {
        const root = makeNode(name, parent, 110, 180);
        root.setPosition(x, top - 48, 0);

        // 外溢暖光
        const aura = makeNode('aura', root, 90, 90);
        aura.setPosition(0, 10, 0);
        const ag = aura.addComponent(Graphics);
        ag.fillColor = colorFromHex('#FFE6A8', 35);
        ag.circle(0, 0, 40);
        ag.fill();
        ag.fillColor = colorFromHex('#FFD878', 28);
        ag.circle(0, 0, 26);
        ag.fill();
        setOp(aura, 140);
        const aop = aura.getComponent(UIOpacity)!;
        tween(aop)
            .to(1.8, { opacity: 200 }, { easing: 'sineInOut' })
            .to(1.8, { opacity: 120 }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();

        const g = root.addComponent(Graphics);

        // 挂枝
        g.strokeColor = colorFromHex('#6B5338', 200);
        g.lineWidth = 2.2;
        g.moveTo(flip * 8, 78);
        g.quadraticCurveTo(flip * 2, 62, 0, 52);
        g.stroke();
        // 小叶/桂花意
        g.fillColor = colorFromHex('#E8C96A', 210);
        g.circle(flip * 10, 70, 2.2);
        g.circle(flip * 16, 66, 1.8);
        g.circle(flip * 6, 64, 1.6);
        g.fill();
        g.fillColor = colorFromHex('#8B9A6A', 160);
        g.ellipse(flip * 14, 72, 5, 2.2);
        g.ellipse(flip * 20, 68, 4, 1.8);
        g.fill();

        // 鎏金吊环
        g.strokeColor = colorFromHex(GOLD, 240);
        g.lineWidth = 2.4;
        g.circle(0, 48, 5);
        g.stroke();
        g.fillColor = colorFromHex('#E8D090', 255);
        g.ellipse(0, 40, 8, 3);
        g.fill();

        // 灯体多层（透光）
        const cy = 8;
        const R = 26;
        g.fillColor = colorFromHex('#F6D88A', 255);
        g.circle(0, cy, R);
        g.fill();
        g.fillColor = colorFromHex('#FFE9B0', 200);
        g.circle(-4, cy + 4, R * 0.72);
        g.fill();
        g.fillColor = colorFromHex('#FFF6D8', 160);
        g.circle(-6, cy + 6, R * 0.42);
        g.fill();
        // 内芯
        g.fillColor = colorFromHex('#FFE08A', 180);
        g.circle(0, cy - 2, 8);
        g.fill();

        // 叶脉暗纹（透出感）
        g.strokeColor = colorFromHex('#C9A05A', 70);
        g.lineWidth = 1.1;
        for (let i = 0; i < 5; i++) {
            const ang = -0.8 + i * 0.4;
            const lx = Math.cos(ang) * 8;
            const ly = cy + Math.sin(ang) * 8;
            g.moveTo(lx * 0.3, cy);
            g.quadraticCurveTo(lx, ly, lx * 1.8, ly + (i % 2 ? 6 : -4));
            g.stroke();
        }
        g.fillColor = colorFromHex('#B88840', 55);
        g.ellipse(-8, cy + 2, 4, 7);
        g.ellipse(6, cy - 4, 3.5, 6);
        g.ellipse(2, cy + 8, 3, 5);
        g.fill();

        // 金边框
        g.strokeColor = colorFromHex(GOLD, 220);
        g.lineWidth = 2.4;
        g.circle(0, cy, R);
        g.stroke();
        g.strokeColor = colorFromHex('#FFF0C0', 90);
        g.lineWidth = 1;
        g.circle(0, cy, R - 3);
        g.stroke();

        // 上下鎏金盖
        g.fillColor = colorFromHex('#C9A050', 255);
        g.ellipse(0, cy + R - 2, 16, 5);
        g.fill();
        g.fillColor = colorFromHex('#E8D080', 255);
        g.ellipse(0, cy + R + 1, 12, 3.5);
        g.fill();
        g.fillColor = colorFromHex('#C9A050', 255);
        g.ellipse(0, cy - R + 2, 15, 4.5);
        g.fill();
        g.fillColor = colorFromHex('#E8D080', 240);
        g.ellipse(0, cy - R - 1, 11, 3);
        g.fill();

        // 丝质流苏（多股细丝）
        const strands = [-8, -5, -2, 1, 4, 7];
        strands.forEach((sx, i) => {
            const len = 34 + (i % 3) * 6;
            g.strokeColor = colorFromHex(i % 2 === 0 ? '#D4B06A' : '#C49858', 210);
            g.lineWidth = 1.15;
            g.moveTo(sx * 0.4, cy - R - 2);
            g.quadraticCurveTo(sx * 0.7, cy - R - len * 0.45, sx + (i % 2 ? 1.5 : -1.5), cy - R - len);
            g.stroke();
        });
        g.fillColor = colorFromHex(GOLD, 230);
        g.circle(0, cy - R - 42, 2.8);
        g.fill();
        g.fillColor = colorFromHex('#E8D080', 200);
        g.circle(0, cy - R - 48, 1.8);
        g.fill();

        disableHit(root);
        idleSway(root, 3.8 + Math.abs(x) * 0.001, 1.55, flip > 0 ? 0.18 : 0.05);
    };

    drawLantern('lanternL', -248, -1);
    drawLantern('lanternR', 248, 1);
}

/** 木牌关卡：挂于棋盘左侧（金链 + 流苏） */
export function mountLevelPlaque(
    parent: Node,
    x: number,
    y: number,
    getText: () => string,
): { root: Node; label: Label } {
    const root = makeNode('levelPlaque', parent, 150, 72);
    root.setPosition(x, y, 0);
    const g = root.addComponent(Graphics);
    // 金链
    g.strokeColor = colorFromHex(GOLD, 200);
    g.lineWidth = 1.6;
    g.moveTo(-14, 28);
    g.lineTo(-10, 20);
    g.lineTo(-6, 28);
    g.moveTo(14, 28);
    g.lineTo(10, 20);
    g.lineTo(6, 28);
    g.stroke();
    g.fillColor = colorFromHex(GOLD, 220);
    g.circle(-10, 20, 2);
    g.circle(10, 20, 2);
    g.fill();
    // 木牌
    g.fillColor = colorFromHex(WOOD, 250);
    g.roundRect(-68, -16, 136, 34, 5);
    g.fill();
    g.strokeColor = colorFromHex(GOLD, 220);
    g.lineWidth = 2;
    g.roundRect(-68, -16, 136, 34, 5);
    g.stroke();
    g.strokeColor = colorFromHex(GOLD, 90);
    g.lineWidth = 1;
    g.roundRect(-62, -11, 124, 24, 3);
    g.stroke();
    // 流苏
    g.strokeColor = colorFromHex(GOLD, 170);
    g.lineWidth = 1.2;
    g.moveTo(0, -16);
    g.lineTo(0, -26);
    g.stroke();
    g.fillColor = colorFromHex('#C9A050', 200);
    g.ellipse(0, -28, 5, 3);
    g.fill();
    g.strokeColor = colorFromHex(GOLD, 140);
    g.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
        g.moveTo(i * 2.2, -30);
        g.lineTo(i * 2.8, -38);
        g.stroke();
    }
    disableHit(root);
    const label = addLabel(root, 't', getText(), 17, GOLD, 124, 26, true);
    label.node.setPosition(0, 1, 0);
    return { root, label };
}

/**
 * 乌木卷轴匣：两端卷曲轴头 + 金梅 / 清空 · 中间凹槽格
 * 比例：略宽于棋盘、窄于画轴
 */
export function mountScholarTray(
    parent: Node,
    trayW: number,
    trayH: number,
    slotCount: number,
    slotSizeHint: number,
    opts?: { onClear?: () => void },
): { slots: Node[]; fitScale: number } {
    const H = Math.max(trayH, 118);
    const endW = 72;
    const bodyW = trayW;
    const root = makeNode('trayBg', parent, bodyW + 8, H);

    const g = root.addComponent(Graphics);
    // 主体乌木底板（卷匣形）
    g.fillColor = colorFromHex('#241C18', 255);
    g.roundRect(-bodyW * 0.5, -H * 0.4, bodyW, H * 0.8, 22);
    g.fill();
    // 内凹木纹面
    g.fillColor = colorFromHex('#352A24', 255);
    g.roundRect(-bodyW * 0.5 + endW * 0.62, -H * 0.3, bodyW - endW * 1.24, H * 0.6, 12);
    g.fill();
    // 顶缘高光
    g.strokeColor = colorFromHex('#5A4A40', 100);
    g.lineWidth = 1.5;
    g.moveTo(-bodyW * 0.5 + endW * 0.55, H * 0.28);
    g.lineTo(bodyW * 0.5 - endW * 0.55, H * 0.28);
    g.stroke();
    // 金线描边
    g.strokeColor = colorFromHex(GOLD, 130);
    g.lineWidth = 1.3;
    g.roundRect(-bodyW * 0.5 + 1, -H * 0.4 + 1, bodyW - 2, H * 0.8 - 2, 21);
    g.stroke();

    const leftX = -bodyW * 0.5 + endW * 0.4;
    const rightX = bodyW * 0.5 - endW * 0.4;
    drawScrollEnd(g, leftX, 0, H * 0.82);
    drawGoldPlum(g, leftX, 2);
    drawScrollEnd(g, rightX, 0, H * 0.82);

    disableHit(root);

    if (opts?.onClear) {
        const clearBtn = makeNode('clearBtn', parent, 56, 56);
        clearBtn.setPosition(rightX, 2, 0);
        const cg = clearBtn.addComponent(Graphics);
        cg.fillColor = colorFromHex('#2E2620', 255);
        cg.circle(0, 0, 21);
        cg.fill();
        cg.strokeColor = colorFromHex(GOLD, 235);
        cg.lineWidth = 2.4;
        cg.circle(0, 0, 21);
        cg.stroke();
        cg.strokeColor = colorFromHex(GOLD, 100);
        cg.lineWidth = 1;
        cg.circle(0, 0, 16);
        cg.stroke();
        addLabel(clearBtn, 't', '清空', 15, GOLD, 48, 22, true).node.setPosition(0, 0, 0);
        bindJellyPress(clearBtn, () => opts.onClear?.());
    }

    const midL = -bodyW * 0.5 + endW * 0.98;
    const midR = bodyW * 0.5 - endW * 0.98;
    const innerW = midR - midL;
    const gap = innerW / slotCount;
    const slotW = Math.min(slotSizeHint * 0.9, gap - 7);
    const slotH = Math.min(H * 0.5, slotW * 1.02);
    const fitScale = Math.min(Design.slotScale, (Math.min(slotW, slotH) * 0.78) / Design.tileSize);
    const slots: Node[] = [];

    for (let i = 0; i < slotCount; i++) {
        const x = midL + gap * 0.5 + i * gap;
        const slot = makeNode(`tray${i}`, parent, slotW + 8, slotH + 8);
        slot.setPosition(x, 0, 0);
        const sg = slot.addComponent(Graphics);
        sg.fillColor = colorFromHex('#1E1814', 255);
        sg.roundRect(-slotW * 0.5 - 2, -slotH * 0.5 - 2, slotW + 4, slotH + 4, 5);
        sg.fill();
        sg.fillColor = colorFromHex('#15110E', 255);
        sg.roundRect(-slotW * 0.5, -slotH * 0.5, slotW, slotH, 4);
        sg.fill();
        sg.strokeColor = colorFromHex(GOLD, 45);
        sg.lineWidth = 1;
        sg.roundRect(-slotW * 0.5 + 0.5, -slotH * 0.5 + 0.5, slotW - 1, slotH - 1, 3.5);
        sg.stroke();
        drawIsoSlot(sg, Math.min(slotW, slotH) * 0.76, '#2A221C', '#4A3E34', 1.2);
        disableHit(slot);
        slots.push(slot);
    }

    return { slots, fitScale };
}

/** 卷轴端头：圆柱 + 鎏金轴帽 */
function drawScrollEnd(g: Graphics, x: number, y: number, h: number) {
    const rw = 22;
    g.fillColor = colorFromHex('#120E0C', 80);
    g.ellipse(x + 3, y, rw * 0.7, h * 0.48);
    g.fill();
    g.fillColor = colorFromHex('#2E241E', 255);
    g.roundRect(x - rw * 0.5, y - h * 0.5, rw, h, 10);
    g.fill();
    g.fillColor = colorFromHex('#4A3A30', 220);
    g.roundRect(x - rw * 0.22, y - h * 0.5, rw * 0.4, h, 8);
    g.fill();
    g.fillColor = colorFromHex('#6B5648', 90);
    g.roundRect(x - 3, y - h * 0.48, 2.5, h * 0.96, 1);
    g.fill();
    const cap = (dir: 1 | -1) => {
        const cy = y + dir * (h * 0.5);
        g.fillColor = colorFromHex('#C9A050', 255);
        g.ellipse(x, cy + dir * 2, rw * 0.55, 4);
        g.fill();
        g.fillColor = colorFromHex('#E8D080', 240);
        g.ellipse(x, cy + dir * 5.5, rw * 0.4, 2.8);
        g.fill();
    };
    cap(1);
    cap(-1);
}

/** 金梅暗纹 */
function drawGoldPlum(g: Graphics, x: number, y: number) {
    g.strokeColor = colorFromHex(GOLD, 160);
    g.fillColor = colorFromHex(GOLD, 120);
    g.lineWidth = 1.2;
    g.circle(x, y + 6, 2.2);
    g.fill();
    for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        const px = x + Math.cos(a) * 7;
        const py = y + 6 + Math.sin(a) * 7;
        g.ellipse(px, py, 3.2, 4.2);
        g.stroke();
    }
    g.moveTo(x - 2, y - 2);
    g.quadraticCurveTo(x - 10, y - 14, x - 4, y - 22);
    g.stroke();
    g.moveTo(x + 2, y - 4);
    g.quadraticCurveTo(x + 12, y - 12, x + 8, y - 20);
    g.stroke();
    g.circle(x - 8, y - 10, 1.5);
    g.circle(x + 10, y - 8, 1.3);
    g.fill();
}

export type ScholarToolKey = 'undo' | 'hint' | 'tidy' | 'share';

/** 竖向圆角金边道具钮（对齐参考图底栏） */
export function mountScholarTools(
    parent: Node,
    y: number,
    keys: ScholarToolKey[],
    labels: Record<string, string>,
    onTool: (key: string) => void,
): { undoNode: Node | null; setEnabled: (key: string, on: boolean) => void } {
    const bw = 52;
    const bh = 68;
    const gap = 96;
    const n = keys.length;
    const totalW = (n - 1) * gap;
    let undoNode: Node | null = null;
    const nodes = new Map<string, { node: Node; paint: (on: boolean) => void }>();

    keys.forEach((key, i) => {
        const x = -totalW * 0.5 + i * gap;
        const cell = makeNode(key, parent, bw + 16, bh + 36);
        cell.setPosition(x, y, 0);

        const disc = makeNode('disc', cell, bw + 4, bh + 4);
        disc.setPosition(0, 10, 0);
        const g = disc.addComponent(Graphics);

        const paint = (on: boolean) => {
            g.clear();
            g.fillColor = colorFromHex(on ? '#F7F0E4' : '#E4DCD0', 235);
            g.roundRect(-bw * 0.5, -bh * 0.5, bw, bh, 16);
            g.fill();
            g.strokeColor = colorFromHex(on ? GOLD : '#B0A090', on ? 210 : 110);
            g.lineWidth = 1.8;
            g.roundRect(-bw * 0.5, -bh * 0.5, bw, bh, 16);
            g.stroke();
            g.strokeColor = colorFromHex(on ? GOLD : '#B0A090', 70);
            g.lineWidth = 1;
            g.roundRect(-bw * 0.5 + 3.5, -bh * 0.5 + 3.5, bw - 7, bh - 7, 13);
            g.stroke();
            drawToolIcon(g, key, on ? '#5A3A28' : '#9A8A7A');
        };
        paint(key !== 'undo');

        addLabel(cell, 't', labels[key] || key, 13, '#5A3A28', 72, 20, true).node.setPosition(0, -36, 0);
        bindJellyPress(cell, () => onTool(key));
        nodes.set(key, { node: cell, paint });
        if (key === 'undo') {
            undoNode = cell;
            paint(false);
        }
    });

    return {
        undoNode,
        setEnabled: (key, on) => {
            const it = nodes.get(key);
            if (it) it.paint(on);
        },
    };
}

function drawToolIcon(g: Graphics, key: ScholarToolKey, hex: string) {
    g.strokeColor = colorFromHex(hex, 230);
    g.fillColor = colorFromHex(hex, 230);
    g.lineWidth = 2;
    if (key === 'undo') {
        g.arc(0, 1, 9, Math.PI * 0.2, Math.PI * 1.6, false);
        g.stroke();
        g.moveTo(-6, 8);
        g.lineTo(-2, 12);
        g.lineTo(0, 6);
        g.close();
        g.fill();
    } else if (key === 'hint') {
        // 笔
        g.moveTo(-8, -8);
        g.lineTo(8, 8);
        g.stroke();
        g.moveTo(5, 10);
        g.lineTo(10, 5);
        g.stroke();
        g.circle(-9, -9, 2.2);
        g.fill();
    } else if (key === 'tidy') {
        // 扇
        g.arc(0, -2, 12, Math.PI * 0.15, Math.PI * 0.85, false);
        g.stroke();
        g.moveTo(0, -2);
        g.lineTo(0, -14);
        g.stroke();
        g.moveTo(0, -2);
        g.lineTo(-8, -10);
        g.stroke();
        g.moveTo(0, -2);
        g.lineTo(8, -10);
        g.stroke();
    } else {
        // 分享 / 灯意
        g.circle(0, 4, 6);
        g.stroke();
        g.moveTo(0, -2);
        g.lineTo(0, -10);
        g.stroke();
        g.circle(0, -12, 2);
        g.fill();
    }
}

/** 兼容：把圆形 undo 接到原 BtnHandle 风格 */
export function wrapScholarUndo(
    tools: ReturnType<typeof mountScholarTools>,
): { setEnabled: (on: boolean) => void; node: Node } | null {
    if (!tools.undoNode) return null;
    return {
        node: tools.undoNode,
        setEnabled: (on: boolean) => tools.setEnabled('undo', on),
    };
}
