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

export const Design = {
    width: 720,
    height: 1280,
    radius: 12,
    /** 散页匣默认格数（点亮书架） */
    traySize: 5,
    /** @deprecated 兼容旧引用，等同 traySize */
    slotCount: 5,
    /** 棋盘上盲盒尺寸（入匣另算 fitScale） */
    tileSize: 112,
    /** 文档：被遮挡透明度 70% */
    coveredAlpha: 0.7,
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
    tileLayerLift: 36,
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

export const Anim = {
    btnMs: 0.12,
    clickMs: 0.1,
    toSlotMs: 0.2,
    matchMs: 0.3,
    maskMs: 0.2,
    popupMs: 0.35,
    pageMs: 0.25,
    starGapMs: 0.08,
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
