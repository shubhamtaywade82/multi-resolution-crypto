import { BookState, Trade } from '../types.ts';
import { DepthHeatStore, HEAT_CONFIG, HeatBucketResult } from './depthHeatStore.ts';

export function computeNormCeiling(norm: Float32Array): number {
  const nz = Array.from(norm).filter((v) => v > 0).sort((a, b) => a - b);
  return nz.length ? nz[Math.floor(nz.length * 0.95)] : 1;
}

export function computeTopTick(mid: number, store: DepthHeatStore, zoom: number): number {
  const cTick = store.tickIndex(mid);
  return Math.max(0, Math.min(store.n - 1, cTick + Math.floor(HEAT_CONFIG.rows / 2) * zoom));
}

function writeHeatPixel(
  d: Uint8ClampedArray,
  o: number,
  c: { q: Int16Array; ps: Uint8Array } | null,
  ti: number,
  ceil: number,
  n: number
): void {
  if (!c || ti < 0 || ti >= n) {
    d[o] = 4; d[o + 1] = 6; d[o + 2] = 10; d[o + 3] = 255;
    return;
  }
  const bi = ti * 2, ai = ti * 2 + 1;
  const gi = Math.pow(Math.max(0, Math.min(1, c.q[bi] / ceil)), 0.6);
  const ri = Math.pow(Math.max(0, Math.min(1, c.q[ai] / ceil)), 0.6);
  let R = 4 + ri * 245, G = 6 + gi * 218, B = 10 + gi * 80 + ri * 28;

  if (c.ps[bi] >= HEAT_CONFIG.persMinObs) {
    G = Math.min(255, G + 40); B = Math.min(255, B + 70); R = Math.min(255, R * 0.75 + 40);
  }
  if (c.ps[ai] >= HEAT_CONFIG.persMinObs) {
    R = Math.min(255, R + 30); G = Math.min(255, G * 0.7 + 70); B = Math.min(255, B + 80);
  }
  d[o] = R; d[o + 1] = G; d[o + 2] = B; d[o + 3] = 255;
}

export function renderRasterHeatmap(
  cv: HTMLCanvasElement,
  cols: HeatBucketResult['cols'],
  ceil: number,
  topT: number,
  tpr: number,
  n: number
): void {
  const { cols: numCols, rows } = HEAT_CONFIG;
  if (cv.width !== numCols || cv.height !== rows) {
    cv.width = numCols;
    cv.height = rows;
  }
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(numCols, rows);
  const d = img.data;

  for (let ci = 0; ci < numCols; ci++) {
    const c = cols[ci];
    for (let ri = 0; ri < rows; ri++) {
      const ti = topT - ri * tpr;
      const o = (ri * numCols + ci) * 4;
      writeHeatPixel(d, o, c, ti, ceil, n);
    }
  }
  ctx.putImageData(img, 0, 0);
}

export interface OverlayParams {
  cols: HeatBucketResult['cols'];
  from: number;
  to: number;
  topT: number;
  tpr: number;
  store: DepthHeatStore;
  book: BookState;
  recentTrades: Trade[];
}

export function renderVectorOverlay(
  oCv: HTMLCanvasElement,
  hCv: HTMLCanvasElement,
  params: OverlayParams
): void {
  const rect = hCv.parentElement?.getBoundingClientRect() ?? { width: 800, height: 330 };
  const dpr = window.devicePixelRatio || 1;
  oCv.width = rect.width * dpr;
  oCv.height = rect.height * dpr;
  const ctx = oCv.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const { cols, from, to, topT, tpr, store, book, recentTrades } = params;
  const W = rect.width, H = rect.height, rows = HEAT_CONFIG.rows;
  const base = (store.anchor ?? book.mid) - (store.n / 2) * HEAT_CONFIG.step;
  const rowOf = (p: number) => (topT - (p - base) / HEAT_CONFIG.step) / tpr;
  const priceAt = (ri: number) => base + (topT - ri * tpr) * HEAT_CONFIG.step;

  drawTrajectory(ctx, cols, rowOf, rows, W, H);
  drawWallLines(ctx, book, rowOf, rows, W, H);
  drawTradeBursts(ctx, recentTrades, cols, from, to, rowOf, rows, W, H);
  drawBookSilhouette(ctx, book, rowOf, rows, W, H);
  drawAxesAndCrosshair(ctx, book.mid, from, to, rowOf, priceAt, rows, W, H);
}

function drawTrajectory(
  ctx: CanvasRenderingContext2D,
  cols: HeatBucketResult['cols'],
  rowOf: (p: number) => number,
  rows: number,
  W: number,
  H: number
): void {
  ctx.beginPath();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(232,238,244,.92)';
  let st = false;
  for (let ci = 0; ci < HEAT_CONFIG.cols; ci++) {
    const c = cols[ci];
    if (!c || !c.n) { st = false; continue; }
    const x = ((ci + 0.5) / HEAT_CONFIG.cols) * W;
    const y = (rowOf(c.mid) / rows) * H;
    if (!st) { ctx.moveTo(x, y); st = true; } else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(63,216,255,.14)';
  ctx.stroke();
}

function drawWallLines(
  ctx: CanvasRenderingContext2D,
  book: BookState,
  rowOf: (p: number) => number,
  rows: number,
  W: number,
  H: number
): void {
  const walls = [...(book.walls?.bids ?? []), ...(book.walls?.asks ?? [])];
  for (const w of walls) {
    if (w.life < 15) continue;
    const y = (rowOf(w.p) / rows) * H;
    if (y < 0 || y > H) continue;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = w.state === 'CONSUMED' ? 'rgba(255,180,40,.8)' : 'rgba(181,140,255,.75)';
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.fillStyle = 'rgba(181,140,255,.95)';
    ctx.fillText(`${w.side.toUpperCase()} ${w.p.toFixed(2)} · ${w.life.toFixed(0)}s · ${(w.pers * 100).toFixed(0)}%`, 6, y - 3);
  }
}

function computeTradeFlow(trades: Trade[], t0: number, bw: number): { v: number; net: number } {
  let v = 0, net = 0;
  for (const t of trades) {
    if (t.timestamp >= t0 && t.timestamp < t0 + bw) {
      v += t.quantity;
      net += (t.aggressorSide === 'BUY' ? t.quantity : -t.quantity);
    }
  }
  return { v, net };
}

function drawTradeBursts(
  ctx: CanvasRenderingContext2D,
  trades: Trade[],
  cols: HeatBucketResult['cols'],
  from: number,
  to: number,
  rowOf: (p: number) => number,
  rows: number,
  W: number,
  H: number
): void {
  const colSpan = Math.max(1, to - from) / HEAT_CONFIG.cols;
  for (let ci = 0; ci < HEAT_CONFIG.cols; ci++) {
    const { v, net } = computeTradeFlow(trades, from + ci * colSpan, colSpan * 2);
    if (v <= 0 || !cols[ci]) continue;
    const x = ((ci + 0.5) / HEAT_CONFIG.cols) * W;
    const y = (rowOf(cols[ci]!.mid) / rows) * H;
    const rad = Math.max(2, Math.min(12, Math.sqrt(v) * 0.85));
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fillStyle = net >= 0 ? 'rgba(255,180,40,.22)' : 'rgba(255,93,120,.22)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = net >= 0 ? 'rgba(255,180,40,.6)' : 'rgba(255,93,120,.6)';
    ctx.stroke();
  }
}

function drawBookSilhouette(
  ctx: CanvasRenderingContext2D,
  book: BookState,
  rowOf: (p: number) => number,
  rows: number,
  W: number,
  H: number
): void {
  const prof: Array<{ p: number; q: number; s: 'b' | 'a' }> = [];
  for (const l of book.bids.slice(0, 30)) prof.push({ p: l.p, q: l.q, s: 'b' });
  for (const l of book.asks.slice(0, 30)) prof.push({ p: l.p, q: l.q, s: 'a' });
  const pq = Math.max(...prof.map((x) => x.q), 1), pw = W * 0.11;

  for (const x of prof) {
    const y = (rowOf(x.p) / rows) * H;
    if (y < 0 || y > H) continue;
    const w2 = (x.q / pq) * pw;
    ctx.fillStyle = x.s === 'b' ? 'rgba(63,216,255,.32)' : 'rgba(255,140,170,.32)';
    ctx.fillRect(W - w2, y - Math.max(1, H / rows / 2), w2, Math.max(1.4, H / rows));
  }
  ctx.strokeStyle = 'rgba(63,216,255,.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W - pw, 0);
  ctx.lineTo(W - pw, H);
  ctx.stroke();
}

function drawPriceAxis(
  ctx: CanvasRenderingContext2D,
  priceAt: (ri: number) => number,
  rows: number,
  W: number,
  H: number,
  pw: number
): void {
  ctx.font = '9px JetBrains Mono, monospace';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 5; i++) {
    const ri = Math.floor((i / 5) * (rows - 1));
    const p = priceAt(ri), y = (ri / rows) * H;
    ctx.fillStyle = 'rgba(139,148,158,.95)';
    ctx.fillText(p.toFixed(2), W - pw - 5, y + (i === 0 ? 9 : -2));
    ctx.beginPath();
    ctx.moveTo(W - pw - 40, y);
    ctx.lineTo(W - pw - 4, y);
    ctx.strokeStyle = 'rgba(33,38,45,.85)';
    ctx.stroke();
  }
}

function drawTimeAxis(ctx: CanvasRenderingContext2D, from: number, to: number, W: number, H: number): void {
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(139,148,158,.95)';
  for (let i = 0; i <= 4; i++) {
    const t = from + ((to - from) * i) / 4;
    const d = new Date(t);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    ctx.fillText(`${h}:${m}:${s}`, (W * i) / 4, H - 4);
  }
}

function drawAxesAndCrosshair(
  ctx: CanvasRenderingContext2D,
  mid: number,
  from: number,
  to: number,
  rowOf: (p: number) => number,
  priceAt: (ri: number) => number,
  rows: number,
  W: number,
  H: number
): void {
  const pw = W * 0.11;
  drawPriceAxis(ctx, priceAt, rows, W, H, pw);
  drawTimeAxis(ctx, from, to, W, H);

  const my = (rowOf(mid) / rows) * H;
  ctx.beginPath();
  ctx.setLineDash([2, 3]);
  ctx.moveTo(0, my);
  ctx.lineTo(W, my);
  ctx.strokeStyle = 'rgba(63,216,255,.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(63,216,255,.95)';
  ctx.fillText(`◂ ${mid.toFixed(2)}`, 4, my - 3);
}
