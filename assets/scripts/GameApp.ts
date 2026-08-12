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
    Tween,
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
import {
    Anim,
    Brand,
    Colors,
    Design,
    PlayMode,
    dailyLevelId,
    difficultyTier,
    ITEM_MAP,
    ITEMS,
    isPoemFamily,
    playModeTitle,
    resolveBoardGlyphMode,
} from './core/Config';
import { MatchGame, TileModel, LevelJson } from './core/MatchGame';
import { getSafeLayout } from './core/SafeArea';
import { PropKind, SaveData } from './core/SaveData';
import {
    formatVerseProgress,
    getVerseForLevel,
    verseCharSequence,
    verseKindLabel,
    Verse,
    VerseKind,
} from './core/Literature';
import { riddlePool } from './core/Riddles';
import { isMidAutumn, MidAutumnCopy, MidAutumnColors } from './core/Festival';
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
    makeNode,
    mountEmbeddedBoardGlyph,
    hideEmbeddedBoardGlyph,
    popupScaleIn,
    popupSlideUp,
    setOpacity,
    strokeRect,
} from './ui/UIKit';
import { TileItem } from './ui/TileItem';
import { flashVerseHud, playLineBrush, playVerseInkReveal, playVerseSeal } from './ui/VerseFX';
import {
    attachScrollMeta,
    mountPoemScroll,
    paintScrollNextSeal,
    playPoemScrollOpen,
    readScrollMeta,
} from './ui/PoemScrollFX';
import {
    mountLevelPlaque,
    mountScholarBackdrop,
    mountScholarTools,
    mountScholarTray,
    wrapScholarUndo,
} from './ui/GameScholarFX';
import {
    AboutPage,
    CatalogPage,
    HomePage,
    HowToPage,
    LibraryPage,
    RiddlePage,
    SettingsPage,
    disableHit as pageDisableHit,
} from './ui/pages';

const { ccclass } = _decorator;

type Page = 'boot' | 'home' | 'game' | 'catalog' | 'library' | 'settings' | 'about' | 'howto' | 'riddle';

@ccclass('GameApp')
export class GameApp extends Component {
    private root!: Node;
    private pageRoot!: Node;
    private overlayRoot!: Node;
    private game = new MatchGame();
    private page: Page = 'boot';
    private currentLevel = 1;
    /** 首页所选游戏模式 */
    private playMode: PlayMode = 'poem';
    /** 休闲模式：通关不推进主线 */
    private leisureMode = false;
    /** 猜灯谜当前题号 */
    private riddleIndex = 0;
    /** 中秋首页 tip 本会话只弹一次 */
    private midAutumnHomeTipShown = false;
    private tileNodes = new Map<string, Node>();
    /** 散页匣格位节点 */
    private slotNodes: Node[] = [];
    private boardLayer!: Node;
    private slotLayer!: Node;
    private parkLayer!: Node;
    private hudLayer!: Node;
    private busy = false;
    private undoBtn: { setEnabled: (on: boolean) => void; node?: Node } | null = null;
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
    private poemNextPill: Graphics | null = null;
    private economyHudLabel: Label | null = null;
    private economyHudRoot: Node | null = null;
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
        this.poemNextPill = null;
        this.economyHudLabel = null;
        this.economyHudRoot = null;
        this.poemChars = [];
        this.poemRevealed = 0;
    }

    private nodeAlive(n: Node | null | undefined): n is Node {
        return !!n && n.isValid;
    }

    private tip(msg: string) {
        if (!this.nodeAlive(this.overlayRoot)) return;
        const safe = getSafeLayout();
        // 底部轻提示，避开首页书页/主按钮中区
        const y = safe.contentBottom + 96;

        const tipOk = !!this.tipLabel?.isValid && this.nodeAlive(this.tipLabel.node);
        let host: Node;
        if (!tipOk) {
            host = makeNode('tipHost', this.overlayRoot, 600, 56);
            const bg = host.addComponent(Graphics);
            bg.fillColor = colorFromHex('#2F2118', 200);
            bg.roundRect(-290, -26, 580, 52, 16);
            bg.fill();
            const lab = addLabel(host, 'tip', msg, 24, '#FFF8F0', 540, 40, true);
            lab.node.setPosition(0, 0, 0);
            this.tipLabel = lab;
        } else {
            host = this.tipLabel!.node.parent?.isValid
                ? this.tipLabel!.node.parent
                : this.tipLabel!.node;
            this.tipLabel!.string = msg;
        }

        if (!this.nodeAlive(host)) return;
        host.setSiblingIndex(this.overlayRoot.children.length - 1);
        host.setPosition(0, y - 18, 0);
        setOpacity(host, 255);
        Tween.stopAllByTarget(host);
        const op = host.getComponent(UIOpacity) || host.addComponent(UIOpacity);
        Tween.stopAllByTarget(op);
        op.opacity = 255;
        tween(host)
            .to(0.18, { position: new Vec3(0, y, 0) }, { easing: 'sineOut' })
            .start();
        tween(op).delay(1.35).to(0.28, { opacity: 0 }).start();
    }

    // ---------------- Boot ----------------
    private showBoot() {
        this.clearPage();
        this.page = 'boot';
        this.bootProgress = 0;
        this.bootLoaded = 0;
        this.bootDone = false;
        const p = this.pageRoot;

        addLabel(p, 'title', Brand.name, 64, Colors.brown, 600, 80, true).node.setPosition(0, 420, 0);
        addLabel(p, 'sub', Brand.tagline, 36, Colors.brown, 500, 50, true).node.setPosition(0, 350, 0);
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

    /** 启动页装饰：缩略书架 */
    private drawDecorShelf(parent: Node, x: number, y: number): Node {
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
        HomePage.mount(this.pageRoot, {
            tip: (m) => this.tip(m),
            startPlayMode: (mode, levelId) => this.startPlayMode(mode, levelId),
            showLanternRiddle: () => this.showLanternRiddle(),
            showLevelPickPopup: () => this.showLevelPickPopup(),
            showCatalog: () => this.showCatalog(),
            showLibrary: () => this.showLibrary('poem'),
            showHowTo: () => this.showHowTo('home'),
            showSettings: () => this.showSettings(),
            showLegalPopup: () => this.showLegalPopup(),
        });
        if (isMidAutumn() && !this.midAutumnHomeTipShown) {
            this.midAutumnHomeTipShown = true;
            this.scheduleOnce(() => this.tip(MidAutumnCopy.homeTip), 0.6);
        }
    }

    private startPlayMode(mode: PlayMode, levelId: number) {
        this.playMode = mode;
        this.leisureMode = mode !== 'poem';
        if (mode === 'match3') this.tip(`${Brand.modeMatch3} · 凑齐三个相同盲盒`);
        else if (mode === 'daily') {
            const tip = isMidAutumn()
                ? `${MidAutumnCopy.dailyHint} · ${getVerseForLevel(levelId).title}`
                : `${Brand.modeDaily} · ${getVerseForLevel(levelId).title}`;
            this.tip(tip);
        } else if (mode === 'blind') this.tip(`${Brand.linkBlind} · 场上不露字`);
        else this.tip(`${Brand.modePoem} · ${getVerseForLevel(levelId).title}`);
        this.enterGame(levelId, mode);
        if (mode === 'daily' || mode === 'match3') {
            this.game.freePropsLeft += 1;
            this.refreshEconomyHud();
        }
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
                    this.startPlayMode('poem', id);
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
            this.playMode = 'poem';
            this.leisureMode = true;
            this.tip(`休闲 · 第 ${id} 关`);
            this.enterGame(id, 'poem');
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

    // ---------------- Catalog ----------------
    private showCatalog() {
        this.clearPage();
        this.page = 'catalog';
        CatalogPage.mount(this.pageRoot, {
            onBack: () => this.showHome(),
            applyTileSprite: (node, itemId, locked) => this.applyTileSprite(node, itemId, locked),
            backFrame: this.uiFrames.get('btn_back'),
        });
    }

    /** 文藏馆：古诗 / 名言 / 文言文（全部可浏览） */
    private showLibrary(tab: VerseKind = 'poem') {
        this.clearPage();
        this.page = 'library';
        LibraryPage.mount(this.pageRoot, {
            tab,
            onBack: () => this.showHome(),
            onTab: (t) => this.showLibrary(t),
            onOpenVerse: (v) => this.showVerseDetail(v),
            backFrame: this.uiFrames.get('btn_back'),
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
        SettingsPage.mount(this.pageRoot, {
            onBack: () => this.showHome(),
            onToggleSound: () => {
                const on = !SaveData.load().soundOn;
                SaveData.setSound(on);
                this.showSettings();
            },
            onHowTo: () => this.showHowTo('settings'),
            onLegal: () => this.showLegalPopup(),
            onAbout: () => this.showAbout(),
            backFrame: this.uiFrames.get('btn_back'),
        });
    }

    private showAbout() {
        this.clearPage();
        this.page = 'about';
        AboutPage.mount(this.pageRoot, {
            onBack: () => this.showSettings(),
            onHowTo: () => this.showHowTo('about'),
            backFrame: this.uiFrames.get('btn_back'),
        });
    }

    /** 点亮书架：玩法说明 */
    private showHowTo(from: 'home' | 'settings' | 'about' = 'home') {
        this.clearPage();
        this.page = 'howto';
        HowToPage.mount(this.pageRoot, {
            onBack: () => {
                if (from === 'settings') this.showSettings();
                else if (from === 'about') this.showAbout();
                else this.showHome();
            },
            backFrame: this.uiFrames.get('btn_back'),
        });
    }

    /** 猜灯谜：诗匣休闲入口 */
    private showLanternRiddle() {
        this.clearPage();
        this.page = 'riddle';
        RiddlePage.mount(this.pageRoot, {
            riddleIndex: this.riddleIndex,
            onBack: () => this.showHome(),
            tip: (m) => this.tip(m),
            requestHintAd: (onGot) => this.showRiddleHintAd(onGot),
            onNext: () => {
                this.riddleIndex = (this.riddleIndex + 1) % riddlePool().length;
                this.showLanternRiddle();
            },
            backFrame: this.uiFrames.get('btn_back'),
        });
    }

    /** 灯谜提示：激励视频解锁 */
    private showRiddleHintAd(onGot: () => void) {
        const mask = fadeMask(this.overlayRoot, true);
        const panel = addBg(this.overlayRoot, 'riddleAd', 560, 320, Colors.panel, 16);
        popupSlideUp(panel, -360);
        addLabel(panel, 't', '解锁灯谜提示', 32, Colors.title, 500, 50, true).node.setPosition(0, 100, 0);
        addLabel(
            panel,
            'd',
            '看一段短视频，即可查看本题提示\n（开发环境为模拟激励视频）',
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
            '看视频解锁',
            220,
            72,
            Colors.btnAd,
            () => {
                close();
                this.simulateAd(() => onGot());
            },
            { textHex: Colors.brown },
        ).node.setPosition(-120, -80, 0);

        addButton(panel, 'cancel', '取消', 200, 72, Colors.btnAd, close).node.setPosition(120, -80, 0);
    }

    // ---------------- Game ----------------
    private enterGame(levelId: number, mode: PlayMode = this.playMode) {
        this.currentLevel = levelId;
        this.playMode = mode;
        this.clearPage();
        this.page = 'game';
        const p = this.pageRoot;
        const L = this.mockLayout;
        const bw = Math.min(L?.board?.w ?? Design.boardW, Design.width - 48);
        const data = this.getLevel(levelId);
        const verse = getVerseForLevel(data.id);

        const safe = getSafeLayout();
        // 书生意气：水墨月夜 + 花灯（对局专用氛围）
        mountScholarBackdrop(p, safe, 46);

        this.hudLayer = makeNode('hud', p);

        // —— 返回 → 画轴(最宽) → 棋盘+侧木牌 → 乌木匣 → 竖钮道具 ——
        const gap = 12;
        const poemH = this.measurePoemHudHeight(verse);
        const trayH = 120;
        const toolH = 88;

        const titleY = safe.headerY;
        const btnSize = Math.max(48, Math.min(safe.headerBtnSize, L?.back?.w ?? 56));
        const backX = L?.back?.x ?? -(Design.width * 0.5 - 24 - btnSize * 0.5);

        addCircleBtn(
            this.hudLayer,
            'back',
            '←',
            btnSize,
            () => this.showHome(),
            this.uiFrames.get('btn_back'),
        ).setPosition(backX, titleY, 0);

        const tier = difficultyTier(data.id);

        const toolY = safe.contentBottom + 10 + toolH * 0.5;
        const slotY = toolY + toolH * 0.5 + gap + trayH * 0.5;
        // 画轴偏上，浮于月前
        const poemTop = safe.contentTop - 8;
        const poemY = poemTop - poemH * 0.5;
        const boardTop = poemY - poemH * 0.5 - gap - 6;
        const boardBottom = slotY + trayH * 0.5 + gap + 14;
        const bh = Math.max(280, boardTop - boardBottom);
        const boardY = (boardTop + boardBottom) * 0.5;

        this.game.loadLevel(data, bw, bh, this.playMode);
        this.boardLayer = makeNode('board', p, bw, bh);
        this.boardLayer.setPosition(0, boardY, 0);
        this.slotLayer = makeNode('tray', p);
        this.slotLayer.setPosition(0, slotY, 0);
        this.parkLayer = makeNode('park', p);
        this.parkLayer.active = false;

        // 木牌挂在棋盘左侧（不越出安全边）
        const plaqueX = Math.max(-(Design.width * 0.5) + 76, -bw * 0.5 - 72);
        this.buildGameMetaBand(plaqueX, boardY + Math.min(36, bh * 0.1));

        this.poemChars = this.game.targetChars.slice();
        this.poemRevealed = this.game.poemRevealed;
        this.refreshEconomyHud(tier);

        // 画轴略宽于匣；匣略宽于棋盘
        const scrollW = Math.min(Design.width - 36, bw + 56);
        const trayW = Math.min(scrollW - 28, bw + 20);
        if (isPoemFamily(this.playMode)) {
            this.buildPoemHud(verse, scrollW, poemY, poemH);
            this.playScrollOpen(this.poemHudRoot, 2.2);
        } else {
            this.buildMatch3Hud(scrollW, poemY, poemH);
            this.playScrollOpen(this.poemHudRoot, 0.55);
        }
        this.buildTrayUI(trayW, trayH);
        this.spawnTiles();
        this.bindBoardInput();
        this.buildTools(toolY, 0, toolH);
        this.refreshTrayVisuals();
        this.refreshTileStates();

        // 棋盘/匣随画轴节奏浮现
        if (this.nodeAlive(this.boardLayer)) {
            const bop = this.boardLayer.getComponent(UIOpacity) || this.boardLayer.addComponent(UIOpacity);
            bop.opacity = 0;
            tween(bop).delay(0.9).to(0.55, { opacity: 255 }, { easing: 'sineOut' }).start();
        }
        if (this.nodeAlive(this.slotLayer)) {
            const sop = this.slotLayer.getComponent(UIOpacity) || this.slotLayer.addComponent(UIOpacity);
            sop.opacity = 0;
            tween(sop).delay(1.15).to(0.5, { opacity: 255 }, { easing: 'sineOut' }).start();
        }

        this.hudLayer.setSiblingIndex(p.children.length - 1);
        const next = this.game.currentTarget();
        const glyphMode = resolveBoardGlyphMode(this.playMode, data.id);
        this.scheduleOnce(() => {
            if (this.page !== 'game') return;
            if (this.playMode === 'match3') {
                this.tip(`点顶层盲盒进匣 · 三个相同即可消除`);
            } else if (next) {
                this.tip(
                    this.playMode === 'daily'
                        ? `${Brand.modeDaily}「${verse.title}」· 下一字「${next}」`
                        : glyphMode === 'blind'
                          ? `${Brand.linkBlind} · 场上不露字 · 下一字「${next}」`
                          : `点带字的顶层盒 · 下一字「${next}」`,
                );
            } else {
                this.tip('理完架上剩余盲盒');
            }
        }, 2.5);
    }

    /** 清匣消除顶栏说明（占原诗笺位置） */
    private buildMatch3Hud(cardW: number, centerY: number, cardH: number) {
        const fest = isMidAutumn();
        const lacquer = fest ? MidAutumnColors.lacquer : '#C45C3A';
        const paper = fest ? '#FFFBF2' : '#FFFCF7';
        const border = fest ? MidAutumnColors.gold : Colors.boardBorder;
        const wood = fest ? '#8B5A32' : '#6B4A32';
        const h = Math.max(78, cardH * 0.78);
        const rollerW = 12;

        const root = makeNode('match3Hud', this.hudLayer, cardW + rollerW * 2, h + 8);
        root.setPosition(0, centerY, 0);
        this.disableHit(root);

        const sheet = makeNode('sheet', root, cardW, h);
        const g = sheet.addComponent(Graphics);
        g.fillColor = colorFromHex(paper, 240);
        g.roundRect(-cardW * 0.5, -h * 0.5, cardW, h, 10);
        g.fill();
        g.strokeColor = colorFromHex(border, 150);
        g.lineWidth = 1.4;
        g.roundRect(-cardW * 0.5 + 0.5, -h * 0.5 + 0.5, cardW - 1, h - 1, 9);
        g.stroke();
        g.fillColor = colorFromHex(lacquer, 210);
        g.roundRect(-cardW * 0.5 + 8, -h * 0.5 + 14, 3, h - 28, 1.5);
        g.fill();

        addLabel(sheet, 't', Brand.modeMatch3, 22, Colors.brown, cardW - 48, 32, true).node.setPosition(0, 12, 0);
        const prog = addLabel(sheet, 'p', '凑齐三个相同盲盒消除 · 清空即通关', 16, Colors.text, cardW - 56, 28, true);
        prog.node.setPosition(0, -14, 0);

        const makeRoller = (name: string) => {
            const n = makeNode(name, root, rollerW + 6, h + 14);
            const rg = n.addComponent(Graphics);
            rg.fillColor = colorFromHex(wood, 245);
            rg.roundRect(-(rollerW * 0.5), -(h * 0.5 + 5), rollerW, h + 10, 5);
            rg.fill();
            return n;
        };
        const rollerL = makeRoller('rollerL');
        const rollerR = makeRoller('rollerR');
        (root as Node & { _scrollMeta?: { sheet: Node; rollerL: Node; rollerR: Node; half: number } })._scrollMeta = {
            sheet,
            rollerL,
            rollerR,
            half: cardW * 0.5 + rollerW * 0.35,
        };

        this.poemHudRoot = root;
        this.poemHudLabel = prog;
        this.poemHudProgressLabel = prog;
        this.poemHudBar = null;
        this.poemNextPill = null;
    }

    /** 诗笺高度：横轴题签布局 */
    private measurePoemHudHeight(verse: Verse): number {
        const lineCount = Math.min(4, Math.max(1, verse.lines.length));
        return Math.max(122, 28 + lineCount * 26 + 20);
    }

    /** 关卡木牌（挂棋盘左侧） */
    private buildGameMetaBand(x: number, y: number) {
        const plaque = mountLevelPlaque(this.hudLayer, x, y, () => '');
        this.economyHudLabel = plaque.label;
        this.economyHudRoot = plaque.root;
    }

    private refreshEconomyHud(tier = difficultyTier(this.currentLevel)) {
        if (!this.economyHudLabel || !this.economyHudLabel.isValid) return;
        const mode = playModeTitle(this.playMode);
        this.economyHudLabel.string =
            this.playMode === 'daily'
                ? mode
                : this.playMode === 'blind'
                  ? mode
                  : `第 ${this.currentLevel} 关`;
        void tier;
    }

    /** 让节点不参与 UI 点击检测 */
    private disableHit(node: Node) {
        pageDisableHit(node);
    }

    private bindBoardInput() {
        // 棋盘置于匣之上，避免底部方块被散页匣挡住点击
        if (this.slotLayer?.isValid && this.boardLayer?.isValid) {
            this.boardLayer.setSiblingIndex(Math.max(this.slotLayer.getSiblingIndex() + 1, this.boardLayer.getSiblingIndex()));
        }
        // 棋盘整体可点：用统一点选，避免等距 AABB 点到旁边/上层块
        this.boardLayer.off(Node.EventType.TOUCH_END);
        if (!this.boardLayer.getComponent(BlockInputEvents)) {
            this.boardLayer.addComponent(BlockInputEvents);
        }
        this.boardLayer.on(
            Node.EventType.TOUCH_END,
            (e: EventTouch) => {
                e.propagationStopped = true;
                this.handleBoardTap(e);
            },
            this,
        );
    }

    /** 触摸 UI 坐标 → 棋盘本地坐标 */
    private uiToBoardLocal(uiLoc: { x: number; y: number }): Vec3 | null {
        if (!this.nodeAlive(this.boardLayer)) return null;
        const ut = this.boardLayer.getComponent(UITransform);
        if (!ut) return null;
        return ut.convertToNodeSpaceAR(new Vec3(uiLoc.x, uiLoc.y, 0));
    }

    /**
     * 点选指尖下顶面。热区贴近盲盒顶面大小；多块重叠时高层优先，其次更靠前。
     */
    private pickBoardTileAt(uiLoc: { x: number; y: number }): TileModel | null {
        const local = this.uiToBoardLocal(uiLoc);
        if (!local) return null;
        const bs = this.getBoardScale();
        const hw = Design.tileSize * bs * 0.46;
        const hh = Design.tileSize * bs * 0.3;
        let best: TileModel | null = null;
        let bestScore = -Infinity;
        for (const tile of this.game.tiles) {
            if (tile.removed || tile.inTray) continue;
            const n = this.tileNodes.get(tile.id);
            if (!this.nodeAlive(n) || !n.active) continue;
            const dx = Math.abs(local.x - tile.x);
            const dy = Math.abs(local.y - tile.y);
            if (dx / hw + dy / hh > 1.12) continue;
            // 可见优先：更靠前（col+row 大 / y 小）再比层高
            const depth = (tile.col ?? 0) + (tile.row ?? 0);
            const score = depth * 1e6 + tile.layer * 1e3 - tile.y;
            if (score > bestScore) {
                bestScore = score;
                best = tile;
            }
        }
        return best;
    }

    private handleBoardTap(e: EventTouch) {
        if (this.busy || this.page !== 'game' || this.game.phase !== 'playing') return;
        const loc = e.getUILocation();
        const tile = this.pickBoardTileAt(loc);
        if (!tile) return;
        if (this.game.isClickable(tile)) {
            void this.onTileClick(tile.id);
            return;
        }
        this.tip('先拿走压在上面的物品');
    }

    /** 场上方块不单独接点击，避免大方块 AABB 互抢；统一由 boardLayer 点选 */
    private bindTileTouch(node: Node, _tileId: string) {
        node.off(Node.EventType.TOUCH_END);
        const bie = node.getComponent(BlockInputEvents);
        if (bie) bie.destroy();
        const item = node.getComponent(TileItem);
        item?.bindRefs();
        node.children.forEach((c) => {
            const cut = c.getComponent(UITransform);
            if (cut) (cut as UITransform & { hitTest: () => boolean }).hitTest = () => false;
        });
        if (item) item.disableRootHit();
        else {
            const ut = node.getComponent(UITransform);
            if (ut) {
                ut.setContentSize(0, 0);
                (ut as UITransform & { hitTest: () => boolean }).hitTest = () => false;
            }
        }
    }

    private buildTrayUI(trayW = 660, trayH = 120) {
        const built = mountScholarTray(this.slotLayer, trayW, trayH, this.game.traySize, 80, {
            onClear: () => this.onTool('tidy'),
        });
        this.slotNodes = built.slots;
        this.slotFitScale = built.fitScale;
    }

    private getSlotScale() {
        return this.slotFitScale || Design.slotScale;
    }

    private getBoardScale() {
        return this.game?.boardScale || 1;
    }

    private buildTools(toolY = -520, _toolW = 148, _toolH = 68) {
        const labels: Record<string, string> = {
            undo: '撤回',
            hint: '提示',
            tidy: '洗牌',
            share: '诗笺',
        };
        const tools = mountScholarTools(
            this.hudLayer,
            toolY,
            ['undo', 'tidy', 'hint', 'share'],
            labels,
            (key) => this.onTool(key),
        );
        this.undoBtn = wrapScholarUndo(tools);
        if (this.undoBtn) this.undoBtn.setEnabled(false);
    }

    private spawnTiles() {
        this.boardLayer.children.slice().forEach((c) => c.destroy());
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
        // 等距正确绘制：先画后排，再画同深度更高层；绝不能先按 layer 再按 y（会把后排高层盖住前排）
        const ordered = [...boardTiles].sort((a, b) => {
            const da = (a.col ?? 0) + (a.row ?? 0);
            const db = (b.col ?? 0) + (b.row ?? 0);
            if (a.col != null && b.col != null && da !== db) return da - db;
            if (a.col == null || b.col == null) {
                // 无网格：y 越大越靠后，先画
                if (a.y !== b.y) return b.y - a.y;
            }
            if (a.layer !== b.layer) return a.layer - b.layer;
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
            this.syncBoardGlyph(n, tile, covered);
            n.setSiblingIndex(10 + i);
            this.bindTileTouch(n, tile.id);
        });
        if (this.undoBtn) this.undoBtn.setEnabled(this.game.canUndo());
    }

    /** 场上显字：古诗印刻；三消不显字 */
    private syncBoardGlyph(n: Node, tile: TileModel, covered: boolean) {
        const mode = resolveBoardGlyphMode(this.playMode, this.currentLevel);
        if (covered || mode === 'blind' || mode === 'none') {
            hideEmbeddedBoardGlyph(n);
            const body = n.getChildByName('Body');
            if (body) setOpacity(body, 255);
            return;
        }
        mountEmbeddedBoardGlyph(n, tile.glyph);
        const body = n.getChildByName('Body');
        if (body) setOpacity(body, 255);
    }

    /** 盲翻提示：短暂在单块上翻开汉字 */
    private flashBoardGlyph(n: Node, glyph: string, ms = 1400) {
        const shown = mountEmbeddedBoardGlyph(n, glyph, { flash: true });
        this.scheduleOnce(() => {
            if (!this.nodeAlive(shown)) return;
            if (resolveBoardGlyphMode(this.playMode, this.currentLevel) === 'blind') {
                shown.active = false;
            } else {
                this.refreshTileStates();
            }
        }, ms / 1000);
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
            const body = n.getChildByName('Body');
            if (body) {
                body.setPosition(0, 0, 0);
                body.setScale(1, 1, 1);
                setOpacity(body, 160);
            }
            let gly = n.getChildByName('GlyphLab');
            if (this.nodeAlive(gly)) gly.destroy();
            if (this.playMode === 'match3' || !tile.glyph) {
                hideEmbeddedBoardGlyph(n);
            } else {
                // 匣内同样相对顶面菱形摆正
                const emb = mountEmbeddedBoardGlyph(n, tile.glyph, { fontSize: 26 });
                emb.setPosition(0, Design.tileSize * 0.08, 0);
                emb.setScale(emb.scale.x * 0.85, emb.scale.y * 0.85, 1);
            }
            this.bindTrayTouch(n, tile.id);
        });
    }

    private bindTrayTouch(node: Node, tileId: string) {
        node.off(Node.EventType.TOUCH_END);
        const item = node.getComponent(TileItem);
        if (item) item.enableRootHit();
        else {
            const ut = node.getComponent(UITransform);
            if (ut) {
                const s = Design.tileSize * 0.9;
                ut.setContentSize(s, s);
                delete (ut as UITransform & { hitTest?: unknown }).hitTest;
            }
        }
        if (!node.getComponent(BlockInputEvents)) node.addComponent(BlockInputEvents);
        if (this.playMode === 'match3') {
            node.on(
                Node.EventType.TOUCH_END,
                (e: EventTouch) => {
                    e.propagationStopped = true;
                    this.tip('凑齐三个相同会自动消除');
                },
                this,
            );
            return;
        }
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
        if (this.playMode === 'match3') {
            this.tip('凑齐三个相同会自动消除');
            return;
        }
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
                this.tip(
                    this.playMode === 'match3'
                        ? '散页匣满了，先整理匣或看视频清空'
                        : '散页匣满了，先点匣内目标字，或整理匣',
                );
                return;
            }

            n.active = false;
            this.refreshTileStates();
            n.active = true;

            if (result.kind === 'light' || result.kind === 'clean') {
                await this.playGlyphResolve(n, result.glyph || tile.glyph, result.kind === 'light');
                if (this.nodeAlive(n)) n.destroy();
                this.tileNodes.delete(tileId);
                this.poemRevealed = this.game.poemRevealed;
                if (result.kind === 'light' && result.litChar) {
                    this.onGlyphLit(result.litChar);
                }
                this.refreshTrayVisuals();
                this.refreshTileStates();
            } else if (result.kind === 'match') {
                const idx = result.trayIndex ?? 0;
                if (this.nodeAlive(n)) {
                    const flash = n.getChildByName('flashG');
                    if (this.nodeAlive(flash)) flash.destroy();
                    await this.flyNodeToTray(n, idx);
                }
                // 消掉的节点销毁
                for (const id of result.matchedIds || []) {
                    const mn = this.tileNodes.get(id);
                    if (mn?.isValid) {
                        mn.destroy();
                        this.tileNodes.delete(id);
                    }
                }
                this.refreshTrayVisuals();
                this.refreshTileStates();
                this.tip('三个相同，消掉了！');
            } else if (result.kind === 'tray' || result.kind === 'fail') {
                const idx = result.trayIndex ?? 0;
                if (this.nodeAlive(n)) {
                    const flash = n.getChildByName('flashG');
                    if (this.nodeAlive(flash)) flash.destroy();
                    await this.flyNodeToTray(n, idx);
                }
                this.refreshTrayVisuals();
                this.refreshTileStates();
                if (this.playMode === 'match3') {
                    this.tip('已放入散页匣');
                } else {
                    this.tip(`「${result.glyph}」不是下一字，已暂存到散页匣`);
                }
            }

            this.afterFlipResolve();
        } finally {
            this.busy = false;
        }
    }

    private flashGlyphOnTile(n: Node, glyph: string) {
        if (!glyph || this.playMode === 'match3') return;
        if (!this.nodeAlive(n)) return;
        const old = n.getChildByName('flashG');
        if (this.nodeAlive(old)) old.destroy();
        // 与顶面印字同一套菱形仿射；单独节点，不拆 GlyphEmb
        const flashRoot = makeNode('flashG', n, 8, 8);
        flashRoot.setPosition(0, Design.tileSize * 0.22, 0);
        const faceW = 0.52;
        const faceH = 0.3;
        const inset = 0.58;
        const halfDiagX = Design.tileSize * faceW * inset;
        const halfDiagY = Design.tileSize * faceH * inset;
        const side = 48;
        const diag = side * Math.SQRT2;
        flashRoot.setScale((2 * halfDiagX) / diag, (2 * halfDiagY) / diag, 1);
        const rot = makeNode('Rot', flashRoot, side, side);
        rot.angle = 45;
        const lab = addLabel(rot, 'Ink', glyph, 30, Colors.highlight, side, side, false);
        lab.isBold = false;
        lab.enableOutline = false;
        lab.cacheMode = Label.CacheMode.NONE;
        const op = flashRoot.getComponent(UIOpacity) || flashRoot.addComponent(UIOpacity);
        op.opacity = 255;
        tween(op)
            .to(0.35, { opacity: 0 })
            .call(() => {
                if (flashRoot.isValid) flashRoot.destroy();
            })
            .start();
    }

    private async playGlyphResolve(n: Node, glyph: string, lit: boolean) {
        if (!this.nodeAlive(this.overlayRoot) || !this.nodeAlive(n)) return;
        const lab = addLabel(this.overlayRoot, 'flyG', glyph, 48, lit ? Colors.highlight : Colors.brown, 100, 60, true);
        const flyNode = lab.node;
        const ui = this.overlayRoot.getComponent(UITransform)!;
        const start = ui.convertToNodeSpaceAR(n.worldPosition);
        flyNode.setPosition(start.x, start.y, 0);
        let end = new Vec3(start.x, start.y + 100, 0);
        if (lit && this.nodeAlive(this.poemHudRoot)) {
            end = ui.convertToNodeSpaceAR(this.poemHudRoot.worldPosition);
        }
        await this.tweenPromise(
            tween(flyNode).to(
                0.28,
                { position: new Vec3(end.x, end.y, 0), scale: new Vec3(0.4, 0.4, 1) },
                { easing: 'quadOut' },
            ),
        );
        if (this.nodeAlive(flyNode)) flyNode.destroy();
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
        if (this.nodeAlive(this.boardLayer)) {
            playVerseInkReveal(this.boardLayer, 0, 40, [ch], verse.kind);
        }
        flashVerseHud(this.poemHudRoot);
        const next = this.game.currentTarget();
        if (next) this.tip(`已点亮「${ch}」· 下一字「${next}」`);
        else this.tip('诗文已点亮！继续点顶层盲盒收走，清空即可通关');
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
        if (this.playMode === 'match3') {
            if (this.poemHudProgressLabel?.isValid) {
                const left = this.game.remainingBoard().length + this.game.trayCount();
                this.poemHudProgressLabel.string =
                    left > 0 ? `剩余 ${left} 个 · 凑齐三个消除` : '正在结算…';
            }
            return;
        }
        this.poemRevealed = this.game.poemRevealed;
        const verse = getVerseForLevel(this.currentLevel);
        const total = Math.max(1, this.poemChars.length);
        const got = Math.min(this.poemRevealed, total);
        const next = this.game.currentTarget();
        if (this.poemHudLabel?.isValid) {
            this.poemHudLabel.string = formatVerseProgress(verse, this.poemRevealed);
        }
        if (this.poemHudProgressLabel?.isValid) {
            const boardLeft = this.game.remainingBoard().length;
            const trayLeft = this.game.trayCount();
            let char = next || `${got}/${total}`;
            let sub = '下一个';
            let done = got >= total;
            if (got >= total) {
                char = boardLeft + trayLeft > 0 ? '收' : '通';
                sub = boardLeft + trayLeft > 0 ? '收尾' : '已点亮';
            } else if (next) {
                char = next;
                sub = '下一个';
            }
            const fest = isMidAutumn();
            const lacquer = fest ? MidAutumnColors.lacquer : '#C23A2B';
            if (this.poemNextPill?.isValid) {
                const sheet = this.poemNextPill.node.parent;
                const sheetW = sheet?.getComponent(UITransform)?.width ?? 560;
                const sheetH = sheet?.getComponent(UITransform)?.height ?? 120;
                paintScrollNextSeal(this.poemNextPill, this.poemHudProgressLabel, {
                    char,
                    sub,
                    done,
                    sheetW,
                    sheetH,
                });
            } else {
                this.poemHudProgressLabel.string = `${sub} ${char}`;
                this.poemHudProgressLabel.color = colorFromHex(done ? Colors.highlight : lacquer);
            }
        }
        if (this.poemHudBar?.isValid) {
            const g = this.poemHudBar;
            const sheet = this.poemHudBar.node.parent;
            const barW = Math.max(200, (sheet?.getComponent(UITransform)?.width ?? 560) - 48);
            const barH = 4;
            const ratio = got / total;
            const fest = isMidAutumn();
            g.clear();
            g.fillColor = colorFromHex('#EDE4D6', 220);
            g.roundRect(-barW * 0.5, -barH * 0.5, barW, barH, 2);
            g.fill();
            if (ratio > 0) {
                g.fillColor = colorFromHex(
                    got >= total ? Colors.highlight : fest ? MidAutumnColors.gold : '#C9A07A',
                );
                g.roundRect(-barW * 0.5, -barH * 0.5, Math.max(10, barW * ratio), barH, 2);
                g.fill();
            }
        }
    }

    /**
     * 文藏笺：锦边画轴 + 题签朱印 + 下一字方印（遮罩展开）
     */
    private buildPoemHud(verse: Verse, cardW: number, centerY: number, cardH: number) {
        const built = mountPoemScroll(
            this.hudLayer,
            verse,
            cardW,
            centerY,
            cardH,
            formatVerseProgress(verse, 0),
        );
        // 保留点击：点画轴可弹朱印（开轴交互）
        if (!built.root.getComponent(BlockInputEvents)) {
            built.root.addComponent(BlockInputEvents);
        }
        this.poemHudRoot = built.root;
        this.poemHudLabel = built.bodyLabel;
        this.poemHudProgressLabel = built.nextLabel;
        this.poemNextPill = built.nextSealG;
        this.poemHudBar = built.barG;
        attachScrollMeta(built.root, built.meta);
        this.refreshPoemHud();
    }

    /** 画轴开轴演出（右→左缓展） */
    private playScrollOpen(root: Node | null, dur = 2.2) {
        if (!this.nodeAlive(root)) return;
        const meta = readScrollMeta(root);
        if (meta) {
            playPoemScrollOpen(meta, dur);
            return;
        }
        root.setScale(0.08, 1, 1);
        const op = root.getComponent(UIOpacity) || root.addComponent(UIOpacity);
        op.opacity = 180;
        tween(root).to(dur, { scale: new Vec3(1, 1, 1) }, { easing: 'cubicOut' }).start();
        tween(op).to(dur * 0.5, { opacity: 255 }).start();
    }

    private tweenPromise(t: ReturnType<typeof tween>): Promise<void> {
        return new Promise((resolve) => {
            t.call(() => resolve()).start();
        });
    }

    private onTool(key: string) {
        if (this.busy) return;
        if (key === 'share') {
            this.tip(`谢谢分享${Brand.tagline}`);
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
        addLabel(panel, 't', `需要「${propName}」`, 32, Colors.title, 500, 50, true).node.setPosition(0, 100, 0);
        addLabel(
            panel,
            'd',
            `看一段短视频，本局获得 1 次「${propName}」\n还可看 ${this.game.adsLeft()} 次`,
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
            '看视频领取',
            220,
            72,
            Colors.btnAd,
            () => {
                if (!this.game.canUseAd()) {
                    this.tip('本局广告已用完');
                    close();
                    return;
                }
                close();
                this.simulateAd(() => {
                    if (!this.game.spendAd()) {
                        this.tip('本局广告已用完');
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
        // 复活被消掉/销毁的节点（含三消 matchedIds）
        for (const t of this.game.tiles) {
            if (t.removed) continue;
            let n = this.tileNodes.get(t.id);
            if (!n || !n.isValid) {
                n = this.createTileNode(t);
                this.tileNodes.set(t.id, n);
            }
            if (!t.inTray) {
                n.parent = this.boardLayer;
                n.active = true;
                const bs = this.getBoardScale();
                n.setScale(bs, bs, 1);
                n.setPosition(t.x, t.y, 0);
            }
        }
        this.refreshTrayVisuals();
        this.refreshTileStates();
        this.tip('已撤回上一步');
    }

    private doHint() {
        const id = this.game.hintTargetId();
        if (!id) {
            this.tip(this.playMode === 'match3' ? '没有可提示的盲盒' : '没有可提示的目标字');
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
            if (tile && !tile.inTray && resolveBoardGlyphMode(this.playMode, this.currentLevel) === 'blind') {
                this.flashBoardGlyph(n, tile.glyph);
            }
        }
        this.tip(
            this.playMode === 'match3'
                ? '试试点这个盲盒'
                : tile
                  ? `目标「${tile.glyph}」在这里`
                  : '已高亮目标',
        );
        this.usedPropMark();
    }

    private doTidy() {
        const moved = this.game.clearTrayJunk(2);
        if (!moved.length) {
            this.tip(this.playMode === 'match3' ? '匣内暂无可整理的盲盒' : '匣内没有可整理的闲字');
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
        this.tip(
            this.playMode === 'match3'
                ? `已整理掉 ${moved.length} 个盲盒`
                : `已整理掉 ${moved.length} 个闲字`,
        );
        this.afterFlipResolve();
    }

    private usedPropMark() {
        this.game.usedProp = true;
    }

    private showFail() {
        const mask = fadeMask(this.overlayRoot, true);
        const panel = addBg(this.overlayRoot, 'fail', 600, 420, Colors.panel, 16);
        popupSlideUp(panel, -420);
        const canAd = this.game.canUseAd();
        const left = this.game.adsLeft();
        addLabel(panel, 't', '散页匣满了', 34, Colors.title, 560, 50, true).node.setPosition(0, 148, 0);
        addLabel(
            panel,
            'd',
            this.playMode === 'match3'
                ? canAd
                    ? `看一段短视频，清空散页匣\n就能继续${Brand.modeMatch3}`
                    : '本局广告已用完\n可以重开本关，或先回首页歇歇'
                : canAd
                  ? '看一段短视频，清空匣内闲字\n就能接着点亮诗文'
                  : '本局广告已用完\n可以重开本关，或先回首页歇歇',
            22,
            Colors.text,
            560,
            70,
            true,
        ).node.setPosition(0, 72, 0);
        addLabel(
            panel,
            'ad',
            canAd ? `本局还可看 ${left} 次` : `本局广告 ${this.game.adUsed}/${this.game.adQuota}`,
            18,
            Colors.text,
            400,
            28,
            true,
        ).node.setPosition(0, 18, 0);

        const closeOverlay = () => {
            if (this.nodeAlive(mask)) mask.destroy();
            if (this.nodeAlive(panel)) panel.destroy();
        };

        addButton(
            panel,
            'revive',
            canAd ? '看视频 · 清空继续' : '今日次数已用完',
            420,
            76,
            canAd ? Colors.btnAd : Colors.btnDisabled,
            () => {
                if (!this.game.canUseAd()) {
                    this.tip('本局广告已用完');
                    return;
                }
                closeOverlay();
                this.simulateAd(() => {
                    if (!this.game.spendAd()) {
                        this.tip('本局广告已用完');
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
                    this.tip(this.playMode === 'match3' ? `匣已清空，继续${Brand.modeMatch3}` : '匣已清空，继续点亮');
                });
            },
            { textHex: Colors.brown, disabled: !canAd, fontSize: 28 },
        ).node.setPosition(0, -55, 0);

        addButton(panel, 'retry', '重开本关', 200, 64, Colors.btnMain, () => {
            closeOverlay();
            this.enterGame(this.currentLevel, this.playMode);
            if (this.playMode === 'daily') {
                this.game.freePropsLeft += 1;
                this.refreshEconomyHud();
            }
        }, { fontSize: 24, textHex: Colors.brown }).node.setPosition(-120, -145, 0);

        addButton(panel, 'home', '回首页', 200, 64, Colors.btnShare, () => {
            closeOverlay();
            this.showHome();
        }, { fontSize: 24, textHex: Colors.brown }).node.setPosition(120, -145, 0);
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
        addLabel(panel, 't', '再看一小段', 34, Colors.brown, 480, 48, true).node.setPosition(0, 110, 0);
        addLabel(
            panel,
            'd',
            `诗文已点亮！领奖前再看 ${need} 段短视频\n本局 ${this.game.adUsed}/${this.game.adQuota}，还需 ${need} 次`,
            22,
            Colors.text,
            500,
            80,
            true,
        ).node.setPosition(0, 20, 0);
        addButton(
            panel,
            'go',
            `看完领奖（${need}）`,
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
            if (this.playMode === 'daily') this.tip(`${Brand.modeDaily}已点亮`);
            else if (this.playMode === 'blind') this.tip(`${Brand.linkBlind}通关：主线进度不变`);
            else if (this.playMode === 'match3') this.tip(`${Brand.modeMatch3}通关：主线进度不变`);
            else this.tip('休闲通关：主线进度不变');
            this.leisureMode = false;
        } else {
            newItems = ITEMS.filter((it) => it.unlockLevel === this.currentLevel).map((i) => i.id);
            SaveData.onClear(this.currentLevel, stars, newItems);
        }
        if (this.playMode === 'match3') {
            this.showMatch3Win(stars, newItems);
            return;
        }
        this.showPoemRecital(verse, stars, newItems);
    }

    /** 三消通关结算（不走朗诗） */
    private showMatch3Win(stars: number, newItems: string[]) {
        const mask = fadeMask(this.overlayRoot, true);
        const panel = addBg(this.overlayRoot, 'm3win', 600, 420, Colors.panel, 18);
        popupScaleIn(panel);
        strokeRect(panel.getComponent(Graphics)!, 600, 420, Colors.boardBorder, 2, 18);
        addLabel(panel, 'done', `${Brand.modeMatch3}通关`, 28, Colors.highlight, 520, 40, true).node.setPosition(0, 140, 0);
        addLabel(panel, 'sub', '相同盲盒凑齐三个，架上已清空', 20, Colors.text, 520, 36, true).node.setPosition(
            0,
            90,
            0,
        );
        const starStr = '★'.repeat(Math.max(1, stars)) + '☆'.repeat(Math.max(0, 3 - stars));
        addLabel(panel, 'stars', starStr, 36, Colors.star, 400, 48, true).node.setPosition(0, 30, 0);
        if (newItems.length) {
            addLabel(
                panel,
                'unlock',
                `本关盲盒：${newItems.map((id) => ITEM_MAP[id]?.name || id).join('、')}`,
                18,
                Colors.highlight,
                520,
                32,
                true,
            ).node.setPosition(0, -20, 0);
        }
        const nextId = this.currentLevel + 1;
        // 三消为休闲模式，不卡主线解锁
        const hasNext = nextId <= Design.totalLevels;
        const close = () => {
            if (this.nodeAlive(mask)) mask.destroy();
            if (this.nodeAlive(panel)) panel.destroy();
        };
        addButton(
            panel,
            'next',
            hasNext ? '下一关' : '返回首页',
            280,
            72,
            Colors.btnAd,
            () => {
                close();
                if (hasNext) {
                    this.leisureMode = true;
                    this.playMode = 'match3';
                    this.enterGame(nextId, 'match3');
                } else this.showHome();
            },
            { textHex: Colors.brown },
        ).node.setPosition(0, -120, 0);
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
            isMidAutumn()
                ? `${MidAutumnCopy.winSeal} · 本关${verseKindLabel(poem.kind)}`
                : `诗文已点亮 · 本关${verseKindLabel(poem.kind)}`,
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
        const sideMode = this.playMode === 'daily' || this.playMode === 'blind';
        const hasNext = !sideMode && nextId <= Design.totalLevels && SaveData.isUnlocked(nextId);
        const closeRecital = () => {
            this.stopPoemSpeech();
            if (this.nodeAlive(mask)) mask.destroy();
            if (this.nodeAlive(panel)) panel.destroy();
        };

        const actions = makeNode('actions', panel, 560, nextBtnH);
        actions.setPosition(0, y - nextBtnH * 0.5, 0);
        actions.active = false;

        const nextLabel = sideMode
            ? this.playMode === 'daily'
                ? `再来${Brand.modeDaily}`
                : `再来${Brand.linkBlind}`
            : hasNext
              ? '下一关'
              : '返回首页';

        addButton(actions, 'next', nextLabel, 280, 72, Colors.btnAd, () => {
            closeRecital();
            if (this.playMode === 'daily') {
                this.startPlayMode('daily', dailyLevelId());
            } else if (this.playMode === 'blind') {
                this.startPlayMode('blind', this.currentLevel);
            } else if (hasNext) {
                this.leisureMode = false;
                this.playMode = 'poem';
                this.enterGame(nextId, 'poem');
            } else this.showHome();
        }, { textHex: Colors.brown }).node.setPosition(0, 0, 0);

        playVerseSeal(panel, 210, top - 180, newItems.length > 0);

        const skip = addLabel(panel, 'skip', '点击跳过', 18, Colors.text, 180, 28, true);
        skip.node.setPosition(0, hint.node.position.y, 0);
        skip.node.addComponent(BlockInputEvents);

        const revealActions = () => {
            if (!hint.isValid || !this.nodeAlive(hint.node)) return;
            hint.string = '朗诵完毕';
            if (this.nodeAlive(skip.node)) skip.node.active = false;
            if (unlockLab?.isValid && this.nodeAlive(unlockLab.node)) unlockLab.node.active = true;
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
                if (!lab.isValid || !this.nodeAlive(lab.node)) return;
                const op = lab.node.getComponent(UIOpacity) || lab.node.addComponent(UIOpacity);
                tween(op).to(0.35, { opacity: 255 }).start();
                tween(lab.node)
                    .to(0.2, { scale: new Vec3(1.06, 1.06, 1) }, { easing: 'backOut' })
                    .to(0.15, { scale: new Vec3(1, 1, 1) })
                    .start();
                playLineBrush(panel, 0, lab.node.position.y);
                lineNodes.forEach((other, j) => {
                    if (!other.isValid) return;
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
