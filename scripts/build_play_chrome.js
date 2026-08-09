/**
 * 从效果图生成对局页 1:1 底图：保留顶栏/棋盘框/空槽托盘/道具按钮，清空棋盘与槽内样例方块。
 * 输出 Design 720×1280 的 play_chrome.png + 精确按钮切片。
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PNG } = require('../tools/pngjs/package');

const SRC = path.join(__dirname, '../材料/羊了个羊游戏分析与2D游戏开发 (3).png');
const OUT = path.join(__dirname, '../assets/resources/textures/ui_mock');
const DESIGN_W = 720;
const DESIGN_H = 1280;

function readPng(p) {
  return PNG.sync.read(fs.readFileSync(p));
}
function writePng(p, png) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, PNG.sync.write(png));
}
function idx(png, x, y) {
  return (png.width * y + x) << 2;
}
function setPx(png, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const i = idx(png, x, y);
  png.data[i] = r;
  png.data[i + 1] = g;
  png.data[i + 2] = b;
  png.data[i + 3] = a;
}
function getPx(png, x, y) {
  const i = idx(png, x, y);
  return [png.data[i], png.data[i + 1], png.data[i + 2], png.data[i + 3]];
}
function isNear(c, rgb, tol = 28) {
  return Math.abs(c[0] - rgb[0]) <= tol && Math.abs(c[1] - rgb[1]) <= tol && Math.abs(c[2] - rgb[2]) <= tol;
}
function isCream(c) {
  return c[0] > 245 && c[1] > 240 && c[2] > 220 && Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]) < 45;
}
function isWhitePanel(c) {
  return c[0] > 248 && c[1] > 248 && c[2] > 245;
}
function isDarkStroke(c) {
  return c[0] < 120 && c[1] < 100 && c[2] < 90 && (c[0] + c[1] + c[2]) / 3 < 95;
}

function crop(png, x, y, w, h) {
  x = Math.max(0, Math.floor(x));
  y = Math.max(0, Math.floor(y));
  w = Math.min(Math.floor(w), png.width - x);
  h = Math.min(Math.floor(h), png.height - y);
  const out = new PNG({ width: w, height: h });
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const si = idx(png, x + col, y + row);
      const di = (w * row + col) << 2;
      out.data[di] = png.data[si];
      out.data[di + 1] = png.data[si + 1];
      out.data[di + 2] = png.data[si + 2];
      out.data[di + 3] = png.data[si + 3];
    }
  }
  return out;
}

function fillRect(png, x0, y0, w, h, rgb) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) setPx(png, x, y, rgb[0], rgb[1], rgb[2], 255);
  }
}

/** 只擦除非描边/非白底的内容，保留框线 */
function eraseContentInRect(png, x0, y0, x1, y1, fillRgb) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const c = getPx(png, x, y);
      if (isDarkStroke(c)) continue;
      if (isWhitePanel(c) || isCream(c)) {
        setPx(png, x, y, fillRgb[0], fillRgb[1], fillRgb[2], 255);
        continue;
      }
      // 彩色/灰色方块 → 填白
      setPx(png, x, y, fillRgb[0], fillRgb[1], fillRgb[2], 255);
    }
  }
}

/** 槽位区：把样例方块擦掉，保留托盘与空槽描边；槽内填浅米色 */
function eraseSlotTiles(png, x0, y0, x1, y1) {
  const empty = [239, 228, 210]; // #EFE4D2
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const c = getPx(png, x, y);
      if (isDarkStroke(c)) continue;
      // 槽托盘米色背景保留稍深一点的米色
      if (isCream(c) || isNear(c, [255, 249, 240], 20) || isNear(c, [245, 236, 220], 25)) continue;
      // 样例方块（红书/玩偶等）清掉
      const sat = Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
      const lum = (c[0] + c[1] + c[2]) / 3;
      if (sat > 20 || lum < 230) {
        setPx(png, x, y, empty[0], empty[1], empty[2], 255);
      }
    }
  }
}

function resizeNearest(src, dw, dh) {
  const out = new PNG({ width: dw, height: dh });
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(src.height - 1, Math.floor((y + 0.5) * src.height / dh));
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(src.width - 1, Math.floor((x + 0.5) * src.width / dw));
      const si = idx(src, sx, sy);
      const di = idx(out, x, y);
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
      out.data[di + 3] = src.data[si + 3];
    }
  }
  return out;
}

function writeSpriteMeta(pngPath, name, w, h) {
  const uid = crypto.randomUUID();
  const meta = {
    ver: '1.0.27',
    importer: 'image',
    imported: true,
    uuid: uid,
    files: ['.json', '.png'],
    subMetas: {
      '6c48a': {
        importer: 'texture',
        uuid: `${uid}@6c48a`,
        displayName: name,
        id: '6c48a',
        name: 'texture',
        userData: {
          wrapModeS: 'clamp-to-edge',
          wrapModeT: 'clamp-to-edge',
          imageUuidOrDatabaseUri: uid,
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
        uuid: `${uid}@f9941`,
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

function saveCrop(png, name, x, y, w, h) {
  const c = crop(png, x, y, w, h);
  // 外圈奶油底透明，便于叠放
  for (let row = 0; row < c.height; row++) {
    for (let col = 0; col < c.width; col++) {
      const p = getPx(c, col, row);
      if (isCream(p)) setPx(c, col, row, 0, 0, 0, 0);
    }
  }
  const p = path.join(OUT, name + '.png');
  writePng(p, c);
  writeSpriteMeta(p, name, c.width, c.height);
  console.log('saved', name, c.width, c.height);
}

function main() {
  const src = readPng(SRC);
  console.log('src', src.width, src.height);
  fs.mkdirSync(OUT, { recursive: true });

  // 工作副本
  const chrome = new PNG({ width: src.width, height: src.height });
  chrome.data.set(src.data);

  // 棋盘内区（保留圆角描边）：效果图实测约 y=300~1850
  eraseContentInRect(chrome, 130, 320, 1470, 1840, [255, 255, 255]);

  // 槽位样例方块：约 y=1920~2220
  eraseSlotTiles(chrome, 120, 1920, 1480, 2220);

  // 缩放到设计分辨率（宽度对齐，高度裁切/居中）
  const scaled = resizeNearest(chrome, DESIGN_W, Math.round((src.height * DESIGN_W) / src.width));
  let play;
  if (scaled.height === DESIGN_H) {
    play = scaled;
  } else if (scaled.height > DESIGN_H) {
    const y0 = Math.floor((scaled.height - DESIGN_H) / 2);
    play = crop(scaled, 0, y0, DESIGN_W, DESIGN_H);
  } else {
    play = new PNG({ width: DESIGN_W, height: DESIGN_H });
    // 奶油底
    fillRect(play, 0, 0, DESIGN_W, DESIGN_H, [255, 248, 235]);
    const y0 = Math.floor((DESIGN_H - scaled.height) / 2);
    for (let y = 0; y < scaled.height; y++) {
      for (let x = 0; x < DESIGN_W; x++) {
        const [r, g, b, a] = getPx(scaled, x, y);
        setPx(play, x, y0 + y, r, g, b, a);
      }
    }
  }

  const playPath = path.join(OUT, 'play_chrome.png');
  writePng(playPath, play);
  writeSpriteMeta(playPath, 'play_chrome', play.width, play.height);
  console.log('play_chrome', play.width, play.height);

  // 精确切片按钮（效果图 y≈2470）
  saveCrop(src, 'btn_undo', 90, 2460, 345, 180);
  saveCrop(src, 'btn_shuffle', 450, 2460, 345, 180);
  saveCrop(src, 'btn_remove', 810, 2460, 345, 180);
  saveCrop(src, 'btn_share', 1170, 2460, 345, 180);
  saveCrop(src, 'btn_back', 70, 130, 120, 120);
  saveCrop(src, 'btn_more', 1410, 130, 120, 120);

  // 空槽托盘
  const tray = crop(chrome, 100, 1920, 1400, 300);
  const trayPath = path.join(OUT, 'slot_tray_empty.png');
  writePng(trayPath, tray);
  writeSpriteMeta(trayPath, 'slot_tray_empty', tray.width, tray.height);

  // 布局（设计坐标：原点中心，y 向上）
  const sx = DESIGN_W / src.width;
  const sy = DESIGN_H / src.height; // 若高度被裁切，仍按最终 1280 映射
  // 使用等比宽缩放后顶对齐裁切的近似：这里直接按宽缩放并 y 从顶部映射到中心系
  const scale = sx;
  const mockH = Math.round(src.height * scale);
  const yCrop = Math.max(0, Math.floor((mockH - DESIGN_H) / 2));
  const toDesign = (mx, my, mw = 0, mh = 0) => {
    const dx = mx * scale - DESIGN_W / 2 + (mw * scale) / 2;
    const dy = DESIGN_H / 2 - ((my * scale - yCrop) + (mh * scale) / 2);
    return { x: Math.round(dx), y: Math.round(dy), w: Math.round(mw * scale), h: Math.round(mh * scale) };
  };

  const layout = {
    design: { w: DESIGN_W, h: DESIGN_H },
    scale,
    yCrop,
    title: toDesign(800, 185, 0, 0),
    back: toDesign(70, 130, 120, 120),
    more: toDesign(1410, 130, 120, 120),
    board: toDesign(100, 300, 1400, 1540),
    slots: toDesign(100, 1920, 1400, 300),
    tools: {
      y: toDesign(0, 2460, 0, 180).y,
      h: Math.round(180 * scale),
      w: Math.round(345 * scale),
      items: [
        { key: 'undo', ...toDesign(90, 2460, 345, 180) },
        { key: 'shuffle', ...toDesign(450, 2460, 345, 180) },
        { key: 'remove', ...toDesign(810, 2460, 345, 180) },
        { key: 'share', ...toDesign(1170, 2460, 345, 180) },
      ],
    },
  };
  const layoutPath = path.join(__dirname, '../assets/resources/mock_layout.json');
  fs.writeFileSync(layoutPath, JSON.stringify(layout, null, 2));
  fs.writeFileSync(
    layoutPath + '.meta',
    JSON.stringify(
      {
        ver: '2.0.1',
        importer: 'json',
        imported: true,
        uuid: crypto.randomUUID(),
        files: ['.json'],
        subMetas: {},
        userData: {},
      },
      null,
      2,
    ) + '\n',
  );
  console.log('layout', JSON.stringify(layout, null, 2));
  console.log('done');
}

main();
