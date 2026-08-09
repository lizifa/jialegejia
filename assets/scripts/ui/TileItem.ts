import {
    _decorator,
    Color,
    Component,
    Layers,
    Node,
    Prefab,
    Sprite,
    SpriteFrame,
    UIOpacity,
    UITransform,
    instantiate,
} from 'cc';
import { Design } from '../core/Config';

const { ccclass, property } = _decorator;

/**
 * 等距盲盒方块（无文字）：
 * Root 负责点击；Body 只负责显示。
 * 古诗进度在对局 HUD 上体现，不印在每个预制体上。
 */
@ccclass('TileItem')
export class TileItem extends Component {
    @property(Sprite)
    body: Sprite | null = null;

    @property(UIOpacity)
    uiOpacity: UIOpacity | null = null;

    tileId = '';
    typeId = '';
    private _covered = false;

    static buildNode(name = 'TileItem'): Node {
        const root = new Node(name);
        root.layer = Layers.Enum.UI_2D;
        const rootUI = root.addComponent(UITransform);
        rootUI.setContentSize(Design.tileSize, Design.tileSize);
        rootUI.setAnchorPoint(0.5, 0.5);

        const body = new Node('Body');
        body.layer = Layers.Enum.UI_2D;
        root.addChild(body);
        const bodyUI = body.addComponent(UITransform);
        bodyUI.setContentSize(Design.tileSize, Design.tileSize);
        bodyUI.setAnchorPoint(0.5, 0.5);
        (bodyUI as UITransform & { hitTest: () => boolean }).hitTest = () => false;

        const sp = body.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.color = Color.WHITE;

        const op = root.addComponent(UIOpacity);
        op.opacity = 255;

        const item = root.addComponent(TileItem);
        item.body = sp;
        item.uiOpacity = op;
        return root;
    }

    static create(parent: Node | null, prefab: Prefab | null, name?: string): TileItem {
        const node = prefab ? instantiate(prefab) : TileItem.buildNode(name || 'TileItem');
        if (name) node.name = name;
        if (parent) parent.addChild(node);
        let item = node.getComponent(TileItem);
        if (!item) item = node.addComponent(TileItem);
        item.bindRefs();
        return item;
    }

    bindRefs() {
        if (!this.body) {
            const bodyNode = this.node.getChildByName('Body') || this.node;
            this.body = bodyNode.getComponent(Sprite) || bodyNode.addComponent(Sprite);
            this.body.sizeMode = Sprite.SizeMode.CUSTOM;
        }
        if (!this.uiOpacity) {
            this.uiOpacity = this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
        }
        const ui = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        ui.setContentSize(Design.tileSize, Design.tileSize);

        const bodyNode = this.body.node;
        if (bodyNode && bodyNode !== this.node) {
            const bui = bodyNode.getComponent(UITransform);
            if (bui) (bui as UITransform & { hitTest: () => boolean }).hitTest = () => false;
        }
        // 旧版若残留 Glyph，隐藏
        const glyph = this.node.getChildByName('Glyph');
        if (glyph) glyph.active = false;
    }

    setup(
        tileId: string,
        typeId: string,
        normal: SpriteFrame | undefined,
        locked: SpriteFrame | undefined,
        covered: boolean,
    ) {
        this.bindRefs();
        this.tileId = tileId;
        this.typeId = typeId;
        this.node.name = tileId;
        this.applyVisual(normal, locked, covered);
    }

    applyVisual(normal: SpriteFrame | undefined, locked: SpriteFrame | undefined, covered: boolean) {
        this._covered = covered;
        this.bindRefs();
        const sp = this.body!;
        const frame = covered ? locked || normal : normal || locked;
        if (frame) {
            sp.spriteFrame = frame;
            sp.color = Color.WHITE;
        }
        const ui = this.node.getComponent(UITransform)!;
        ui.setContentSize(Design.tileSize, Design.tileSize);
        if (this.body?.node && this.body.node !== this.node) {
            const bui = this.body.node.getComponent(UITransform);
            bui?.setContentSize(Design.tileSize, Design.tileSize);
            if (bui) (bui as UITransform & { hitTest: () => boolean }).hitTest = () => false;
        }
        if (this.uiOpacity) {
            this.uiOpacity.opacity = covered ? Math.floor(255 * Design.coveredAlpha) : 255;
        }
    }

    get covered() {
        return this._covered;
    }

    enableRootHit() {
        const ut = this.node.getComponent(UITransform);
        if (!ut) return;
        // 恢复可点区域（勿依赖 hitTest 覆盖，3.x 上不可靠）
        ut.setContentSize(Design.tileSize, Design.tileSize);
        delete (ut as UITransform & { hitTest?: unknown }).hitTest;
    }

    disableRootHit() {
        const ut = this.node.getComponent(UITransform);
        if (!ut) return;
        // 被压住：命中盒缩为 0，彻底点不到下层
        ut.setContentSize(0, 0);
        (ut as UITransform & { hitTest: () => boolean }).hitTest = () => false;
    }
}
