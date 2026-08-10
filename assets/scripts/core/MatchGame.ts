import {
    PlayMode,
    adQuotaForLevel,
    Design,
    freePropQuotaForLevel,
    isoCell,
    isPoemFamily,
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

export type FlipKind = 'light' | 'tray' | 'clean' | 'fail' | 'match';

export interface FlipResult {
    ok: boolean;
    kind?: FlipKind;
    glyph?: string;
    trayIndex?: number;
    litChar?: string;
    targetIndex?: number;
    /** 三消：本步消掉的 tile id */
    matchedIds?: string[];
}

interface HistoryEntry {
    tileId: string;
    action: 'light' | 'tray' | 'clean' | 'trayLight' | 'match';
    targetIndexBefore: number;
    traySnapshot: string[];
    /** 三消消除时一并移除的 id */
    matchedIds?: string[];
}

/**
 * 点亮书架 / 三消：
 * - poem：按诗句点亮
 * - match3：匣内相同类型凑 3 个消除
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
    /** 当前规则形式 */
    playMode: PlayMode = 'poem';

    private coverX = Design.tileStepX * 0.5;
    private coverY = Math.max(Design.tileStepY * 0.85, Design.tileLayerLift * 0.45);
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

    loadLevel(
        data: LevelJson,
        boardW = Design.boardW,
        boardH = Design.boardH,
        mode: PlayMode = 'poem',
    ): void {
        this.playMode = mode;
        this.levelId = data.id;
        this.title = data.title;
        this.boardScale = 1;
        this.traySize = traySizeForLevel(data.id);

        const verse = getVerseForLevel(data.id);
        let targets = isPoemFamily(mode) ? verseCharSequence(verse) : [];

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
            this.coverX = Design.tileStepX * fit * 0.5;
            this.coverY = Math.max(Design.tileStepY * fit * 0.85, Design.tileLayerLift * fit * 0.45);
        }

        if (mode === 'match3') {
            this.ensureMatch3Triples(raw);
            this.targetChars = [];
        } else {
            if (targets.length > raw.length) {
                targets = targets.slice(0, Math.max(1, raw.length));
            }
            this.targetChars = targets;
            this.assignGlyphs(raw, targets, data.id);
        }

        this.tiles = raw;
        this.tray = Array(this.traySize).fill(null);
        this.targetIndex = 0;
        this.history = [];
        this.phase = 'playing';
        this.moves = 0;
        this.adUsed = 0;
        this.adQuota = adQuotaForLevel(data.id);
        this.freePropsLeft = freePropQuotaForLevel(data.id);
        this.minAdsRequired = mode === 'match3' ? 0 : minAdsForLevel(data.id);
        this.usedProp = false;
    }

    /** 三消：保证可消数量为 3 的倍数；余数块直接移出（避免残局无解） */
    private ensureMatch3Triples(tiles: TileModel[]): void {
        if (!tiles.length) return;
        const types = [...new Set(tiles.map((t) => t.type))];
        if (!types.length) return;
        const rem = tiles.length % 3;
        if (rem) {
            for (let i = 0; i < rem; i++) {
                const t = tiles[tiles.length - 1 - i];
                t.removed = true;
                t.glyph = '';
            }
        }
        const work = tiles.filter((t) => !t.removed);
        const groups = work.length / 3;
        const pool: string[] = [];
        for (let i = 0; i < groups; i++) {
            const ty = types[i % types.length];
            pool.push(ty, ty, ty);
        }
        for (let i = pool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        work.forEach((t, i) => {
            t.type = pool[i];
            t.glyph = '';
        });
    }

    /** 注入目标字 + 干扰字 */
    private assignGlyphs(tiles: TileModel[], targets: string[], levelId: number): void {
        const n = tiles.length;
        if (!n) return;
        const glyphs: string[] = new Array(n);
        const depthOf = (i: number) => {
            const t = tiles[i];
            let d = 0;
            for (const o of tiles) {
                if (o === t) continue;
                if (o.layer <= t.layer) continue;
                if (t.col != null && t.row != null && o.col === t.col && o.row === t.row) {
                    d++;
                    continue;
                }
                if (Math.abs(o.x - t.x) < this.coverX && Math.abs(o.y - t.y) < this.coverY) d++;
            }
            return d;
        };
        // 目标字优先落在浅层（可点/少遮挡），避免诗句字被埋在最底
        const order = tiles.map((_, i) => i);
        for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [order[i], order[j]] = [order[j], order[i]];
        }
        order.sort((a, b) => depthOf(a) - depthOf(b));

        for (let i = 0; i < targets.length && i < n; i++) {
            glyphs[order[i]] = targets[i];
        }
        const distractors = this.buildDistractorPool(levelId, targets);
        for (let i = targets.length; i < n; i++) {
            const prefab = tiles[order[i]].glyph;
            if (prefab) {
                glyphs[order[i]] = prefab;
            } else {
                glyphs[order[i]] = distractors[Math.floor(Math.random() * distractors.length)] || '书';
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

    /**
     * 让靠前的目标字尽量落在顶层可点位，避免开局/中盘「下一字」被深埋。
     * 按目标序列顺序占用顶层；顶层不够则停止。
     */
    private ensureSolvableGlyphPlacement(tiles: TileModel[], targets: string[]): void {
        if (!tiles.length || !targets.length) return;
        const covered = (tile: TileModel) => this.isCoveredAmong(tile, tiles);
        const reserved = new Set<TileModel>();
        const uniqueFirst: string[] = [];
        const seen = new Set<string>();
        for (const ch of targets) {
            if (seen.has(ch)) continue;
            seen.add(ch);
            uniqueFirst.push(ch);
        }
        // 至少保证前若干个不重复目标字在顶层
        const ensureCount = Math.min(uniqueFirst.length, Math.max(4, Math.ceil(uniqueFirst.length * 0.35)));
        for (let k = 0; k < ensureCount; k++) {
            const ch = uniqueFirst[k];
            const tops = tiles.filter((t) => !covered(t) && !reserved.has(t));
            if (!tops.length) break;
            const already = tops.find((t) => t.glyph === ch);
            if (already) {
                reserved.add(already);
                continue;
            }
            const donor = tiles.find((t) => t.glyph === ch && !reserved.has(t));
            if (!donor) continue;
            const host = tops[0];
            const tmp = host.glyph;
            host.glyph = donor.glyph;
            donor.glyph = tmp;
            reserved.add(host);
        }
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

    /**
     * 是否被压住：
     * - 同格更高层
     * - 或屏幕投影中心足够近的更高层（等距对角叠影：不同格却几乎画在同一位置）
     * 阈值小于正交步长，避免把旁边一层误判成压住。
     */
    isCovered(tile: TileModel): boolean {
        if (tile.removed || tile.inTray) return true;
        return this.isCoveredAmong(tile, this.tiles);
    }

    private isCoveredAmong(tile: TileModel, tiles: TileModel[]): boolean {
        for (const other of tiles) {
            if (other === tile || other.removed || other.inTray) continue;
            if (other.layer <= tile.layer) continue;
            if (
                tile.col != null &&
                tile.row != null &&
                other.col != null &&
                other.row != null &&
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

    private pushHistory(
        tileId: string,
        action: HistoryEntry['action'],
        targetBefore: number,
        matchedIds?: string[],
    ) {
        this.history.push({
            tileId,
            action,
            targetIndexBefore: targetBefore,
            traySnapshot: this.traySnapshot(),
            matchedIds,
        });
        this.moves++;
    }

    /** 场上翻开盲盒 */
    flip(tileId: string): FlipResult {
        if (this.phase !== 'playing') return { ok: false };
        const tile = this.tiles.find((t) => t.id === tileId);
        if (!tile || !this.isClickable(tile)) return { ok: false };

        if (this.playMode === 'match3') {
            return this.flipMatch3(tile);
        }

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
            this.evaluateEnd();
            return {
                ok: true,
                kind: 'light',
                glyph,
                litChar: glyph,
                targetIndex: this.targetIndex,
            };
        }

        const empty = this.tray.findIndex((t) => !t);
        if (empty < 0) {
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

    /** 三消：进匣后自动消三个相同类型 */
    private flipMatch3(tile: TileModel): FlipResult {
        const empty = this.tray.findIndex((t) => !t);
        if (empty < 0) {
            this.evaluateEnd();
            return { ok: false, kind: 'fail', glyph: tile.glyph };
        }
        const snapBefore = this.traySnapshot();
        tile.inTray = true;
        this.tray[empty] = tile;
        const matchedIds = this.clearMatch3Groups();
        this.history.push({
            tileId: tile.id,
            action: matchedIds.length ? 'match' : 'tray',
            targetIndexBefore: 0,
            traySnapshot: snapBefore,
            matchedIds: matchedIds.length ? matchedIds : undefined,
        });
        this.moves++;
        this.evaluateEnd();
        if (this.phase === 'failed') {
            return {
                ok: true,
                kind: 'fail',
                glyph: tile.glyph,
                trayIndex: empty,
                matchedIds,
            };
        }
        return {
            ok: true,
            kind: matchedIds.length ? 'match' : 'tray',
            glyph: tile.glyph,
            trayIndex: empty,
            matchedIds,
        };
    }

    /** 匣内同一 type 满 3 个则消除，返回被消 id */
    private clearMatch3Groups(): string[] {
        const matched: string[] = [];
        let changed = true;
        while (changed) {
            changed = false;
            const counts = new Map<string, TileModel[]>();
            for (const t of this.tray) {
                if (!t || t.removed) continue;
                const list = counts.get(t.type) || [];
                list.push(t);
                counts.set(t.type, list);
            }
            for (const [, list] of counts) {
                if (list.length < 3) continue;
                const take = list.slice(0, 3);
                for (const t of take) {
                    matched.push(t.id);
                    t.removed = true;
                    t.inTray = false;
                    for (let i = 0; i < this.tray.length; i++) {
                        if (this.tray[i]?.id === t.id) this.tray[i] = null;
                    }
                }
                changed = true;
            }
            if (changed) this.compactTray();
        }
        return matched;
    }

    /** 从散页匣取字：对则点亮，错则忽略（仍留匣内） */
    pickFromTray(tileId: string): FlipResult {
        if (this.phase !== 'playing') return { ok: false };
        // 三消：匣内不可点选，靠自动三消
        if (this.playMode === 'match3') return { ok: false };
        const tile = this.tiles.find((t) => t.id === tileId);
        if (!tile || !this.isTrayClickable(tile)) return { ok: false };

        const before = this.targetIndex;
        const glyph = tile.glyph;

        if (this.targetIndex >= this.targetChars.length) {
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
        if (this.playMode === 'match3') {
            if (this.trayCount() >= this.traySize && !this.trayHasMatch3()) {
                this.phase = 'failed';
            }
            return;
        }
        if (this.trayCount() >= this.traySize && !this.canLightFromTray()) {
            this.phase = 'failed';
        }
    }

    private trayHasMatch3(): boolean {
        const counts = new Map<string, number>();
        for (const t of this.tray) {
            if (!t || t.removed) continue;
            counts.set(t.type, (counts.get(t.type) || 0) + 1);
        }
        for (const c of counts.values()) {
            if (c >= 3) return true;
        }
        return false;
    }

    private checkWin(): boolean {
        if (this.playMode === 'match3') {
            return this.remainingBoard().length === 0 && this.trayCount() === 0;
        }
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
        if (entry.matchedIds?.length) {
            for (const id of entry.matchedIds) {
                const m = this.tiles.find((x) => x.id === id);
                if (m) {
                    m.removed = false;
                }
            }
        }
        this.restoreTray(entry.traySnapshot);

        if (entry.action === 'light' || entry.action === 'trayLight' || entry.action === 'clean') {
            tile.removed = false;
            if (entry.action === 'light') {
                tile.inTray = false;
                for (let i = 0; i < this.tray.length; i++) {
                    if (this.tray[i]?.id === tile.id) this.tray[i] = null;
                }
                this.compactTray();
            }
        } else if (entry.action === 'tray' || entry.action === 'match') {
            tile.removed = false;
            tile.inTray = false;
            for (let i = 0; i < this.tray.length; i++) {
                if (this.tray[i]?.id === tile.id) this.tray[i] = null;
            }
            this.compactTray();
            // match 已在上方复活；再套一次 snapshot 对齐匣
            this.restoreTray(entry.traySnapshot);
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
        if (isPoemFamily(this.playMode)) {
            this.ensureSolvableGlyphPlacement(board, this.targetChars.slice(this.targetIndex));
        }
        this.usedProp = true;
        this.history = [];
        return true;
    }

    /** 整理匣：清掉匣内闲字（最多 max 个）；古诗保留剩余诗句用字 */
    clearTrayJunk(max = 2): TileModel[] {
        if (this.phase !== 'playing') return [];
        const keep =
            this.playMode === 'match3'
                ? new Set<string>()
                : new Set(this.targetChars.slice(this.targetIndex));
        const moved: TileModel[] = [];
        for (let i = this.tray.length - 1; i >= 0 && moved.length < max; i--) {
            const t = this.tray[i];
            if (!t) continue;
            if (this.playMode !== 'match3' && keep.has(t.glyph)) continue;
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

    /** 提示：古诗找目标字；三消找可点且有助于成组的类型 */
    hintTargetId(): string | null {
        if (this.playMode === 'match3') {
            const trayTypes = new Map<string, number>();
            for (const t of this.tray) {
                if (!t || t.removed) continue;
                trayTypes.set(t.type, (trayTypes.get(t.type) || 0) + 1);
            }
            const board = this.remainingBoard().filter((t) => this.isClickable(t));
            const prefer = board.find((t) => (trayTypes.get(t.type) || 0) > 0);
            if (prefer) return prefer.id;
            return board[0]?.id || this.remainingBoard()[0]?.id || null;
        }
        const t = this.currentTarget();
        if (!t) return null;
        for (const tile of this.tray) {
            if (tile && !tile.removed && tile.glyph === t) return tile.id;
        }
        for (const tile of this.remainingBoard()) {
            if (tile.glyph === t && this.isClickable(tile)) return tile.id;
        }
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
