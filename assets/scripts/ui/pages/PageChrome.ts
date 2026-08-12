import { _decorator, Component, Graphics, Node, Tween, Vec3, tween } from 'cc';
import { Design } from '../../core/Config';
import { isMidAutumn, MidAutumnColors } from '../../core/Festival';
import { SafeLayout } from '../../core/SafeArea';
import { colorFromHex, idleSway, makeNode } from '../UIKit';
import { disableHit } from './PageKit';

const { ccclass } = _decorator;

export type PageChromeOpts = {
    /** 是否绘制顶部倒挂饰物（灯笼/猴子/月兔），默认 true */
    hangings?: boolean;
    /** 挂饰整体下移（对局页避开刘海/状态栏） */
    hangDrop?: number;
};

/**
 * 各页共享氛围层：暖宣纸底 + 顶部挂饰
 * 中秋：月晕底 + 月灯/玉兔
 */
@ccclass('PageChrome')
export class PageChrome extends Component {
    static attach(parent: Node, safe: SafeLayout, opts?: PageChromeOpts): PageChrome {
        const root = makeNode('PageChrome', parent, Design.width, safe.visH);
        root.setSiblingIndex(0);
        const c = root.addComponent(PageChrome);
        c.build(safe, opts);
        return c;
    }

    private build(safe: SafeLayout, opts?: PageChromeOpts) {
        const visH = safe.visH;
        const fest = isMidAutumn();
        if (fest) this.drawMidAutumnAtmosphere(this.node, visH);
        else this.drawAtmosphere(this.node, visH);
        if (opts?.hangings !== false) {
            const drop = opts?.hangDrop ?? 0;
            if (fest) this.drawMidAutumnHangings(this.node, safe, drop);
            else this.drawHangings(this.node, safe, drop);
        }
    }

    private drawAtmosphere(parent: Node, visH: number) {
        const root = makeNode('atmosphere', parent, Design.width, visH);
        const g = root.addComponent(Graphics);
        g.fillColor = colorFromHex('#F6EDE0');
        g.rect(-Design.width * 0.5, -visH * 0.5, Design.width, visH);
        g.fill();
        g.fillColor = colorFromHex('#EED9C2', 90);
        g.ellipse(0, visH * 0.42, 420, 120);
        g.fill();
        g.fillColor = colorFromHex('#E8C9A8', 55);
        g.ellipse(0, -visH * 0.46, 380, 90);
        g.fill();
        const flecks = [
            [-280, 380, 3],
            [260, 340, 2.5],
            [-220, -420, 2],
            [240, -380, 3],
            [-300, 80, 2],
            [290, -60, 2.5],
            [-160, 480, 2],
            [180, 460, 2],
        ];
        flecks.forEach(([x, y, r]) => {
            g.fillColor = colorFromHex('#C4A36A', 70);
            g.circle(x, y * (visH / 1280), r);
            g.fill();
        });
        const puff = (px: number, py: number, s: number) => {
            g.fillColor = colorFromHex('#FFF8F0', 160);
            g.circle(px, py, 18 * s);
            g.fill();
            g.circle(px + 16 * s, py + 4 * s, 14 * s);
            g.fill();
            g.circle(px - 14 * s, py + 2 * s, 12 * s);
            g.fill();
        };
        puff(-280, visH * 0.28, 1.1);
        puff(270, visH * 0.22, 0.9);
        puff(-250, -visH * 0.3, 0.85);
        disableHit(root);
    }

    /** 中秋：浅紫夜洗 + 右上月晕 */
    private drawMidAutumnAtmosphere(parent: Node, visH: number) {
        const root = makeNode('atmosphere', parent, Design.width, visH);
        const g = root.addComponent(Graphics);
        g.fillColor = colorFromHex('#F4EFE6');
        g.rect(-Design.width * 0.5, -visH * 0.5, Design.width, visH);
        g.fill();
        g.fillColor = colorFromHex(MidAutumnColors.nightWash, 70);
        g.ellipse(0, visH * 0.38, 460, 140);
        g.fill();
        g.fillColor = colorFromHex(MidAutumnColors.moon, 55);
        g.circle(210, visH * 0.36, 92);
        g.fill();
        g.fillColor = colorFromHex(MidAutumnColors.moon, 120);
        g.circle(210, visH * 0.36, 54);
        g.fill();
        g.fillColor = colorFromHex('#FFF8E8', 200);
        g.circle(210, visH * 0.36, 38);
        g.fill();
        g.fillColor = colorFromHex(MidAutumnColors.moonEdge, 40);
        g.ellipse(-40, -visH * 0.44, 360, 80);
        g.fill();
        // 细桂影点
        [
            [-260, 300],
            [280, 220],
            [-200, -360],
            [160, -300],
            [-300, 40],
            [300, -40],
        ].forEach(([x, y]) => {
            g.fillColor = colorFromHex(MidAutumnColors.gold, 55);
            g.circle(x, y * (visH / 1280), 2.2);
            g.fill();
        });
        disableHit(root);
    }

    private drawHangings(parent: Node, safe: SafeLayout, hangDrop = 0) {
        const top = safe.half - Math.max(8, safe.topInset * 0.15) - hangDrop;
        const items: Array<{ x: number; kind: 'lantern' | 'tassel' | 'knot'; len: number }> = [
            { x: -268, kind: 'lantern', len: 52 },
            { x: -198, kind: 'tassel', len: 68 },
            { x: 210, kind: 'tassel', len: 62 },
            { x: 268, kind: 'lantern', len: 48 },
            { x: 118, kind: 'knot', len: 44 },
        ];

        items.forEach((it, idx) => {
            const root = makeNode(`hang${idx}`, parent, 48, it.len + 36);
            root.setPosition(it.x, top - it.len * 0.35, 0);
            const g = root.addComponent(Graphics);
            g.strokeColor = colorFromHex('#8B5A32', 160);
            g.lineWidth = 1.6;
            g.moveTo(0, it.len * 0.5);
            g.lineTo(0, it.len * 0.5 - 16);
            g.stroke();

            if (it.kind === 'lantern') {
                g.fillColor = colorFromHex('#C45C3A', 235);
                g.ellipse(0, it.len * 0.5 - 34, 12, 14);
                g.fill();
                g.fillColor = colorFromHex('#E8C98A', 230);
                g.ellipse(0, it.len * 0.5 - 20, 11, 3);
                g.fill();
                g.ellipse(0, it.len * 0.5 - 48, 10, 3);
                g.fill();
                g.strokeColor = colorFromHex('#5C2A1A', 160);
                g.lineWidth = 1.2;
                g.arc(0, it.len * 0.5 - 36, 4, Math.PI * 1.15, Math.PI * 1.85, false);
                g.stroke();
                g.fillColor = colorFromHex('#5C2A1A', 180);
                g.circle(-3.5, it.len * 0.5 - 32, 1.2);
                g.circle(3.5, it.len * 0.5 - 32, 1.2);
                g.fill();
                g.strokeColor = colorFromHex('#E8C98A', 200);
                g.lineWidth = 1.4;
                g.moveTo(0, it.len * 0.5 - 50);
                g.lineTo(0, it.len * 0.5 - 62);
                g.stroke();
                g.fillColor = colorFromHex('#E8C98A', 210);
                g.circle(0, it.len * 0.5 - 64, 2.5);
                g.fill();
            } else if (it.kind === 'tassel') {
                g.fillColor = colorFromHex('#9A3E28', 210);
                g.roundRect(-6, it.len * 0.5 - 28, 12, 10, 4);
                g.fill();
                const strands = [-5, -2, 1, 4];
                strands.forEach((sx, si) => {
                    g.strokeColor = colorFromHex(si % 2 === 0 ? '#C45C3A' : '#E8C98A', 190);
                    g.lineWidth = 1.3;
                    g.moveTo(sx, it.len * 0.5 - 28);
                    g.lineTo(sx + (si % 2 === 0 ? -2 : 2), it.len * 0.5 - 28 - (22 + si * 4));
                    g.stroke();
                });
            } else {
                g.strokeColor = colorFromHex('#C45C3A', 210);
                g.lineWidth = 2;
                g.circle(0, it.len * 0.5 - 28, 7);
                g.stroke();
                g.circle(0, it.len * 0.5 - 28, 3.5);
                g.stroke();
                g.fillColor = colorFromHex('#E8C98A', 220);
                g.circle(0, it.len * 0.5 - 40, 2.2);
                g.fill();
            }

            disableHit(root);
            idleSway(root, 3.5 + (idx % 3), 1.6 + (idx % 2) * 0.25, idx * 0.12);
        });

        this.mountHangingMonkey(parent, -108, top);
    }

    private drawMidAutumnHangings(parent: Node, safe: SafeLayout, hangDrop = 0) {
        const top = safe.half - Math.max(8, safe.topInset * 0.15) - hangDrop;
        const items: Array<{ x: number; kind: 'moonLantern' | 'tassel' | 'osmanthus'; len: number }> = [
            { x: -268, kind: 'moonLantern', len: 56 },
            { x: -198, kind: 'tassel', len: 68 },
            { x: 210, kind: 'osmanthus', len: 58 },
            { x: 268, kind: 'moonLantern', len: 50 },
            { x: 118, kind: 'tassel', len: 48 },
        ];

        items.forEach((it, idx) => {
            const root = makeNode(`hang${idx}`, parent, 48, it.len + 36);
            root.setPosition(it.x, top - it.len * 0.35, 0);
            const g = root.addComponent(Graphics);
            g.strokeColor = colorFromHex('#8B5A32', 160);
            g.lineWidth = 1.6;
            g.moveTo(0, it.len * 0.5);
            g.lineTo(0, it.len * 0.5 - 16);
            g.stroke();

            if (it.kind === 'moonLantern') {
                // 圆形月灯：米黄罩 + 朱红边 + 月牙窗
                g.fillColor = colorFromHex(MidAutumnColors.moon, 245);
                g.circle(0, it.len * 0.5 - 36, 14);
                g.fill();
                g.strokeColor = colorFromHex(MidAutumnColors.lacquer, 220);
                g.lineWidth = 2;
                g.circle(0, it.len * 0.5 - 36, 14);
                g.stroke();
                g.fillColor = colorFromHex(MidAutumnColors.gold, 230);
                g.ellipse(0, it.len * 0.5 - 20, 12, 3);
                g.fill();
                g.ellipse(0, it.len * 0.5 - 52, 11, 3);
                g.fill();
                g.fillColor = colorFromHex(MidAutumnColors.moonEdge, 200);
                g.arc(2, it.len * 0.5 - 36, 7, Math.PI * 0.25, Math.PI * 1.55, false);
                g.lineTo(2, it.len * 0.5 - 36);
                g.close();
                g.fill();
                g.strokeColor = colorFromHex(MidAutumnColors.gold, 200);
                g.lineWidth = 1.4;
                g.moveTo(0, it.len * 0.5 - 54);
                g.lineTo(0, it.len * 0.5 - 66);
                g.stroke();
                g.fillColor = colorFromHex(MidAutumnColors.gold, 210);
                g.circle(0, it.len * 0.5 - 68, 2.5);
                g.fill();
            } else if (it.kind === 'osmanthus') {
                g.fillColor = colorFromHex(MidAutumnColors.gold, 200);
                g.circle(0, it.len * 0.5 - 28, 5);
                g.fill();
                g.circle(-5, it.len * 0.5 - 34, 3.5);
                g.circle(5, it.len * 0.5 - 34, 3.5);
                g.circle(0, it.len * 0.5 - 40, 3);
                g.fill();
                g.strokeColor = colorFromHex('#6B8E4E', 180);
                g.lineWidth = 1.4;
                g.moveTo(0, it.len * 0.5 - 22);
                g.lineTo(-4, it.len * 0.5 - 42);
                g.moveTo(0, it.len * 0.5 - 22);
                g.lineTo(5, it.len * 0.5 - 40);
                g.stroke();
            } else {
                g.fillColor = colorFromHex(MidAutumnColors.lacquer, 210);
                g.roundRect(-6, it.len * 0.5 - 28, 12, 10, 4);
                g.fill();
                [-5, -2, 1, 4].forEach((sx, si) => {
                    g.strokeColor = colorFromHex(si % 2 === 0 ? MidAutumnColors.lacquer : MidAutumnColors.gold, 190);
                    g.lineWidth = 1.3;
                    g.moveTo(sx, it.len * 0.5 - 28);
                    g.lineTo(sx + (si % 2 === 0 ? -2 : 2), it.len * 0.5 - 28 - (22 + si * 4));
                    g.stroke();
                });
            }

            disableHit(root);
            idleSway(root, 3.5 + (idx % 3), 1.6 + (idx % 2) * 0.25, idx * 0.12);
        });

        this.mountHangingRabbit(parent, -108, top);
    }

    private mountHangingMonkey(parent: Node, x: number, topY: number) {
        const root = makeNode('hangMonkey', parent, 96, 176);
        root.setPosition(x, topY - 52, 0);

        const rope = makeNode('rope', root, 28, 100);
        rope.setPosition(0, 64, 0);
        const rg = rope.addComponent(Graphics);
        rg.strokeColor = colorFromHex('#8B5A32', 180);
        rg.lineWidth = 2.4;
        rg.moveTo(0, 44);
        rg.lineTo(0, -28);
        rg.stroke();
        rg.fillColor = colorFromHex('#E8C98A', 220);
        rg.circle(0, 18, 2.2);
        rg.circle(0, -4, 2.2);
        rg.fill();

        const swing = makeNode('swing', root, 90, 120);
        swing.setPosition(0, -28, 0);

        const monkey = makeNode('monkey', swing, 90, 120);
        monkey.setPosition(0, 0, 0);
        const g = monkey.addComponent(Graphics);
        const fur = '#C4874A';
        const furDark = '#8B5A32';
        const face = '#F3C9A0';
        const ink = '#3A2A22';
        const blush = '#FFB0A0';

        g.fillColor = colorFromHex(fur);
        g.ellipse(0, 6, 13, 16);
        g.fill();
        g.fillColor = colorFromHex(face);
        g.ellipse(0, 4, 8, 10);
        g.fill();

        g.fillColor = colorFromHex(fur);
        g.ellipse(-7, 24, 4.2, 10);
        g.ellipse(7, 24, 4.2, 10);
        g.fill();
        g.fillColor = colorFromHex(face);
        g.ellipse(-7, 36, 6, 4);
        g.ellipse(7, 36, 6, 4);
        g.fill();
        g.fillColor = colorFromHex('#E8B890');
        g.circle(-7, 37.5, 1.4);
        g.circle(7, 37.5, 1.4);
        g.fill();

        g.fillColor = colorFromHex(fur);
        g.circle(0, -22, 17);
        g.fill();
        g.fillColor = colorFromHex(face);
        g.ellipse(0, -24, 11, 10);
        g.fill();
        g.fillColor = colorFromHex(fur);
        g.circle(-15, -18, 6);
        g.circle(15, -18, 6);
        g.fill();
        g.fillColor = colorFromHex(face);
        g.circle(-15, -18, 3.4);
        g.circle(15, -18, 3.4);
        g.fill();
        g.fillColor = colorFromHex(blush, 150);
        g.ellipse(-9, -27, 3.8, 2.2);
        g.ellipse(9, -27, 3.8, 2.2);
        g.fill();
        g.fillColor = colorFromHex(ink);
        g.ellipse(0, -25.5, 2.4, 1.8);
        g.fill();
        g.strokeColor = colorFromHex(ink, 210);
        g.lineWidth = 1.3;
        g.arc(0, -29, 3.2, Math.PI * 1.15, Math.PI * 1.85, false);
        g.stroke();

        const bind = makeNode('bind', monkey, 44, 28);
        bind.setPosition(0, 36, 0);
        const bg = bind.addComponent(Graphics);
        bg.strokeColor = colorFromHex('#8B5A32', 220);
        bg.lineWidth = 2.2;
        bg.moveTo(0, 10);
        bg.lineTo(-7, 2);
        bg.moveTo(0, 10);
        bg.lineTo(7, 2);
        bg.stroke();
        bg.lineWidth = 2.4;
        bg.ellipse(-7, 0, 7.5, 4.5);
        bg.stroke();
        bg.ellipse(-7, -2, 6.5, 3.5);
        bg.stroke();
        bg.ellipse(7, 0, 7.5, 4.5);
        bg.stroke();
        bg.ellipse(7, -2, 6.5, 3.5);
        bg.stroke();
        bg.fillColor = colorFromHex('#C45C3A', 245);
        bg.ellipse(-5, 8, 5.5, 3.5);
        bg.ellipse(5, 8, 5.5, 3.5);
        bg.fill();
        bg.fillColor = colorFromHex('#E8C98A', 240);
        bg.circle(0, 8, 2.8);
        bg.fill();

        const tuft = makeNode('tuft', monkey, 18, 18);
        tuft.setPosition(0, -38, 0);
        const tg = tuft.addComponent(Graphics);
        tg.fillColor = colorFromHex(furDark);
        tg.ellipse(0, 0, 4, 6);
        tg.fill();
        tg.ellipse(-3, 2, 2.5, 4);
        tg.ellipse(3, 2, 2.5, 4);
        tg.fill();

        const eyes = makeNode('eyes', monkey, 40, 14);
        eyes.setPosition(0, -21, 0);
        const eg = eyes.addComponent(Graphics);
        eg.fillColor = colorFromHex(ink);
        eg.ellipse(-5.5, 0, 2.6, 3.4);
        eg.ellipse(5.5, 0, 2.6, 3.4);
        eg.fill();
        eg.fillColor = colorFromHex('#FFFFFF', 235);
        eg.circle(-6.2, 1.1, 1);
        eg.circle(4.8, 1.1, 1);
        eg.fill();

        const makeArm = (name: string, ax: number, side: 1 | -1) => {
            const arm = makeNode(name, monkey, 28, 36);
            arm.setPosition(ax, 2, 0);
            const ag = arm.addComponent(Graphics);
            ag.fillColor = colorFromHex(fur);
            ag.ellipse(side * 2, -2, 4.2, 10);
            ag.fill();
            ag.fillColor = colorFromHex(face);
            ag.circle(side * 3, -14, 5);
            ag.fill();
            ag.circle(side * 6, -16, 2);
            ag.circle(side * 0.5, -18, 2);
            ag.fill();
            return arm;
        };
        const armL = makeArm('armL', -14, -1);
        const armR = makeArm('armR', 14, 1);

        const tail = makeNode('tail', monkey, 40, 40);
        tail.setPosition(-12, 8, 0);
        const tlg = tail.addComponent(Graphics);
        tlg.strokeColor = colorFromHex(furDark, 230);
        tlg.lineWidth = 3.2;
        tlg.moveTo(4, 0);
        tlg.quadraticCurveTo(-12, 6, -16, 16);
        tlg.quadraticCurveTo(-10, 24, 0, 20);
        tlg.stroke();

        disableHit(root);
        idleSway(root, 5.5, 2.1, 0.12);

        tween(armR)
            .to(0.28, { eulerAngles: new Vec3(0, 0, 42) }, { easing: 'sineOut' })
            .to(0.28, { eulerAngles: new Vec3(0, 0, 8) }, { easing: 'sineInOut' })
            .to(0.28, { eulerAngles: new Vec3(0, 0, 38) }, { easing: 'sineOut' })
            .to(0.32, { eulerAngles: new Vec3(0, 0, 12) }, { easing: 'sineInOut' })
            .delay(0.35)
            .union()
            .repeatForever()
            .start();
        tween(armL)
            .delay(0.2)
            .to(0.3, { eulerAngles: new Vec3(0, 0, -36) }, { easing: 'sineOut' })
            .to(0.3, { eulerAngles: new Vec3(0, 0, -6) }, { easing: 'sineInOut' })
            .to(0.28, { eulerAngles: new Vec3(0, 0, -40) }, { easing: 'sineOut' })
            .to(0.34, { eulerAngles: new Vec3(0, 0, -10) }, { easing: 'sineInOut' })
            .delay(0.45)
            .union()
            .repeatForever()
            .start();

        tween(eyes)
            .delay(1.5)
            .to(0.05, { scale: new Vec3(1, 0.12, 1) })
            .to(0.08, { scale: new Vec3(1, 1, 1) })
            .delay(0.3)
            .to(0.05, { scale: new Vec3(1, 0.12, 1) })
            .to(0.08, { scale: new Vec3(1, 1, 1) })
            .delay(2.3)
            .union()
            .repeatForever()
            .start();

        tween(monkey)
            .to(1.1, { eulerAngles: new Vec3(0, 0, 3.5) }, { easing: 'sineInOut' })
            .to(1.1, { eulerAngles: new Vec3(0, 0, -3.5) }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();
        const base = swing.position.clone();
        tween(swing)
            .to(0.95, { position: new Vec3(base.x, base.y - 2.5, 0) }, { easing: 'sineInOut' })
            .to(0.95, { position: base }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();

        tween(tuft)
            .to(0.55, { eulerAngles: new Vec3(0, 0, 10) }, { easing: 'sineInOut' })
            .to(0.55, { eulerAngles: new Vec3(0, 0, -10) }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();
        tween(tail)
            .to(0.5, { eulerAngles: new Vec3(0, 0, -16) }, { easing: 'sineInOut' })
            .to(0.5, { eulerAngles: new Vec3(0, 0, 12) }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();
    }

    /** 中秋：倒挂玉兔（抱月饼） */
    private mountHangingRabbit(parent: Node, x: number, topY: number) {
        const root = makeNode('hangRabbit', parent, 96, 176);
        root.setPosition(x, topY - 52, 0);

        const rope = makeNode('rope', root, 28, 100);
        rope.setPosition(0, 64, 0);
        const rg = rope.addComponent(Graphics);
        rg.strokeColor = colorFromHex('#8B5A32', 180);
        rg.lineWidth = 2.4;
        rg.moveTo(0, 44);
        rg.lineTo(0, -28);
        rg.stroke();
        rg.fillColor = colorFromHex(MidAutumnColors.gold, 220);
        rg.circle(0, 18, 2.2);
        rg.circle(0, -4, 2.2);
        rg.fill();

        const swing = makeNode('swing', root, 90, 120);
        swing.setPosition(0, -28, 0);

        const rabbit = makeNode('rabbit', swing, 90, 120);
        const g = rabbit.addComponent(Graphics);
        const fur = '#F5F0E6';
        const earIn = '#F2C4B8';
        const ink = '#3A2A22';
        const blush = '#FFB0A0';

        // 长耳（可摆动）
        const earL = makeNode('earL', rabbit, 16, 40);
        earL.setPosition(-8, 28, 0);
        const elg = earL.addComponent(Graphics);
        elg.fillColor = colorFromHex(fur);
        elg.ellipse(0, 0, 5, 16);
        elg.fill();
        elg.fillColor = colorFromHex(earIn, 200);
        elg.ellipse(0, 2, 2.4, 10);
        elg.fill();

        const earR = makeNode('earR', rabbit, 16, 40);
        earR.setPosition(8, 28, 0);
        const erg = earR.addComponent(Graphics);
        erg.fillColor = colorFromHex(fur);
        erg.ellipse(0, 0, 5, 16);
        erg.fill();
        erg.fillColor = colorFromHex(earIn, 200);
        erg.ellipse(0, 2, 2.4, 10);
        erg.fill();

        // 头身
        g.fillColor = colorFromHex(fur);
        g.circle(0, 4, 14);
        g.fill();
        g.circle(0, -22, 16);
        g.fill();

        // 腮红 / 鼻口
        g.fillColor = colorFromHex(blush, 140);
        g.ellipse(-8, -1, 3.5, 2.2);
        g.ellipse(8, -1, 3.5, 2.2);
        g.fill();
        g.fillColor = colorFromHex('#E8A090');
        g.circle(0, -2, 2);
        g.fill();
        g.strokeColor = colorFromHex(ink, 180);
        g.lineWidth = 1.1;
        g.moveTo(0, -3.5);
        g.lineTo(-3, -6);
        g.moveTo(0, -3.5);
        g.lineTo(3, -6);
        g.stroke();

        // 月饼
        g.fillColor = colorFromHex(MidAutumnColors.moonEdge, 240);
        g.circle(0, -26, 8);
        g.fill();
        g.strokeColor = colorFromHex(MidAutumnColors.lacquer, 200);
        g.lineWidth = 1.2;
        g.circle(0, -26, 8);
        g.stroke();
        g.fillColor = colorFromHex(MidAutumnColors.lacquer, 180);
        g.circle(0, -26, 2.2);
        g.fill();

        // 爪
        g.fillColor = colorFromHex(fur);
        g.ellipse(-12, -18, 5, 4);
        g.ellipse(12, -18, 5, 4);
        g.fill();

        const eyes = makeNode('eyes', rabbit, 40, 14);
        eyes.setPosition(0, 6, 0);
        const eg = eyes.addComponent(Graphics);
        eg.fillColor = colorFromHex(ink);
        eg.ellipse(-5, 0, 2.4, 3.2);
        eg.ellipse(5, 0, 2.4, 3.2);
        eg.fill();
        eg.fillColor = colorFromHex('#FFFFFF', 235);
        eg.circle(-5.6, 1, 0.9);
        eg.circle(4.4, 1, 0.9);
        eg.fill();

        disableHit(root);
        idleSway(root, 5.2, 1.9, 0.1);

        tween(eyes)
            .delay(1.8)
            .to(0.05, { scale: new Vec3(1, 0.12, 1) })
            .to(0.08, { scale: new Vec3(1, 1, 1) })
            .delay(2.6)
            .union()
            .repeatForever()
            .start();

        tween(rabbit)
            .to(1.2, { eulerAngles: new Vec3(0, 0, 2.8) }, { easing: 'sineInOut' })
            .to(1.2, { eulerAngles: new Vec3(0, 0, -2.8) }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();

        const base = swing.position.clone();
        tween(swing)
            .to(1.0, { position: new Vec3(base.x, base.y - 2.2, 0) }, { easing: 'sineInOut' })
            .to(1.0, { position: base }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();

        tween(earL)
            .to(0.7, { eulerAngles: new Vec3(0, 0, -8) }, { easing: 'sineInOut' })
            .to(0.7, { eulerAngles: new Vec3(0, 0, 6) }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();
        tween(earR)
            .delay(0.15)
            .to(0.7, { eulerAngles: new Vec3(0, 0, 8) }, { easing: 'sineInOut' })
            .to(0.7, { eulerAngles: new Vec3(0, 0, -6) }, { easing: 'sineInOut' })
            .union()
            .repeatForever()
            .start();
    }

    onDestroy() {
        Tween.stopAllByTarget(this.node);
    }
}
