import { _decorator, Component, Graphics, Node, SpriteFrame } from 'cc';
import { Colors } from '../../core/Config';
import {
    Verse,
    VerseKind,
    verseKindLabel,
    versesByKind,
} from '../../core/Literature';
import { getSafeLayout } from '../../core/SafeArea';
import {
    addBg,
    addButton,
    addLabel,
    makeVerticalScroll,
    onTapWithoutScroll,
    strokeRect,
} from '../UIKit';
import { PageChrome } from './PageChrome';
import { mountPageRoot, placePageHeader } from './PageKit';

const { ccclass } = _decorator;

export type LibraryPageCtx = {
    tab: VerseKind;
    onBack: () => void;
    onTab: (tab: VerseKind) => void;
    onOpenVerse: (v: Verse) => void;
    backFrame?: SpriteFrame;
};

@ccclass('LibraryPage')
export class LibraryPage extends Component {
    static mount(parent: Node, ctx: LibraryPageCtx): LibraryPage {
        const root = mountPageRoot(parent, 'LibraryPage');
        const c = root.addComponent(LibraryPage);
        c.build(ctx);
        return c;
    }

    private build(ctx: LibraryPageCtx) {
        const p = this.node;
        const tab = ctx.tab;
        const list = versesByKind(tab);
        const safe = getSafeLayout();
        PageChrome.attach(p, safe);
        placePageHeader(p, '诗藏馆', ctx.onBack, { safe, backFrame: ctx.backFrame });

        addLabel(p, 'prog', `${list.length} 篇`, 20, Colors.highlight, 200, 36, true).node.setPosition(
            270,
            safe.headerY,
            0,
        );

        const tabs: { id: VerseKind; name: string }[] = [
            { id: 'poem', name: '古诗' },
            { id: 'quote', name: '名言' },
            { id: 'prose', name: '文言文' },
        ];
        const tabY = safe.headerY - safe.headerBtnSize * 0.5 - 36;
        tabs.forEach((t, i) => {
            addButton(
                p,
                `tab_${t.id}`,
                t.name,
                160,
                48,
                tab === t.id ? Colors.btnAd : Colors.btnShare,
                () => ctx.onTab(t.id),
                { fontSize: 22, textHex: Colors.brown },
            ).node.setPosition(-170 + i * 170, tabY, 0);
        });

        addLabel(p, 'hint', `${verseKindLabel(tab)} · 点击阅读`, 18, Colors.text, 560, 28, true).node.setPosition(
            0,
            tabY - 40,
            0,
        );

        const boardTop = tabY - 56;
        const boardBot = safe.contentBottom + 8;
        const boardH = Math.max(420, boardTop - boardBot);
        const board = addBg(p, 'board', 640, boardH, Colors.panel, 16);
        board.setPosition(0, (boardTop + boardBot) * 0.5, 0);

        const viewH = boardH - 40;
        const cellH = 96;
        const gap = 8;
        const pad = 12;
        const contentH = pad * 2 + list.length * cellH + Math.max(0, list.length - 1) * gap;
        const { root: scrollRoot, content } = makeVerticalScroll(board, 'list', 600, viewH, contentH);
        scrollRoot.setPosition(0, 0, 0);

        list.forEach((v, i) => {
            const cell = addBg(content, v.id, 580, cellH, '#FFF8EB', 12);
            cell.setPosition(0, -(pad + cellH * 0.5 + i * (cellH + gap)), 0);
            strokeRect(cell.getComponent(Graphics)!, 580, cellH, Colors.slotBorder, 1.5, 12);
            addLabel(cell, 't', v.title, 26, Colors.brown, 360, 36, true).node.setPosition(-80, 18, 0);
            addLabel(cell, 'm', `${v.source} · ${v.author}`, 18, Colors.text, 400, 28).node.setPosition(-60, -16, 0);
            addLabel(cell, 'tag', '阅读', 18, Colors.highlight, 100, 28, true).node.setPosition(220, 0, 0);
            onTapWithoutScroll(cell, () => ctx.onOpenVerse(v));
        });
    }
}
