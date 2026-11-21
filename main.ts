// THE WORLD TODAY — front page for Saturday 21 November 2026.
// Draws a 1024x1024 newspaper front page as a PNG, deterministically,
// using only the Node 22+ standard library (no network, no clock, no
// randomness). Two runs write byte-identical output.
//
// Stories (all events of, or first reported on, 21 November 2026):
//  1. Russia's overnight missile/drone strikes hit three Kyiv bridges;
//     at least 9 killed, dozens hurt.
//  2. Wall Street rout: Nasdaq -5.3%, Nvidia -14%, Dow -950 as the
//     AI sell-off deepens; SEC reported to be probing Nvidia.
//  3. JPMorgan, Visa and Mastercard report cyberattacks on
//     third-party vendors; core payment networks unaffected.
//  4. COP31 climate talks in Turkey enter their crucial final stage.
//  5. Estonia shuts every border crossing with Russia after a
//     suspected arson sabotage.
//  6. Cricket: India fight back in Wellington, 159/1 on day two.
//  7. Sensex jumps 898 points; NSE becomes the world's 5th-largest
//     listed exchange. Hyundai unveils the 2027 Elantra in Los Angeles.

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- PNG ----
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePng(rgb: Uint8Array, w: number, h: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: none
    raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (1 + w * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------- canvas ----
type RGB = [number, number, number];
const INK: RGB = [24, 24, 28];
const PAPER: RGB = [247, 243, 232];
const NAVY: RGB = [18, 38, 66];
const RED: RGB = [178, 34, 34];
const BLUE: RGB = [30, 80, 140];
const GREY: RGB = [110, 108, 100];
const LIGHT: RGB = [232, 226, 210];
const GOLD: RGB = [176, 132, 32];

class Canvas {
  buf = new Uint8Array(W * H * 3);
  constructor() {
    this.fill(0, 0, W, H, PAPER);
  }
  px(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    this.buf[i] = c[0];
    this.buf[i + 1] = c[1];
    this.buf[i + 2] = c[2];
  }
  fill(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, x), y0 = Math.max(0, y);
    const x1 = Math.min(W, x + w), y1 = Math.min(H, y + h);
    for (let yy = y0; yy < y1; yy++)
      for (let xx = x0; xx < x1; xx++) this.px(xx, yy, c);
  }
  hline(x: number, y: number, w: number, c: RGB, t = 1): void {
    this.fill(x, y, w, t, c);
  }
  vline(x: number, y: number, h: number, c: RGB, t = 1): void {
    this.fill(x, y, t, h, c);
  }
  rect(x: number, y: number, w: number, h: number, c: RGB, t = 2): void {
    this.hline(x, y, w, c, t);
    this.hline(x, y + h - t, w, c, t);
    this.vline(x, y, h, c, t);
    this.vline(x + w - t, y, h, c, t);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
    const dx = x1 - x0, dy = y1 - y0;
    const n = Math.max(Math.abs(dx), Math.abs(dy));
    for (let i = 0; i <= n; i++) {
      this.px(Math.round(x0 + (dx * i) / n), Math.round(y0 + (dy * i) / n), c);
    }
  }
  circle(cx: number, cy: number, r: number, c: RGB): void {
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++)
        if (x * x + y * y <= r * r) this.px(cx + x, cy + y, c);
  }
  // Filled triangle (scanline).
  tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
    const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
    for (let y = minY; y <= maxY; y++) {
      const xs: number[] = [];
      const edges: [number, number, number, number][] = [[x0, y0, x1, y1], [x1, y1, x2, y2], [x2, y2, x0, y0]];
      for (const [ax, ay, bx, by] of edges) {
        if ((ay <= y && by > y) || (by <= y && ay > y)) {
          xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
        }
      }
      if (xs.length >= 2) {
        const a = Math.round(Math.min(...xs)), b = Math.round(Math.max(...xs));
        for (let x = a; x <= b; x++) this.px(x, y, c);
      }
    }
  }
}

// -------------------------------------------------------------- font -----
// 5x7 bitmap font, uppercase + digits + punctuation. Each glyph is 7 rows
// of 5 bits written as strings; "#" = ink, "." = blank.
const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  '"': ["01010", "01010", "01010", "00000", "00000", "00000", "00000"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "#": ["01010", "01010", "11111", "01010", "01010", "11111", "01010"],
  "*": ["00000", "10101", "01110", "11111", "01110", "10101", "00000"],
  _: ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
};

function textWidth(s: string, scale: number): number {
  return s.length * 6 * scale - scale;
}

function drawText(cv: Canvas, s: string, x: number, y: number, scale: number, c: RGB): void {
  const up = s.toUpperCase();
  for (let i = 0; i < up.length; i++) {
    const g = GLYPHS[up[i]];
    if (!g) continue;
    const ox = x + i * 6 * scale;
    for (let r = 0; r < 7; r++)
      for (let col = 0; col < 5; col++)
        if (g[r][col] === "1") cv.fill(ox + col * scale, y + r * scale, scale, scale, c);
  }
}

function drawCentred(cv: Canvas, s: string, cx: number, y: number, scale: number, c: RGB): void {
  drawText(cv, s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, c);
}

// Word-wrap: returns lines that fit maxWidth at the given scale.
function wrap(s: string, maxWidth: number, scale: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur === "" ? w : cur + " " + w;
    if (textWidth(test, scale) <= maxWidth || cur === "") cur = test;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

function drawPara(cv: Canvas, s: string, x: number, y: number, maxWidth: number, scale: number, c: RGB, lh: number): number {
  const lines = wrap(s, maxWidth, scale);
  for (let i = 0; i < lines.length; i++) drawText(cv, lines[i], x, y + i * lh, scale, c);
  return y + lines.length * lh;
}

// Kicker label: small red tag + headline + body.
function story(cv: Canvas, x: number, y: number, w: number, kicker: string, head: string, body: string, headScale: number): number {
  cv.fill(x, y, 6, 14, RED);
  drawText(cv, kicker, x + 12, y, 2, RED);
  let yy = y + 22;
  yy = drawPara(cv, head, x, yy, w, headScale, INK, headScale === 3 ? 26 : 22);
  yy += 4;
  yy = drawPara(cv, body, x, yy, w, 2, [52, 52, 56], 17);
  return yy;
}

// ------------------------------------------------------------ the page ----
function drawPage(): Canvas {
  const cv = new Canvas();
  const M = 36; // margin

  // ---- masthead -------------------------------------------------------
  cv.fill(0, 0, W, 118, NAVY);
  drawCentred(cv, "THE WORLD TODAY", W / 2, 18, 7, [247, 243, 232]);
  cv.hline(M, 90, W - 2 * M, GOLD, 3);
  drawText(cv, "SATURDAY 21 NOVEMBER 2026", M, 98, 2, GOLD);
  drawText(cv, "ONE DAY. THE WHOLE WORLD.", W - M - textWidth("ONE DAY. THE WHOLE WORLD.", 2), 98, 2, [200, 205, 215]);

  // ---- lead illustration: Kyiv skyline under attack -------------------
  const LX = M, LY = 132, LW = 600, LH = 250;
  cv.fill(LX, LY, LW, LH, [28, 32, 48]); // night sky
  // stars
  const stars: [number, number][] = [[40, 20], [120, 45], [210, 18], [300, 50], [390, 22], [470, 42], [540, 16], [80, 70], [250, 80], [430, 75], [180, 30], [520, 90], [330, 15]];
  for (const [sx, sy] of stars) cv.fill(LX + sx, LY + sy, 3, 3, [220, 220, 200]);
  // moon
  cv.circle(LX + 540, LY + 40, 22, [235, 230, 205]);
  cv.circle(LX + 532, LY + 34, 18, [28, 32, 48]);
  // buildings
  const blds: [number, number, number][] = [[0, 190, 60], [70, 150, 46], [125, 205, 70], [205, 160, 52], [265, 200, 64], [340, 140, 48], [398, 195, 60], [470, 170, 56], [535, 205, 65]];
  for (const [bx, by, bw] of blds) {
    cv.fill(LX + bx, LY + by, bw, LH - by, [12, 14, 24]);
    // lit windows
    for (let wy = LY + by + 12; wy < LY + LH - 12; wy += 18)
      for (let wx = LX + bx + 8; wx < LX + bx + bw - 8; wx += 16)
        if ((wx * 7 + wy * 13) % 5 < 2) cv.fill(wx, wy, 5, 7, [240, 200, 90]);
  }
  // bridge across the river
  cv.fill(LX, LY + 218, LW, 6, [60, 62, 70]);
  for (let bx = 20; bx < LW; bx += 60) cv.fill(LX + bx, LY + 190, 6, 34, [60, 62, 70]);
  cv.line(LX + 20, LY + 190, LX + 140, LY + 224, [90, 92, 100]);
  cv.line(LX + 380, LY + 190, LX + 500, LY + 224, [90, 92, 100]);
  // river
  cv.fill(LX, LY + 224, LW, LH - 224, [40, 70, 110]);
  // explosions + smoke over the bridges
  cv.circle(LX + 150, LY + 175, 26, [255, 140, 40]);
  cv.circle(LX + 150, LY + 175, 14, [255, 210, 80]);
  cv.circle(LX + 470, LY + 168, 20, [255, 120, 30]);
  cv.circle(LX + 470, LY + 168, 10, [255, 200, 70]);
  cv.circle(LX + 250, LY + 120, 16, [120, 120, 125]);
  cv.circle(LX + 300, LY + 100, 20, [140, 140, 145]);
  cv.circle(LX + 350, LY + 118, 14, [120, 120, 125]);
  drawText(cv, "KYIV, UKRAINE - OVERNIGHT STRIKES", LX + 12, LY + LH - 22, 2, [240, 240, 230]);

  // ---- lead headline + standfirst -------------------------------------
  let y = LY + LH + 16;
  y = drawPara(cv, "RUSSIA HITS THREE KYIV BRIDGES IN MASSIVE OVERNIGHT STRIKE", LX, y, LW, 4, INK, 34);
  y += 6;
  y = drawPara(
    cv,
    "At least nine people were killed and dozens hurt as missiles and drones rained down on the Ukrainian capital and nine regions. France called for a UN Security Council meeting after the strikes hit near Kyiv's embassies.",
    LX, y, LW, 2, [52, 52, 56], 17,
  );
  const leadBottom = y + 8;
  cv.hline(M, leadBottom, W - 2 * M, INK, 3);

  // ---- right column: markets ------------------------------------------
  const RX = M + LW + 24, RW = W - M - RX;
  story(
    cv, RX, LY, RW,
    "MARKETS",
    "WALL STREET ROUT AS AI SELL-OFF DEEPENS",
    "The Nasdaq fell 5.3% and the Dow lost 950 points in Friday's rout. Nvidia dropped about 14% as reports said the SEC is probing its accounting.",
    3,
  );
  // falling chart
  const CX = RX, CY = LY + 198, CW = RW, CH = 64;
  cv.rect(CX, CY, CW, CH, GREY, 1);
  const pts: [number, number][] = [[0, 10], [30, 15], [60, 9], [95, 22], [130, 19], [165, 36], [200, 33], [235, 49], [265, 55]];
  for (let i = 0; i < pts.length - 1; i++) {
    cv.line(CX + 8 + pts[i][0], CY + pts[i][1], CX + 8 + pts[i + 1][0], CY + pts[i + 1][1], RED);
    cv.line(CX + 8 + pts[i][0], CY + pts[i][1] + 1, CX + 8 + pts[i + 1][0], CY + pts[i + 1][1] + 1, RED);
  }
  drawText(cv, "NASDAQ -5.3%  DOW -950", RX, CY + CH + 6, 2, RED);
  drawText(cv, "NVIDIA -14%", RX, CY + CH + 22, 2, RED);
  cv.hline(RX, LY + 298, RW, GREY, 1);
  story(
    cv, RX, LY + 310, RW,
    "CYBERATTACK",
    "BANKS HIT IN VENDOR BREACH",
    "JPMorgan, Visa and Mastercard reported attacks on third-party vendors. Core payment networks were unaffected.",
    3,
  );

  // ---- middle row: three stories --------------------------------------
  const MY = leadBottom + 22;
  const colW = Math.floor((W - 2 * M - 48) / 3);
  const y1 = story(
    cv, M, MY, colW,
    "CLIMATE - COP31, TURKEY",
    "CLIMATE TALKS ENTER FINAL STAGE",
    "Negotiators in Turkey push into the decisive hours over fossil fuels and climate finance.",
    3,
  );
  const y2 = story(
    cv, M + colW + 24, MY, colW,
    "EUROPE",
    "ESTONIA SHUTS RUSSIA BORDER",
    "All crossings closed after a suspected arson sabotage, as tensions on NATO's eastern edge rise.",
    3,
  );
  const y3 = story(
    cv, M + 2 * (colW + 24), MY, colW,
    "CRICKET - WELLINGTON",
    "INDIA FIGHT BACK IN TEST",
    "India reached 159 for 1 at stumps on day two of the first Test against New Zealand, trailing by 209.",
    3,
  );
  const midBottom = Math.max(y1, y2, y3) + 10;
  cv.hline(M, midBottom, W - 2 * M, INK, 2);

  // ---- bottom strip ----------------------------------------------------
  const BY = midBottom + 18;
  const bw = Math.floor((W - 2 * M - 48) / 3);
  drawText(cv, "INDIA", M, BY, 2, RED);
  drawPara(cv, "SENSEX JUMPS 898 POINTS; NSE NOW 5TH-LARGEST EXCHANGE", M, BY + 20, bw, 2, INK, 17);
  drawText(cv, "AUTOS", M + bw + 24, BY, 2, RED);
  drawPara(cv, "HYUNDAI UNVEILS 2027 ELANTRA AT LOS ANGELES AUTO SHOW", M + bw + 24, BY + 20, bw, 2, INK, 17);
  drawText(cv, "ALSO TODAY", M + 2 * (bw + 24), BY, 2, RED);
  drawPara(cv, "TRUMP AND XI AGREE HUMANS MUST STAY IN CHARGE OF MILITARY AI", M + 2 * (bw + 24), BY + 20, bw, 2, INK, 17);

  // ---- footer ----------------------------------------------------------
  cv.hline(M, H - 44, W - 2 * M, INK, 2);
  drawText(cv, "THE WORLD TODAY - SATURDAY 21 NOVEMBER 2026", M, H - 32, 2, GREY);
  drawText(cv, "NEWS OF THE DAY, IN ONE IMAGE", W - M - textWidth("NEWS OF THE DAY, IN ONE IMAGE", 2), H - 32, 2, GREY);

  return cv;
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  mkdirSync(outDir, { recursive: true });
  const cv = drawPage();
  const png = encodePng(cv.buf, W, H);
  writeFileSync(join(outDir, "entry.png"), png);
}

main();
