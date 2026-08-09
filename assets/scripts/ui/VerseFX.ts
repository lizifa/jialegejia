/**
 * 文言文绑定特效（轻量矢量 + Tween，无重粒子）
 * - 点亮：墨点溅开 + 汉字上浮
 * - 通关：朱红印章落下
 * - HUD：诗条墨痕闪一下
 */
import { Graphics, Node, UIOpacity, Vec3, tween } from 'cc';
import { Colors } from '../core/Config';
import { VerseKind } from '../core/Literature';
import { addLabel, colorFromHex, makeNode } from './UIKit';

const INK = '#3A2A1A';
const SEAL = '#C23A2B';

/** 点亮诗文时：墨点 + 飘字 */
export function playVerseInkReveal(
    parent: Node,
    x: number,
    y: number,
    chars: string[],
    kind: VerseKind,
): void {
    // 墨点
    for (let i = 0; i < 8; i++) {
        const n = makeNode(`ink${i}`, parent, 12, 12);
        n.setPosition(x, y, 0);
        const g = n.addComponent(Graphics);
        const r = 3 + Math.random() * 5;
        g.fillColor = colorFromHex(INK, 160);
        g.circle(0, 0, r);
        g.fill();
        const ang = (Math.PI * 2 * i) / 8 + Math.random() * 0.4;
        const dist = 36 + Math.random() * 50;
        const op = n.addComponent(UIOpacity);
        op.opacity = 200;
        tween(n)
            .to(
                0.45 + Math.random() * 0.2,
                {
                    position: new Vec3(x + Math.cos(ang) * dist, y + Math.sin(ang) * dist + 20, 0),
                    scale: new Vec3(0.2, 0.2, 1),
                },
                { easing: 'quadOut' },
            )
            .start();
        tween(op)
            .to(0.5, { opacity: 0 })
            .call(() => n.destroy())
            .start();
    }

    // 飘字（本段新点亮的字）
    const show = chars.slice(0, 4);
    show.forEach((ch, i) => {
        const n = makeNode(`gz${i}`, parent, 40, 40);
        n.setPosition(x + (i - show.length / 2) * 18, y + 10, 0);
        const lab = addLabel(n, 'c', ch, 28, verseAccent(kind), 40, 40, true);
        lab.node.setPosition(0, 0, 0);
        const op = n.addComponent(UIOpacity);
        op.opacity = 0;
        tween(op).to(0.12, { opacity: 255 }).delay(0.25).to(0.35, { opacity: 0 }).start();
        tween(n)
            .to(0.7, { position: new Vec3(n.position.x, y + 90 + i * 8, 0), scale: new Vec3(1.2, 1.2, 1) }, { easing: 'quadOut' })
            .call(() => n.destroy())
            .start();
    });
}

/** 诗条 HUD 轻闪（点亮反馈，不再画椭圆墨痕） */
export function flashVerseHud(hudRoot: Node | null): void {
    if (!hudRoot || !hudRoot.isValid) return;
    const op = hudRoot.getComponent(UIOpacity) || hudRoot.addComponent(UIOpacity);
    const prev = op.opacity;
    tween(op)
        .to(0.08, { opacity: 255 })
        .to(0.2, { opacity: prev })
        .start();
    tween(hudRoot)
        .to(0.08, { scale: new Vec3(1.02, 1.02, 1) })
        .to(0.12, { scale: new Vec3(1, 1, 1) })
        .start();
}

/** 通关落印：朱红方印「藏」或「通」 */
export function playVerseSeal(parent: Node, x: number, y: number, newlyCollected: boolean): void {
    const root = makeNode('seal', parent, 120, 120);
    root.setPosition(x, y, 0);
    root.setScale(1.8, 1.8, 1);
    root.setRotationFromEuler(0, 0, -12);

    const g = root.addComponent(Graphics);
    g.strokeColor = colorFromHex(SEAL, 230);
    g.lineWidth = 5;
    g.roundRect(-42, -42, 84, 84, 6);
    g.stroke();
    g.fillColor = colorFromHex(SEAL, 35);
    g.roundRect(-42, -42, 84, 84, 6);
    g.fill();

    const word = newlyCollected ? '藏' : '通';
    const lab = addLabel(root, 'w', word, 48, SEAL, 80, 80, true);
    lab.node.setPosition(0, 0, 0);

    const op = root.addComponent(UIOpacity);
    op.opacity = 0;
    tween(op).to(0.08, { opacity: 255 }).delay(0.9).to(0.35, { opacity: 0 }).start();
    tween(root)
        .to(0.18, { scale: new Vec3(1, 1, 1), eulerAngles: new Vec3(0, 0, -8) }, { easing: 'backOut' })
        .delay(0.85)
        .to(0.3, { scale: new Vec3(0.9, 0.9, 1) })
        .call(() => root.destroy())
        .start();
}

/** 朗诵逐句：句旁淡墨竖线一闪 */
export function playLineBrush(parent: Node, x: number, y: number): void {
    const n = makeNode('brush', parent, 8, 40);
    n.setPosition(x - 140, y, 0);
    const g = n.addComponent(Graphics);
    g.fillColor = colorFromHex(INK, 120);
    g.roundRect(-2, -16, 4, 32, 2);
    g.fill();
    const op = n.addComponent(UIOpacity);
    op.opacity = 0;
    tween(op).to(0.15, { opacity: 200 }).delay(0.4).to(0.3, { opacity: 0 }).call(() => n.destroy()).start();
}

/** 按文种取飘字色（诗墨棕 / 名言赭 / 文言文朱红） */
export function verseAccent(kind: VerseKind): string {
    if (kind === 'poem') return Colors.brown;
    if (kind === 'quote') return '#8B5A2B';
    return '#8B3A2B';
}
