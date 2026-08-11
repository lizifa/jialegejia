import { _decorator, Component, Graphics, Label, Node, SpriteFrame, tween, Vec3 } from 'cc';
import { Brand, Colors } from '../../core/Config';
import { LANTERN_RIDDLES, riddleByIndex, riddleQuizChoices } from '../../core/Riddles';
import { getSafeLayout } from '../../core/SafeArea';
import {
    addBg,
    addButton,
    addLabel,
    bindJellyPress,
    burstStars,
    colorFromHex,
    idleSway,
    makeNode,
    sparkBurst,
    strokeRect,
} from '../UIKit';
import { PageChrome } from './PageChrome';
import { mountPageRoot, placePageHeader } from './PageKit';

const { ccclass } = _decorator;

const PRAISE = [
    '答对了！灯花为你亮一盏',
    '妙哉，一语中的',
    '好眼力！花灯点头称赞',
    '猜中了，诗匣记下这一笔',
    '漂亮，下一盏更有趣',
];

export type RiddlePageCtx = {
    riddleIndex: number;
    onBack: () => void;
    tip: (msg: string) => void;
    requestHintAd: (onGot: () => void) => void;
    onNext: () => void;
    backFrame?: SpriteFrame;
};

@ccclass('RiddlePage')
export class RiddlePage extends Component {
    static mount(parent: Node, ctx: RiddlePageCtx): RiddlePage {
        const root = mountPageRoot(parent, 'RiddlePage');
        const c = root.addComponent(RiddlePage);
        c.build(ctx);
        return c;
    }

    private build(ctx: RiddlePageCtx) {
        const p = this.node;
        const safe = getSafeLayout();
        PageChrome.attach(p, safe);
        placePageHeader(p, Brand.linkRiddle, ctx.onBack, { safe, backFrame: ctx.backFrame });

        const r = riddleByIndex(ctx.riddleIndex);
        const quiz = riddleQuizChoices(ctx.riddleIndex, 4);
        const total = LANTERN_RIDDLES.length;
        const lacquer = '#C45C3A';
        const ink = '#2F2118';

        addLabel(
            p,
            'prog',
            `${ctx.riddleIndex + 1} / ${total}`,
            20,
            Colors.highlight,
            160,
            32,
            true,
        ).node.setPosition(270, safe.headerY, 0);

        const boardTop = safe.headerY - safe.headerBtnSize * 0.5 - 24;
        const boardBot = safe.contentBottom + 100;
        const boardH = Math.max(480, boardTop - boardBot);
        const board = addBg(p, 'board', 640, boardH, Colors.panel, 18);
        board.setPosition(0, (boardTop + boardBot) * 0.5, 0);
        strokeRect(board.getComponent(Graphics)!, 640, boardH, Colors.boardBorder, 2, 18);

        const lantern = makeNode('lantern', board, 64, 80);
        lantern.setPosition(0, boardH * 0.5 - 48, 0);
        const lg = lantern.addComponent(Graphics);
        lg.fillColor = colorFromHex(lacquer, 235);
        lg.ellipse(0, 4, 18, 22);
        lg.fill();
        lg.fillColor = colorFromHex('#E8C98A', 230);
        lg.ellipse(0, 22, 16, 4);
        lg.fill();
        lg.ellipse(0, -16, 14, 4);
        lg.fill();
        lg.strokeColor = colorFromHex('#E8C98A', 200);
        lg.lineWidth = 1.6;
        lg.moveTo(0, -18);
        lg.lineTo(0, -32);
        lg.stroke();
        lg.fillColor = colorFromHex('#E8C98A', 220);
        lg.circle(0, -34, 3);
        lg.fill();
        idleSway(lantern, 4, 1.6, 0.1);

        addLabel(board, 'eyebrow', '花灯一盏 · 四选一', 18, lacquer, 400, 28, true).node.setPosition(
            0,
            boardH * 0.5 - 100,
            0,
        );

        const puzzle = addLabel(board, 'puzzle', r.puzzle, 28, ink, 560, 100, true);
        puzzle.overflow = Label.Overflow.RESIZE_HEIGHT;
        puzzle.lineHeight = 38;
        puzzle.node.setPosition(0, boardH * 0.5 - 175, 0);

        const hintLab = addLabel(board, 'hint', '', 20, Colors.text, 520, 36, true);
        hintLab.node.setPosition(0, boardH * 0.5 - 245, 0);

        const grid = makeNode('choices', board, 560, 260);
        grid.setPosition(0, -20, 0);
        const cellW = 250;
        const cellH = 100;
        const gapX = 28;
        const gapY = 24;

        const resultLab = addLabel(board, 'result', '点选你认为的谜底', 22, Colors.text, 560, 36, true);
        resultLab.node.setPosition(0, -boardH * 0.5 + 70, 0);
        const noteLab = addLabel(board, 'note', '', 18, Colors.text, 560, 56, true);
        noteLab.overflow = Label.Overflow.RESIZE_HEIGHT;
        noteLab.lineHeight = 26;
        noteLab.node.setPosition(0, -boardH * 0.5 + 36, 0);

        let revealedHint = false;
        let answered = false;
        const choiceNodes: Node[] = [];

        const paintChoice = (node: Node, w: number, h: number, state: 'idle' | 'ok' | 'bad' | 'dim') => {
            const g = node.getComponent(Graphics) || node.addComponent(Graphics);
            g.clear();
            const fill =
                state === 'ok'
                    ? '#E8F6EC'
                    : state === 'bad'
                      ? '#FCEDEA'
                      : state === 'dim'
                        ? '#F5F0E8'
                        : '#FFF8F0';
            const stroke =
                state === 'ok' ? '#6FBE88' : state === 'bad' ? '#E07058' : state === 'dim' ? '#D8C8B0' : '#E8C9A0';
            g.fillColor = colorFromHex(fill, 250);
            g.roundRect(-w * 0.5, -h * 0.5, w, h, 18);
            g.fill();
            g.strokeColor = colorFromHex(stroke, 220);
            g.lineWidth = 2.2;
            g.roundRect(-w * 0.5, -h * 0.5, w, h, 18);
            g.stroke();
        };

        const celebrate = () => {
            const line = PRAISE[Math.floor(Math.random() * PRAISE.length)]!;
            resultLab.string = `✦ ${line}`;
            resultLab.color = colorFromHex(lacquer) as never;
            noteLab.string = r.note;
            burstStars(board, 0, 0);
            sparkBurst(board, -50, 20, 10, '#E8C98A');
            sparkBurst(board, 50, 10, 8, '#E07058');
            ctx.tip(line);
        };

        quiz.options.forEach((opt, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const x = (col === 0 ? -1 : 1) * (cellW * 0.5 + gapX * 0.5);
            const y = (row === 0 ? 1 : -1) * (cellH * 0.5 + gapY * 0.5);
            const cell = makeNode(`opt${i}`, grid, cellW, cellH);
            cell.setPosition(x, y, 0);
            paintChoice(cell, cellW, cellH, 'idle');
            const lab = addLabel(cell, 't', opt, opt.length > 2 ? 30 : 40, ink, cellW - 24, cellH - 16, true);
            lab.node.setPosition(0, 0, 0);
            choiceNodes.push(cell);

            bindJellyPress(cell, () => {
                if (answered) return;
                answered = true;
                const hit = quiz.accept.includes(opt);
                quiz.options.forEach((o, j) => {
                    const n = choiceNodes[j]!;
                    if (quiz.accept.includes(o)) paintChoice(n, cellW, cellH, 'ok');
                    else if (j === i && !hit) paintChoice(n, cellW, cellH, 'bad');
                    else paintChoice(n, cellW, cellH, 'dim');
                });
                if (hit) {
                    celebrate();
                    tween(cell)
                        .to(0.14, { scale: new Vec3(1.06, 1.06, 1) }, { easing: 'sineOut' })
                        .to(0.16, { scale: new Vec3(1, 1, 1) })
                        .start();
                } else {
                    resultLab.string = `选的是「${opt}」· 正确答案「${quiz.correct}」`;
                    noteLab.string = r.note;
                    ctx.tip(`答错了，谜底是「${quiz.correct}」`);
                }
            });
        });

        const applyHint = () => {
            hintLab.string = `提示：${r.hint}`;
            revealedHint = true;
            ctx.tip('提示已解锁');
        };
        const showHint = () => {
            if (revealedHint) {
                ctx.tip('这题已经看过提示了');
                return;
            }
            ctx.requestHintAd(applyHint);
        };

        const barY = safe.contentBottom + 44;
        const bar = makeNode('bar', p, 640, 72);
        bar.setPosition(0, barY, 0);
        addButton(bar, 'hintBtn', '看提示', 200, 64, Colors.btnShare, showHint, {
            fontSize: 24,
            textHex: Colors.brown,
        }).node.setPosition(-160, 0, 0);
        addButton(bar, 'nextBtn', '下一谜', 200, 64, Colors.btnAd, () => ctx.onNext(), {
            fontSize: 24,
            textHex: Colors.brown,
        }).node.setPosition(160, 0, 0);
    }
}
