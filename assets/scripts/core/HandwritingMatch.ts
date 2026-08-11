/**
 * 手写识别（题库内）：把笔迹与全部灯谜谜底字形比对，找出最像的字
 * 非开放 OCR；识别范围是本关题库出现过的谜底用字/词
 */

import { LANTERN_RIDDLES } from './Riddles';

export type InkStroke = { x: number; y: number }[];

export type HandwritingRecognizeResult = {
    /** 识别出的字/词；过低置信则为空 */
    text: string;
    score: number;
    /** 备选前几名 */
    top: { text: string; score: number }[];
    unsupported?: boolean;
};

export type HandwritingMatchResult = {
    ok: boolean;
    score: number;
    matched: string;
    /** 识别出的字 */
    recognized: string;
    unsupported?: boolean;
};

const GRID = 48;

let vocabCache: Map<string, Float32Array> | null = null;
let vocabBuilding: Promise<Map<string, Float32Array>> | null = null;

function splitAnswerCandidates(answer: string): string[] {
    const parts = answer
        .split(/[\/｜|、,，\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    return parts.length ? parts : [answer.trim()].filter(Boolean);
}

function collectVocab(): string[] {
    const set = new Set<string>();
    for (const r of LANTERN_RIDDLES) {
        for (const t of splitAnswerCandidates(r.answer)) set.add(t);
    }
    return [...set];
}

function createCanvas(w: number, h: number): {
    canvas: { width: number; height: number; getContext: (t: string) => any };
    ctx: any;
} | null {
    const g = globalThis as any;
    try {
        if (typeof g.document?.createElement === 'function') {
            const canvas = g.document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (ctx) return { canvas, ctx };
        }
    } catch {
        /* ignore */
    }
    try {
        if (typeof g.wx?.createOffscreenCanvas === 'function') {
            const canvas = g.wx.createOffscreenCanvas({ type: '2d', width: w, height: h });
            const ctx = canvas.getContext('2d');
            if (ctx) return { canvas, ctx };
        }
    } catch {
        /* ignore */
    }
    try {
        if (typeof g.wx?.createCanvas === 'function') {
            const canvas = g.wx.createCanvas();
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (ctx) return { canvas, ctx };
        }
    } catch {
        /* ignore */
    }
    return null;
}

function clearWhite(ctx: any, w: number, h: number) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
}

function drawStrokes(
    ctx: any,
    strokes: InkStroke[],
    padW: number,
    padH: number,
    canvasW: number,
    canvasH: number,
) {
    clearWhite(ctx, canvasW, canvasH);
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#000000';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(5, canvasW * 0.07);

    const sx = canvasW / padW;
    const sy = canvasH / padH;
    const toX = (x: number) => (x + padW * 0.5) * sx;
    const toY = (y: number) => (padH * 0.5 - y) * sy;

    for (const s of strokes) {
        if (!s.length) continue;
        if (s.length === 1) {
            ctx.beginPath();
            ctx.arc(toX(s[0]!.x), toY(s[0]!.y), ctx.lineWidth * 0.4, 0, Math.PI * 2);
            ctx.fill();
            continue;
        }
        ctx.beginPath();
        ctx.moveTo(toX(s[0]!.x), toY(s[0]!.y));
        for (let i = 1; i < s.length; i++) ctx.lineTo(toX(s[i]!.x), toY(s[i]!.y));
        ctx.stroke();
    }
}

function drawGlyph(ctx: any, text: string, w: number, h: number) {
    clearWhite(ctx, w, h);
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const len = Math.max(1, text.length);
    const fontSize = Math.floor(Math.min(w, h) * (len <= 1 ? 0.7 : len === 2 ? 0.4 : 0.3));
    ctx.font = `900 ${fontSize}px "PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif`;
    ctx.lineWidth = Math.max(2, fontSize * 0.04);
    ctx.strokeText(text, w * 0.5, h * 0.52);
    ctx.fillText(text, w * 0.5, h * 0.52);
}

function inkMaskFromImageData(data: Uint8ClampedArray, w: number, h: number): Uint8Array {
    const mask = new Uint8Array(w * h);
    for (let i = 0, p = 0; i < w * h; i++, p += 4) {
        const v = data[p]! + data[p + 1]! + data[p + 2]!;
        mask[i] = v < 245 * 3 ? 1 : 0;
    }
    return mask;
}

function keepLargestBlob(mask: Uint8Array, w: number, h: number): Uint8Array {
    const seen = new Uint8Array(w * h);
    let best: number[] = [];
    const stack: number[] = [];

    for (let i = 0; i < w * h; i++) {
        if (!mask[i] || seen[i]) continue;
        const comp: number[] = [];
        stack.length = 0;
        stack.push(i);
        seen[i] = 1;
        while (stack.length) {
            const cur = stack.pop()!;
            comp.push(cur);
            const x = cur % w;
            const y = (cur / w) | 0;
            const tryPush = (nx: number, ny: number) => {
                if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
                const ni = ny * w + nx;
                if (!mask[ni] || seen[ni]) return;
                seen[ni] = 1;
                stack.push(ni);
            };
            tryPush(x + 1, y);
            tryPush(x - 1, y);
            tryPush(x, y + 1);
            tryPush(x, y - 1);
        }
        if (comp.length > best.length) best = comp;
    }

    const out = new Uint8Array(w * h);
    for (const i of best) out[i] = 1;
    return out;
}

function bboxOf(mask: Uint8Array, w: number, h: number) {
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (!mask[y * w + x]) continue;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }
    }
    if (maxX < 0) return null;
    return { minX, minY, maxX, maxY };
}

function normalizeMask(mask: Uint8Array, w: number, h: number): Float32Array | null {
    const box = bboxOf(mask, w, h);
    if (!box) return null;
    const bw = Math.max(1, box.maxX - box.minX + 1);
    const bh = Math.max(1, box.maxY - box.minY + 1);
    const side = Math.max(bw, bh);
    const cx = (box.minX + box.maxX) * 0.5;
    const cy = (box.minY + box.maxY) * 0.5;
    const pad = side * 0.12;
    const half = side * 0.5 + pad;
    const x0 = cx - half;
    const y0 = cy - half;
    const span = half * 2;

    const out = new Float32Array(GRID * GRID);
    for (let gy = 0; gy < GRID; gy++) {
        for (let gx = 0; gx < GRID; gx++) {
            const sx = x0 + ((gx + 0.5) / GRID) * span;
            const sy = y0 + ((gy + 0.5) / GRID) * span;
            const ix = Math.min(w - 1, Math.max(0, Math.floor(sx)));
            const iy = Math.min(h - 1, Math.max(0, Math.floor(sy)));
            out[gy * GRID + gx] = mask[iy * w + ix] ? 1 : 0;
        }
    }
    return out;
}

function dilate(src: Float32Array, radius: number): Float32Array {
    const out = new Float32Array(src.length);
    const r = Math.max(1, radius | 0);
    for (let y = 0; y < GRID; y++) {
        for (let x = 0; x < GRID; x++) {
            let hit = 0;
            for (let dy = -r; dy <= r && !hit; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (dx * dx + dy * dy > r * r) continue;
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
                    if (src[ny * GRID + nx]! > 0.5) {
                        hit = 1;
                        break;
                    }
                }
            }
            out[y * GRID + x] = hit;
        }
    }
    return out;
}

function inkCount(mask: Float32Array): number {
    let n = 0;
    for (let i = 0; i < mask.length; i++) if (mask[i]! > 0.5) n++;
    return n;
}

function coverage(user: Float32Array, refFat: Float32Array): number {
    let need = 0;
    let hit = 0;
    for (let i = 0; i < user.length; i++) {
        if (user[i]! <= 0.5) continue;
        need++;
        if (refFat[i]! > 0.5) hit++;
    }
    return need <= 0 ? 0 : hit / need;
}

function softIou(a: Float32Array, b: Float32Array): number {
    let inter = 0;
    let uni = 0;
    for (let i = 0; i < a.length; i++) {
        const av = a[i]! > 0.5 ? 1 : 0;
        const bv = b[i]! > 0.5 ? 1 : 0;
        inter += av & bv;
        uni += av | bv;
    }
    return uni <= 0 ? 0 : inter / uni;
}

function correlation(a: Float32Array, b: Float32Array): number {
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
        const av = a[i]!;
        const bv = b[i]!;
        dot += av * bv;
        na += av * av;
        nb += bv * bv;
    }
    if (na < 1e-6 || nb < 1e-6) return 0;
    return dot / Math.sqrt(na * nb);
}

function scorePair(user: Float32Array, ref: Float32Array) {
    const userFat = dilate(user, 2);
    const refFat = dilate(ref, 3);
    const covU = coverage(user, refFat);
    const covR = coverage(ref, userFat);
    const i = softIou(userFat, refFat);
    const c = correlation(userFat, refFat);
    const uN = inkCount(user);
    const rN = Math.max(1, inkCount(ref));
    const dens = Math.min(uN, rN) / Math.max(uN, rN);
    let score = covU * 0.42 + covR * 0.22 + i * 0.2 + c * 0.16;
    if (dens < 0.22) score *= dens / 0.22;
    return score;
}

async function ensureVocabCache(): Promise<Map<string, Float32Array> | null> {
    if (vocabCache) return vocabCache;
    if (vocabBuilding) return vocabBuilding;

    vocabBuilding = (async () => {
        const size = 120;
        const pack = createCanvas(size, size);
        if (!pack) return new Map();
        const { ctx } = pack;
        const map = new Map<string, Float32Array>();
        const vocab = collectVocab();
        // 分批让出主线程，避免首进卡死
        const batch = 40;
        for (let i = 0; i < vocab.length; i++) {
            const t = vocab[i]!;
            drawGlyph(ctx, t, size, size);
            const raw = inkMaskFromImageData(
                ctx.getImageData(0, 0, size, size).data as Uint8ClampedArray,
                size,
                size,
            );
            const norm = normalizeMask(raw, size, size);
            if (norm) map.set(t, norm);
            if (i > 0 && i % batch === 0) {
                await new Promise<void>((r) => setTimeout(r, 0));
            }
        }
        vocabCache = map;
        return map;
    })();

    return vocabBuilding;
}

function strokesToUserMask(
    strokes: InkStroke[],
    padW: number,
    padH: number,
): { mask: Float32Array | null; unsupported: boolean } {
    const size = 180;
    const pack = createCanvas(size, size);
    if (!pack) return { mask: null, unsupported: true };
    const { ctx } = pack;
    drawStrokes(ctx, strokes, padW, padH, size, size);
    const userRaw = inkMaskFromImageData(
        ctx.getImageData(0, 0, size, size).data as Uint8ClampedArray,
        size,
        size,
    );
    const userClean = keepLargestBlob(userRaw, size, size);
    return { mask: normalizeMask(userClean, size, size), unsupported: false };
}

/**
 * 识别手写内容：在题库谜底字表中找最像的
 */
export async function recognizeHandwriting(
    strokes: InkStroke[],
    padW: number,
    padH: number,
): Promise<HandwritingRecognizeResult> {
    if (!strokes.some((s) => s.length > 0)) {
        return { text: '', score: 0, top: [] };
    }
    const pointN = strokes.reduce((n, s) => n + s.length, 0);
    if (pointN < 8) return { text: '', score: 0.02, top: [] };

    const { mask: userMask, unsupported } = strokesToUserMask(strokes, padW, padH);
    if (unsupported) return { text: '', score: 0, top: [], unsupported: true };
    if (!userMask) return { text: '', score: 0, top: [] };

    const cache = await ensureVocabCache();
    if (!cache || cache.size === 0) {
        return { text: '', score: 0, top: [], unsupported: true };
    }

    const ranked: { text: string; score: number }[] = [];
    for (const [text, ref] of cache) {
        ranked.push({ text, score: scorePair(userMask, ref) });
    }
    ranked.sort((a, b) => b.score - a.score);
    const top = ranked.slice(0, 3);
    const best = top[0]!;

    // 置信不够则视为未识别出
    const text = best.score >= 0.32 ? best.text : '';
    return { text, score: best.score, top };
}

/**
 * 识别后再与本题谜底比对
 */
export async function matchHandwritingToAnswer(
    strokes: InkStroke[],
    answer: string,
    padW: number,
    padH: number,
): Promise<HandwritingMatchResult> {
    const candidates = splitAnswerCandidates(answer);
    const rec = await recognizeHandwriting(strokes, padW, padH);
    if (rec.unsupported) {
        return {
            ok: false,
            score: 0,
            matched: candidates[0] ?? '',
            recognized: '',
            unsupported: true,
        };
    }

    const recognized = rec.text;
    // 也看前三名是否命中谜底（写得稍歪时第 2 名可能才是对的）
    const hit =
        candidates.some((c) => c === recognized) ||
        rec.top.some((t) => t.score >= 0.3 && candidates.includes(t.text));

    const matchedHit = hit
        ? candidates.find((c) => c === recognized || rec.top.some((t) => t.text === c && t.score >= 0.3)) ||
          recognized
        : candidates[0] ?? '';

    const score = hit
        ? Math.max(rec.score, ...rec.top.filter((t) => candidates.includes(t.text)).map((t) => t.score))
        : rec.score;

    // 识别出的字命中谜底，或 top 命中且分够
    const ok = hit && score >= 0.32;
    return {
        ok,
        score,
        matched: matchedHit || recognized || candidates[0] || '',
        recognized: recognized || (rec.top[0]?.text ?? ''),
    };
}

/** 预热字库（进猜灯谜页时可调用） */
export function warmupHandwritingVocab(): void {
    void ensureVocabCache();
}
