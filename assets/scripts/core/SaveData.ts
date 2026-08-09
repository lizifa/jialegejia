import { sys } from 'cc';
import { Design } from './Config';

const LEGACY_KEY = 'jialegejia_save_v1';

/** 清掉旧包 localStorage，之后永不读写 */
function purgeLegacyStorage(): void {
    try {
        const s = (sys.localStorage as unknown as Storage) || localStorage;
        s?.removeItem(LEGACY_KEY);
    } catch {
        /* ignore */
    }
}

export interface LevelRecord {
    stars: number; // 0-3, 0=未通关但可挑战(已解锁)
    unlocked: boolean;
}

export type PropKind = 'undo' | 'shuffle' | 'remove';

/** 仅当次会话有效，不做持久化 */
export interface SaveState {
    version: number;
    maxUnlocked: number;
    totalStars: number;
    levels: Record<string, LevelRecord>;
    unlockedItems: string[];
    soundOn: boolean;
    propUndo: number;
    propShuffle: number;
    propRemove: number;
}

function defaultState(): SaveState {
    return {
        version: 1,
        maxUnlocked: 1,
        totalStars: 0,
        levels: { '1': { stars: 0, unlocked: true } },
        unlockedItems: ['book_red', 'book_blue', 'book_green'],
        soundOn: true,
        propUndo: 1,
        propShuffle: 1,
        propRemove: 1,
    };
}

export class SaveData {
    private static _data: SaveState | null = null;
    private static _purged = false;

    static load(): SaveState {
        if (!this._purged) {
            this._purged = true;
            purgeLegacyStorage();
        }
        if (!this._data) this._data = defaultState();
        return this._data;
    }

    static getLevel(id: number): LevelRecord {
        const data = this.load();
        const key = String(id);
        if (!data.levels[key]) {
            data.levels[key] = { stars: 0, unlocked: id <= data.maxUnlocked };
        }
        return data.levels[key];
    }

    static isUnlocked(id: number): boolean {
        return id <= this.load().maxUnlocked;
    }

    /** 通关结算：stars 1-3（仅内存解锁下一关） */
    static onClear(levelId: number, stars: number, newItems: string[]): void {
        const data = this.load();
        const rec = this.getLevel(levelId);
        const prev = rec.stars || 0;
        if (stars > prev) {
            data.totalStars += stars - prev;
            rec.stars = stars;
        }
        rec.unlocked = true;
        if (levelId >= data.maxUnlocked && levelId < Design.totalLevels) {
            data.maxUnlocked = levelId + 1;
            this.getLevel(levelId + 1).unlocked = true;
        }
        for (const id of newItems) {
            if (!data.unlockedItems.includes(id)) data.unlockedItems.push(id);
        }
    }

    /** 休闲通关：可补星，不推进主线解锁 */
    static onLeisureClear(levelId: number, stars: number): void {
        const data = this.load();
        const rec = this.getLevel(levelId);
        const prev = rec.stars || 0;
        if (stars > prev) {
            data.totalStars += stars - prev;
            rec.stars = stars;
        }
    }

    static unlockItem(id: string): boolean {
        const data = this.load();
        if (data.unlockedItems.includes(id)) return false;
        data.unlockedItems.push(id);
        return true;
    }

    static setSound(on: boolean): void {
        this.load().soundOn = on;
    }

    static propCount(kind: PropKind): number {
        const d = this.load();
        if (kind === 'undo') return d.propUndo;
        if (kind === 'shuffle') return d.propShuffle;
        return d.propRemove;
    }

    static addProp(kind: PropKind, n = 1): void {
        const d = this.load();
        if (kind === 'undo') d.propUndo += n;
        else if (kind === 'shuffle') d.propShuffle += n;
        else d.propRemove += n;
    }

    /** 消耗库存道具 */
    static consumeProp(kind: PropKind): boolean {
        const d = this.load();
        if (kind === 'undo') {
            if (d.propUndo <= 0) return false;
            d.propUndo--;
        } else if (kind === 'shuffle') {
            if (d.propShuffle <= 0) return false;
            d.propShuffle--;
        } else {
            if (d.propRemove <= 0) return false;
            d.propRemove--;
        }
        return true;
    }
}
