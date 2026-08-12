/**
 * 节日主题：中秋
 * forceMidAutumn 便于现在预览；上线前改为 false，按公历窗口自动开闭
 */

export type FestivalId = 'none' | 'midAutumn';

/** 近年中秋（农历八月十五对应公历） */
const MID_AUTUMN_DAYS: { y: number; m: number; d: number }[] = [
    { y: 2025, m: 10, d: 6 },
    { y: 2026, m: 9, d: 25 },
    { y: 2027, m: 9, d: 15 },
    { y: 2028, m: 10, d: 3 },
];

export const FestivalConfig = {
    /** 开发预览强制中秋；正式环境请改 false */
    forceMidAutumn: true,
    daysBefore: 12,
    daysAfter: 3,
};

function startOfDay(y: number, m: number, d: number): number {
    // 东八区正午避免时区边界
    return Date.UTC(y, m - 1, d, 4, 0, 0);
}

function inMidAutumnWindow(now: number): boolean {
    const before = FestivalConfig.daysBefore * 86400000;
    const after = FestivalConfig.daysAfter * 86400000;
    for (const { y, m, d } of MID_AUTUMN_DAYS) {
        const center = startOfDay(y, m, d);
        if (now >= center - before && now <= center + after) return true;
    }
    return false;
}

export function activeFestival(now = Date.now()): FestivalId {
    if (FestivalConfig.forceMidAutumn) return 'midAutumn';
    if (inMidAutumnWindow(now)) return 'midAutumn';
    return 'none';
}

export function isMidAutumn(now = Date.now()): boolean {
    return activeFestival(now) === 'midAutumn';
}

/** 中秋文案 */
export const MidAutumnCopy = {
    tagline: '花好月圆 · 翻开见诗',
    badge: '中秋',
    riddleTitle: '中秋灯谜',
    riddleEyebrow: '月下花灯 · 四选一',
    dailyHint: '中秋日读 · 月下诗',
    homeTip: '中秋到了，翻开诗匣望一望月',
    winSeal: '花好月圆',
};

/** 中秋氛围色 */
export const MidAutumnColors = {
    moon: '#F5E6B8',
    moonEdge: '#E8C98A',
    nightWash: '#E8E4F0',
    lacquer: '#C45C3A',
    gold: '#D4A017',
};

/**
 * 中秋每日一诗：优先月亮相关短诗所在关卡
 * （按现有 getVerseForLevel 映射：4≈静夜思）
 */
export const MID_AUTUMN_DAILY_LEVELS = [4, 4, 1, 6, 9, 4, 11, 4, 16, 4];
