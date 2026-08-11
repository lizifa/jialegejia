import { _decorator, BlockInputEvents, Component, Node, SpriteFrame } from 'cc';
import { Colors } from '../../core/Config';
import { getSafeLayout } from '../../core/SafeArea';
import { SaveData } from '../../core/SaveData';
import { addBg, addLabel } from '../UIKit';
import { PageChrome } from './PageChrome';
import { mountPageRoot, placePageHeader } from './PageKit';

const { ccclass } = _decorator;

export type SettingsPageCtx = {
    onBack: () => void;
    onToggleSound: () => void;
    onHowTo: () => void;
    onLegal: () => void;
    onAbout: () => void;
    backFrame?: SpriteFrame;
};

@ccclass('SettingsPage')
export class SettingsPage extends Component {
    static mount(parent: Node, ctx: SettingsPageCtx): SettingsPage {
        const root = mountPageRoot(parent, 'SettingsPage');
        const c = root.addComponent(SettingsPage);
        c.build(ctx);
        return c;
    }

    private build(ctx: SettingsPageCtx) {
        const p = this.node;
        const safe = getSafeLayout();
        PageChrome.attach(p, safe);
        placePageHeader(p, '设置', ctx.onBack, { safe, backFrame: ctx.backFrame });

        const list = [
            {
                name: '音效',
                action: () => ctx.onToggleSound(),
                right: SaveData.load().soundOn ? '开' : '关',
            },
            { name: '玩法说明', action: () => ctx.onHowTo(), right: '>' },
            { name: '用户协议', action: () => ctx.onLegal(), right: '>' },
            { name: '隐私协议', action: () => ctx.onLegal(), right: '>' },
            { name: '关于游戏', action: () => ctx.onAbout(), right: 'i' },
        ];

        const listTop = safe.headerY - safe.headerBtnSize * 0.5 - 48;
        list.forEach((item, i) => {
            const row = addBg(p, `row${i}`, 640, 88, Colors.panel, 12);
            row.setPosition(0, listTop - i * 100, 0);
            addLabel(row, 'n', item.name, 28, Colors.title, 400, 40, true).node.setPosition(-80, 0, 0);
            if (item.name === '音效') {
                addBg(
                    row,
                    'tog',
                    72,
                    36,
                    SaveData.load().soundOn ? Colors.highlight : Colors.btnDisabled,
                    18,
                ).setPosition(240, 0, 0);
            } else {
                addLabel(row, 'r', item.right, 28, Colors.text, 60, 40).node.setPosition(250, 0, 0);
            }
            row.addComponent(BlockInputEvents);
            row.on(Node.EventType.TOUCH_END, item.action);
        });
    }
}
