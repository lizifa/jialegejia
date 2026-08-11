import { _decorator, Component, Graphics, Node, SpriteFrame } from 'cc';
import { Colors, ITEMS } from '../../core/Config';
import { getSafeLayout } from '../../core/SafeArea';
import { addBg, addLabel, ensureUI, makeNode, strokeRect } from '../UIKit';
import { PageChrome } from './PageChrome';
import { mountPageRoot, placePageHeader } from './PageKit';

const { ccclass } = _decorator;

export type CatalogPageCtx = {
    onBack: () => void;
    applyTileSprite: (node: Node, itemId: string, locked: boolean) => void;
    backFrame?: SpriteFrame;
};

@ccclass('CatalogPage')
export class CatalogPage extends Component {
    static mount(parent: Node, ctx: CatalogPageCtx): CatalogPage {
        const root = mountPageRoot(parent, 'CatalogPage');
        const c = root.addComponent(CatalogPage);
        c.build(ctx);
        return c;
    }

    private build(ctx: CatalogPageCtx) {
        const p = this.node;
        const safe = getSafeLayout();
        PageChrome.attach(p, safe);
        placePageHeader(p, '盲盒图鉴', ctx.onBack, { safe, backFrame: ctx.backFrame });

        const grid = makeNode('grid', p, 640, 900);
        grid.setPosition(0, (safe.contentBottom + safe.contentTop) * 0.5, 0);
        ITEMS.forEach((item, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const cell = addBg(grid, item.id, 280, 140, Colors.panel, 12);
            cell.setPosition(col === 0 ? -150 : 150, 380 - row * 155, 0);
            strokeRect(cell.getComponent(Graphics)!, 280, 140, Colors.slotBorder, 2, 12);
            const cube = makeNode('cube', cell, 90, 90);
            cube.setPosition(-80, 0, 0);
            ctx.applyTileSprite(cube, item.id, false);
            ensureUI(cube, 90, 90);
            addLabel(cell, 'name', item.name, 26, Colors.title, 160, 40, true).node.setPosition(50, 20, 0);
            addLabel(cell, 'tag', `第${item.unlockLevel}关出现`, 18, Colors.text, 160, 30).node.setPosition(
                50,
                -20,
                0,
            );
        });
    }
}
