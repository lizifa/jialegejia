import { Color, Graphics } from 'cc';
import { darken, hexToRgb, lighten } from '../core/Config';

function rgb(hex: string): { r: number; g: number; b: number } {
    return hexToRgb(hex.startsWith('#') ? hex : `#${hex}`);
}

function col(hex: string): Color {
    const { r, g, b } = rgb(hex);
    return new Color(r, g, b, 255);
}

/** 饱和主色 —— 对齐效果图实体盲盒 */
export const TILE_COLORS: Record<string, string> = {
    book_red: '#E85D55',
    book_blue: '#6EC4E0',
    book_green: '#6BCB7F',
    book_yellow: '#F0CC55',
    book_orange: '#F0994A',
    bear: '#E8C96A',
    rabbit: '#F2A8BE',
    cat: '#EBD05A',
    cup: '#F0994A',
    box: '#DDB889',
    gift: '#FF8F5A',
    basket: '#E890A8',
};

function fillPoly(g: Graphics, pts: [number, number][], hex: string) {
    g.fillColor = col(hex);
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.close();
    g.fill();
}

function strokePoly(g: Graphics, pts: [number, number][], hex: string, w = 2) {
    g.strokeColor = col(hex);
    g.lineWidth = w;
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.close();
    g.stroke();
}

/**
 * 经典等距实体方块（效果图同款体块）
 * 不使用半透明 fill，避免「玻璃盖」观感
 */
export function drawItemTile(g: Graphics, size: number, typeId: string, locked: boolean): void {
    g.clear();
    let base = TILE_COLORS[typeId] || '#D0C4B0';
    if (locked) {
        // 被压住：降饱和变灰一点，但仍是实体块
        base = mixGrey(base, 0.45);
    }

    const w = size * 0.5;
    const h = size * 0.29;
    const d = size * 0.42;
    const topZ = d * 0.5;

    const top: [number, number][] = [
        [0, topZ + h],
        [w, topZ],
        [0, topZ - h],
        [-w, topZ],
    ];
    const left: [number, number][] = [
        [-w, topZ],
        [0, topZ - h],
        [0, -topZ - h],
        [-w, -topZ],
    ];
    const right: [number, number][] = [
        [w, topZ],
        [0, topZ - h],
        [0, -topZ - h],
        [w, -topZ],
    ];

    const topC = lighten(base, locked ? 0.08 : 0.22);
    const leftC = darken(base, locked ? 0.05 : 0.1);
    const rightC = darken(base, locked ? 0.18 : 0.28);
    const edge = darken(base, 0.4);

    // 先侧面后顶面，保证顶面压住
    fillPoly(g, left, leftC);
    fillPoly(g, right, rightC);
    fillPoly(g, top, topC);
    strokePoly(g, left, edge, 1.8);
    strokePoly(g, right, edge, 1.8);
    strokePoly(g, top, edge, 1.8);

    const faceCx = 0;
    const faceCy = topZ * 0.15;
    const faceR = size * 0.2;

    if (typeId.startsWith('book_')) {
        drawBookPages(g, right, locked ? '#E8E0D8' : '#FFFFFF');
    } else if (typeId === 'cat') {
        drawCat(g, faceCx, faceCy, faceR);
    } else if (typeId === 'bear') {
        drawBear(g, faceCx, faceCy, faceR);
    } else if (typeId === 'rabbit') {
        drawRabbit(g, faceCx, faceCy, faceR);
    } else if (typeId === 'cup') {
        drawCup(g, faceCx, faceCy - 2, faceR);
    } else if (typeId === 'gift') {
        drawGift(g, faceCx, faceCy, faceR * 0.9);
    } else if (typeId === 'box') {
        drawBox(g, faceCx, faceCy, faceR * 0.85);
    } else if (typeId === 'basket') {
        drawBasket(g, faceCx, faceCy, faceR * 0.9);
    }
}

function mixGrey(hex: string, t: number): string {
    const { r, g, b } = rgb(hex);
    const grey = 0.35 * r + 0.45 * g + 0.2 * b;
    const nr = Math.floor(r * (1 - t) + grey * t);
    const ng = Math.floor(g * (1 - t) + grey * t);
    const nb = Math.floor(b * (1 - t) + grey * t);
    return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}

function drawBookPages(g: Graphics, right: [number, number][], lineHex: string) {
    g.strokeColor = col(lineHex);
    g.lineWidth = 2.2;
    for (let i = 0; i < 4; i++) {
        const t0 = 0.18 + i * 0.16;
        const t1 = t0 + 0.08;
        const ax = right[0][0] * (1 - t0) + right[3][0] * t0;
        const ay = right[0][1] * (1 - t0) + right[3][1] * t0;
        const bx = right[1][0] * (1 - t1) + right[2][0] * t1;
        const by = right[1][1] * (1 - t1) + right[2][1] * t1;
        g.moveTo(ax * 0.65 + bx * 0.35, ay * 0.65 + by * 0.35);
        g.lineTo(ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75);
        g.stroke();
    }
}

function drawCat(g: Graphics, cx: number, cy: number, r: number) {
    g.fillColor = col('#9A9AA8');
    g.circle(cx, cy, r);
    g.fill();
    g.moveTo(cx - r * 0.65, cy + r * 0.35);
    g.lineTo(cx - r * 0.95, cy + r * 1.05);
    g.lineTo(cx - r * 0.2, cy + r * 0.65);
    g.close();
    g.fill();
    g.moveTo(cx + r * 0.65, cy + r * 0.35);
    g.lineTo(cx + r * 0.95, cy + r * 1.05);
    g.lineTo(cx + r * 0.2, cy + r * 0.65);
    g.close();
    g.fill();
    g.fillColor = col('#2F2F35');
    g.circle(cx - r * 0.32, cy + r * 0.08, r * 0.11);
    g.fill();
    g.circle(cx + r * 0.32, cy + r * 0.08, r * 0.11);
    g.fill();
    g.fillColor = col('#F2A0B4');
    g.circle(cx, cy - r * 0.18, r * 0.1);
    g.fill();
}

function drawBear(g: Graphics, cx: number, cy: number, r: number) {
    g.fillColor = col('#C4895A');
    g.circle(cx - r * 0.72, cy + r * 0.62, r * 0.36);
    g.fill();
    g.circle(cx + r * 0.72, cy + r * 0.62, r * 0.36);
    g.fill();
    g.circle(cx, cy, r);
    g.fill();
    g.fillColor = col('#E8C9A0');
    g.ellipse(cx, cy - r * 0.18, r * 0.5, r * 0.36);
    g.fill();
    g.fillColor = col('#4A2E18');
    g.circle(cx - r * 0.28, cy + r * 0.12, r * 0.1);
    g.fill();
    g.circle(cx + r * 0.28, cy + r * 0.12, r * 0.1);
    g.fill();
    g.circle(cx, cy - r * 0.12, r * 0.12);
    g.fill();
}

function drawRabbit(g: Graphics, cx: number, cy: number, r: number) {
    g.fillColor = col('#FFFFFF');
    g.ellipse(cx - r * 0.42, cy + r * 1.05, r * 0.26, r * 0.68);
    g.fill();
    g.ellipse(cx + r * 0.42, cy + r * 1.05, r * 0.26, r * 0.68);
    g.fill();
    g.fillColor = col('#F5B8C8');
    g.ellipse(cx - r * 0.42, cy + r * 1.0, r * 0.12, r * 0.38);
    g.fill();
    g.ellipse(cx + r * 0.42, cy + r * 1.0, r * 0.12, r * 0.38);
    g.fill();
    g.fillColor = col('#FFFFFF');
    g.circle(cx, cy, r);
    g.fill();
    g.fillColor = col('#2F2F35');
    g.circle(cx - r * 0.28, cy + r * 0.1, r * 0.1);
    g.fill();
    g.circle(cx + r * 0.28, cy + r * 0.1, r * 0.1);
    g.fill();
    g.fillColor = col('#F5A0B0');
    g.circle(cx, cy - r * 0.18, r * 0.12);
    g.fill();
}

function drawCup(g: Graphics, cx: number, cy: number, r: number) {
    g.fillColor = col('#FFD24A');
    g.circle(cx - r * 0.16, cy + r * 1.1, r * 0.2);
    g.fill();
    g.circle(cx + r * 0.16, cy + r * 1.1, r * 0.2);
    g.fill();
    g.moveTo(cx - r * 0.34, cy + r * 1.05);
    g.lineTo(cx, cy + r * 0.65);
    g.lineTo(cx + r * 0.34, cy + r * 1.05);
    g.close();
    g.fill();
    g.fillColor = col('#5B8CDE');
    g.moveTo(cx - r * 0.65, cy + r * 0.3);
    g.lineTo(cx + r * 0.65, cy + r * 0.3);
    g.lineTo(cx + r * 0.5, cy - r * 0.65);
    g.lineTo(cx - r * 0.5, cy - r * 0.65);
    g.close();
    g.fill();
    g.strokeColor = col('#5B8CDE');
    g.lineWidth = 3;
    g.arc(cx + r * 0.72, cy - r * 0.05, r * 0.32, -1.1, 1.1, false);
    g.stroke();
}

function drawGift(g: Graphics, cx: number, cy: number, r: number) {
    g.fillColor = col('#FF9A52');
    g.roundRect(cx - r, cy - r, r * 2, r * 2, 4);
    g.fill();
    g.fillColor = col('#FFD24A');
    g.rect(cx - r * 0.18, cy - r, r * 0.36, r * 2);
    g.fill();
    g.rect(cx - r, cy - r * 0.18, r * 2, r * 0.36);
    g.fill();
}

function drawBox(g: Graphics, cx: number, cy: number, r: number) {
    g.strokeColor = col('#8B6914');
    g.lineWidth = 2.5;
    g.roundRect(cx - r, cy - r * 0.65, r * 2, r * 1.3, 3);
    g.stroke();
    g.moveTo(cx - r, cy);
    g.lineTo(cx + r, cy);
    g.stroke();
}

function drawBasket(g: Graphics, cx: number, cy: number, r: number) {
    ['#E85D5D', '#5B8CDE', '#F0C35A'].forEach((hex, i) => {
        g.fillColor = col(hex);
        g.circle(cx + (i - 1) * r * 0.5, cy + r * 0.12, r * 0.32);
        g.fill();
    });
    g.strokeColor = col('#C4895A');
    g.lineWidth = 3;
    g.moveTo(cx - r, cy - r * 0.15);
    g.lineTo(cx - r * 0.65, cy - r * 0.85);
    g.lineTo(cx + r * 0.65, cy - r * 0.85);
    g.lineTo(cx + r, cy - r * 0.15);
    g.stroke();
}
