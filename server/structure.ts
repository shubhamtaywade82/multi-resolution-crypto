import { Candle, StructureAnalysis } from './types.js';
import { CandleBuilder } from './candles.js';

interface SwingPoint {
  p: number;
  t: number;
  i: number;
}

function findSwings(candles: Candle[], lookback = 2): { H: SwingPoint[]; L: SwingPoint[] } {
  const H: SwingPoint[] = [];
  const L: SwingPoint[] = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;

    for (let j = 1; j <= lookback; j++) {
      if (c.h <= candles[i - j].h || c.h <= candles[i + j].h) isHigh = false;
      if (c.l >= candles[i - j].l || c.l >= candles[i + j].l) isLow = false;
    }

    if (isHigh) H.push({ p: c.h, t: c.t, i });
    if (isLow) L.push({ p: c.l, t: c.t, i });
  }

  return { H, L };
}

function calculateBiasAndPattern(H: SwingPoint[], L: SwingPoint[], isAboveSma: boolean) {
  const hh = H.length >= 2 && H[H.length - 1].p > H[H.length - 2].p;
  const hl = L.length >= 2 && L[L.length - 1].p > L[L.length - 2].p;
  const lh = H.length >= 2 && H[H.length - 1].p < H[H.length - 2].p;
  const ll = L.length >= 2 && L[L.length - 1].p < L[L.length - 2].p;

  const pattern = hh && hl ? 'HH + HL'
    : lh && ll ? 'LH + LL'
    : hh || hl ? 'mixed · higher extreme'
    : lh || ll ? 'mixed · lower extreme'
    : 'range';

  const bias = hh && hl && isAboveSma ? 1
    : lh && ll && !isAboveSma ? -1
    : isAboveSma && (hh || hl) ? 1
    : !isAboveSma && (lh || ll) ? -1
    : 0;

  const trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL / RANGE' =
    bias > 0 ? 'BULLISH' : bias < 0 ? 'BEARISH' : 'NEUTRAL / RANGE';

  return { pattern, bias, trend };
}

function findSweeps(candles: Candle[], H: SwingPoint[], L: SwingPoint[]) {
  const sweeps: Array<{ type: string; p: number; t: number; bull: boolean }> = [];
  const startIdx = Math.max(2, candles.length - 6);

  for (let i = startIdx; i < candles.length; i++) {
    const x = candles[i];
    const prevHighs = H.filter(s => s.i < i);
    const prevLows = L.filter(s => s.i < i);
    const pH = prevHighs[prevHighs.length - 1];
    const pL = prevLows[prevLows.length - 1];

    if (pH && x.h > pH.p && x.c < pH.p) {
      sweeps.push({ type: 'BSL swept', p: pH.p, t: x.t, bull: true });
    }
    if (pL && x.l < pL.p && x.c > pL.p) {
      sweeps.push({ type: 'SSL swept', p: pL.p, t: x.t, bull: false });
    }
  }

  return sweeps.slice(-3);
}

function findLiquidityZones(H: SwingPoint[], L: SwingPoint[], mid: number) {
  const zones: Array<{ p: number; type: string; t: number; d: number }> = [];

  for (const s of H.slice(-4)) {
    if (s.p > mid) zones.push({ p: s.p, type: 'BSL', t: s.t, d: ((s.p - mid) / mid) * 100 });
  }
  for (const s of L.slice(-4)) {
    if (s.p < mid) zones.push({ p: s.p, type: 'SSL', t: s.t, d: ((s.p - mid) / mid) * 100 });
  }

  zones.sort((a, b) => Math.abs(a.d) - Math.abs(b.d));
  return zones.slice(0, 4);
}

export function analyzeStructure(cb: CandleBuilder, mid: number, now: number): StructureAnalysis {
  const cl = cb.closed;
  if (cl.length < 8) {
    return {
      tf: cb.label, trend: 'NEUTRAL / RANGE', pattern: 'insufficient candles',
      bias: 0, lastC: cb.last(), cur: cb.cur, sma: mid, bos: null,
      sweeps: [], zones: [], progress: cb.progress(now), ok: false
    };
  }

  const { H, L } = findSwings(cl, 2);
  const lastC = cl[cl.length - 1];
  const prevC = cl[cl.length - 2];
  const closes = cl.slice(-10).map(x => x.c);
  const sma = closes.reduce((a, b) => a + b, 0) / closes.length;

  let bos: { dir: number; at: number; t: number } | null = null;
  const lH = H.length ? H[H.length - 1] : null;
  const lL = L.length ? L[L.length - 1] : null;

  if (lH && lastC.c > lH.p && prevC.c <= lH.p) {
    bos = { dir: 1, at: lH.p, t: lastC.t };
  } else if (lL && lastC.c < lL.p && prevC.c >= lL.p) {
    bos = { dir: -1, at: lL.p, t: lastC.t };
  }

  const { pattern, bias, trend } = calculateBiasAndPattern(H, L, lastC.c > sma);
  const sweeps = findSweeps(cl, H, L);
  const zones = findLiquidityZones(H, L, mid);

  return {
    tf: cb.label,
    trend,
    pattern,
    bias,
    lastC,
    cur: cb.cur,
    sma,
    bos,
    sweeps,
    zones,
    progress: cb.progress(now),
    ok: true
  };
}
