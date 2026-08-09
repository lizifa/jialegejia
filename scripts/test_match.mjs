/** 纯逻辑冒烟：不依赖 Cocos 运行时 */
import { readFileSync } from 'fs';

const Design = { slotCount: 7, tileSize: 78, totalLevels: 30, adLimitPerRound: 3 };

class MatchGame {
  tiles = [];
  slots = Array(Design.slotCount).fill(null);
  parked = [];
  history = [];
  phase = 'playing';
  overlapRatio = 0.42;
  tileW = Design.tileSize;
  tileH = Design.tileSize;
  adUsed = 0;
  usedProp = false;
  moves = 0;

  loadLevel(data) {
    this.tiles = data.tiles.map((t, i) => ({
      id: `t${i}`, type: t.type, x: t.x, y: t.y, layer: t.layer,
      removed: false, inSlot: false, parked: false,
    }));
    this.slots = Array(Design.slotCount).fill(null);
    this.parked = [];
    this.history = [];
    this.phase = 'playing';
  }

  remainingBoard() {
    return this.tiles.filter((t) => !t.removed && !t.inSlot && !t.parked);
  }

  isCovered(tile) {
    const half = this.tileW * 0.5;
    for (const other of this.tiles) {
      if (other === tile || other.removed || other.inSlot || other.parked) continue;
      if (other.layer <= tile.layer) continue;
      const dx = Math.abs(other.x - tile.x);
      const dy = Math.abs(other.y - tile.y);
      if (dx < this.tileW * this.overlapRatio && dy < this.tileH * this.overlapRatio) return true;
      if (dx < half * 0.9 && dy < half * 0.9) return true;
    }
    return false;
  }

  isClickable(tile) {
    return this.phase === 'playing' && !tile.removed && !tile.inSlot && !tile.parked && !this.isCovered(tile);
  }

  slotCount() { return this.slots.filter(Boolean).length; }

  findInsertIndex(type) {
    let lastSame = -1;
    for (let i = 0; i < Design.slotCount; i++) if (this.slots[i]?.type === type) lastSame = i;
    if (lastSame >= 0) return Math.min(lastSame + 1, Design.slotCount - 1);
    for (let i = 0; i < Design.slotCount; i++) if (!this.slots[i]) return i;
    return 0;
  }

  pick(tileId) {
    const tile = this.tiles.find((t) => t.id === tileId);
    if (!tile || !this.isClickable(tile)) return { ok: false };
    if (this.slotCount() >= Design.slotCount) return { ok: false };
    const insertAt = this.findInsertIndex(tile.type);
    for (let i = Design.slotCount - 1; i > insertAt; i--) this.slots[i] = this.slots[i - 1];
    this.slots[insertAt] = tile;
    tile.inSlot = true;
    this.history.push({ tileId });
    return { ok: true, insertIndex: insertAt };
  }

  tryMatch() {
    const counts = {};
    for (const s of this.slots) {
      if (!s) continue;
      (counts[s.type] ||= []).push(s);
    }
    let target = null;
    for (const type of Object.keys(counts)) {
      if (counts[type].length >= 3) { target = counts[type].slice(0, 3); break; }
    }
    if (!target) return null;
    const ids = new Set(target.map((t) => t.id));
    for (let i = 0; i < Design.slotCount; i++) {
      const s = this.slots[i];
      if (s && ids.has(s.id)) { s.removed = true; s.inSlot = false; this.slots[i] = null; }
    }
    const filled = this.slots.filter(Boolean);
    this.slots = Array(Design.slotCount).fill(null);
    filled.forEach((t, i) => { this.slots[i] = t; });
    return target;
  }

  resolveAfterPick() {
    const matched = this.tryMatch();
    if (this.remainingBoard().length === 0 && this.slotCount() === 0 && this.parked.length === 0) {
      this.phase = 'won';
      return { matched, won: true };
    }
    const counts = {};
    for (const s of this.slots) if (s) counts[s.type] = (counts[s.type] || 0) + 1;
    const hasMatch = Object.values(counts).some((c) => c >= 3);
    if (this.slotCount() >= Design.slotCount && !hasMatch) {
      this.phase = 'failed';
      return { matched, failed: true };
    }
    return { matched };
  }
}

const level = JSON.parse(readFileSync(new URL('../assets/resources/levels/level1.json', import.meta.url), 'utf8'));
const g = new MatchGame();
g.loadLevel(level);

let steps = 0;
const maxSteps = 500;
while (g.phase === 'playing' && steps < maxSteps) {
  const clickable = g.remainingBoard().filter((t) => g.isClickable(t));
  if (!clickable.length) {
    console.log('DEADLOCK: no clickable tiles', { left: g.remainingBoard().length, slots: g.slotCount() });
    process.exit(1);
  }
  // prefer type already in slots
  const slotTypes = new Set(g.slots.filter(Boolean).map((s) => s.type));
  clickable.sort((a, b) => (slotTypes.has(b.type) ? 1 : 0) - (slotTypes.has(a.type) ? 1 : 0));
  const pick = clickable[0];
  if (g.slotCount() >= Design.slotCount) {
    console.log('FAIL full slots');
    break;
  }
  g.pick(pick.id);
  g.resolveAfterPick();
  steps++;
}

console.log({ phase: g.phase, steps, left: g.remainingBoard().length, tiles: level.tiles.length });
if (g.phase !== 'won') {
  console.log('WARN: greedy solver did not clear level1 (may still be solvable with better play)');
} else {
  console.log('OK: level1 cleared by greedy');
}
