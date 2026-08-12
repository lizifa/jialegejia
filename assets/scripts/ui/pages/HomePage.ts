import { _decorator, BlockInputEvents, Component, Graphics, Node } from 'cc';
import {
    Brand,
    Design,
    PlayMode,
    blindModeUnlocked,
    dailyLevelId,
} from '../../core/Config';
import { getVerseForLevel } from '../../core/Literature';
import { getSafeLayout } from '../../core/SafeArea';
import { SaveData } from '../../core/SaveData';
import { mountHomeFlipBook } from '../HomeBookFX';
import {
    addLabel,
    bindJellyPress,
    colorFromHex,
    idleBreathe,
    idleFadePulse,
    makeNode,
    softFadeIn,
    softRiseIn,
} from '../UIKit';
import { PageChrome } from './PageChrome';
import { mountPageRoot } from './PageKit';
import { isMidAutumn, MidAutumnCopy, MidAutumnColors } from '../../core/Festival';

const { ccclass } = _decorator;

export type HomePageCtx = {
    tip: (msg: string) => void;
    startPlayMode: (mode: PlayMode, levelId: number) => void;
    showLanternRiddle: () => void;
    showLevelPickPopup: () => void;
    showCatalog: () => void;
    showLibrary: () => void;
    showHowTo: () => void;
    showSettings: () => void;
    showLegalPopup: () => void;
};

/** 首页：品牌 + 翻页书 + 主 CTA + 圆入口 + 底链 */
@ccclass('HomePage')
export class HomePage extends Component {
    static mount(parent: Node, ctx: HomePageCtx): HomePage {
        const root = mountPageRoot(parent, 'HomePage');
        const c = root.addComponent(HomePage);
        c.build(ctx);
        return c;
    }

    private build(ctx: HomePageCtx) {
        const p = this.node;
        const save = SaveData.load();
        const lv = Math.max(1, Math.min(Design.totalLevels, save.maxUnlocked));
        const verse = getVerseForLevel(lv);
        const dailyId = dailyLevelId();
        const blindOk = blindModeUnlocked(save.maxUnlocked);
        const safe = getSafeLayout();
        const visH = safe.visH;

        PageChrome.attach(p, safe);

        const brandH = 52;
        const tagH = 18;
        const primaryH = 92;
        const roundH = 108;
        const bottomH = 36;
        const footH = 18;
        const gapBrandTag = 6;
        const gapTagHero = 10;
        const gapHeroPrimary = 28;
        const gapPrimaryRound = 22;
        const gapRoundBottom = 20;
        const gapBottomFoot = 10;
        const heroH = Math.min(340, Math.max(250, visH * 0.34));
        const totalH =
            brandH +
            gapBrandTag +
            tagH +
            gapTagHero +
            heroH +
            gapHeroPrimary +
            primaryH +
            gapPrimaryRound +
            roundH +
            gapRoundBottom +
            bottomH +
            gapBottomFoot +
            footH;

        const safeTop = safe.contentTop - 6;
        const safeBot = safe.contentBottom + 6;
        let shiftY = 0;
        const topEdge = totalH * 0.5;
        const botEdge = -totalH * 0.5;
        if (topEdge > safeTop) shiftY = safeTop - topEdge;
        if (botEdge + shiftY < safeBot) shiftY = safeBot - botEdge;

        let cursor = totalH * 0.5 + shiftY;
        const brandY = cursor - brandH * 0.5;
        cursor -= brandH + gapBrandTag;
        const tagY = cursor - tagH * 0.5;
        cursor -= tagH + gapTagHero;
        const heroY = cursor - heroH * 0.5;
        cursor -= heroH + gapHeroPrimary;
        const primaryY = cursor - primaryH * 0.5;
        cursor -= primaryH + gapPrimaryRound;
        const roundY = cursor - roundH * 0.5;
        cursor -= roundH + gapRoundBottom;
        const bottomY = cursor - bottomH * 0.5;
        cursor -= bottomH + gapBottomFoot;
        const footY = cursor - footH * 0.5;

        const ink = '#2F2118';
        const lacquer = isMidAutumn() ? MidAutumnColors.lacquer : '#C45C3A';
        const tagline = isMidAutumn() ? MidAutumnCopy.tagline : Brand.tagline;
        const riddleName = isMidAutumn() ? MidAutumnCopy.riddleTitle : Brand.linkRiddle;

        const brandLab = addLabel(p, 'brand', Brand.name, 54, ink, 640, brandH, true);
        brandLab.spacingX = 12;
        const brand = brandLab.node;
        brand.setPosition(0, brandY, 0);

        if (isMidAutumn()) {
            const badge = addLabel(p, 'festBadge', MidAutumnCopy.badge, 14, MidAutumnColors.gold, 64, 22, true);
            badge.node.setPosition(Brand.name.length * 28 + 8, brandY + 14, 0);
        }

        const tagLab = addLabel(p, 'tag', tagline, 16, lacquer, 520, tagH, true);
        tagLab.spacingX = 4;
        tagLab.node.setPosition(0, tagY, 0);

        const hero = this.drawHero(p, heroY, heroH, ctx);

        const poemBtn = this.drawPrimaryCta(
            p,
            Brand.modePoem,
            Brand.modePoemSub(lv, verse.title),
            () => ctx.startPlayMode('poem', lv),
        );
        poemBtn.setPosition(0, primaryY, 0);

        const rounds = this.drawRoundEntries(p, [
            {
                name: Brand.modeMatch3,
                accent: '#E07058',
                fn: () => ctx.startPlayMode('match3', lv),
            },
            {
                name: Brand.modeDaily,
                accent: isMidAutumn() ? MidAutumnColors.gold : '#6FBE88',
                fn: () => ctx.startPlayMode('daily', dailyId),
            },
            {
                name: riddleName,
                accent: '#D4A017',
                fn: () => ctx.showLanternRiddle(),
            },
            {
                name: Brand.linkBlind,
                accent: '#7A9CC6',
                fn: () => {
                    if (!blindOk) {
                        ctx.tip('先通关第 3 关，再来挑战盲翻诗');
                        return;
                    }
                    ctx.startPlayMode('blind', lv);
                },
            },
        ]);
        rounds.setPosition(0, roundY, 0);

        const bottom = this.drawBottomLinks(p, [
            { name: Brand.linkLevels, fn: () => ctx.showLevelPickPopup() },
            { name: Brand.linkCatalog, fn: () => ctx.showCatalog() },
            { name: Brand.linkLibrary, fn: () => ctx.showLibrary() },
            { name: Brand.linkHowTo, fn: () => ctx.showHowTo() },
            { name: Brand.linkSettings, fn: () => ctx.showSettings() },
        ]);
        bottom.setPosition(0, bottomY, 0);

        const foot = addLabel(p, 'foot', Brand.foot, 12, '#B8A090', 560, footH, true);
        foot.node.setPosition(0, footY, 0);
        foot.node.addComponent(BlockInputEvents);
        foot.node.on(Node.EventType.TOUCH_END, () => ctx.showLegalPopup());

        softRiseIn(brand, 0.02, 16);
        softRiseIn(tagLab.node, 0.1, 10);
        softFadeIn(hero, 0.18, 0.45);
        softRiseIn(poemBtn, 0.42, 24);
        softRiseIn(rounds, 0.55, 14);
        softFadeIn(bottom, 0.68, 0.4);
        softFadeIn(foot.node, 0.8, 0.35);

        idleBreathe(poemBtn, 0.012, 1.8, 1.0);
        const glow = poemBtn.getChildByName('glow');
        if (glow) idleFadePulse(glow, 50, 120, 1.6, 1.0);
    }

    private drawHero(parent: Node, y: number, height: number, ctx: HomePageCtx): Node {
        const h = height;
        const hero = makeNode('hero', parent, 680, h);
        hero.setPosition(0, y, 0);
        const g = hero.addComponent(Graphics);
        const sy = h / 220;
        g.fillColor = colorFromHex('#C9A882', 40);
        g.ellipse(0, -10 * sy, 240 * sy, 26 * sy);
        g.fill();
        const bookScale = Math.min(1.65, Math.max(1.25, sy * 1.45));
        mountHomeFlipBook(hero, 0, 4 * sy, bookScale, {
            autoFlipInterval: 1.8,
            tip: (s) => ctx.tip(s),
        });
        return hero;
    }

    private drawRoundEntries(
        parent: Node,
        items: { name: string; accent: string; fn: () => void }[],
    ): Node {
        const n = Math.max(1, items.length);
        const cellW = 128;
        const cellH = 108;
        const gap = 10;
        const rootW = n * cellW + (n - 1) * gap;
        const root = makeNode('rounds', parent, rootW, cellH);
        const r = 34;

        items.forEach((it, i) => {
            const x = -rootW * 0.5 + cellW * 0.5 + i * (cellW + gap);
            const cell = makeNode(`round${i}`, root, cellW, cellH);
            cell.setPosition(x, 0, 0);

            const disc = makeNode('disc', cell, r * 2 + 8, r * 2 + 8);
            disc.setPosition(0, 14, 0);
            const g = disc.addComponent(Graphics);
            g.fillColor = colorFromHex(it.accent, 36);
            g.circle(0, -2, r + 4);
            g.fill();
            g.fillColor = colorFromHex('#FFF8F0', 250);
            g.circle(0, 0, r);
            g.fill();
            g.strokeColor = colorFromHex(it.accent, 220);
            g.lineWidth = 2.4;
            g.circle(0, 0, r);
            g.stroke();
            g.fillColor = colorFromHex(it.accent);
            g.circle(0, 6, 7);
            g.fill();
            g.fillColor = colorFromHex(it.accent, 160);
            g.roundRect(-10, -12, 20, 8, 3);
            g.fill();

            addLabel(cell, 't', it.name, 18, '#5A3A28', cellW - 8, 28, true).node.setPosition(0, -40, 0);
            bindJellyPress(cell, it.fn);
        });
        return root;
    }

    private drawPrimaryCta(parent: Node, title: string, sub: string, onClick: () => void): Node {
        const w = 520;
        const h = 92;
        const node = makeNode('start', parent, w, h);
        const glow = makeNode('glow', node, w + 24, h + 20);
        const gg = glow.addComponent(Graphics);
        gg.fillColor = colorFromHex('#E07058', 40);
        gg.roundRect(-(w + 24) * 0.5, -(h + 20) * 0.5, w + 24, h + 20, 32);
        gg.fill();

        const g = node.addComponent(Graphics);
        g.fillColor = colorFromHex('#C45C3A', 45);
        g.roundRect(-w * 0.5 + 5, -h * 0.5 - 5, w - 10, h, 26);
        g.fill();
        g.fillColor = colorFromHex('#E07058');
        g.roundRect(-w * 0.5, -h * 0.5, w, h, 26);
        g.fill();
        g.fillColor = colorFromHex('#F09070');
        g.roundRect(-w * 0.5 + 4, -h * 0.5 + 4, w - 8, h * 0.44, 22);
        g.fill();
        g.strokeColor = colorFromHex('#FFE0C8', 210);
        g.lineWidth = 2;
        g.roundRect(-w * 0.5 + 3, -h * 0.5 + 3, w - 6, h - 6, 24);
        g.stroke();
        g.fillColor = colorFromHex('#FFE8D0', 210);
        g.circle(-w * 0.5 + 20, 0, 3.5);
        g.fill();
        g.circle(w * 0.5 - 20, 0, 3.5);
        g.fill();
        const t = addLabel(node, 't', title, 34, '#FFF8F0', w - 24, 40, true);
        t.spacingX = 6;
        t.node.setPosition(0, 11, 0);
        addLabel(node, 's', sub, 16, '#FFE8D8', w - 40, 26, true).node.setPosition(0, -20, 0);
        bindJellyPress(node, onClick);
        return node;
    }

    private drawBottomLinks(parent: Node, items: { name: string; fn: () => void }[]): Node {
        const n = Math.max(1, items.length);
        const cellH = 36;
        const rootW = Math.min(600, n * 100 + (n - 1) * 6);
        const step = rootW / n;
        const root = makeNode('bottomLinks', parent, rootW, cellH);

        items.forEach((it, i) => {
            const x = -rootW * 0.5 + step * 0.5 + i * step;
            const chip = makeNode(`b${i}`, root, step - 4, cellH);
            chip.setPosition(x, 0, 0);
            addLabel(chip, 't', it.name, 18, '#8A6A50', step - 8, 28, true).node.setPosition(0, 0, 0);
            if (i < n - 1) {
                const sep = makeNode(`sep${i}`, root, 2, 16);
                sep.setPosition(x + step * 0.5, 0, 0);
                const sg = sep.addComponent(Graphics);
                sg.fillColor = colorFromHex('#D8C0A0', 140);
                sg.roundRect(-0.75, -7, 1.5, 14, 0.75);
                sg.fill();
            }
            bindJellyPress(chip, it.fn);
        });
        return root;
    }
}
