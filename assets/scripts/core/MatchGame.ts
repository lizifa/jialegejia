import {
    adQuotaForLevel,
    Design,
    freePropQuotaForLevel,
    isoCell,
    minAdsForLevel,
    traySizeForLevel,
} from './Config';
import { getVerseForLevel, gradeForLevel, verseCharSequence, versesByGrade } from './Literature';

export interface TileModel {
    id: string;
    type: string;
    /** 翻开后的汉字 */
    glyph: string;
    x: number;
    y: number;
    layer: number;
    col?: number;
    row?: number;
    removed: boolean;
    /** 在散页匣中 */
    inTray: boolean;
}

export interface LevelTileJson {
    type: string;
    layer: number;
    col?: number;
    row?: number;
    x?: number;
    y?: number;
    /** 可选手工指定字 */
    glyph?: string;
}

export interface LevelJson {
    id: number;
    title: string;
    tiles: LevelTileJson[];
}

export type GamePhase = 'playing' | 'won' | 'failed';

export type FlipKind = 'light' | 'tray' | 'clean' | 'fail';

export interface FlipResult {
    ok: boolean;
    kind?: FlipKind;
    glyph?: string;
    trayIndex?: number;
    litChar?: string;
    targetIndex?: number;
}

interface HistoryEntry {
    tileId: string;
    action: 'light' | 'tray' | 'clean' | 'trayLight';
    targetIndexBefore: number;
    traySnapshot: string[];
}

/**
 * 点亮书架（原创）：
 * - 仅顶层可点
 * - 翻开字：对上诗句下一字 → 点亮；否则进散页匣
 * - 诗已全亮后翻开剩余块 → 直接理走（clean）
 * - 匣满且无法从匣点亮下一字 → 失败
 * - 诗全亮且场/匣皆空 → 通关
 */
export class MatchGame {
    tiles: TileModel[] = [];
    /** 散页匣 */
    tray: (TileModel | null)[] = [];
    traySize = Design.traySize;
    targetChars: string[] = [];
    /** 下一个要点亮的下标 */
    targetIndex = 0;
    history: HistoryEntry[] = [];
    phase: GamePhase = 'playing';
    levelId = 1;
    title = '';
    moves = 0;
    adUsed = 0;
    adQuota = Design.adLimitPerRound;
    freePropsLeft = 0;
    minAdsRequired = 0;
    usedProp = false;
    boardScale = 1;

    private coverX = Design.tileSize * 0.72;
    private coverY = Design.tileSize * 0.72;
    private tileW = Design.tileSize;
    private tileH = Design.tileSize;

    /** 已点亮字数 */
    get poemRevealed(): number {
        return this.targetIndex;
    }

    currentTarget(): string | null {
        if (this.targetIndex >= this.targetChars.length) return null;
        return this.targetChars[this.targetIndex];
    }

    loadLevel(data: LevelJson, boardW = Design.boardW, boardH = Design.boardH): void {
        this.levelId = data.id;
        this.title = data.title;
        this.boardScale = 1;
        this.traySize = traySizeForLevel(data.id);

        const verse = getVerseForLevel(data.id);
        let targets = verseCharSequence(verse);

        const raw = data.tiles.map((t, i) => {
            let x = t.x ?? 0;
            let y = t.y ?? 0;
            if (t.col != null && t.row != null) {
                const p = isoCell(t.col, t.row, t.layer);
                x = p.x;
                y = p.y;
            }
            return {
                id: `t${i}`,
                type: t.type,
                glyph: t.glyph || '',
                x,
                y,
                layer: t.layer,
                col: t.col,
                row: t.row,
                removed: false,
                inTray: false,
            } as TileModel;
        });

        if (raw.length) {
            const cx = raw.reduce((s, t) => s + t.x, 0) / raw.length;
            const cy = raw.reduce((s, t) => s + t.y, 0) / raw.length;
            for (const t of raw) {
                t.x -= cx;
                t.y -= cy;
            }
            const half = Design.tileSize * 0.52;
            let minX = Infinity;
            let maxX = -Infinity;
            let minY = Infinity;
            let maxY = -Infinity;
            for (const t of raw) {
                minX = Math.min(minX, t.x - half);
                maxX = Math.max(maxX, t.x + half);
                minY = Math.min(minY, t.y - half);
                maxY = Math.max(maxY, t.y + half);
            }
            const maxW = Math.max(120, boardW - 80);
            const maxH = Math.max(120, boardH - 48);
            const bw = Math.max(1, maxX - minX);
            const bh = Math.max(1, maxY - minY);
            const fit = Math.min(1, maxW / bw, maxH / bh) * 0.9;
            this.boardScale = fit;
            for (const t of raw) {
                t.x = Math.round(t.x * fit);
                t.y = Math.round(t.y * fit - 12);
            }
            this.tileW = Design.tileSize * fit;
            this.tileH = Design.tileSize * fit;
            this.coverX = this.tileW * 0.72;
            this.coverY = this.tileH * 0.72;
        }

        if (targets.length > raw.length) {
            targets = targets.slice(0, Math.max(1, raw.length));
        }
        this.targetChars = targets;
        this.assignGlyphs(raw, targets, data.id);

        this.tiles = raw;
        this.tray = Array(this.traySize).fill(null);
        this.targetIndex = 0;
        this.history = [];
        this.phase = 'playing';
        this.moves = 0;
        this.adUsed = 0;
        this.adQuota = adQuotaForLevel(data.id);
        this.freePropsLeft = freePropQuotaForLevel(data.id);
        this.minAdsRequired = minAdsForLevel(data.id);
        this.usedProp = false;
    }

    /** 注入目标字 + 干扰字 */
    private assignGlyphs(tiles: TileModel[], targets: string[], levelId: number): void {
        const n = tiles.length;
        if (!n) return;
        const glyphs: string[] = new Array(n);
        const indices = tiles.map((_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        // 先写入目标序列所需的每个字
        for (let i = 0; i < targets.length; i++) {
            glyphs[indices[i]] = targets[i];
        }
        const distractors = this.buildDistractorPool(levelId, targets);
        for (let i = targets.length; i < n; i++) {
            const prefab = tiles[indices[i]].glyph;
            if (prefab) {
                glyphs[indices[i]] = prefab;
            } else {
                glyphs[indices[i]] = distractors[Math.floor(Math.random() * distractors.length)] || '书';
            }
        }
        // 手工 glyph 优先（关卡 JSON）
        tiles.forEach((t, i) => {
            if (t.glyph) glyphs[i] = t.glyph;
        });
        // 若手工覆盖导致目标字不足，补回缺失目标字
        const have: Record<string, number> = {};
        for (const g of glyphs) have[g] = (have[g] || 0) + 1;
        const need: Record<string, number> = {};
        for (const g of targets) need[g] = (need[g] || 0) + 1;
        for (const ch of Object.keys(need)) {
            let miss = need[ch] - (have[ch] || 0);
            for (let i = 0; i < n && miss > 0; i++) {
                const g = glyphs[i];
                if ((need[g] || 0) < (have[g] || 0) || !need[g]) {
                    // 可替换的干扰位
                    if ((have[g] || 0) > (need[g] || 0)) {
                        have[g]--;
                        glyphs[i] = ch;
                        have[ch] = (have[ch] || 0) + 1;
                        miss--;
                    }
                }
            }
        }
        tiles.forEach((t, i) => {
            t.glyph = glyphs[i] || '书';
        });
        this.ensureSolvableGlyphPlacement(tiles, targets);
    }

    /** 尽量让首个目标字落在顶层可点位，避免开局死锁 */
    private ensureSolvableGlyphPlacement(tiles: TileModel[], targets: string[]): void {
        if (!tiles.length || !targets.length) return;
        const first = targets[0];
        const covered = (tile: TileModel) => {
            for (const other of tiles) {
                if (other === tile) continue;
                if (other.layer <= tile.layer) continue;
                if (
                    tile.col != null &&
                    tile.row != null &&
                    other.col === tile.col &&
                    other.row === tile.row
                ) {
                    return true;
                }
                const dx = Math.abs(other.x - tile.x);
                const dy = Math.abs(other.y - tile.y);
                if (dx < this.coverX && dy < this.coverY) return true;
            }
            return false;
        };
        const top = tiles.filter((t) => !covered(t));
        if (!top.length) return;
        if (top.some((t) => t.glyph === first)) return;
        const donor = tiles.find((t) => t.glyph === first);
        if (!donor) return;
        const host = top[0];
        const tmp = host.glyph;
        host.glyph = donor.glyph;
        donor.glyph = tmp;
    }

    private buildDistractorPool(levelId: number, targets: string[]): string[] {
        const grade = gradeForLevel(levelId);
        const avoid = new Set(targets);
        const pool: string[] = [];
        for (const v of versesByGrade(grade)) {
            for (const ch of verseCharSequence(v)) {
                if (!avoid.has(ch)) pool.push(ch);
            }
        }
        if (pool.length < 8) {
            for (const ch of '书架盒诗文言古今山水风月春夏') {
                if (!avoid.has(ch)) pool.push(ch);
            }
        }
        return pool.length ? pool : ['书', '架', '盒'];
    }

    adsLeft(): number {
        return Math.max(0, this.adQuota - this.adUsed);
    }

    canUseAd(): boolean {
        return this.adUsed < this.adQuota;
    }

    spendAd(): boolean {
        if (!this.canUseAd()) return false;
        this.adUsed++;
        return true;
    }

    takePropCost(): 'free' | 'ad' | 'none' {
        if (this.freePropsLeft > 0) {
            this.freePropsLeft--;
            this.usedProp = true;
            return 'free';
        }
        if (this.canUseAd()) return 'ad';
        return 'none';
    }

    adsNeededToClear(): number {
        return Math.max(0, this.minAdsRequired - this.adUsed);
    }

    remainingBoard(): TileModel[] {
        return this.tiles.filter((t) => !t.removed && !t.inTray);
    }

    trayCount(): number {
        return this.tray.filter(Boolean).length;
    }

    isCovered(tile: TileModel): boolean {
        if (tile.removed || tile.inTray) return true;
        for (const other of this.tiles) {
            if (other === tile || other.removed || other.inTray) continue;
            if (other.layer <= tile.layer) continue;
            if (
                tile.col != null &&
                tile.row != null &&
                other.col === tile.col &&
                other.row === tile.row
            ) {
                return true;
            }
            const dx = Math.abs(other.x - tile.x);
            const dy = Math.abs(other.y - tile.y);
            if (dx < this.coverX && dy < this.coverY) return true;
        }
        return false;
    }

    isClickable(tile: TileModel): boolean {
        return this.phase === 'playing' && !tile.removed && !tile.inTray && !this.isCovered(tile);
    }

    isTrayClickable(tile: TileModel): boolean {
        return this.phase === 'playing' && !!tile.inTray && !tile.removed;
    }

    canUndo(): boolean {
        return this.phase === 'playing' && this.history.length > 0;
    }

    private traySnapshot(): string[] {
        return this.tray.map((t) => (t ? t.id : ''));
    }

    private restoreTray(snapshot: string[]): void {
        for (const t of this.tiles) {
            if (t.inTray) t.inTray = false;
        }
        this.tray = Array(this.traySize).fill(null);
        snapshot.forEach((id, i) => {
            if (!id || i >= this.traySize) return;
            const t = this.tiles.find((x) => x.id === id);
            if (t && !t.removed) {
                t.inTray = true;
                this.tray[i] = t;
            }
        });
    }

    private pushHistory(tileId: string, action: HistoryEntry['action'], targetBefore: number) {
        this.history.push({
            tileId,
            action,
            targetIndexBefore: targetBefore,
            traySnapshot: this.traySnapshot(),
        });
        this.moves++;
    }

    /** 场上翻开盲盒 */
    flip(tileId: string): FlipResult {
        if (this.phase !== 'playing') return { ok: false };
        const tile = this.tiles.find((t) => t.id === tileId);
        if (!tile || !this.isClickable(tile)) return { ok: false };

        const before = this.targetIndex;
        const glyph = tile.glyph;

        // 诗已全亮：理架模式，直接收走
        if (this.targetIndex >= this.targetChars.length) {
            this.pushHistory(tileId, 'clean', before);
            tile.removed = true;
            tile.inTray = false;
            this.evaluateEnd();
            return { ok: true, kind: 'clean', glyph, targetIndex: this.targetIndex };
        }

        if (glyph === this.currentTarget()) {
            this.pushHistory(tileId, 'light', before);
            tile.removed = true;
            tile.inTray = false;
            this.targetIndex++;
            // 链式：匣内若有下一字可继续由 UI 提示，逻辑上不自动消
            this.evaluateEnd();
            return {
                ok: true,
                kind: 'light',
                glyph,
                litChar: glyph,
                targetIndex: this.targetIndex,
            };
        }

        // 进散页匣
        const empty = this.tray.findIndex((t) => !t);
        if (empty < 0) {
            // 匣满时不可再塞错字；若匣内也点不亮下一字则失败
            this.evaluateEnd();
            return { ok: false, kind: 'fail', glyph };
        }
        this.pushHistory(tileId, 'tray', before);
        tile.inTray = true;
        this.tray[empty] = tile;
        this.evaluateEnd();
        if (this.phase === 'failed') {
            return { ok: true, kind: 'fail', glyph, trayIndex: empty, targetIndex: this.targetIndex };
        }
        return { ok: true, kind: 'tray', glyph, trayIndex: empty, targetIndex: this.targetIndex };
    }

    /** 从散页匣取字：对则点亮，错则忽略（仍留匣内） */
    pickFromTray(tileId: string): FlipResult {
        if (this.phase !== 'playing') return { ok: false };
        const tile = this.tiles.find((t) => t.id === tileId);
        if (!tile || !this.isTrayClickable(tile)) return { ok: false };

        const before = this.targetIndex;
        const glyph = tile.glyph;

        if (this.targetIndex >= this.targetChars.length) {
            // 理架：匣内闲字直接清掉
            this.pushHistory(tileId, 'clean', before);
            this.removeFromTray(tile);
            tile.removed = true;
            this.evaluateEnd();
            return { ok: true, kind: 'clean', glyph, targetIndex: this.targetIndex };
        }

        if (glyph !== this.currentTarget()) {
            return { ok: false };
        }

        this.pushHistory(tileId, 'trayLight', before);
        this.removeFromTray(tile);
        tile.removed = true;
        this.targetIndex++;
        this.evaluateEnd();
        return {
            ok: true,
            kind: 'light',
            glyph,
            litChar: glyph,
            targetIndex: this.targetIndex,
        };
    }

    private removeFromTray(tile: TileModel) {
        for (let i = 0; i < this.tray.length; i++) {
            if (this.tray[i]?.id === tile.id) this.tray[i] = null;
        }
        tile.inTray = false;
        this.compactTray();
    }

    compactTray(): void {
        const filled = this.tray.filter((t): t is TileModel => !!t && !t.removed);
        this.tray = Array(this.traySize).fill(null);
        filled.forEach((t, i) => {
            if (i < this.traySize) {
                this.tray[i] = t;
                t.inTray = true;
            }
        });
    }

    private canLightFromTray(): boolean {
        const t = this.currentTarget();
        if (!t) return false;
        return this.tray.some((x) => x && !x.removed && x.glyph === t);
    }

    private evaluateEnd(): void {
        if (this.checkWin()) {
            this.phase = 'won';
            return;
        }
        // 匣满且当前不能从匣点亮 → 失败
        if (this.trayCount() >= this.traySize && !this.canLightFromTray()) {
            this.phase = 'failed';
        }
    }

    private checkWin(): boolean {
        return (
            this.targetIndex >= this.targetChars.length &&
            this.remainingBoard().length === 0 &&
            this.trayCount() === 0
        );
    }

    isBoardCleared(): boolean {
        return this.checkWin();
    }

    undo(): TileModel | null {
        if (!this.canUndo()) return null;
        const entry = this.history.pop()!;
        const tile = this.tiles.find((t) => t.id === entry.tileId);
        if (!tile) return null;

        this.targetIndex = entry.targetIndexBefore;
        this.restoreTray(entry.traySnapshot);

        if (entry.action === 'light' || entry.action === 'trayLight' || entry.action === 'clean') {
            tile.removed = false;
            // light 来自场上：不在匣；trayLight/clean 从匣：由 snapshot 决定
            if (entry.action === 'light') {
                tile.inTray = false;
                for (let i = 0; i < this.tray.length; i++) {
                    if (this.tray[i]?.id === tile.id) this.tray[i] = null;
                }
                this.compactTray();
            }
        } else if (entry.action === 'tray') {
            tile.removed = false;
            tile.inTray = false;
            for (let i = 0; i < this.tray.length; i++) {
                if (this.tray[i]?.id === tile.id) this.tray[i] = null;
            }
            this.compactTray();
        }

        this.phase = 'playing';
        return tile;
    }

    /** 洗牌：重排场上剩余位置，字跟着走 */
    shuffle(): boolean {
        if (this.phase !== 'playing') return false;
        const board = this.remainingBoard();
        if (board.length < 2) return false;
        const coords = board.map((t) => ({
            x: t.x,
            y: t.y,
            layer: t.layer,
            col: t.col,
            row: t.row,
        }));
        for (let i = coords.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [coords[i], coords[j]] = [coords[j], coords[i]];
        }
        board.forEach((t, i) => {
            t.x = coords[i].x;
            t.y = coords[i].y;
            t.layer = coords[i].layer;
            t.col = coords[i].col;
            t.row = coords[i].row;
        });
        this.usedProp = true;
        this.history = [];
        return true;
    }

    /** 整理匣：清掉匣内非当前目标的闲字（最多 max 个） */
    clearTrayJunk(max = 2): TileModel[] {
        if (this.phase !== 'playing') return [];
        const target = this.currentTarget();
        const moved: TileModel[] = [];
        for (let i = this.tray.length - 1; i >= 0 && moved.length < max; i--) {
            const t = this.tray[i];
            if (!t) continue;
            if (target && t.glyph === target) continue;
            t.removed = true;
            t.inTray = false;
            this.tray[i] = null;
            moved.push(t);
        }
        this.compactTray();
        this.usedProp = true;
        this.history = [];
        this.evaluateEnd();
        return moved;
    }

    /** 广告复活：清空散页匣 */
    reviveClearTray(): void {
        for (let i = 0; i < this.tray.length; i++) {
            const t = this.tray[i];
            if (!t) continue;
            t.removed = true;
            t.inTray = false;
            this.tray[i] = null;
        }
        this.phase = 'playing';
        this.history = [];
        this.evaluateEnd();
    }

    /** 提示：返回场上或匣内一个当前目标字的 id */
    hintTargetId(): string | null {
        const t = this.currentTarget();
        if (!t) return null;
        for (const tile of this.tray) {
            if (tile && !tile.removed && tile.glyph === t) return tile.id;
        }
        for (const tile of this.remainingBoard()) {
            if (tile.glyph === t && this.isClickable(tile)) return tile.id;
        }
        // 被压住的也提示位置（仍返回 id，UI 可高亮）
        for (const tile of this.remainingBoard()) {
            if (tile.glyph === t) return tile.id;
        }
        return null;
    }

    calcStars(): number {
        if (this.adUsed > 0 || this.minAdsRequired > 0) return 1;
        if (this.usedProp) return 2;
        return 3;
    }
}
