import {
    _decorator,
    Component,
    JsonAsset,
    Node,
    Prefab,
    ResolutionPolicy,
    UIOpacity,
    UITransform,
    Vec3,
    resources,
    tween,
    view,
    Graphics,
    Label,
    BlockInputEvents,
    Layers,
    EventTouch,
    Sprite,
    SpriteFrame,
    Color,
    Vec2,
} from 'cc';
import { Anim, Colors, Design, difficultyTier, ITEM_MAP, ITEMS, lighten } from './core/Config';
import { MatchGame, TileModel, LevelJson } from './core/MatchGame';
import { PropKind, SaveData } from './core/SaveData';
import {
    formatVerseProgress,
    getVerseForLevel,
    verseCharSequence,
    verseKindLabel,
    versesByKind,
    Verse,
    VerseKind,
} from './core/Literature';
import {
    addBg,
    addButton,
    addCircleBtn,
    addLabel,
    colorFromHex,
    drawIsoSlot,
    ensureUI,
    fadeMask,
    fillRect,
    idleBreathe,
    idleFloat,
    idleSway,
    makeNode,
    makeVerticalScroll,
    onTapWithoutScroll,
    popIn,
    popupScaleIn,
    popupSlideUp,
    setOpacity,
    strokeRect,
} from './ui/UIKit';
import { TileItem } from './ui/TileItem';
import { flashVerseHud, playLineBrush, playVerseInkReveal, playVerseSeal } from './ui/VerseFX';

const { ccclass } = _decorator;

type Page = 'boot' | 'home' | 'game' | 'catalog' | 'library' | 'settings' | 'about';

@ccclass('GameApp')
export class GameApp extends Component {
    private root!: Node;
    private pageRoot!: Node;
    private overlayRoot!: Node;
    private game = new MatchGame();
    private page: Page = 'boot';
    private currentLevel = 1;
    /** 休闲模式：通关不推进主线 */
    private leisureMode = false;
    private tileNodes = new Map<string, Node>();
    /** 散页匣格位节点 */
    private slotNodes: Node[] = [];
    private boardLayer!: Node;
    private slotLayer!: Node;
    private parkLayer!: Node;
    private hudLayer!: Node;
    private busy = false;
    private undoBtn: ReturnType<typeof addButton> | null = null;
    private levelCache = new Map<number, LevelJson>();
    private tipLabel: Label | null = null;
    private bootBar: Graphics | null = null;
    private bootBarNode: Node | null = null;
    private bootPct: Label | null = null;
    private bootProgress = 0;
    private bootLoaded = 0;
    private bootDone = false;
    private tileFrames = new Map<string, SpriteFrame>();
    private uiFrames = new Map<string, SpriteFrame>();
    /** 等距盲盒方块预制体 */
    private tilePrefab: Prefab | null = null;
    /** 本关目标字序列（与 game.targetChars 同步） */
    private poemChars: string[] = [];
    private poemRevealed = 0;
    private poemHudLabel: Label | null = null;
    private poemHudProgressLabel: Label | null = null;
    private poemHudBar: Graphics | null = null;
    private poemHudRoot: Node | null = null;
    private economyHudLabel: Label | null = null;
    /** 按匣格实测，保证入匣不撑破 */
    private slotFitScale = Design.slotScale;
    private mockLayout: {
        board: { x: number; y: number; w: number; h: number };
        slots: { x: number; y: number; w: number; h: number };
        tools: { items: { key: string; x: number; y: number; w: number; h: number }[] };
        back: { x: number; y: number; w: number; h: number };
        more: { x: number; y: number; w: number; h: number };
        title: { x: number; y: number };
    } | null = null;
    private bootTotal = Design.totalLevels;

    onLoad() {
        view.setDesignResolutionSize(Design.width, Design.height, ResolutionPolicy.FIXED_WIDTH);
        this.bootstrap();
    }

    /**
     * 微信小游戏：顶栏与右上角胶囊水平对齐（取胶囊垂直中心 → 设计坐标 Y）
     * 非微信环境返回 null，走设计稿默认值
     */
    private getWechatCapsuleAlignY(): number | null {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const wxApi = (globalThis as any).wx;
            if (!wxApi?.getMenuButtonBoundingClientRect) return null;
            const info = wxApi.getWindowInfo?.() ?? wxApi.getSystemInfoSync?.();
            const menu = wxApi.getMenuButtonBoundingClientRect();
            if (!info || !menu || !menu.height) return null;
            const winW = info.windowWidth || info.screenWidth;
            const winH = info.windowHeight || info.screenHeight;
            if (!winW || !winH) return null;
            // FIXED_WIDTH：设计宽对齐窗口宽
            const scale = Design.width / winW;
            const capsuleCenterFromTop = (menu.top + menu.height * 0.5) * scale;
            const visH = winH * scale;
            return visH * 0.5 - capsuleCenterFromTop;
        } catch {
            return null;
        }
    }

    /** 微信胶囊高度 → 设计坐标，用于顶栏圆钮尺寸 */
    private getWechatCapsuleBtnSize(fallback = 56): number {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const wxApi = (globalThis as any).wx;
            if (!wxApi?.getMenuButtonBoundingClientRect) return fallback;
            const info = wxApi.getWindowInfo?.() ?? wxApi.getSystemInfoSync?.();
            const menu = wxApi.getMenuButtonBoundingClientRect();
            const winW = info?.windowWidth || info?.screenWidth;
            if (!winW || !menu?.height) return fallback;
            const scale = Design.width / winW;
            return Math.max(48, Math.min(64, Math.round(menu.height * scale)));
        } catch {
            return fallback;
        }
    }

    private bootstrap() {
        this.root = makeNode('GameRoot', this.node, Design.width, Design.height);
        addBg(this.root, 'PageBg', Design.width + 40, Design.height + 40, Colors.bg);
        this.pageRoot = makeNode('PageRoot', this.root, Design.width, Design.height);
        this.overlayRoot = makeNode('OverlayRoot', this.root, Design.width, Design.height);
        this.showBoot();
    }

    private clearPage() {
        this.unschedule(this.tickBoot);
        this.pageRoot.removeAllChildren();
        this.overlayRoot.removeAllChildren();
        this.tileNodes.clear();
        this.slotNodes = [];
        this.undoBtn = null;
        this.tipLabel = null;
        this.busy = false;
        this.bootBar = null;
        this.bootBarNode = null;
        this.bootPct = null;
        this.poemHudLabel = null;
        this.poemHudProgressLabel = null;
        this.poemHudBar = null;
        this.poemHudRoot = null;
        this.economyHudLabel = null;
        this.poemChars = [];
        this.poemRevealed = 0;
    }

    private tip(msg: string) {
        if (!this.tipLabel || !this.tipLabel.isValid) {
            const lab = addLabel(this.overlayRoot, 'tip', msg, 26, Colors.highlight, 560, 48, true);
            lab.node.setPosition(0, 420, 0);
            this.tipLabel = lab;
        } else {
            this.tipLabel.string = msg;
        }
        const n = this.tipLabel.node;
        setOpacity(n, 255);
        tween(n.getComponent(UIOpacity)!)
            .delay(1.2)
            .to(0.25, { opacity: 0 })
            .start();
    }

    // ---------------- Boot ----------------
    private showBoot() {
        this.clearPage();
        this.page = 'boot';
        this.bootProgress = 0;
        this.bootLoaded = 0;
        this.bootDone = false;
        const p = this.pageRoot;

        addLabel(p, 'title', '架了个架', 64, Colors.brown, 600, 80, true).node.setPosition(0, 420, 0);
        addLabel(p, 'sub', '书架盲盒馆', 36, Colors.brown, 500, 50, true).node.setPosition(0, 350, 0);
        addLabel(p, 'slogan', '翻开盲盒，点亮诗文', 24, Colors.text, 500, 40).node.setPosition(0, 300, 0);

        this.drawDecorShelf(p, 0, 40);

        const barBg = addBg(p, 'barBg', 420, 18, Colors.slotBorder, 9);
        barBg.setPosition(0, -360, 0);
        this.bootBarNode = makeNode('barFill', barBg, 4, 14);
        ensureUI(this.bootBarNode, 4, 14, 0, 0.5);
        this.bootBarNode.setPosition(-210, 0, 0);
        this.bootBar = this.bootBarNode.addComponent(Graphics);
        fillRect(this.bootBar, 4, 14, Colors.brown, 4, 0, 0.5);

        this.bootPct = addLabel(p, 'pct', '正在加载资源 0%', 22, Colors.text, 400, 36);
        this.bootPct.node.setPosition(0, -400, 0);

        // 并行加载关卡 + 方块贴图
        void this.preloadAll().finally(() => {
            this.bootDone = true;
        });
        this.schedule(this.tickBoot, 0.05);
        this.scheduleOnce(() => {
            this.bootDone = true;
        }, 5);
    }

    private tickBoot = () => {
        if (this.page !== 'boot' || !this.bootBar || !this.bootBarNode || !this.bootPct) return;

        const loadPct = (this.bootLoaded / Math.max(1, this.bootTotal)) * 100;
        const target = this.bootDone ? 100 : Math.min(92, Math.max(loadPct, this.bootProgress + 3));
        this.bootProgress = Math.min(100, this.bootProgress + Math.max(1.5, (target - this.bootProgress) * 0.35));

        const w = Math.max(4, (420 - 8) * (this.bootProgress / 100));
        ensureUI(this.bootBarNode, w, 14, 0, 0.5);
        fillRect(this.bootBar, w, 14, Colors.brown, 4, 0, 0.5);
        this.bootPct.string = `正在加载资源 ${Math.floor(this.bootProgress)}%`;

        if (this.bootDone && this.bootProgress >= 99.5) {
            this.unschedule(this.tickBoot);
            this.bootProgress = 100;
            this.bootPct.string = '正在加载资源 100%';
            this.showHome();
        }
    };

    /** 首页氛围：整屏单色宣纸底，不分层 */
    private drawHomeAtmosphere(parent: Node, visH: number): Node {
        const root = makeNode('atmosphere', parent, Design.width, visH);
        const g = root.addComponent(Graphics);
        g.fillColor = colorFromHex('#F3E8D8');
        g.rect(-Design.width * 0.5, -visH * 0.5, Design.width, visH);
        g.fill();
        this.disableHit(root);
        return root;
    }

    /** 画一枚等距小盲盒（首页主视觉用，柔描边 + 顶面高光） */
    private paintMiniIsoBox(g: Graphics, cx: number, cy: number, size: number, topHex: string, sideHex: string) {
        const w = size * 0.52;
        const h = size * 0.28;
        const d = size * 0.42;
        const topZ = d * 0.5;
        // 落地软影（扁矩形，不用椭圆）
        g.fillColor = colorFromHex('#3D2A1F', 28);
        g.roundRect(cx - w * 0.75, cy - topZ - h - 4, w * 1.5, 8, 3);
        g.fill();
        // top
        g.fillColor = colorFromHex(topHex);
        g.moveTo(cx, cy + topZ + h);
        g.lineTo(cx + w, cy + topZ);
        g.lineTo(cx, cy + topZ - h);
        g.lineTo(cx - w, cy + topZ);
        g.close();
        g.fill();
        // 顶面高光棱
        g.strokeColor = colorFromHex('#FFFFFF', 70);
        g.lineWidth = 1.5;
        g.moveTo(cx - w * 0.35, cy + topZ + h * 0.35);
        g.lineTo(cx, cy + topZ + h * 0.75);
        g.lineTo(cx + w * 0.35, cy + topZ + h * 0.35);
        g.stroke();
        // left
        g.fillColor = colorFromHex(sideHex);
        g.moveTo(cx - w, cy + topZ);
        g.lineTo(cx, cy + topZ - h);
        g.lineTo(cx, cy - topZ - h);
        g.lineTo(cx - w, cy - topZ);
        g.close();
        g.fill();
        // right
        g.fillColor = colorFromHex(lighten(sideHex, 0.1));
        g.moveTo(cx + w, cy + topZ);
        g.lineTo(cx, cy + topZ - h);
        g.lineTo(cx, cy - topZ - h);
        g.lineTo(cx + w, cy - topZ);
        g.close();
        g.fill();
        g.strokeColor = colorFromHex('#3D2A1F', 160);
        g.lineWidth = 1.6;
        g.moveTo(cx, cy + topZ + h);
        g.lineTo(cx + w, cy + topZ);
        g.lineTo(cx + w, cy - topZ);
        g.lineTo(cx, cy - topZ - h);
        g.lineTo(cx - w, cy - topZ);
        g.lineTo(cx - w, cy + topZ);
        g.close();
        g.stroke();
    }

    /**
     * 首页主视觉：木匣展台 + 宝石色盲盒堆叠，撑满中段
     */
    private drawHomeHero(parent: Node, y: number, height = 300): { root: Node; height: number } {
        const h = height;
        const hero = makeNode('hero', parent, 680, h);
        hero.setPosition(0, y, 0);
        const g = hero.addComponent(Graphics);
        const sy = h / 300;

        // 展台底座
        g.fillColor = colorFromHex('#C9A882', 90);
        g.roundRect(-260 * sy, -132 * sy, 520 * sy, 36 * sy, 14);
        g.fill();
        g.fillColor = colorFromHex('#8B6848');
        g.roundRect(-240 * sy, -122 * sy, 480 * sy, 16 * sy, 6);
        g.fill();
        g.fillColor = colorFromHex('#A67C52');
        g.roundRect(-230 * sy, -118 * sy, 460 * sy, 6 * sy, 3);
        g.fill();

        // 书柜木匣
        g.fillColor = colorFromHex('#E8D2B4');
        g.roundRect(-200 * sy, -98 * sy, 320 * sy, 220 * sy, 14);
        g.fill();
        g.fillColor = colorFromHex('#F4E6D0');
        g.roundRect(-188 * sy, -86 * sy, 296 * sy, 196 * sy, 10);
        g.fill();
        g.strokeColor = colorFromHex('#8B6848', 180);
        g.lineWidth = 2;
        g.roundRect(-200 * sy, -98 * sy, 320 * sy, 220 * sy, 14);
        g.stroke();
        // 层板
        g.fillColor = colorFromHex('#B8956A');
        g.roundRect(-176 * sy, 8 * sy, 272 * sy, 7 * sy, 2);
        g.fill();
        g.fillColor = colorFromHex('#C4A36A', 120);
        g.roundRect(-176 * sy, 12 * sy, 272 * sy, 2 * sy, 1);
        g.fill();

        // 更克制的宝石色（去糖果感）
        const topRow: { x: number; y: number; s: number; top: string; side: string }[] = [
            { x: -118, y: 58, s: 50, top: '#5A7EB5', side: '#3E5A86' },
            { x: -62, y: 62, s: 52, top: '#5FA879', side: '#3E7A56' },
            { x: -4, y: 56, s: 54, top: '#D08A48', side: '#A86830' },
            { x: 54, y: 60, s: 50, top: '#C45C4A', side: '#9A3E34' },
            { x: 108, y: 57, s: 48, top: '#D4B05A', side: '#A88838' },
        ];
        const midRow: { x: number; y: number; s: number; top: string; side: string }[] = [
            { x: -90, y: -2, s: 56, top: '#6AA8B8', side: '#458090' },
            { x: -28, y: 6, s: 60, top: '#D49AA8', side: '#B07080' },
            { x: 36, y: 0, s: 58, top: '#D4BC78', side: '#A89450' },
            { x: 96, y: 4, s: 54, top: '#6AAB7E', side: '#488860' },
        ];
        const frontRow: { x: number; y: number; s: number; top: string; side: string }[] = [
            { x: -58, y: -58, s: 62, top: '#C45C4A', side: '#963C34' },
            { x: 6, y: -50, s: 70, top: '#E0A86A', side: '#B88848' },
            { x: 70, y: -60, s: 60, top: '#8A78B0', side: '#645488' },
        ];
        [...topRow, ...midRow, ...frontRow].forEach((b) =>
            this.paintMiniIsoBox(g, b.x * sy, b.y * sy, b.s * sy, b.top, b.side),
        );

        const gift = this.drawDecorGift(hero, 198 * sy, 18 * sy);
        gift.setScale(1.15 * sy, 1.15 * sy, 1);
        idleSway(gift, 3.5, 1.8, 0.2);
        idleFloat(gift, 6, 2.1, 0.1);

        return { root: hero, height: h };
    }

    private drawDecorShelf(parent: Node, x: number, y: number): Node {
        // 兼容旧调用：缩略书架
        const shelf = makeNode('shelf', parent, 280, 200);
        shelf.setPosition(x, y, 0);
        const g = shelf.addComponent(Graphics);
        g.fillColor = colorFromHex('#E8C9A0');
        g.roundRect(-130, -90, 260, 180, 10);
        g.fill();
        g.fillColor = colorFromHex('#D4A574');
        g.rect(-120, 0, 240, 10);
        g.fill();
        g.rect(-120, -80, 240, 10);
        g.fill();
        const cols = ['#5B8CDE', '#6BBF7A', '#F09A4A', '#E85D5D', '#F0C35A'];
        cols.forEach((c, i) => {
            g.fillColor = colorFromHex(c);
            g.roundRect(-100 + i * 28, 20, 22, 55, 3);
            g.fill();
        });
        return shelf;
    }

    private async preloadAll() {
        this.levelCache.clear();
        this.tileFrames.clear();
        this.uiFrames.clear();
        this.bootLoaded = 0;
        const tileNames = ITEMS.flatMap((it) => [it.id, `${it.id}_locked`]);
        const uiNames = ['btn_undo', 'btn_shuffle', 'btn_remove', 'btn_share', 'btn_back', 'btn_more'];
        this.bootTotal = Design.totalLevels + tileNames.length + uiNames.length + 2;

        const jobs: Promise<void>[] = [];
        for (let i = 1; i <= Design.totalLevels; i++) {
            jobs.push(this.loadOneLevel(i));
        }
        for (const name of tileNames) {
            jobs.push(this.loadOneTile(name));
        }
        for (const name of uiNames) {
            jobs.push(this.loadOneUi(name));
        }
        jobs.push(this.loadMockLayout());
        jobs.push(this.loadTilePrefab());
        await Promise.all(jobs);
    }

    private loadTilePrefab(): Promise<void> {
        return new Promise((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                this.bootLoaded++;
                resolve();
            };
            try {
                resources.load('prefabs/TileItem', Prefab, (err, prefab) => {
                    if (!err && prefab) this.tilePrefab = prefab;
                    finish();
                });
            } catch {
                finish();
            }
            setTimeout(finish, 2500);
        });
    }

    private loadMockLayout(): Promise<void> {
        return new Promise((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                this.bootLoaded++;
                resolve();
            };
            try {
                resources.load('mock_layout', JsonAsset, (err, asset) => {
                    if (!err && asset) {
                        this.mockLayout = (asset.json || asset) as NonNullable<typeof this.mockLayout>;
                    }
                    finish();
                });
            } catch {
                finish();
            }
            setTimeout(finish, 2500);
        });
    }

    private loadOneUi(name: string): Promise<void> {
        return new Promise((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                this.bootLoaded++;
                resolve();
            };
            try {
                resources.load(`textures/ui_mock/${name}/spriteFrame`, SpriteFrame, (err, frame) => {
                    if (!err && frame) this.uiFrames.set(name, frame);
                    finish();
                });
            } catch {
                finish();
            }
            setTimeout(finish, 2500);
        });
    }

    private addSprite(parent: Node, name: string, frame: SpriteFrame | undefined, w: number, h: number): Node {
        const n = makeNode(name, parent, w, h);
        if (frame) {
            const sp = n.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            sp.spriteFrame = frame;
            sp.color = Color.WHITE;
        }
        this.disableHit(n);
        return n;
    }

    private addHitBtn(
        parent: Node,
        name: string,
        w: number,
        h: number,
        onClick: () => void,
        frame?: SpriteFrame,
    ): ReturnType<typeof addButton> {
        const node = makeNode(name, parent, w, h);
        if (frame) {
            const sp = node.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            sp.spriteFrame = frame;
            sp.color = Color.WHITE;
        }
        let enabled = true;
        node.addComponent(BlockInputEvents);
        node.on(Node.EventType.TOUCH_START, () => {
            if (!enabled) return;
            tween(node).to(Anim.btnMs, { scale: new Vec3(0.94, 0.94, 1) }, { easing: 'quadOut' }).start();
        });
        node.on(Node.EventType.TOUCH_CANCEL, () => {
            tween(node).to(Anim.btnMs, { scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' }).start();
        });
        node.on(Node.EventType.TOUCH_END, () => {
            tween(node)
                .to(Anim.btnMs, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                .call(() => {
                    if (enabled) onClick();
                })
                .start();
        });
        return {
            node,
            setEnabled: (on: boolean) => {
                enabled = on;
                const op = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
                op.opacity = on ? 255 : 140;
            },
            setLabel: () => {},
        };
    }

    private loadOneLevel(i: number): Promise<void> {
        return new Promise((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                this.bootLoaded++;
                resolve();
            };
            try {
                resources.load(`levels/level${i}`, JsonAsset, (err, asset) => {
                    if (!err && asset) this.levelCache.set(i, (asset.json || asset) as LevelJson);
                    finish();
                });
            } catch {
                finish();
            }
            setTimeout(finish, 2500);
        });
    }

    private loadOneTile(name: string): Promise<void> {
        return new Promise((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                this.bootLoaded++;
                resolve();
            };
            try {
                resources.load(`textures/tiles/${name}/spriteFrame`, SpriteFrame, (err, frame) => {
                    if (!err && frame) this.tileFrames.set(name, frame);
                    finish();
                });
            } catch {
                finish();
            }
            setTimeout(finish, 2500);
        });
    }

    private applyTileSprite(node: Node, typeId: string, locked: boolean) {
        const normal = this.tileFrames.get(typeId);
        const lockedFrame = this.tileFrames.get(`${typeId}_locked`);
        const item = node.getComponent(TileItem);
        if (item) {
            item.applyVisual(normal, lockedFrame, locked);
            return;
        }
        const frame = locked ? lockedFrame || normal : normal || lockedFrame;
        let sp = node.getComponent(Sprite) || node.getChildByName('Body')?.getComponent(Sprite);
        if (!sp) {
            sp = node.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
        }
        if (frame) {
            sp.spriteFrame = frame;
            sp.color = locked ? new Color(210, 210, 210, 255) : Color.WHITE;
        } else {
            sp.color = colorFromHex(ITEM_MAP[typeId]?.color || '#CCCCCC');
        }
        ensureUI(node, Design.tileSize, Design.tileSize);
    }

    private getLevel(id: number): LevelJson {
        if (this.levelCache.has(id)) return this.levelCache.get(id)!;
        // fallback embedded tiny level
        return {
            id,
            title: `第${id}关`,
            tiles: this.makeFallbackTiles(id),
        };
    }

    private makeFallbackTiles(id: number): LevelJson['tiles'] {
        const types = ['book_red', 'book_blue', 'book_green', 'book_yellow', 'bear'];
        const n = 6 + Math.min(id, 8);
        const tiles: LevelJson['tiles'] = [];
        const bag: string[] = [];
        for (let i = 0; i < n; i++) {
            const t = types[i % types.length];
            bag.push(t, t, t);
        }
        bag.forEach((type, i) => {
            const layer = i % 3;
            const col = i % 4;
            const row = Math.floor(i / 4) % 3;
            tiles.push({ type, col, row, layer });
        });
        return tiles;
    }

    // ---------------- Home ----------------
    private showHome() {
        this.clearPage();
        this.page = 'home';
        const p = this.pageRoot;
        const save = SaveData.load();
        const lv = Math.max(1, Math.min(Design.totalLevels, save.maxUnlocked));
        const verse = getVerseForLevel(lv);

        const visH = this.getVisibleDesignHeight();
        const half = visH * 0.5;
        this.drawHomeAtmosphere(p, visH);

        // 整块内容按固定间距堆叠后垂直居中（不再顶底拉开）
        const brandH = 54;
        const tagH = 24;
        const hookH = 22;
        const ctaH = 92;
        const linksH = 32;
        const footH = 22;
        // 四大模块：标题块 / 主视觉 / CTA / 底链 —— 模块间距拉开
        const gapBrandTag = 8;
        const gapTagHook = 6;
        const gapHookHero = 36;
        const gapHeroCta = 40;
        const gapCtaLinks = 32;
        const gapLinksFoot = 12;
        const heroH = Math.min(300, Math.max(240, visH * 0.28));
        const totalH =
            brandH +
            gapBrandTag +
            tagH +
            gapTagHook +
            hookH +
            gapHookHero +
            heroH +
            gapHeroCta +
            ctaH +
            gapCtaLinks +
            linksH +
            gapLinksFoot +
            footH;

        const safeTop = Math.min(half - 36, this.getWechatCapsuleAlignY() ?? half - 44);
        const safeBot = -half + 16;
        let shiftY = 0;
        const topEdge = totalH * 0.5;
        const botEdge = -totalH * 0.5;
        if (topEdge > safeTop) shiftY = safeTop - topEdge;
        if (botEdge + shiftY < safeBot) shiftY = safeBot - botEdge;

        let cursor = totalH * 0.5 + shiftY;
        const brandY = cursor - brandH * 0.5;
        cursor -= brandH + gapBrandTag;
        const tagY = cursor - tagH * 0.5;
        cursor -= tagH + gapTagHook;
        const hookY = cursor - hookH * 0.5;
        cursor -= hookH + gapHookHero;
        const heroY = cursor - heroH * 0.5;
        cursor -= heroH + gapHeroCta;
        const ctaY = cursor - ctaH * 0.5;
        cursor -= ctaH + gapCtaLinks;
        const linksY = cursor - linksH * 0.5;
        cursor -= linksH + gapLinksFoot;
        const footY = cursor - footH * 0.5;

        const ink = '#2F2118';
        const lacquer = '#C45C3A';

        const brandLab = addLabel(p, 'brand', '架了个架', 54, ink, 640, brandH, true);
        brandLab.spacingX = 6;
        const brand = brandLab.node;
        brand.setPosition(0, brandY, 0);

        // 品牌下细金线
        const rule = makeNode('rule', p, 160, 8);
        rule.setPosition(0, brandY - brandH * 0.5 - 2, 0);
        const rg = rule.addComponent(Graphics);
        rg.strokeColor = colorFromHex('#C4A36A', 200);
        rg.lineWidth = 1.5;
        rg.moveTo(-70, 0);
        rg.lineTo(70, 0);
        rg.stroke();
        rg.fillColor = colorFromHex('#C4A36A', 220);
        rg.circle(0, 0, 2.5);
        rg.fill();

        const tagLab = addLabel(p, 'tag', '书架盲盒馆', 22, lacquer, 400, tagH, true);
        tagLab.spacingX = 4;
        const tag = tagLab.node;
        tag.setPosition(0, tagY, 0);

        const hook = addLabel(
            p,
            'hook',
            `按序点亮「${verse.title}」 · 错字进散页匣`,
            17,
            '#8A7460',
            600,
            hookH,
            true,
        ).node;
        hook.setPosition(0, hookY, 0);

        const { root: hero } = this.drawHomeHero(p, heroY, heroH);
        hero.addComponent(BlockInputEvents);
        hero.on(Node.EventType.TOUCH_END, () => this.showCatalog());
        const giftNode = hero.getChildByName('gift');
        if (giftNode) {
            giftNode.addComponent(BlockInputEvents);
            giftNode.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
                e.propagationStopped = true;
                this.showCatalog();
            });
        }

        const startBtn = this.drawHomePrimaryCta(
            p,
            '点亮书架',
            `第 ${lv} 关　·　${verse.title}`,
            () => {
                this.leisureMode = false;
                this.enterGame(lv);
            },
        );
        startBtn.setPosition(0, ctaY, 0);

        const links = this.drawHomeTextLinks(
            p,
            [
                { name: '选关', fn: () => this.showLevelPickPopup() },
                { name: '图鉴', fn: () => this.showCatalog() },
                { name: '文藏', fn: () => this.showLibrary('poem') },
                { name: '休闲', fn: () => this.onLeisureMode() },
                { name: '设置', fn: () => this.showSettings() },
            ],
            118,
        );
        links.setPosition(0, linksY, 0);

        const foot = addLabel(p, 'foot', 'v1.0.0　·　无账号 · 无存档', 14, '#A09080', 560, footH, true);
        foot.node.setPosition(0, footY, 0);
        foot.node.addComponent(BlockInputEvents);
        foot.node.on(Node.EventType.TOUCH_END, () => this.showLegalPopup());

        popIn(brand, 0.02, 0.88);
        popIn(rule, 0.06, 0.5);
        popIn(tag, 0.08, 0.92);
        popIn(hook, 0.1, 0.94);
        popIn(hero, 0.12, 0.86);
        popIn(startBtn, 0.2, 0.78);
        popIn(links, 0.26, 0.92);

        idleFloat(hero, 5, 2.4, 0.3);
        idleBreathe(startBtn, 0.014, 1.6, 0.6);
    }

    private drawHomePrimaryCta(parent: Node, title: string, sub: string, onClick: () => void): Node {
        const w = 520;
        const h = 92;
        const node = makeNode('start', parent, w, h);
        const g = node.addComponent(Graphics);
        // 木色底托
        g.fillColor = colorFromHex('#6B4A2E', 40);
        g.roundRect(-w * 0.5 + 4, -h * 0.5 - 4, w - 8, h, 22);
        g.fill();
        // 漆面主体
        g.fillColor = colorFromHex('#C45C3A');
        g.roundRect(-w * 0.5, -h * 0.5, w, h, 22);
        g.fill();
        // 上部柔亮
        g.fillColor = colorFromHex('#E07858');
        g.roundRect(-w * 0.5 + 3, -h * 0.5 + 4, w - 6, h * 0.48, 18);
        g.fill();
        // 金边
        g.strokeColor = colorFromHex('#E8C98A');
        g.lineWidth = 1.8;
        g.roundRect(-w * 0.5 + 2, -h * 0.5 + 2, w - 4, h - 4, 20);
        g.stroke();
        const t = addLabel(node, 't', title, 34, '#FFF8F0', w - 24, 42, true);
        t.spacingX = 4;
        t.node.setPosition(0, 12, 0);
        addLabel(node, 's', sub, 18, '#FFE8D8', w - 40, 28, true).node.setPosition(0, -22, 0);
        node.addComponent(BlockInputEvents);
        node.on(Node.EventType.TOUCH_START, () => {
            tween(node).to(Anim.btnMs, { scale: new Vec3(0.97, 0.97, 1) }, { easing: 'quadOut' }).start();
        });
        node.on(Node.EventType.TOUCH_CANCEL, () => {
            tween(node).to(Anim.btnMs, { scale: new Vec3(1, 1, 1) }).start();
        });
        node.on(Node.EventType.TOUCH_END, () => {
            tween(node)
                .to(Anim.btnMs, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                .call(onClick)
                .start();
        });
        return node;
    }

    /** 轻量文字入口，项间细点分隔 */
    private drawHomeTextLinks(
        parent: Node,
        items: { name: string; fn: () => void }[],
        step = 200,
    ): Node {
        const root = makeNode('links', parent, 640, 40);
        const g = root.addComponent(Graphics);
        items.forEach((it, i) => {
            const x = (i - (items.length - 1) / 2) * step;
            if (i > 0) {
                const mid = x - step * 0.5;
                g.fillColor = colorFromHex('#C4A36A', 140);
                g.circle(mid, 0, 2);
                g.fill();
            }
            const lab = addLabel(root, `l${i}`, it.name, 20, '#5C4030', Math.min(200, step - 8), 36, true);
            lab.node.setPosition(x, 0, 0);
            lab.node.addComponent(BlockInputEvents);
            lab.node.on(Node.EventType.TOUCH_END, () => it.fn());
        });
        return root;
    }

    private showLevelPickPopup() {
        const save = SaveData.load();
        const max = Math.max(1, save.maxUnlocked);
        const mask = fadeMask(this.overlayRoot, true);
        const panel = addBg(this.overlayRoot, 'levels', 600, 640, Colors.panel, 20);
        popupScaleIn(panel);
        strokeRect(panel.getComponent(Graphics)!, 600, 640, Colors.boardBorder, 2, 20);
        addLabel(panel, 't', '选择关卡', 34, Colors.brown, 500, 48, true).node.setPosition(0, 265, 0);
        addLabel(panel, 'h', `已解锁 1–${max} 关 · 点选即开局`, 20, Colors.text, 480, 28, true).node.setPosition(
            0,
            220,
            0,
        );

        const grid = makeNode('grid', panel, 540, 420);
        grid.setPosition(0, -10, 0);
        const showCount = Math.min(Design.totalLevels, Math.max(max + 2, 12));
        for (let id = 1; id <= showCount; id++) {
            const col = (id - 1) % 5;
            const row = Math.floor((id - 1) / 5);
            const unlocked = id <= max;
            const stars = SaveData.getLevel(id).stars || 0;
            const cell = addBg(grid, `lv${id}`, 92, 92, unlocked ? Colors.btnMain : '#E8E2D5', 14);
            cell.setPosition(-216 + col * 108, 150 - row * 100, 0);
            strokeRect(cell.getComponent(Graphics)!, 92, 92, Colors.brown, 1.5, 14);
            addLabel(cell, 'n', `${id}`, 26, unlocked ? Colors.brown : Colors.text, 60, 36, true).node.setPosition(
                0,
                12,
                0,
            );
            addLabel(
                cell,
                's',
                unlocked ? '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars)) : '锁',
                unlocked ? 14 : 18,
                unlocked ? Colors.star : Colors.text,
                80,
                24,
                true,
            ).node.setPosition(0, -22, 0);
            if (unlocked) {
                cell.addComponent(BlockInputEvents);
                cell.on(Node.EventType.TOUCH_END, () => {
                    mask.destroy();
                    panel.destroy();
                    this.leisureMode = false;
                    this.enterGame(id);
                });
            }
        }

        addButton(panel, 'close', '关闭', 200, 56, Colors.btnShare, () => {
            mask.destroy();
            panel.destroy();
        }, { fontSize: 26, textHex: Colors.brown }).node.setPosition(0, -280, 0);
    }

    private onLeisureMode() {
        const unlocked = Math.max(1, SaveData.load().maxUnlocked);
        const mask = fadeMask(this.overlayRoot, true);
        const panel = addBg(this.overlayRoot, 'leisure', 560, 400, Colors.panel, 20);
        popupScaleIn(panel);
        strokeRect(panel.getComponent(Graphics)!, 560, 400, Colors.boardBorder, 2, 20);
        addLabel(panel, 't', '休闲模式', 34, Colors.brown, 480, 48, true).node.setPosition(0, 140, 0);
        addLabel(
            panel,
            'd',
            '重温已解锁关卡，通关不推进主线\n开局额外赠送 1 次局内免费道具',
            22,
            Colors.text,
            500,
            70,
            true,
        ).node.setPosition(0, 60, 0);

        const close = () => {
            mask.destroy();
            panel.destroy();
        };
        const startLeisure = (id: number) => {
            close();
            this.leisureMode = true;
            this.tip(`休闲 · 第 ${id} 关`);
            this.enterGame(id);
            // enterGame 后补一次免费道具
            this.game.freePropsLeft += 1;
            this.refreshEconomyHud();
        };

        addButton(panel, 'rand', '随机一关', 240, 72, Colors.btnMain, () => {
            const pick = 1 + Math.floor(Math.random() * unlocked);
            startLeisure(pick);
        }, { fontSize: 28, textHex: Colors.brown }).node.setPosition(-120, -40, 0);

        addButton(panel, 'last', '重温当前关', 240, 72, Colors.btnAd, () => {
            startLeisure(unlocked);
        }, { fontSize: 26, textHex: Colors.brown }).node.setPosition(120, -40, 0);

        addButton(panel, 'close', '返回', 200, 56, Colors.btnShare, close, {
            fontSize: 26,
            textHex: Colors.brown,
        }).node.setPosition(0, -130, 0);
    }

    private showLegalPopup() {
        const mask = fadeMask(this.overlayRoot, true);
        const panel = addBg(this.overlayRoot, 'legal', 560, 420, Colors.panel, 20);
        popupScaleIn(panel);
        addLabel(panel, 't', '隐私与用户协议', 32, Colors.brown, 500, 44, true).node.setPosition(0, 150, 0);
        addLabel(
            panel,
            'body',
            '隐私：无账号、无云存档、不采集通讯录或精确位置。\n进度仅在本次打开期间有效，关闭后重新开始。\n\n用户：本作为休闲益智游戏，含激励视频广告，无强制内购。\n请适度游戏，保护视力。',
            22,
            Colors.text,
            500,
            220,
            true,
        ).node.setPosition(0, 10, 0);
        addButton(panel, 'ok', '我知道了', 240, 64, Colors.btnMain, () => {
            mask.destroy();
            panel.destroy();
        }, { textHex: Colors.brown }).node.setPosition(0, -150, 0);
        mask.on(Node.EventType.TOUCH_END, () => {
            mask.destroy();
            panel.destroy();
        });
    }

    private drawDecorGift(parent: Node, x: number, y: number): Node {
        const gift = makeNode('gift', parent, 100, 100);
        gift.setPosition(x, y, 0);
        const gg = gift.addComponent(Graphics);
        // 漆匣 + 金丝带
        gg.fillColor = colorFromHex('#3D2A1F', 35);
        gg.roundRect(-36, -36, 76, 16, 6);
        gg.fill();
        fillRect(gg, 78, 62, '#C45C3A', 10);
        gg.fillColor = colorFromHex('#E07858', 120);
        gg.roundRect(-36, 2, 72, 22, 6);
        gg.fill();
        gg.fillColor = colorFromHex('#E8C98A');
        gg.roundRect(-9, -38, 18, 76, 4);
        gg.fill();
        gg.roundRect(-38, -9, 76, 18, 4);
        gg.fill();
        gg.fillColor = colorFromHex('#F0D8A0');
        gg.circle(-15, 34, 9);
        gg.fill();
        gg.circle(15, 34, 9);
        gg.fill();
        gg.circle(0, 28, 6);
        gg.fill();
        gg.strokeColor = colorFromHex('#E8C98A', 180);
        gg.lineWidth = 1.5;
        gg.roundRect(-39, -31, 78, 62, 10);
        gg.stroke();
        return gift;
    }

    // ---------------- Catalog ----------------
    private showCatalog() {
        this.clearPage();
        this.page = 'catalog';
        const p = this.pageRoot;

        addCircleBtn(p, 'back', '←', 64, () => this.showHome()).setPosition(-300, 540, 0);
        addLabel(p, 'title', '盲盒图鉴', 36, Colors.brown, 400, 50, true).node.setPosition(0, 540, 0);

        const grid = makeNode('grid', p, 640, 900);
        grid.setPosition(0, -20, 0);
        ITEMS.forEach((item, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const cell = addBg(grid, item.id, 280, 140, Colors.panel, 12);
            cell.setPosition(col === 0 ? -150 : 150, 380 - row * 155, 0);
            strokeRect(cell.getComponent(Graphics)!, 280, 140, Colors.slotBorder, 2, 12);
            const cube = makeNode('cube', cell, 90, 90);
            cube.setPosition(-80, 0, 0);
            this.applyTileSprite(cube, item.id, false);
            ensureUI(cube, 90, 90);
            addLabel(cell, 'name', item.name, 26, Colors.title, 160, 40, true).node.setPosition(50, 20, 0);
            addLabel(cell, 'tag', `第${item.unlockLevel}关出现`, 18, Colors.text, 160, 30).node.setPosition(
                50,
                -20,
                0,
            );
        });
    }

    /** 文藏馆：古诗 / 名言 / 文言文（全部可浏览） */
    private showLibrary(tab: VerseKind = 'poem') {
        this.clearPage();
        this.page = 'library';
        const p = this.pageRoot;
        const list = versesByKind(tab);

        addCircleBtn(p, 'back', '←', 64, () => this.showHome()).setPosition(-300, 540, 0);
        addLabel(p, 'title', '文藏馆', 34, Colors.brown, 360, 50, true).node.setPosition(0, 540, 0);
        addLabel(p, 'prog', `${list.length} 篇`, 20, Colors.highlight, 200, 36, true).node.setPosition(270, 540, 0);

        const tabs: { id: VerseKind; name: string }[] = [
            { id: 'poem', name: '古诗' },
            { id: 'quote', name: '名言' },
            { id: 'prose', name: '文言文' },
        ];
        tabs.forEach((t, i) => {
            addButton(
                p,
                `tab_${t.id}`,
                t.name,
                160,
                48,
                tab === t.id ? Colors.btnAd : Colors.btnShare,
                () => this.showLibrary(t.id),
                { fontSize: 22, textHex: Colors.brown },
            ).node.setPosition(-170 + i * 170, 460, 0);
        });

        addLabel(p, 'hint', `${verseKindLabel(tab)} · 点击阅读`, 18, Colors.text, 560, 28, true).node.setPosition(
            0,
            400,
            0,
        );

        const board = addBg(p, 'board', 640, 820, Colors.panel, 16);
        board.setPosition(0, -50, 0);

        const viewH = 780;
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
            onTapWithoutScroll(cell, () => this.showVerseDetail(v));
        });
    }

    private showVerseDetail(v: Verse) {
        const mask = fadeMask(this.overlayRoot, true);
        const panel = addBg(this.overlayRoot, 'verseDetail', 600, 520, Colors.panel, 16);
        popupScaleIn(panel);
        addLabel(panel, 'kind', verseKindLabel(v.kind), 20, Colors.highlight, 200, 30, true).node.setPosition(0, 210, 0);
        addLabel(panel, 't', v.title, 34, Colors.brown, 520, 44, true).node.setPosition(0, 160, 0);
        addLabel(panel, 'm', `${v.source} · ${v.author}`, 22, Colors.text, 400, 32, true).node.setPosition(0, 110, 0);
        addLabel(panel, 'body', v.lines.join('\n'), 26, Colors.brown, 520, 220, true).node.setPosition(0, -20, 0);
        addButton(panel, 'close', '关闭', 200, 64, Colors.btnMain, () => {
            mask.destroy();
            panel.destroy();
        }, { textHex: Colors.brown }).node.setPosition(0, -200, 0);
        addButton(panel, 'read', '再朗诵', 200, 64, Colors.btnAd, () => {
            this.speakPoem(v);
        }, { textHex: Colors.brown }).node.setPosition(0, -280, 0);
    }

    // ---------------- Settings / About ----------------
    private showSettings() {
        this.clearPage();
        this.page = 'settings';
        const p = this.pageRoot;
        addCircleBtn(p, 'back', '←', 64, () => this.showHome()).setPosition(-300, 540, 0);
        addLabel(p, 'title', '设置', 36, Colors.brown, 400, 50, true).node.setPosition(0, 540, 0);

        const list = [
            {
                name: '音效',
                action: () => {
                    const on = !SaveData.load().soundOn;
                    SaveData.setSound(on);
                    this.showSettings();
                },
                right: SaveData.load().soundOn ? '开' : '关',
            },
            { name: '用户协议', action: () => this.showLegalPopup(), right: '>' },
            { name: '隐私协议', action: () => this.showLegalPopup(), right: '>' },
            { name: '关于游戏', action: () => this.showAbout(), right: 'i' },
        ];

        list.forEach((item, i) => {
            const row = addBg(p, `row${i}`, 640, 88, Colors.panel, 12);
            row.setPosition(0, 380 - i * 100, 0);
            addLabel(row, 'n', item.name, 28, Colors.title, 400, 40, true).node.setPosition(-80, 0, 0);
            if (item.name === '音效') {
                const tog = addBg(
                    row,
                    'tog',
                    72,
                    36,
                    SaveData.load().soundOn ? Colors.highlight : Colors.btnDisabled,
                    18,
                );
                tog.setPosition(240, 0, 0);
            } else {
                addLabel(row, 'r', item.right, 28, Colors.text, 60, 40).node.setPosition(250, 0, 0);
            }
            row.addComponent(BlockInputEvents);
            row.on(Node.EventType.TOUCH_END, item.action);
        });
    }

    private showAbout() {
        this.clearPage();
        this.page = 'about';
        const p = this.pageRoot;
        addCircleBtn(p, 'back', '←', 64, () => this.showSettings()).setPosition(-300, 540, 0);
        addLabel(p, 'title', '关于游戏', 36, Colors.brown, 400, 50, true).node.setPosition(0, 540, 0);
        addLabel(p, 'name', '架了个架-书架盲盒馆 v1.0.0', 28, Colors.title, 600, 50, true).node.setPosition(0, 200, 0);
        addLabel(
            p,
            'desc',
            '翻开顶层盲盒得字，按诗句顺序点亮；错字进散页匣',
            24,
            Colors.text,
            600,
            120,
        ).node.setPosition(0, 80, 0);
        addLabel(p, 'copy', '©2026', 20, Colors.text, 200, 30).node.setPosition(0, -500, 0);
    }

    /**
     * 当前可见高度（设计坐标）。FIXED_WIDTH 下不同机型高宽比不同，
     * 对局页必须按可见高度排版，才能一屏放下。
     */
    private getVisibleDesignHeight(): number {
        try {
            const vs = view.getVisibleSize();
            if (vs?.height > 200) return vs.height;
        } catch {
            /* ignore */
        }
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const wxApi = (globalThis as any).wx;
            const info = wxApi?.getWindowInfo?.() ?? wxApi?.getSystemInfoSync?.();
            const winW = info?.windowWidth || info?.screenWidth;
            const winH = info?.windowHeight || info?.screenHeight;
            if (winW && winH) return (winH * Design.width) / winW;
        } catch {
            /* ignore */
        }
        return Design.height;
    }

    // ---------------- Game ----------------
    private enterGame(levelId: number) {
        this.currentLevel = levelId;
        this.clearPage();
        this.page = 'game';
        const p = this.pageRoot;
        const L = this.mockLayout;
        const bw = Math.min(L?.board?.w ?? Design.boardW, Design.width - 48);
        const data = this.getLevel(levelId);
        const verse = getVerseForLevel(data.id);

        this.hudLayer = makeNode('hud', p);

        // —— 一屏垂直栈：顶栏 → 诗笺 → 棋盘 → 散页匣 → 道具 ——
        const visH = this.getVisibleDesignHeight();
        const half = visH * 0.5;
        const gap = 8;
        const bottomPad = 14;
        const headerBlock = 50;
        const poemH = this.measurePoemHudHeight(verse);
        const trayH = 120;
        const toolH = 68;
        const toolW = 148;

        const capsuleY = this.getWechatCapsuleAlignY();
        const titleY = Math.min(capsuleY ?? half - 52, half - 44);
        const btnSize = this.getWechatCapsuleBtnSize(Math.max(52, L?.back?.w ?? 56));
        const backX = L?.back?.x ?? -(bw * 0.5 - 8);

        addCircleBtn(this.hudLayer, 'back', '←', btnSize, () => this.showHome()).setPosition(backX, titleY, 0);
        addLabel(this.hudLayer, 'title', `第${data.id}关`, 26, Colors.brown, 280, 40, true).node.setPosition(
            -16,
            titleY,
            0,
        );
        const tier = difficultyTier(data.id);
        const eco = addLabel(this.hudLayer, 'economy', '', 17, Colors.text, 500, 26, true);
        eco.node.setPosition(-16, titleY - 30, 0);
        this.economyHudLabel = eco;

        const toolY = -half + bottomPad + toolH * 0.5;
        const slotY = toolY + toolH * 0.5 + gap + trayH * 0.5;
        const poemTop = titleY - headerBlock;
        const poemY = poemTop - poemH * 0.5;
        const boardTop = poemY - poemH * 0.5 - gap;
        const boardBottom = slotY + trayH * 0.5 + gap;
        const bh = Math.max(300, boardTop - boardBottom);
        const boardY = (boardTop + boardBottom) * 0.5;

        this.game.loadLevel(data, bw, bh);
        this.boardLayer = makeNode('board', p, bw, bh);
        this.boardLayer.setPosition(0, boardY, 0);
        this.slotLayer = makeNode('tray', p);
        this.slotLayer.setPosition(0, slotY, 0);
        this.parkLayer = makeNode('park', p);
        this.parkLayer.active = false;

        this.poemChars = this.game.targetChars.slice();
        this.poemRevealed = this.game.poemRevealed;
        this.refreshEconomyHud(tier);

        const frame = addBg(this.boardLayer, 'frame', bw, bh, Colors.panelGame, 22);
        frame.setSiblingIndex(0);
        strokeRect(frame.getComponent(Graphics)!, bw, bh, Colors.boardBorder, 2.5, 22);
        this.disableHit(frame);

        this.buildPoemHud(verse, bw - 28, poemY, poemH);
        this.buildTrayUI(bw + 20, trayH);
        this.spawnTiles();
        this.bindBoardInput();
        this.buildTools(toolY, toolW, toolH);
        this.refreshTrayVisuals();
        this.refreshTileStates();

        this.hudLayer.setSiblingIndex(p.children.length - 1);
        const next = this.game.currentTarget();
        this.tip(next ? `点亮书架：下一字「${next}」` : '理完架上剩余盲盒');
    }

    /** 诗笺高度：尽量压扁，保证一屏 */
    private measurePoemHudHeight(verse: Verse): number {
        const lineCount = Math.min(4, Math.max(1, verse.lines.length));
        const padY = 8;
        const headH = 30;
        const bodyH = lineCount * 20 + 2;
        const footH = 12;
        return padY + headH + bodyH + footH + padY;
    }

    /** 让节点不参与 UI 点击检测 */
    private disableHit(node: Node) {
        const ui = node.getComponent(UITransform);
        if (ui) {
            // Cocos 3.8：将命中盒置空，仅保留显示
            (ui as UITransform & { hitTest?: (p: unknown) => boolean }).hitTest = () => false;
        }
        node.children.forEach((c) => this.disableHit(c));
    }

    private bindBoardInput() {
        // 不再使用全屏 pad 算坐标（易偏移点到旁边）
        // 改为每个方块自己接收点击；清掉旧 pad
        const pad = this.boardLayer.getChildByName('inputPad');
        if (pad) pad.destroy();
    }

    private bindTileTouch(node: Node, tileId: string) {
        node.off(Node.EventType.TOUCH_END);
        const tile = this.game.tiles.find((t) => t.id === tileId);
        const item = node.getComponent(TileItem);
        item?.bindRefs();
        const clickable = !!tile && this.game.isClickable(tile);

        if (!clickable) {
            // 被压住：不接点击，等上层消完再开放
            node.off(Node.EventType.TOUCH_END);
            const bie = node.getComponent(BlockInputEvents);
            if (bie) bie.destroy();
            if (item) item.disableRootHit();
            else {
                const ut = node.getComponent(UITransform);
                if (ut) {
                    ut.setContentSize(0, 0);
                    (ut as UITransform & { hitTest: () => boolean }).hitTest = () => false;
                }
            }
            // Body 只关命中，保留尺寸以免贴图被压没
            node.children.forEach((c) => {
                const cut = c.getComponent(UITransform);
                if (cut) (cut as UITransform & { hitTest: () => boolean }).hitTest = () => false;
            });
            return;
        }

        if (item) item.enableRootHit();
        else {
            const ut = node.getComponent(UITransform);
            if (ut) {
                ut.setContentSize(Design.tileSize, Design.tileSize);
                delete (ut as UITransform & { hitTest?: unknown }).hitTest;
            }
        }
        // Body 始终不命中
        const body = node.getChildByName('Body');
        const but = body?.getComponent(UITransform);
        if (but) (but as UITransform & { hitTest: () => boolean }).hitTest = () => false;

        if (!node.getComponent(BlockInputEvents)) node.addComponent(BlockInputEvents);
        node.on(
            Node.EventType.TOUCH_END,
            (e: EventTouch) => {
                e.propagationStopped = true;
                if (this.busy || this.page !== 'game' || this.game.phase !== 'playing') return;
                const t = this.game.tiles.find((x) => x.id === tileId);
                if (t && this.game.isClickable(t)) {
                    void this.onTileClick(t.id);
                    return;
                }
                this.tip('先拿走压在上面的物品');
            },
            this,
        );
    }

    private buildTrayUI(trayW = 660, trayH = 120) {
        this.slotNodes = [];
        const n = this.game.traySize;
        const tray = addBg(this.slotLayer, 'trayBg', trayW, trayH, Colors.slotTray, 16);
        strokeRect(tray.getComponent(Graphics)!, trayW, trayH, Colors.boardBorder, 2, 16);
        this.disableHit(tray);
        addLabel(this.slotLayer, 'trayTitle', '散页匣', 18, Colors.brown, 120, 28, true).node.setPosition(
            -trayW * 0.5 + 56,
            trayH * 0.5 - 16,
            0,
        );

        const pad = 12;
        const innerW = trayW - pad * 2;
        const gap = innerW / n;
        const slotSize = Math.min(84, gap - 6);
        this.slotFitScale = Math.min(Design.slotScale, (slotSize * 0.72) / Design.tileSize);
        for (let i = 0; i < n; i++) {
            const slot = makeNode(`tray${i}`, this.slotLayer, slotSize, slotSize);
            slot.setPosition((i - (n - 1) / 2) * gap, -4, 0);
            const g = slot.addComponent(Graphics);
            drawIsoSlot(g, slotSize * 0.92, Colors.slotEmpty, Colors.slotBorder, 2.2);
            this.disableHit(slot);
            this.slotNodes.push(slot);
        }
    }

    private getSlotScale() {
        return this.slotFitScale || Design.slotScale;
    }

    private getBoardScale() {
        return this.game?.boardScale || 1;
    }

    private buildTools(toolY = -520, toolW = 148, toolH = 68) {
        const xs = [-1.5, -0.5, 0.5, 1.5].map((i) => i * (toolW + 12));
        const keys = ['undo', 'hint', 'tidy', 'share'];
        const labels: Record<string, string> = {
            undo: '撤回',
            hint: '提示',
            tidy: '整理匣',
            share: '分享',
        };

        keys.forEach((key, i) => {
            const isShare = key === 'share';
            const btn = addButton(
                this.hudLayer,
                key,
                labels[key] || key,
                toolW,
                toolH,
                isShare ? Colors.btnShare : Colors.btnMain,
                () => this.onTool(key),
                { fontSize: 26, textHex: Colors.brown, radius: 16 },
            );
            btn.node.setPosition(xs[i], toolY, 0);
            if (key === 'undo') {
                this.undoBtn = btn;
                btn.setEnabled(false);
            }
        });
    }

    private spawnTiles() {
        this.boardLayer.children.slice().forEach((c) => {
            if (c.name !== 'frame') c.destroy();
        });
        this.tileNodes.clear();

        for (const tile of this.game.tiles) {
            if (tile.removed || tile.inTray) continue;
            const n = this.createTileNode(tile);
            this.boardLayer.addChild(n);
            n.setPosition(tile.x, tile.y, 0);
            this.tileNodes.set(tile.id, n);
        }
        this.refreshTileStates();
    }

    private createTileNode(tile: TileModel): Node {
        const item = TileItem.create(null, this.tilePrefab, tile.id);
        item.setup(
            tile.id,
            tile.type,
            this.tileFrames.get(tile.type),
            this.tileFrames.get(`${tile.type}_locked`),
            false,
        );
        this.bindTileTouch(item.node, tile.id);
        return item.node;
    }

    private refreshTileStates() {
        const boardTiles = this.game.tiles.filter((t) => !t.removed && !t.inTray);
        const ordered = [...boardTiles].sort((a, b) => {
            if (a.layer !== b.layer) return a.layer - b.layer;
            if (a.y !== b.y) return b.y - a.y;
            return a.x - b.x;
        });

        ordered.forEach((tile, i) => {
            const n = this.tileNodes.get(tile.id);
            if (!n || !n.isValid) return;
            const bs = this.getBoardScale();
            if (n.parent !== this.boardLayer) {
                n.parent = this.boardLayer;
            }
            n.setScale(bs, bs, 1);
            n.active = true;
            n.setPosition(tile.x, tile.y, 0);
            const covered = this.game.isCovered(tile);
            this.applyTileSprite(n, tile.type, covered);
            setOpacity(n, covered ? Math.floor(255 * Design.coveredAlpha) : 255);
            n.setSiblingIndex(10 + i);
            this.bindTileTouch(n, tile.id);
        });
        if (this.undoBtn) this.undoBtn.setEnabled(this.game.canUndo());
    }

    private refreshTrayVisuals() {
        this.game.compactTray();
        for (const slot of this.slotNodes) {
            slot.children.slice().forEach((c) => c.removeFromParent());
        }

        this.game.tray.forEach((tile, i) => {
            if (!tile || tile.removed || !this.slotNodes[i]) return;
            let n = this.tileNodes.get(tile.id);
            if (!n || !n.isValid) {
                n = this.createTileNode(tile);
                this.tileNodes.set(tile.id, n);
            }
            n.active = true;
            n.setParent(this.slotNodes[i], false);
            n.setPosition(0, 0, 0);
            const ss = this.getSlotScale();
            n.setScale(ss, ss, 1);
            n.setRotationFromEuler(0, 0, 0);
            this.applyTileSprite(n, tile.type, false);
            setOpacity(n, 255);
            n.name = `tray_${tile.id}`;
            let gly = n.getChildByName('GlyphLab');
            if (!gly) {
                const lab = addLabel(n, 'GlyphLab', tile.glyph, 36, Colors.brown, 80, 48, true);
                gly = lab.node;
            } else {
                const lab = gly.getComponent(Label);
                if (lab) lab.string = tile.glyph;
            }
            gly.setPosition(0, 8, 0);
            const body = n.getChildByName('Body');
            if (body) {
                body.setPosition(0, 0, 0);
                body.setScale(1, 1, 1);
            }
            this.bindTrayTouch(n, tile.id);
        });
    }

    private bindTrayTouch(node: Node, tileId: string) {
        node.off(Node.EventType.TOUCH_END);
        if (!node.getComponent(BlockInputEvents)) node.addComponent(BlockInputEvents);
        node.on(
            Node.EventType.TOUCH_END,
            (e: EventTouch) => {
                e.propagationStopped = true;
                void this.onTrayClick(tileId);
            },
            this,
        );
    }

    private async onTrayClick(tileId: string) {
        if (this.busy || this.game.phase !== 'playing') return;
        const tile = this.game.tiles.find((t) => t.id === tileId);
        if (!tile || !this.game.isTrayClickable(tile)) return;

        this.busy = true;
        try {
            const before = this.game.poemRevealed;
            const result = this.game.pickFromTray(tileId);
            if (!result.ok) {
                this.tip(`当前要点亮「${this.game.currentTarget() || '…'}」`);
                return;
            }
            const n = this.tileNodes.get(tileId);
            if (n?.isValid && (result.kind === 'light' || result.kind === 'clean')) {
                await this.playGlyphResolve(n, result.glyph || tile.glyph, result.kind === 'light');
                n.destroy();
                this.tileNodes.delete(tileId);
            }
            this.poemRevealed = this.game.poemRevealed;
            if (result.kind === 'light' && result.litChar) {
                this.onGlyphLit(result.litChar);
            }
            this.refreshTrayVisuals();
            this.refreshTileStates();
            this.afterFlipResolve();
        } finally {
            this.busy = false;
        }
    }

    private async onTileClick(tileId: string) {
        if (this.busy || this.game.phase !== 'playing') return;
        const tile = this.game.tiles.find((t) => t.id === tileId);
        if (!tile || !this.game.isClickable(tile)) return;

        const n = this.tileNodes.get(tileId);
        if (!n) return;

        this.busy = true;
        try {
            const bs = this.getBoardScale();
            await this.tweenPromise(
                tween(n)
                    .to(Anim.clickMs, {
                        scale: new Vec3(bs * 1.05, bs * 1.05, 1),
                        position: new Vec3(tile.x, tile.y + 8, 0),
                    })
                    .to(Anim.clickMs, {
                        scale: new Vec3(bs, bs, 1),
                        position: new Vec3(tile.x, tile.y, 0),
                    }),
            );

            this.flashGlyphOnTile(n, tile.glyph);

            const result = this.game.flip(tileId);
            if (!result.ok) {
                this.tip('散页匣已满');
                return;
            }

            n.active = false;
            this.refreshTileStates();
            n.active = true;

            if (result.kind === 'light' || result.kind === 'clean') {
                await this.playGlyphResolve(n, result.glyph || tile.glyph, result.kind === 'light');
                if (n.isValid) n.destroy();
                this.tileNodes.delete(tileId);
                this.poemRevealed = this.game.poemRevealed;
                if (result.kind === 'light' && result.litChar) {
                    this.onGlyphLit(result.litChar);
                }
                this.refreshTrayVisuals();
                this.refreshTileStates();
            } else if (result.kind === 'tray' || result.kind === 'fail') {
                const idx = result.trayIndex ?? 0;
                await this.flyNodeToTray(n, idx);
                this.refreshTrayVisuals();
                this.refreshTileStates();
                this.tip(`「${result.glyph}」暂入散页匣`);
            }

            this.afterFlipResolve();
        } finally {
            this.busy = false;
        }
    }

    private flashGlyphOnTile(n: Node, glyph: string) {
        const lab = addLabel(n, 'flashG', glyph, 42, Colors.brown, 90, 56, true);
        lab.node.setPosition(0, 20, 0);
        const op = lab.node.getComponent(UIOpacity) || lab.node.addComponent(UIOpacity);
        op.opacity = 255;
        tween(op).to(0.35, { opacity: 0 }).start();
        this.scheduleOnce(() => {
            if (lab.node.isValid) lab.node.destroy();
        }, 0.4);
    }

    private async playGlyphResolve(n: Node, glyph: string, lit: boolean) {
        const lab = addLabel(this.overlayRoot, 'flyG', glyph, 48, lit ? Colors.highlight : Colors.brown, 100, 60, true);
        const ui = this.overlayRoot.getComponent(UITransform)!;
        const start = ui.convertToNodeSpaceAR(n.worldPosition);
        lab.node.setPosition(start.x, start.y, 0);
        let end = new Vec3(start.x, start.y + 100, 0);
        if (lit && this.poemHudRoot?.isValid) {
            end = ui.convertToNodeSpaceAR(this.poemHudRoot.worldPosition);
        }
        await this.tweenPromise(
            tween(lab.node).to(
                0.28,
                { position: new Vec3(end.x, end.y, 0), scale: new Vec3(0.4, 0.4, 1) },
                { easing: 'quadOut' },
            ),
        );
        if (lab.node.isValid) lab.node.destroy();
    }

    private async flyNodeToTray(n: Node, insert: number) {
        const idx = Math.max(0, Math.min(insert, this.slotNodes.length - 1));
        const targetSlot = this.slotNodes[idx];
        if (!targetSlot) return;
        const startWorld = n.worldPosition.clone();
        n.setParent(this.overlayRoot, true);
        const ui = this.overlayRoot.getComponent(UITransform)!;
        n.setPosition(ui.convertToNodeSpaceAR(startWorld));
        const endLocal = ui.convertToNodeSpaceAR(targetSlot.worldPosition);
        n.setSiblingIndex(999);
        const ss = this.getSlotScale();
        await this.tweenPromise(
            tween(n).to(
                Anim.toSlotMs,
                { position: endLocal, scale: new Vec3(ss, ss, 1) },
                { easing: 'quadOut' },
            ),
        );
        n.setParent(targetSlot, false);
        n.setPosition(0, 0, 0);
        n.setScale(ss, ss, 1);
    }

    private onGlyphLit(ch: string) {
        this.poemRevealed = this.game.poemRevealed;
        this.refreshPoemHud();
        const verse = getVerseForLevel(this.currentLevel);
        const fxParent = this.boardLayer || this.overlayRoot;
        playVerseInkReveal(fxParent, 0, 40, [ch], verse.kind);
        flashVerseHud(this.poemHudRoot);
        const next = this.game.currentTarget();
        if (next) this.tip(`已点亮「${ch}」· 下一字「${next}」`);
        else this.tip('诗文已点亮，理完剩余盲盒即可通关');
    }

    private afterFlipResolve() {
        this.poemRevealed = this.game.poemRevealed;
        this.refreshPoemHud();
        if (this.game.phase === 'won') {
            this.showWin();
        } else if (this.game.phase === 'failed') {
            this.showFail();
        }
        if (this.undoBtn) this.undoBtn.setEnabled(this.game.canUndo());
    }

    private refreshPoemHud() {
        this.poemRevealed = this.game.poemRevealed;
        const verse = getVerseForLevel(this.currentLevel);
        const total = Math.max(1, this.poemChars.length);
        const got = Math.min(this.poemRevealed, total);
        const next = this.game.currentTarget();
        if (this.poemHudLabel?.isValid) {
            this.poemHudLabel.string = formatVerseProgress(verse, this.poemRevealed);
        }
        if (this.poemHudProgressLabel?.isValid) {
            this.poemHudProgressLabel.string =
                got >= total ? '已点亮全文' : next ? `下一字 ${next}` : `点亮 ${got}/${total}`;
            this.poemHudProgressLabel.color = colorFromHex(got >= total ? Colors.highlight : Colors.text);
        }
        if (this.poemHudBar?.isValid) {
            const g = this.poemHudBar;
            const barW = 180;
            const barH = 5;
            const ratio = got / total;
            g.clear();
            g.fillColor = colorFromHex('#E8DFD0');
            g.roundRect(-barW * 0.5, -barH * 0.5, barW, barH, 3);
            g.fill();
            if (ratio > 0) {
                g.fillColor = colorFromHex(got >= total ? Colors.highlight : '#D4A574');
                g.roundRect(-barW * 0.5, -barH * 0.5, Math.max(8, barW * ratio), barH, 3);
                g.fill();
            }
        }
    }

    /**
     * 文藏笺：挂在 HUD（棋盘框上方）
     * 只承载文种 / 题名出处 / 点亮正文 / 进度，不再与顶栏重复「第N关」
     */
    private buildPoemHud(verse: Verse, cardW: number, centerY: number, cardH: number) {
        const lineCount = Math.min(4, Math.max(1, verse.lines.length));
        const lineH = 20;
        const padY = 8;
        const headH = 30;
        const bodyH = lineCount * lineH + 2;

        const card = addBg(this.hudLayer, 'poemHud', cardW, cardH, '#FFFCF6', 14);
        card.setPosition(0, centerY, 0);
        strokeRect(card.getComponent(Graphics)!, cardW, cardH, '#DCCBB0', 1.5, 14);
        this.disableHit(card);
        this.poemHudRoot = card;

        const accent = makeNode('accent', card, 5, cardH - 16);
        accent.setPosition(-cardW * 0.5 + 12, 0, 0);
        const ag = accent.addComponent(Graphics);
        const accentHex = verse.kind === 'poem' ? '#C45C4A' : verse.kind === 'prose' ? '#8B3A2B' : Colors.highlight;
        ag.fillColor = colorFromHex(accentHex, 210);
        ag.roundRect(-2.5, -(cardH - 16) * 0.5, 5, cardH - 16, 2.5);
        ag.fill();

        const top = cardH * 0.5 - padY;
        const kind = verseKindLabel(verse.kind);
        const badgeW = kind.length >= 3 ? 90 : 60;
        const badge = addBg(card, 'badge', badgeW, 22, '#FFF1E0', 11);
        badge.setPosition(-cardW * 0.5 + 26 + badgeW * 0.5, top - 11, 0);
        strokeRect(badge.getComponent(Graphics)!, badgeW, 22, '#E8C9A8', 1, 11);
        addLabel(badge, 't', kind, 14, Colors.highlight, badgeW - 6, 20, true).node.setPosition(0, 0, 0);

        // 题名 + 出处同一行，居中偏右，避免与顶栏关卡号重复堆叠
        addLabel(
            card,
            'title',
            `${verse.title}　${verse.source}·${verse.author}`,
            17,
            Colors.brown,
            cardW - badgeW - 150,
            24,
            true,
        ).node.setPosition(12, top - 11, 0);

        this.poemHudProgressLabel = addLabel(card, 'prog', '', 14, Colors.text, 110, 20, true);
        this.poemHudProgressLabel.node.setPosition(cardW * 0.5 - 60, top - 11, 0);

        const bodyTop = top - headH;
        this.poemHudLabel = addLabel(
            card,
            'body',
            formatVerseProgress(verse, 0),
            18,
            Colors.brown,
            cardW - 44,
            bodyH,
            true,
        );
        this.poemHudLabel.node.setPosition(4, bodyTop - bodyH * 0.5, 0);
        this.poemHudLabel.overflow = Label.Overflow.SHRINK;
        this.poemHudLabel.lineHeight = lineH;

        const barNode = makeNode('bar', card, 180, 8);
        barNode.setPosition(0, -cardH * 0.5 + padY + 5, 0);
        this.poemHudBar = barNode.addComponent(Graphics);
        this.refreshPoemHud();
    }

    private tweenPromise(t: ReturnType<typeof tween>): Promise<void> {
        return new Promise((resolve) => {
            t.call(() => resolve()).start();
        });
    }

    private refreshEconomyHud(tier = difficultyTier(this.currentLevel)) {
        if (!this.economyHudLabel || !this.economyHudLabel.isValid) return;
        const g = this.game;
        const min = g.minAdsRequired;
        const minPart = min > 0 ? ` · 通关需广告≥${min}` : '';
        this.economyHudLabel.string = `难度${tier}  ·  免费道具 ${g.freePropsLeft}  ·  广告 ${g.adUsed}/${g.adQuota}${minPart}`;
    }

    private onTool(key: string) {
        if (this.busy) return;
        if (key === 'share') {
            this.tip('谢谢分享书架盲盒馆');
            return;
        }
        if (key === 'undo') {
            if (!this.game.canUndo()) {
                this.tip('暂无可撤回的操作');
                return;
            }
            this.requestProp('撤回', () => this.doUndo());
            return;
        }
        if (key === 'hint') {
            this.requestProp('提示', () => this.doHint());
            return;
        }
        if (key === 'tidy') {
            if (this.game.trayCount() === 0) {
                this.tip('散页匣是空的');
                return;
            }
            this.requestProp('整理匣', () => this.doTidy());
        }
    }

    private propKindFromName(propName: string): PropKind {
        if (propName.includes('提') || propName.includes('洗')) return 'shuffle';
        if (propName.includes('整') || propName.includes('移')) return 'remove';
        return 'undo';
    }

    private requestProp(propName: string, onGot: () => void) {
        const kind = this.propKindFromName(propName);
        if (SaveData.consumeProp(kind)) {
            this.game.usedProp = true;
            onGot();
            this.tip(`已使用库存【${propName}】`);
            return;
        }
        const cost = this.game.takePropCost();
        if (cost === 'free') {
            this.refreshEconomyHud();
            onGot();
            this.tip(`已使用免费【${propName}】`);
            return;
        }
        if (cost === 'none') {
            this.tip('道具与广告均已用尽');
            return;
        }
        this.showPropDialog(propName, onGot);
    }

    private showPropDialog(propName: string, onGot: () => void) {
        const mask = fadeMask(this.overlayRoot, true);
        const panel = addBg(this.overlayRoot, 'prop', 560, 320, Colors.panel, 16);
        popupSlideUp(panel, -360);
        addLabel(panel, 't', '获取道具', 32, Colors.title, 500, 50, true).node.setPosition(0, 100, 0);
        addLabel(
            panel,
            'd',
            `观看广告可获得 1 次【${propName}】\n本局广告 ${this.game.adUsed}/${this.game.adQuota}`,
            22,
            Colors.text,
            500,
            70,
            true,
        ).node.setPosition(0, 30, 0);

        const close = () => {
            mask.destroy();
            panel.destroy();
        };

        addButton(
            panel,
            'ad',
            '观看广告',
            200,
            72,
            '#F5F0E6',
            () => {
                if (!this.game.canUseAd()) {
                    this.tip('本局广告次数已达上限');
                    close();
                    return;
                }
                close();
                this.simulateAd(() => {
                    if (!this.game.spendAd()) {
                        this.tip('本局广告次数已达上限');
                        return;
                    }
                    this.game.usedProp = true;
                    this.refreshEconomyHud();
                    onGot();
                });
            },
            { textHex: Colors.brown },
        ).node.setPosition(-120, -80, 0);

        addButton(panel, 'cancel', '取消', 200, 72, Colors.btnAd, close).node.setPosition(120, -80, 0);
    }

    private simulateAd(done: () => void) {
        const mask = fadeMask(this.overlayRoot, true);
        const panel = addBg(this.overlayRoot, 'ad', 520, 240, Colors.panel, 16);
        popupScaleIn(panel);
        addLabel(panel, 't', '广告播放中…', 30, Colors.title, 480, 50, true).node.setPosition(0, 40, 0);
        addLabel(panel, 'd', '（开发环境模拟激励视频）', 22, Colors.text, 480, 40).node.setPosition(0, -10, 0);
        this.scheduleOnce(() => {
            mask.destroy();
            panel.destroy();
            done();
        }, 1.2);
    }

    /** 连续播放 n 次广告（通关补给） */
    private watchAdsSequential(times: number, onDone: () => void, index = 0) {
        if (times <= 0) {
            onDone();
            return;
        }
        if (!this.game.canUseAd()) {
            onDone();
            return;
        }
        this.simulateAd(() => {
            this.game.spendAd();
            this.refreshEconomyHud();
            const left = times - 1;
            if (left <= 0) onDone();
            else {
                this.tip(`通关补给 ${index + 1}/${index + times}`);
                this.watchAdsSequential(left, onDone, index + 1);
            }
        });
    }

    private doUndo() {
        const tile = this.game.undo();
        if (!tile) {
            this.tip('无法撤回');
            return;
        }
        this.poemRevealed = this.game.poemRevealed;
        this.refreshPoemHud();
        this.refreshTrayVisuals();
        let n = this.tileNodes.get(tile.id);
        if (!tile.removed) {
            if (!n || !n.isValid) {
                n = this.createTileNode(tile);
                this.tileNodes.set(tile.id, n);
            }
            if (!tile.inTray) {
                n.parent = this.boardLayer;
                n.active = true;
                const bs = this.getBoardScale();
                n.setScale(bs, bs, 1);
                n.setPosition(tile.x, tile.y, 0);
            }
        }
        this.refreshTileStates();
        this.refreshTrayVisuals();
        this.tip('已撤回上一步');
    }

    private doHint() {
        const id = this.game.hintTargetId();
        if (!id) {
            this.tip('没有可提示的目标字');
            return;
        }
        const tile = this.game.tiles.find((t) => t.id === id);
        const n = this.tileNodes.get(id);
        if (n?.isValid) {
            const sx = n.scale.x;
            const sy = n.scale.y;
            tween(n)
                .to(0.12, { scale: new Vec3(sx * 1.15, sy * 1.15, 1) })
                .to(0.12, { scale: new Vec3(sx, sy, 1) })
                .union()
                .repeat(2)
                .start();
        }
        this.tip(tile ? `目标「${tile.glyph}」在这里` : '已高亮目标');
        this.usedPropMark();
    }

    private doTidy() {
        const moved = this.game.clearTrayJunk(2);
        if (!moved.length) {
            this.tip('匣内没有可整理的闲字');
            return;
        }
        moved.forEach((t) => {
            const n = this.tileNodes.get(t.id);
            if (n?.isValid) {
                n.destroy();
                this.tileNodes.delete(t.id);
            }
        });
        this.refreshTrayVisuals();
        this.refreshTileStates();
        this.tip(`已整理掉 ${moved.length} 个闲字`);
        this.afterFlipResolve();
    }

    private usedPropMark() {
        this.game.usedProp = true;
    }

    private showFail() {
        const mask = fadeMask(this.overlayRoot, true);
        const panel = addBg(this.overlayRoot, 'fail', 600, 420, Colors.panel, 16);
        popupSlideUp(panel, -420);
        addLabel(panel, 't', '散页匣满啦！', 34, Colors.title, 560, 50, true).node.setPosition(0, 140, 0);
        addLabel(
            panel,
            'd',
            `看广告可清空散页匣继续点亮\n广告 ${this.game.adUsed}/${this.game.adQuota}`,
            22,
            Colors.text,
            560,
            60,
            true,
        ).node.setPosition(0, 70, 0);

        const closeOverlay = () => {
            if (mask.isValid) mask.destroy();
            if (panel.isValid) panel.destroy();
        };

        addButton(
            panel,
            'revive',
            this.game.canUseAd() ? '看广告清空匣继续' : '广告次数已用完',
            420,
            80,
            this.game.canUseAd() ? Colors.btnAd : Colors.btnDisabled,
            () => {
                if (!this.game.canUseAd()) {
                    this.tip('本局广告次数已达上限');
                    return;
                }
                closeOverlay();
                this.simulateAd(() => {
                    if (!this.game.spendAd()) {
                        this.tip('本局广告次数已达上限');
                        return;
                    }
                    // 清掉匣内节点
                    this.game.tray.forEach((t) => {
                        if (!t) return;
                        const n = this.tileNodes.get(t.id);
                        if (n?.isValid) {
                            n.destroy();
                            this.tileNodes.delete(t.id);
                        }
                    });
                    this.game.reviveClearTray();
                    this.refreshEconomyHud();
                    this.refreshTrayVisuals();
                    this.refreshTileStates();
                    this.tip('散页匣已清空，继续点亮');
                });
            },
            { textHex: Colors.brown, disabled: !this.game.canUseAd() },
        ).node.setPosition(0, -10, 0);

        addButton(panel, 'retry', '重新开始本关', 200, 64, Colors.btnMain, () => {
            closeOverlay();
            this.enterGame(this.currentLevel);
        }, { fontSize: 24, textHex: Colors.brown }).node.setPosition(-120, -100, 0);

        addButton(panel, 'home', '返回首页', 200, 64, Colors.btnShare, () => {
            closeOverlay();
            this.showHome();
        }, { fontSize: 24, textHex: Colors.brown }).node.setPosition(120, -100, 0);
    }

    private showWin() {
        const need = this.game.adsNeededToClear();
        if (need > 0) {
            // 后期关：通关结算前补齐最低广告数（2–5）
            this.showClearAdGate(need);
            return;
        }
        this.finishWinRewards();
    }

    private showClearAdGate(need: number) {
        const mask = fadeMask(this.overlayRoot, true);
        const panel = addBg(this.overlayRoot, 'adGate', 560, 360, Colors.panel, 18);
        popupScaleIn(panel);
        strokeRect(panel.getComponent(Graphics)!, 560, 360, Colors.boardBorder, 2, 18);
        addLabel(panel, 't', '通关补给', 34, Colors.brown, 480, 48, true).node.setPosition(0, 110, 0);
        addLabel(
            panel,
            'd',
            `本关难度较高，领取奖励前需观看 ${need} 次广告\n（本局已看 ${this.game.adUsed}/${this.game.adQuota}，通关要求 ≥${this.game.minAdsRequired}）`,
            22,
            Colors.text,
            500,
            80,
            true,
        ).node.setPosition(0, 20, 0);
        addButton(
            panel,
            'go',
            `观看 ${need} 次广告并领奖`,
            360,
            76,
            Colors.btnAd,
            () => {
                mask.destroy();
                panel.destroy();
                // 若配额不够，临时抬到至少能看完（保证“至少看 N 个”）
                const lack = need - this.game.adsLeft();
                if (lack > 0) this.game.adQuota += lack;
                this.watchAdsSequential(need, () => this.finishWinRewards());
            },
            { textHex: Colors.brown, fontSize: 26 },
        ).node.setPosition(0, -100, 0);
    }

    private finishWinRewards() {
        const stars = this.game.calcStars();
        const verse = getVerseForLevel(this.currentLevel);
        let newItems: string[] = [];
        if (this.leisureMode) {
            SaveData.onLeisureClear(this.currentLevel, stars);
            this.tip('休闲通关：主线进度不变');
            this.leisureMode = false;
        } else {
            newItems = ITEMS.filter((it) => it.unlockLevel === this.currentLevel).map((i) => i.id);
            SaveData.onClear(this.currentLevel, stars, newItems);
        }
        this.showPoemRecital(verse, stars, newItems);
    }

    /** 通关朗诵：逐句显现 + 系统语音（若环境支持） */
    private showPoemRecital(poem: Verse, stars: number, newItems: string[]) {
        const mask = fadeMask(this.overlayRoot, true);
        const lineCount = Math.max(1, poem.lines.length);
        const lineH = 42;
        const showUnlockHint = newItems.length > 0;

        // 自上而下堆叠算高
        const padTop = 36;
        const padBot = 28;
        const headerH = 36 + 48 + 32 + 16; // done + title + meta + gap
        const starsH = 50;
        const poemBlockH = lineCount * lineH;
        const statusH = 36; // 朗诵完毕 / 跳过
        const unlockH = showUnlockHint ? 36 : 0;
        const nextBtnH = 72;
        const gapAfterHeader = 12;
        const gapAfterStars = 18;
        const gapAfterPoem = 10;
        const gapBeforeNext = 14;
        const panelH = Math.min(
            1040,
            Math.max(
                560,
                padTop +
                    headerH +
                    gapAfterHeader +
                    starsH +
                    gapAfterStars +
                    poemBlockH +
                    gapAfterPoem +
                    statusH +
                    unlockH +
                    gapBeforeNext +
                    nextBtnH +
                    padBot,
            ),
        );
        const panelW = 620;
        const panel = addBg(this.overlayRoot, 'poem', panelW, panelH, Colors.panel, 18);
        popupScaleIn(panel);
        strokeRect(panel.getComponent(Graphics)!, panelW, panelH, Colors.boardBorder, 2, 18);

        const top = panelH * 0.5;
        let y = top - padTop;

        addLabel(
            panel,
            'done',
            `诗文已点亮 · 本关${verseKindLabel(poem.kind)}`,
            22,
            Colors.highlight,
            560,
            36,
            true,
        ).node.setPosition(0, y - 18, 0);
        y -= 36;
        addLabel(panel, 'title', poem.title, 36, Colors.brown, 560, 48, true).node.setPosition(0, y - 24, 0);
        y -= 48;
        addLabel(panel, 'meta', `${poem.source} · ${poem.author}`, 22, Colors.text, 480, 32, true).node.setPosition(
            0,
            y - 16,
            0,
        );
        y -= 32 + gapAfterHeader;

        const starRoot = makeNode('stars', panel, 280, 50);
        starRoot.setPosition(0, y - 25, 0);
        for (let i = 0; i < 3; i++) {
            const lab = addLabel(starRoot, `s${i}`, i < stars ? '★' : '☆', 32, i < stars ? Colors.star : Colors.slotBorder, 48, 40);
            lab.node.setPosition((i - 1) * 56, 0, 0);
        }
        y -= starsH + gapAfterStars;

        const lineNodes: Label[] = [];
        poem.lines.forEach((line, i) => {
            const lab = addLabel(panel, `ln${i}`, line, 28, Colors.brown, 540, 40, true);
            lab.node.setPosition(0, y - lineH * 0.5 - i * lineH, 0);
            const op = lab.node.getComponent(UIOpacity) || lab.node.addComponent(UIOpacity);
            op.opacity = 0;
            lineNodes.push(lab);
        });
        y -= poemBlockH + gapAfterPoem;

        const hint = addLabel(panel, 'hint', '正在朗诵…', 20, Colors.text, 400, 30, true);
        hint.node.setPosition(0, y - 15, 0);
        y -= statusH;

        let unlockLab: Label | null = null;
        if (showUnlockHint) {
            unlockLab = addLabel(
                panel,
                'unlock',
                `本关盲盒：${newItems.map((id) => ITEM_MAP[id]?.name || id).join('、')}`,
                18,
                Colors.highlight,
                520,
                32,
                true,
            );
            unlockLab.node.setPosition(0, y - 16, 0);
            unlockLab.node.active = false;
            y -= unlockH;
        }

        y -= gapBeforeNext;
        const nextId = this.currentLevel + 1;
        const hasNext = nextId <= Design.totalLevels && SaveData.isUnlocked(nextId);
        const closeRecital = () => {
            this.stopPoemSpeech();
            if (mask.isValid) mask.destroy();
            if (panel.isValid) panel.destroy();
        };

        const actions = makeNode('actions', panel, 560, nextBtnH);
        actions.setPosition(0, y - nextBtnH * 0.5, 0);
        actions.active = false;

        addButton(actions, 'next', hasNext ? '下一关' : '返回首页', 280, 72, Colors.btnAd, () => {
            closeRecital();
            if (hasNext) {
                this.leisureMode = false;
                this.enterGame(nextId);
            } else this.showHome();
        }, { textHex: Colors.brown }).node.setPosition(0, 0, 0);

        playVerseSeal(panel, 210, top - 180, newItems.length > 0);

        const skip = addLabel(panel, 'skip', '点击跳过', 18, Colors.text, 180, 28, true);
        skip.node.setPosition(0, hint.node.position.y, 0);
        skip.node.addComponent(BlockInputEvents);

        const revealActions = () => {
            if (!hint.node.isValid) return;
            hint.string = '朗诵完毕';
            skip.node.active = false;
            if (unlockLab?.node.isValid) unlockLab.node.active = true;
            actions.active = true;
            popupScaleIn(actions);
        };

        skip.node.on(Node.EventType.TOUCH_END, () => {
            this.stopPoemSpeech();
            lineNodes.forEach((lab) => {
                const op = lab.node.getComponent(UIOpacity);
                if (op) op.opacity = 255;
                lab.color = colorFromHex(Colors.brown);
            });
            revealActions();
        });

        const gap = 1.15;
        lineNodes.forEach((lab, i) => {
            this.scheduleOnce(() => {
                if (!lab.node.isValid) return;
                const op = lab.node.getComponent(UIOpacity)!;
                tween(op).to(0.35, { opacity: 255 }).start();
                tween(lab.node)
                    .to(0.2, { scale: new Vec3(1.06, 1.06, 1) }, { easing: 'backOut' })
                    .to(0.15, { scale: new Vec3(1, 1, 1) })
                    .start();
                playLineBrush(panel, 0, lab.node.position.y);
                lineNodes.forEach((other, j) => {
                    other.color = colorFromHex(j === i ? Colors.brown : '#A89880');
                });
            }, 0.35 + i * gap);
        });

        this.scheduleOnce(revealActions, 0.35 + poem.lines.length * gap + 0.2);
        this.speakPoem(poem);
    }

    private speakPoem(poem: Verse) {
        this.stopPoemSpeech();
        if (!SaveData.load().soundOn) return;
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const g = globalThis as any;
            if (!g.speechSynthesis || !g.SpeechSynthesisUtterance) return;
            const text = `${poem.title}。${poem.source}，${poem.author}。${poem.lines.join('')}`;
            const u = new g.SpeechSynthesisUtterance(text);
            u.lang = 'zh-CN';
            u.rate = 0.9;
            g.speechSynthesis.speak(u);
        } catch {
            /* 环境无 TTS 时仅字幕朗诵 */
        }
    }

    private stopPoemSpeech() {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const g = globalThis as any;
            g.speechSynthesis?.cancel?.();
        } catch {
            /* ignore */
        }
    }
}
