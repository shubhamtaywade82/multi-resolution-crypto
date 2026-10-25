import { BookState } from '../types.ts';

export const HEAT_CONFIG = {
  cols: 150,
  ticks: 220,
  step: 0.02,
  rows: 140,
  persMinObs: 6
};

export const VIEW_SPAN: Record<'5m' | '30m' | '2h', number> = {
  '5m': 300_000,
  '30m': 1_800_000,
  '2h': 7_200_000
};

export interface HeatColumn {
  t: number;
  q: Int16Array;
  ps: Uint8Array;
  mid: number;
}

export interface HeatBucketResult {
  cols: Array<{ q: Int16Array; ps: Uint8Array; n: number; mid: number } | null>;
  from: number;
  to: number;
  norm: Float32Array;
  span?: number;
}

export class DepthHeatStore {
  anchor: number | null = null;
  readonly n: number = HEAT_CONFIG.ticks;
  cols: HeatColumn[] = [];
  readonly maxCols: number = 7400;
  private run: Map<string, { n: number }> = new Map();

  get colsCount(): number {
    return this.cols.length;
  }

  tickIndex(price: number): number {
    if (this.anchor === null) return Math.floor(this.n / 2);
    const base = this.anchor - (this.n / 2) * HEAT_CONFIG.step;
    return Math.max(0, Math.min(this.n - 1, Math.round((price - base) / HEAT_CONFIG.step)));
  }

  priceAt(index: number): number {
    const base = (this.anchor ?? 0) - (this.n / 2) * HEAT_CONFIG.step;
    return base + index * HEAT_CONFIG.step;
  }

  // Shifts price grid when mid drifts beyond 28% of vertical window
  reanchor(mid: number): void {
    if (this.anchor === null) {
      this.anchor = mid;
      return;
    }
    const drift = Math.abs(mid - this.anchor);
    if (drift > HEAT_CONFIG.step * this.n * 0.28) {
      const sh = Math.round((mid - this.anchor) / HEAT_CONFIG.step);
      for (const c of this.cols) {
        c.q = DepthHeatStore.shift(c.q, -sh, this.n);
        c.ps = DepthHeatStore.shiftU(c.ps, -sh, this.n);
      }
      this.anchor += sh * HEAT_CONFIG.step;
    }
  }

  static shift(a: Int16Array, k: number, n: number): Int16Array {
    const o = new Int16Array(n * 2);
    const offset = k * 2;
    for (let i = 0; i < n * 2; i++) {
      const j = i + offset;
      if (j >= 0 && j < n * 2) o[j] = a[i];
    }
    return o;
  }

  static shiftU(a: Uint8Array, k: number, n: number): Uint8Array {
    const o = new Uint8Array(n * 2);
    const offset = k * 2;
    for (let i = 0; i < n * 2; i++) {
      const j = i + offset;
      if (j >= 0 && j < n * 2) o[j] = a[i];
    }
    return o;
  }

  add(t: number, book: BookState, mid: number): void {
    this.reanchor(mid);
    const q = new Int16Array(this.n * 2);
    const ps = new Uint8Array(this.n * 2);

    const put = (lv: { p: number; q: number }, side: 'bid' | 'ask') => {
      const i = this.tickIndex(lv.p);
      if (i < 0 || i >= this.n) return;
      const offset = i * 2 + (side === 'bid' ? 0 : 1);
      const qi = Math.max(0, Math.min(32000, Math.round(lv.q)));
      if (qi > q[offset]) q[offset] = qi;

      const key = (side === 'bid' ? 'b' : 'a') + i;
      let r = this.run.get(key);
      // Threshold for tracking persistent resting orders over continuous scans
      if (qi >= HEAT_CONFIG.persMinObs * 8) {
        if (!r) r = { n: 0 };
        r.n = Math.min(255, r.n + 1);
        this.run.set(key, r);
      } else {
        this.run.delete(key);
      }
      ps[offset] = r ? r.n : 0;
    };

    for (const l of book.bids) put(l, 'bid');
    for (const l of book.asks) put(l, 'ask');

    this.cols.push({ t, q, ps, mid });
    if (this.cols.length > this.maxCols) {
      this.cols.splice(0, this.cols.length - this.maxCols);
    }
  }

  // Pre-populates synthetic historical depth if newly mounted
  seedIfEmpty(book: BookState, now: number): void {
    if (this.cols.length > 0 || !book || book.mid === 0) return;
    for (let i = 40; i >= 1; i--) {
      const t = now - i * 1000;
      this.add(t, book, book.mid);
    }
  }

  bucket(span: number, now: number): HeatBucketResult {
    const from = now - span * HEAT_CONFIG.cols;
    const to = now;
    const out: Array<{ q: Int16Array; ps: Uint8Array; n: number; mid: number } | null> =
      new Array(HEAT_CONFIG.cols).fill(null);
    const norm = new Float32Array(HEAT_CONFIG.cols);

    for (const c of this.cols) {
      if (c.t < from || c.t >= to) continue;
      const ci = Math.max(0, Math.min(HEAT_CONFIG.cols - 1, Math.floor((c.t - from) / span)));
      let o = out[ci];
      if (!o) {
        o = { q: new Int16Array(this.n * 2), ps: new Uint8Array(this.n * 2), n: 0, mid: 0 };
        out[ci] = o;
      }
      for (let i = 0; i < this.n * 2; i++) {
        if (c.q[i] > o.q[i]) o.q[i] = c.q[i];
        if (c.ps[i] > o.ps[i]) o.ps[i] = c.ps[i];
      }
      o.mid += c.mid;
      o.n++;
      let mx = 0;
      for (let i = 0; i < this.n * 2; i++) {
        if (c.q[i] > mx) mx = c.q[i];
      }
      if (mx > norm[ci]) norm[ci] = mx;
    }

    for (const o of out) {
      if (o && o.n) o.mid /= o.n;
    }
    return { cols: out, from, to, norm };
  }
}
