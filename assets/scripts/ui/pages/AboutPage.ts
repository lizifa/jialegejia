import { _decorator, Component, Node, SpriteFrame } from 'cc';
import { Brand, Colors } from '../../core/Config';
import { getSafeLayout } from '../../core/SafeArea';
import { addButton, addLabel } from '../UIKit';
import { PageChrome } from './PageChrome';
import { mountPageRoot, placePageHeader } from './PageKit';

const { ccclass } = _decorator;

export type AboutPageCtx = {
    onBack: () => void;
    onHowTo: () => void;
    backFrame?: SpriteFrame;
};

@ccclass('AboutPage')
export class AboutPage extends Component {
    static mount(parent: Node, ctx: AboutPageCtx): AboutPage {
        const root = mountPageRoot(parent, 'AboutPage');
        const c = root.addComponent(AboutPage);
        c.build(ctx);
        return c;
    }

    private build(ctx: AboutPageCtx) {
        const p = this.node;
        const safe = getSafeLayout();
        PageChrome.attach(p, safe);
        placePageHeader(p, '关于游戏', ctx.onBack, { safe, backFrame: ctx.backFrame });
        addLabel(p, 'name', `${Brand.full} ${Brand.version}`, 28, Colors.title, 600, 50, true).node.setPosition(
            0,
            200,
            0,
        );
        addLabel(
            p,
            'desc',
            '翻开顶层盲盒得字，按诗句顺序点亮；错字进散页匣',
            24,
            Colors.text,
            600,
            120,
        ).node.setPosition(0, 80, 0);
        addButton(p, 'howto', '查看玩法说明', 280, 64, Colors.btnMain, () => ctx.onHowTo(), {
            textHex: Colors.brown,
            fontSize: 26,
        }).node.setPosition(0, -40, 0);
        addLabel(p, 'copy', '©2026', 20, Colors.text, 200, 30).node.setPosition(0, safe.contentBottom + 24, 0);
    }
}
