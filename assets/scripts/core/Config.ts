/** 全局配色与常量 —— 严格对齐开发文档 */

export const Colors = {
    bg: '#FFF8EB',
    panel: '#FFFFFF',
    panelGame: '#FFFCF5',
    boardBorder: '#C9B59A',
    mask: 'rgba(0,0,0,0.6)',
    title: '#333333',
    text: '#888888',
    btnText: '#FFFFFF',
    highlight: '#FF9A52',
    btnMain: '#FFD194',
    btnMainPress: '#FFBE7A',
    btnDisabled: '#DCDCDC',
    btnAd: '#FF9A52',
    /** 设计稿分享钮偏冷灰 */
    btnShare: '#C9CED6',
    /** 散页匣边框/底色 */
    slotBorder: '#E8E2D5',
    slotTray: '#F7F0E2',
    slotEmpty: '#EDE4D4',
    lockMask: 'rgba(0,0,0,0.4)',
    brown: '#5C3A21',
    star: '#FFC94A',
};

/** 对外品牌与按钮文案（首页 / 关于 / 分享） */
export const Brand = {
    name: '诗匣',
    tagline: '翻开见诗',
    hook: '两种玩法 · 清匣消除 · 点亮诗句',
    full: '诗匣 · 翻开见诗',
    version: 'v1.0.0',
    modePoem: '点亮诗句',
    modePoemSub: (lv: number, title: string) => `按诗句点亮　·　第 ${lv} 关「${title}」`,
    modeMatch3: '清匣消除',
    modeMatch3Sub: '相同盲盒进匣，凑齐三个消除',
    modeDaily: '每日一诗',
    modeDailySub: (title: string) => `今日「${title}」· 短关速背`,
    linkBlind: '盲翻诗',
    linkRiddle: '猜灯谜',
    linkLevels: '选关',
    linkCatalog: '图鉴',
    linkLibrary: '诗藏',
    linkHowTo: '玩法',
    linkSettings: '设置',
    foot: 'v1.0.0　·　无账号 · 无存档',
};

export const Design = {
    width: 720,
    height: 1280,
    radius: 12,
    /**
     * 小游戏安全区兜底（设计坐标）
     * 宿主有 safeArea / 胶囊 API 时以实测为准；编辑器预览用此值模拟刘海+底栏
     */
    safeTopFallback: 56,
    safeBottomFallback: 40,
    /** 散页匣默认格数（点亮书架） */
    traySize: 5,
    /** @deprecated 兼容旧引用，等同 traySize */
    slotCount: 5,
    /** 棋盘上盲盒尺寸（入匣另算 fitScale） */
    tileSize: 112,
    /** 文档：被遮挡透明度 70% */
    coveredAlpha: 0.55,
    /** 入匣默认缩放 */
    slotScale: 0.62,
    /** 默认广告上限（会被关卡动态配额覆盖） */
    adLimitPerRound: 5,
    totalLevels: 30,
    boardW: 640,
    boardH: 620,
    /** 等距网格 */
    tileStepX: 54,
    tileStepY: 32,
    /** 层间抬升：越大同格叠放越明显，减少「看不出被压住」 */
    tileLayerLift: 48,
};

/** 散页匣容量：前期宽裕，后期更紧 */
export function traySizeForLevel(levelId: number): number {
    if (levelId <= 5) return 6;
    if (levelId <= 12) return 5;
    if (levelId <= 20) return 5;
    return 4;
}

/** 网格坐标 → 棋盘本地坐标（等距投影，层叠抬升） */
export function isoCell(col: number, row: number, layer = 0): { x: number; y: number; layer: number } {
    return {
        x: (col - row) * Design.tileStepX,
        y: -(col + row) * Design.tileStepY + layer * Design.tileLayerLift,
        layer,
    };
}

/**
 * 关卡广告经济：
 * - 前期免费道具多、广告少
 * - 后期免费道具归零，本局可看 4–5 次广告；通关至少消耗 2–5 次
 */
export function adQuotaForLevel(levelId: number): number {
    if (levelId <= 5) return 2;
    if (levelId <= 10) return 3;
    if (levelId <= 18) return 4;
    return 5;
}

/** 本局免费道具次数（撤回/洗牌/移除共用） */
export function freePropQuotaForLevel(levelId: number): number {
    if (levelId <= 4) return 3;
    if (levelId <= 8) return 2;
    if (levelId <= 12) return 1;
    return 0;
}

/** 通关结算前至少看过的广告数（后期 2–5） */
export function minAdsForLevel(levelId: number): number {
    if (levelId <= 8) return 0;
    if (levelId <= 14) return 2;
    if (levelId <= 20) return 3;
    if (levelId <= 25) return 4;
    return 5;
}

/** 难度档位 1–5，供关卡生成与 UI 展示 */
export function difficultyTier(levelId: number): number {
    if (levelId <= 5) return 1;
    if (levelId <= 10) return 2;
    if (levelId <= 18) return 3;
    if (levelId <= 25) return 4;
    return 5;
}

/**
 * 首页游戏模式（两大形式）：
 * - match3：三消（相同类型收进匣，凑齐 3 个消除）
 * - poem：古诗点亮（按诗句顺序点亮）
 * - daily / blind：古诗变体（今日一句 / 盲翻）
 */
export type PlayMode = 'match3' | 'poem' | 'daily' | 'blind';

/**
 * 场上显字模式：
 * - top：顶层可点块露字（新手友好）
 * - blind：场上全盲，只靠「下一字」+ 匣内已知字 + 提示推理
 * - none：三消不靠字，只认盲盒种类
 */
export type BoardGlyphMode = 'top' | 'blind' | 'none';

export function playModeTitle(mode: PlayMode): string {
    if (mode === 'match3') return Brand.modeMatch3;
    if (mode === 'daily') return Brand.modeDaily;
    if (mode === 'blind') return Brand.linkBlind;
    return Brand.modePoem;
}

export function isPoemFamily(mode: PlayMode): boolean {
    return mode === 'poem' || mode === 'daily' || mode === 'blind';
}

/** 今日一句：按东八区日期轮换 1–10 关（偏短、好分享） */
export function dailyLevelId(now = Date.now()): number {
    const day = Math.floor((now + 8 * 3600 * 1000) / 86400000);
    return (day % 10) + 1;
}

/** 盲翻局入口：至少通关过第 3 关后解锁 */
export function blindModeUnlocked(maxUnlocked: number): boolean {
    return maxUnlocked >= 3;
}

export function resolveBoardGlyphMode(mode: PlayMode, levelId: number): BoardGlyphMode {
    if (mode === 'match3') return 'none';
    if (mode === 'blind') return 'blind';
    if (mode === 'daily') return 'top';
    // 古诗主线：11 关起自动盲翻
    return levelId >= 11 ? 'blind' : 'top';
}

/** @deprecated 用 resolveBoardGlyphMode；保留兼容 */
export function boardGlyphMode(levelId: number): BoardGlyphMode {
    return resolveBoardGlyphMode('poem', levelId);
}

export const Anim = {
    btnMs: 0.12,
    clickMs: 0.1,
    toSlotMs: 0.2,
    matchMs: 0.3,
    maskMs: 0.2,
    popupMs: 0.35,
    pageMs: 0.25,
    starGapMs: 0.08,
    /** 首页入场弹跳 */
    homePopMs: 0.42,
    /** 果冻按压缩放 */
    jellyMs: 0.16,
};

export interface ItemDef {
    id: string;
    name: string;
    color: string;
    icon: string;
    unlockLevel: number;
}

export const ITEMS: ItemDef[] = [
    { id: 'book_red', name: '红皮书', color: '#E86A5D', icon: '书', unlockLevel: 1 },
    { id: 'book_blue', name: '蓝皮书', color: '#7EC8E3', icon: '书', unlockLevel: 1 },
    { id: 'book_green', name: '绿皮书', color: '#7BC98F', icon: '书', unlockLevel: 1 },
    { id: 'book_yellow', name: '黄皮书', color: '#F2D06B', icon: '书', unlockLevel: 2 },
    { id: 'book_orange', name: '橙皮书', color: '#F0A35A', icon: '书', unlockLevel: 3 },
    { id: 'bear', name: '小熊玩偶', color: '#F0D48A', icon: '熊', unlockLevel: 1 },
    { id: 'rabbit', name: '小兔玩偶', color: '#F5B8C8', icon: '兔', unlockLevel: 1 },
    { id: 'cat', name: '小猫玩偶', color: '#F2D06B', icon: '猫', unlockLevel: 1 },
    { id: 'cup', name: '暖心茶杯', color: '#F0A35A', icon: '杯', unlockLevel: 2 },
    { id: 'box', name: '收纳纸盒', color: '#E0C49A', icon: '盒', unlockLevel: 4 },
    { id: 'gift', name: '惊喜盲盒', color: '#FF9A6A', icon: '礼', unlockLevel: 6 },
    { id: 'basket', name: '彩球篮', color: '#E8A0B0', icon: '篮', unlockLevel: 10 },
];

export const ITEM_MAP = Object.fromEntries(ITEMS.map((i) => [i.id, i])) as Record<string, ItemDef>;

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const h = hex.replace('#', '');
    return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
    };
}

export function darken(hex: string, amount = 0.18): string {
    const { r, g, b } = hexToRgb(hex);
    const f = 1 - amount;
    const nr = Math.max(0, Math.floor(r * f));
    const ng = Math.max(0, Math.floor(g * f));
    const nb = Math.max(0, Math.floor(b * f));
    return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

export function lighten(hex: string, amount = 0.2): string {
    const { r, g, b } = hexToRgb(hex);
    const nr = Math.min(255, Math.floor(r + (255 - r) * amount));
    const ng = Math.min(255, Math.floor(g + (255 - g) * amount));
    const nb = Math.min(255, Math.floor(b + (255 - b) * amount));
    return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}
