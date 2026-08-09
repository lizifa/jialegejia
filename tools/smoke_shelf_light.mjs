/**
 * 点亮书架核心逻辑冒烟（不依赖 Cocos 运行时）
 * 用法：npx esbuild assets/scripts/core/MatchGame.ts --bundle --platform=node --format=cjs --outfile=/tmp/shelf_matchgame.cjs && node tools/smoke_shelf_light.mjs
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const { MatchGame } = require('/tmp/shelf_matchgame.cjs');

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

function loadLevel(id) {
    return JSON.parse(fs.readFileSync(path.join(root, 'assets/resources/levels', `level${id}.json`), 'utf8'));
}

function countNeed(g) {
    const have = {};
    g.tiles.forEach((t) => {
        have[t.glyph] = (have[t.glyph] || 0) + 1;
    });
    const need = {};
    g.targetChars.forEach((c) => {
        need[c] = (need[c] || 0) + 1;
    });
    for (const c of Object.keys(need)) {
        assert((have[c] || 0) >= need[c], `缺字 ${c}`);
    }
}

function smokeMechanics(id) {
    const data = loadLevel(id);
    const g = new MatchGame();
    g.loadLevel(data);
    countNeed(g);
    for (const t of g.tiles.filter((t) => g.isCovered(t))) {
        assert(!g.flip(t.id).ok, 'covered flip');
    }
    const first = g.currentTarget();
    const clickable = g.tiles.filter((t) => g.isClickable(t) && t.glyph === first);
    assert(clickable.length > 0, `L${id} 首字不可点 ${first}`);
    assert(g.flip(clickable[0].id).kind === 'light', 'light');
    const wrong = g.tiles.find((t) => g.isClickable(t) && t.glyph !== g.currentTarget());
    assert(!!wrong, 'need wrong');
    assert(g.flip(wrong.id).kind === 'tray', 'tray');

    const g2 = new MatchGame();
    g2.loadLevel(data);
    g2.traySize = 3;
    g2.tray = [null, null, null];
    let guard = 0;
    while (g2.trayCount() < 3 && g2.phase === 'playing' && guard++ < 300) {
        const tgt = g2.currentTarget();
        const w = g2.tiles.find((t) => g2.isClickable(t) && t.glyph !== tgt);
        if (!w) break;
        g2.flip(w.id);
    }
    while (
        g2.phase === 'playing' &&
        g2.tray.some((t) => t && t.glyph === g2.currentTarget()) &&
        guard++ < 400
    ) {
        const t = g2.tray.find((x) => x && x.glyph === g2.currentTarget());
        g2.pickFromTray(t.id);
        const w = g2.tiles.find((x) => g2.isClickable(x) && x.glyph !== g2.currentTarget());
        if (w && g2.trayCount() < g2.traySize) g2.flip(w.id);
    }
    while (g2.trayCount() < g2.traySize && guard++ < 500) {
        const tgt = g2.currentTarget();
        const w = g2.tiles.find((t) => g2.isClickable(t) && t.glyph !== tgt);
        if (!w) break;
        g2.flip(w.id);
    }
    if (g2.phase !== 'failed') g2.evaluateEnd();
    assert(g2.phase === 'failed', 'failed phase');
    g2.reviveClearTray();
    assert(g2.phase === 'playing' && g2.trayCount() === 0, 'revive');

    const g3 = new MatchGame();
    g3.loadLevel(data);
    const tgt = g3.currentTarget();
    const junk = g3.tiles.find((t) => g3.isClickable(t) && t.glyph !== tgt);
    g3.flip(junk.id);
    const inTray = g3.tray.find(Boolean);
    inTray.glyph = tgt;
    assert(g3.pickFromTray(inTray.id).kind === 'light', 'tray light');
    console.log(`mechanics L${id} OK`);
}

function smokeWinSynthetic() {
    const poem = ['春', '眠', '不', '觉', '晓'];
    const tiles = poem.map((glyph, i) => ({ type: 'a', layer: 0, col: i, row: 0, glyph }));
    tiles.push({ type: 'b', layer: 0, col: 0, row: 1, glyph: '闲' });
    tiles.push({ type: 'b', layer: 0, col: 1, row: 1, glyph: '字' });
    const g = new MatchGame();
    g.loadLevel({ id: 1, title: 'syn', tiles });
    g.targetChars = poem.slice();
    g.targetIndex = 0;
    for (const t of g.tiles) {
        if (t.row === 0 && t.col != null && t.col < poem.length) t.glyph = poem[t.col];
        if (t.row === 1 && t.col === 0) t.glyph = '闲';
        if (t.row === 1 && t.col === 1) t.glyph = '字';
    }
    for (const ch of poem) {
        const t = g.tiles.find((x) => g.isClickable(x) && x.glyph === ch);
        assert(t, 'find ' + ch);
        assert(g.flip(t.id).kind === 'light', 'light ' + ch);
    }
    while (g.phase === 'playing') {
        const t = g.tiles.find((x) => g.isClickable(x)) || g.tray.find(Boolean);
        if (!t) break;
        if (t.inTray) g.pickFromTray(t.id);
        else g.flip(t.id);
    }
    assert(g.phase === 'won', 'win syn ' + g.phase);
    console.log('synthetic win OK');
}

function smokeCoverStack() {
    const tiles = [
        { type: 'a', layer: 0, col: 0, row: 0, glyph: '底' },
        { type: 'a', layer: 1, col: 0, row: 0, glyph: '春' },
        { type: 'a', layer: 0, col: 1, row: 0, glyph: '眠' },
    ];
    const g = new MatchGame();
    g.loadLevel({ id: 1, title: 'cover', tiles });
    g.targetChars = ['春', '眠'];
    g.targetIndex = 0;
    const bottom = g.tiles.find((t) => t.layer === 0 && t.col === 0);
    const top = g.tiles.find((t) => t.layer === 1);
    const side = g.tiles.find((t) => t.col === 1);
    bottom.glyph = '底';
    top.glyph = '春';
    side.glyph = '眠';
    assert(g.isCovered(bottom), 'bottom covered');
    assert(!g.flip(bottom.id).ok, 'cannot flip bottom');
    assert(g.flip(top.id).kind === 'light', 'flip top');
    assert(!g.isCovered(bottom), 'bottom free');
    assert(g.flip(bottom.id).kind === 'tray', 'bottom to tray');
    assert(g.flip(side.id).kind === 'light', 'side light');
    assert(g.pickFromTray(bottom.id).kind === 'clean', 'clean junk');
    assert(g.phase === 'won', 'cover win');
    console.log('cover stack OK');
}

for (const id of [1, 10, 20, 30]) smokeMechanics(id);
smokeWinSynthetic();
smokeCoverStack();
console.log('ALL_SMOKE_OK');
