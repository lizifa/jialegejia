import { _decorator, Component, Graphics, Label, Node, SpriteFrame } from 'cc';
import { Brand, Colors } from '../../core/Config';
import { getSafeLayout } from '../../core/SafeArea';
import {
    addBg,
    addLabel,
    colorFromHex,
    makeNode,
    makeVerticalScroll,
    strokeRect,
} from '../UIKit';
import { PageChrome } from './PageChrome';
import { mountPageRoot, placePageHeader } from './PageKit';

const { ccclass } = _decorator;

export type HowToPageCtx = {
    onBack: () => void;
    backFrame?: SpriteFrame;
};

@ccclass('HowToPage')
export class HowToPage extends Component {
    static mount(parent: Node, ctx: HowToPageCtx): HowToPage {
        const root = mountPageRoot(parent, 'HowToPage');
        const c = root.addComponent(HowToPage);
        c.build(ctx);
        return c;
    }

    private build(ctx: HowToPageCtx) {
        const p = this.node;
        const safe = getSafeLayout();
        PageChrome.attach(p, safe);
        placePageHeader(p, '玩法说明', ctx.onBack, { safe, backFrame: ctx.backFrame });

        const cardW = 640;
        const boardTop = safe.headerY - safe.headerBtnSize * 0.5 - 20;
        const boardBot = safe.contentBottom + 8;
        const viewH = Math.max(420, boardTop - boardBot);
        const board = addBg(p, 'board', cardW, viewH, Colors.panel, 16);
        board.setPosition(0, (boardTop + boardBot) * 0.5, 0);
        strokeRect(board.getComponent(Graphics)!, cardW, viewH, Colors.boardBorder, 2, 16);

        const sections: { title: string; body: string }[] = [
            {
                title: '两种玩法',
                body: `${Brand.modeMatch3}：点顶层盲盒进匣，相同类型凑齐三个自动消除，清空通关。${Brand.modePoem}：按诗句顺序点亮汉字，点错进匣，匣内可再点亮下一字。`,
            },
            {
                title: '诗句变体',
                body: `${Brand.modeDaily}：每天一首短诗。${Brand.linkBlind}：场上不露字（通关第 3 关解锁）。均不推进主线。`,
            },
            {
                title: '散页匣',
                body: `匣格有限。${Brand.modeMatch3}靠自动消除腾空；${Brand.modePoem}匣满且点不亮下一字时失败。`,
            },
            {
                title: '道具',
                body: '撤回 / 提示 / 整理匣。免费次数用完可看短视频补给。',
            },
            {
                title: '广告续关',
                body: '匣满了可看短视频清空闲字。无账号、无云存档，进度仅本次打开有效。',
            },
        ];

        const innerW = 600;
        const titleH = 34;
        const gapSec = 18;
        const bodyLineH = 30;
        const pad = 20;
        const measured = sections.map((s) => {
            const lines = Math.ceil(s.body.length / 16) + 1;
            const bodyH = Math.max(64, lines * bodyLineH);
            return { ...s, bodyH, h: titleH + 10 + bodyH };
        });
        const contentH =
            pad * 2 + measured.reduce((s, x) => s + x.h, 0) + Math.max(0, measured.length - 1) * gapSec;

        const { root: scrollRoot, content } = makeVerticalScroll(board, 'howtoScroll', innerW, viewH - 20, contentH);
        scrollRoot.setPosition(0, 0, 0);

        let cursor = -pad;
        measured.forEach((s, i) => {
            const block = makeNode(`sec${i}`, content, innerW - 20, s.h);
            block.setPosition(0, cursor - s.h * 0.5, 0);
            const g = block.addComponent(Graphics);
            g.fillColor = colorFromHex('#C45C3A', 220);
            g.roundRect(-(innerW - 20) * 0.5 + 8, s.h * 0.5 - titleH + 6, 4, titleH - 10, 2);
            g.fill();
            addLabel(block, 't', s.title, 26, Colors.brown, 520, titleH, true).node.setPosition(
                12,
                s.h * 0.5 - titleH * 0.5 - 2,
                0,
            );
            const body = addLabel(block, 'b', s.body, 22, Colors.text, innerW - 72, s.bodyH, false);
            body.node.setPosition(12, -titleH * 0.5 + 4, 0);
            body.overflow = Label.Overflow.RESIZE_HEIGHT;
            body.horizontalAlign = Label.HorizontalAlign.LEFT;
            body.verticalAlign = Label.VerticalAlign.TOP;
            body.lineHeight = bodyLineH;
            cursor -= s.h + gapSec;
        });
    }
}
