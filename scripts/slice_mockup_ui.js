/**
 * 从效果图 1:1 切片：棋盘框、槽位托盘、按钮、方块样本
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('../tools/pngjs/package');

const SRC = path.join(__dirname, '../材料/羊了个羊游戏分析与2D游戏开发 (3).png');
const OUT = path.join(__dirname, '../assets/resources/textures/ui_mock');
const TILE_OUT = path.join(__dirname, '../assets/resources/textures/tiles_mock');

function readPng(p) {
  return PNG.sync.read(fs.readFileSync(p));
}
function writePng(p, png) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, PNG.sync.write(png));
}
function crop(png, x, y, w, h) {
  x = Math.max(0, Math.floor(x));
  y = Math.max(0, Math.floor(y));
  w = Math.min(Math.floor(w), png.width - x);
  h = Math.min(Math.floor(h), png.height - y);
  const out = new PNG({ width: w, height: h });
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const si = (png.width * (y + row) + (x + col)) << 2;
      const di = (w * row + col) << 2;
      out.data[di] = png.data[si];
      out.data[di + 1] = png.data[si + 1];
      out.data[di + 2] = png.data[si + 2];
      out.data[di + 3] = png.data[si + 3];
    }
  }
  return out;
}

function idx(png, x, y) {
  return (png.width * y + x) << 2;
}

function isBg(png, x, y) {
  const i = idx(png, x, y);
  const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2], a = png.data[i + 3];
  if (a < 10) return true;
  // cream page bg ~ #FFF8EB / #FFFEF8
  return r > 245 && g > 240 && b > 220 && Math.max(r, g, b) - Math.min(r, g, b) < 40;
}

function writeMeta(pngPath, name, w, h) {
  const crypto = require('crypto');
  const uid = [...crypto.randomBytes(16)].map((b, i) => {
    const hex = b.toString(16).padStart(2, '0');
    return hex;
  }).join('');
  // format uuid
  const uuid = `${uid.slice(0, 8)}-${uid.slice(8, 12)}-${uid.slice(12, 16)}-${uid.slice(16, 20)}-${uid.slice(20)}`;
  const meta = {
    ver: '1.0.27',
    importer: 'image',
    imported: true,
    uuid,
    files: ['.json', '.png'],
    subMetas: {
      '6c48a': {
        importer: 'texture',
        uuid: `${uuid}@6c48a`,
        displayName: name,
        id: '6c48a',
        name: 'texture',
        userData: {
          wrapModeS: 'clamp-to-edge',
          wrapModeT: 'clamp-to-edge',
          imageUuidOrDatabaseUri: uuid,
          isUuid: true,
          visible: false,
          minfilter: 'linear',
          magfilter: 'linear',
          mipfilter: 'none',
          anisotropy: 0,
        },
        ver: '1.0.22',
        imported: true,
        files: ['.json'],
        subMetas: {},
      },
      f9941: {
        importer: 'sprite-frame',
        uuid: `${uuid}@f9941`,
        displayName: name,
        id: 'f9941',
        name: 'spriteFrame',
        userData: {
          trimThreshold: 1,
          rotated: false,
          offsetX: 0,
          offsetY: 0,
          trimX: 0,
          trimY: 0,
          width: w,
          height: h,
          rawWidth: w,
          rawHeight: h,
          borderTop: 0,
          borderBottom: 0,
          borderLeft: 0,
          borderRight: 0,
          packable: true,
          pixelsToUnit: 100,
          pivotX: 0.5,
          pivotY: 0.5,
          meshType: 0,
        },
        ver: '1.0.12',
        imported: true,
        files: ['.json'],
        subMetas: {},
      },
    },
    userData: { type: 'sprite-frame', format: 'raw', hasAlpha: true },
  };
  fs.writeFileSync(pngPath + '.meta', JSON.stringify(meta, null, 2) + '\n');
}

function saveCrop(png, name, x, y, w, h, dir) {
  const c = crop(png, x, y, w, h);
  const p = path.join(dir, name + '.png');
  writePng(p, c);
  writeMeta(p, name, c.width, c.height);
  console.log('saved', name, c.width, c.height, `@(${x},${y})`);
  return c;
}

function makeTransparentBg(png, tol = 28) {
  // turn near-cream into transparent for overlays
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = idx(png, x, y);
      const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2];
      if (r > 245 && g > 240 && b > 220 && Math.max(r, g, b) - Math.min(r, g, b) < tol) {
        png.data[i + 3] = 0;
      }
    }
  }
  return png;
}

function main() {
  const png = readPng(SRC);
  const W = png.width, H = png.height;
  console.log('mockup', W, H);
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(TILE_OUT, { recursive: true });
  // dir metas
  for (const d of [OUT, TILE_OUT, path.dirname(OUT)]) {
    const mp = d + '.meta';
    if (!fs.existsSync(mp)) {
      fs.writeFileSync(mp, JSON.stringify({
        ver: '1.2.0', importer: 'directory', imported: true,
        uuid: require('crypto').randomUUID(), files: [], subMetas: {}, userData: {},
      }, null, 2) + '\n');
    }
  }

  // ---- UI chrome crops (tuned for 1600x2848 Doubao mockup) ----
  // Full screen scaled reference (optional debug)
  // Header icons
  saveCrop(png, 'btn_back', 70, 130, 110, 110, OUT);
  saveCrop(png, 'btn_more', 1420, 130, 110, 110, OUT);

  // Board panel (white rounded card)
  const board = saveCrop(png, 'board_panel', 90, 280, 1420, 1280, OUT);

  // Slot tray with 7 slots (includes sample tiles - we'll use empty version by painting)
  const slotTray = saveCrop(png, 'slot_tray', 100, 1600, 1400, 200, OUT);

  // Bottom buttons row
  saveCrop(png, 'btn_undo', 90, 1880, 340, 140, OUT);
  saveCrop(png, 'btn_shuffle', 450, 1880, 340, 140, OUT);
  saveCrop(png, 'btn_remove', 810, 1880, 340, 140, OUT);
  saveCrop(png, 'btn_share', 1170, 1880, 340, 140, OUT);

  // Full gameplay chrome without tiles: we'll mask board interior later
  // Extract individual cubes from board by scanning non-white blobs
  const bx0 = 120, by0 = 320, bx1 = 1480, by1 = 1520;
  const boardInner = crop(png, bx0, by0, bx1 - bx0, by1 - by0);

  // Connected components on saturated pixels
  const visited = new Uint8Array(boardInner.width * boardInner.height);
  const comps = [];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  function solid(x, y) {
    if (x < 0 || y < 0 || x >= boardInner.width || y >= boardInner.height) return false;
    const i = idx(boardInner, x, y);
    const r = boardInner.data[i], g = boardInner.data[i + 1], b = boardInner.data[i + 2], a = boardInner.data[i + 3];
    if (a < 20) return false;
    // skip near-white panel
    if (r > 248 && g > 248 && b > 245) return false;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    const lum = (r + g + b) / 3;
    // tiles have color or grey locked outlines
    return sat > 18 || (lum < 210 && sat > 8);
  }

  for (let y = 0; y < boardInner.height; y++) {
    for (let x = 0; x < boardInner.width; x++) {
      const vi = y * boardInner.width + x;
      if (visited[vi] || !solid(x, y)) continue;
      const q = [[x, y]];
      visited[vi] = 1;
      let minX = x, maxX = x, minY = y, maxY = y, n = 0;
      let sumR = 0, sumG = 0, sumB = 0;
      while (q.length) {
        const [cx, cy] = q.pop();
        n++;
        const i = idx(boardInner, cx, cy);
        sumR += boardInner.data[i];
        sumG += boardInner.data[i + 1];
        sumB += boardInner.data[i + 2];
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        for (const [dx, dy] of dirs) {
          const nx = cx + dx, ny = cy + dy;
          const ni = ny * boardInner.width + nx;
          if (nx < 0 || ny < 0 || nx >= boardInner.width || ny >= boardInner.height) continue;
          if (visited[ni] || !solid(nx, ny)) continue;
          visited[ni] = 1;
          q.push([nx, ny]);
        }
      }
      const w = maxX - minX + 1, h = maxY - minY + 1;
      if (n < 800 || w < 60 || h < 60 || w > 280 || h > 280) continue;
      comps.push({
        minX, minY, maxX, maxY, w, h, n,
        avg: [sumR / n, sumG / n, sumB / n],
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2,
      });
    }
  }
  comps.sort((a, b) => a.cy - b.cy || a.cx - b.cx);
  console.log('tile candidates', comps.length);

  // Classify by average color into item types
  function classify(avg) {
    const [r, g, b] = avg;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    if (sat < 25 && (r + g + b) / 3 > 160) return 'locked';
    if (r > 180 && r > g + 20 && r > b + 20) return 'book_red';
    if (b > 160 && b > r + 10 && g > 140) return 'book_blue';
    if (g > 150 && g >= r && g >= b && sat > 30) return 'book_green';
    if (r > 200 && g > 160 && b < 140) return 'cup'; // orange
    if (r > 200 && g > 180 && b > 120 && b < 180) return 'cat'; // yellow
    if (r > 180 && g > 150 && b > 140 && b > g - 20) return 'rabbit'; // pink
    if (r > 160 && g > 130 && b < 120) return 'bear';
    return 'misc_' + Math.round(r) + '_' + Math.round(g) + '_' + Math.round(b);
  }

  const byType = {};
  comps.forEach((c, i) => {
    const type = classify(c.avg);
    const pad = 4;
    let tile = crop(boardInner, c.minX - pad, c.minY - pad, c.w + pad * 2, c.h + pad * 2);
    // make outer cream transparent
    makeTransparentBg(tile, 32);
    const name = `${type}_${i}`;
    const p = path.join(TILE_OUT, name + '.png');
    writePng(p, tile);
    writeMeta(p, name, tile.width, tile.height);
    if (!byType[type]) byType[type] = [];
    byType[type].push({ file: name, ...c, absX: bx0 + c.cx, absY: by0 + c.cy });
    console.log('tile', name, 'avg', c.avg.map((v) => Math.round(v)), 'pos', Math.round(c.cx), Math.round(c.cy));
  });

  // Pick best representative per known type (largest area)
  const reps = {};
  for (const [type, arr] of Object.entries(byType)) {
    arr.sort((a, b) => b.n - a.n);
    reps[type] = arr[0];
    // copy best as canonical type name
    if (!type.startsWith('misc_') && type !== 'locked') {
      const srcP = path.join(TILE_OUT, arr[0].file + '.png');
      const dstP = path.join(TILE_OUT, type + '.png');
      fs.copyFileSync(srcP, dstP);
      writeMeta(dstP, type, arr[0].w + 8, arr[0].h + 8);
    }
    if (type === 'locked') {
      const srcP = path.join(TILE_OUT, arr[0].file + '.png');
      const dstP = path.join(TILE_OUT, 'locked.png');
      fs.copyFileSync(srcP, dstP);
      writeMeta(dstP, 'locked', arr[0].w + 8, arr[0].h + 8);
    }
  }

  // Layout map in mockup pixels → design 720 space (scale 0.45)
  const scale = 720 / 1600;
  const layout = {
    design: { w: 720, h: Math.round(2848 * scale) },
    scale,
    board: { x: 90 * scale, y: 280 * scale, w: 1420 * scale, h: 1280 * scale },
    slotTray: { x: 100 * scale, y: 1600 * scale, w: 1400 * scale, h: 200 * scale },
    buttons: {
      y: 1880 * scale,
      h: 140 * scale,
      items: [
        { name: 'undo', x: 90 * scale },
        { name: 'shuffle', x: 450 * scale },
        { name: 'remove', x: 810 * scale },
        { name: 'share', x: 1170 * scale },
      ],
      w: 340 * scale,
    },
    titleY: 180 * scale,
    tiles: comps.map((c) => ({
      type: classify(c.avg),
      x: (bx0 + c.cx - 800) * scale, // relative to screen center x=800
      y: (by0 + c.cy - 960) * scale, // relative-ish; refined in game
      w: c.w * scale,
      h: c.h * scale,
      layerHint: Math.round((1520 - (by0 + c.cy)) / 80),
    })),
    reps: Object.fromEntries(Object.entries(reps).map(([k, v]) => [k, v.file])),
  };
  fs.writeFileSync(path.join(OUT, 'layout.json'), JSON.stringify(layout, null, 2));
  writeMeta(path.join(OUT, 'layout.json'), 'layout', 0, 0); // may be wrong importer - write plain meta for json later
  fs.unlinkSync(path.join(OUT, 'layout.json.meta')); // remove wrong meta
  const layoutMeta = {
    ver: '2.0.1', importer: 'json', imported: true,
    uuid: require('crypto').randomUUID(), files: ['.json'], subMetas: {}, userData: {},
  };
  // put layout into resources root for easy load
  const layoutPath = path.join(__dirname, '../assets/resources/mock_layout.json');
  fs.writeFileSync(layoutPath, JSON.stringify(layout, null, 2));
  fs.writeFileSync(layoutPath + '.meta', JSON.stringify(layoutMeta, null, 2) + '\n');

  console.log('done types', Object.keys(byType));
}

main();
