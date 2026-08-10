import { view } from 'cc';
import { Design } from './Config';

/**
 * 小游戏安全区（设计坐标，原点在屏幕中心，Y 向上）
 * 同时兼容：微信 wx / 抖音 tt / 浏览器与编辑器预览
 */
export interface SafeLayout {
    /** 可见高度（设计坐标） */
    visH: number;
    half: number;
    /** 顶部不可点/不可画区域高度（刘海/状态栏/胶囊） */
    topInset: number;
    /** 底部不可点区域高度（Home 指示条 / 手势条） */
    bottomInset: number;
    /** 顶栏内容中心 Y（返回钮、关卡标题） */
    headerY: number;
    /** 顶栏圆钮建议尺寸 */
    headerBtnSize: number;
    /** 底部内容底边内侧 Y（道具栏下沿应不低于此） */
    contentBottom: number;
    /** 顶部内容顶边内侧 Y */
    contentTop: number;
}

const FALLBACK_BTN = 56;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hostApi(): any {
    const g = globalThis as Record<string, unknown>;
    return g.tt || g.wx || null;
}

export function getVisibleDesignHeight(): number {
    try {
        const vs = view.getVisibleSize();
        if (vs?.height > 200) return vs.height;
    } catch {
        /* ignore */
    }
    try {
        const api = hostApi();
        const info = api?.getWindowInfo?.() ?? api?.getSystemInfoSync?.();
        const winW = info?.windowWidth || info?.screenWidth;
        const winH = info?.windowHeight || info?.screenHeight;
        if (winW && winH) return (winH * Design.width) / winW;
    } catch {
        /* ignore */
    }
    return Design.height;
}

/**
 * 读取宿主安全区，换算为设计坐标 inset。
 * 抖音 / 微信均提供 safeArea + 右上角菜单按钮。
 */
export function getSafeLayout(): SafeLayout {
    const visH = getVisibleDesignHeight();
    const half = visH * 0.5;
    const FALLBACK_TOP = Design.safeTopFallback;
    const FALLBACK_BOTTOM = Design.safeBottomFallback;
    let topInset = FALLBACK_TOP;
    let bottomInset = FALLBACK_BOTTOM;
    let headerBtnSize = FALLBACK_BTN;
    let headerY: number | null = null;

    try {
        const api = hostApi();
        if (api) {
            const info = api.getWindowInfo?.() ?? api.getSystemInfoSync?.();
            const winW = info?.windowWidth || info?.screenWidth;
            const winH = info?.windowHeight || info?.screenHeight;
            if (winW && winH) {
                const scale = Design.width / winW;
                const safe = info.safeArea;
                if (safe && typeof safe.top === 'number') {
                    topInset = Math.max(Math.round(FALLBACK_TOP * 0.6), Math.round(safe.top * scale));
                    const botPx = Math.max(0, winH - (safe.bottom ?? winH));
                    bottomInset = Math.max(Math.round(FALLBACK_BOTTOM * 0.75), Math.round(botPx * scale));
                } else if (typeof info.statusBarHeight === 'number') {
                    topInset = Math.max(FALLBACK_TOP, Math.round((info.statusBarHeight + 12) * scale));
                }

                // 胶囊/菜单钮：顶栏与之水平对齐（微信 / 抖音）
                const menu = api.getMenuButtonBoundingClientRect?.();
                if (menu?.height && winH) {
                    const capsuleCenterFromTop = (menu.top + menu.height * 0.5) * scale;
                    headerY = visH * 0.5 - capsuleCenterFromTop;
                    headerBtnSize = Math.max(48, Math.min(64, Math.round(menu.height * scale)));
                    const capsuleBottomFromTop = (menu.top + menu.height) * scale;
                    topInset = Math.max(topInset, Math.round(capsuleBottomFromTop + 6));
                }
            }
        }
    } catch {
        /* 编辑器 / 浏览器走 fallback */
    }

    // 顶栏中心：必须与胶囊垂直居中平行；无 API 时按常见小游戏胶囊高度估算
    if (headerY == null) {
        // 编辑器 / 浏览器：模拟「刘海下胶囊」约距顶 96 设计像素
        headerY = half - Math.max(96, topInset + headerBtnSize * 0.35);
    }
    // 仅防止飞出屏幕，不再把按钮往上顶到刘海里
    headerY = Math.min(half - 40, Math.max(-half + 80, headerY));

    // 业务内容从胶囊下沿再留空隙开始，顶栏中间不放方框
    const contentTop = Math.min(headerY - headerBtnSize * 0.5 - 10, half - topInset - 4);
    const contentBottom = -half + bottomInset;

    return {
        visH,
        half,
        topInset,
        bottomInset,
        headerY,
        headerBtnSize,
        contentBottom,
        contentTop,
    };
}
