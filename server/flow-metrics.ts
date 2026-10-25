import { Trade, WindowMetric, AbsorptionEvent } from './types.js';
import { WallTracker } from './orderbook.js';

interface RawTradeSummary {
  n: number;
  buy: number;
  sell: number;
  cvd: number;
  disp: number | null;
  rv: number;
  fill: number;
  src: string;
}

export class RollingTrades {
  private events: Trade[] = [];
  constructor(private readonly maxMs = 120_000) {}

  public add(trade: Trade): void {
    this.events.push(trade);
    this.prune(trade.timestamp);
  }

  public prune(now: number): void {
    const cutoff = now - this.maxMs;
    let i = 0;
    while (i < this.events.length && this.events[i].timestamp < cutoff) i++;
    if (i > 0) this.events.splice(0, i);
  }

  public snapshot(now: number): Trade[] {
    this.prune(now);
    return this.events;
  }
}

export class TradeBuckets {
  private map = new Map<number, any>();
  private order: any[] = [];

  constructor(
    private readonly bucketMs = 1000,
    private readonly maxBuckets = 7200
  ) {}

  public add(t: number, p: number, q: number, side: 'BUY' | 'SELL'): void {
    const k = Math.floor(t / this.bucketMs);
    let o = this.map.get(k);
    if (!o) {
      o = { k, t: k * this.bucketMs, buy: 0, sell: 0, n: 0, o: p, h: p, l: p, c: p };
      this.map.set(k, o);
      this.order.push(o);
    }
    if (side === 'BUY') o.buy += q;
    else o.sell += q;
    o.n++;
    if (p > o.h) o.h = p;
    if (p < o.l) o.l = p;
    o.c = p;
  }

  public prune(now: number): void {
    const cutoff = now - this.maxBuckets * this.bucketMs;
    let i = 0;
    while (i < this.order.length && this.order[i].t < cutoff) i++;
    if (i > 0) {
      for (let j = 0; j < i; j++) this.map.delete(this.order[j].k);
      this.order.splice(0, i);
    }
  }

  public range(from: number, to: number): any[] {
    const out: any[] = [];
    for (let i = 0; i < this.order.length; i++) {
      const b = this.order[i];
      if (b.t >= from && b.t < to) out.push(b);
      else if (b.t >= to) break;
    }
    return out;
  }
}

export class TopOfBookRing {
  private a: Array<{ t: number; bp: number; bq: number; ap: number; aq: number }> = [];
  constructor(private readonly maxMs = 25 * 60_000) {}

  public add(t: number, bp: number, bq: number, ap: number, aq: number): void {
    this.a.push({ t, bp, bq, ap, aq });
    const cutoff = t - this.maxMs;
    let i = 0;
    while (i < this.a.length && this.a[i].t < cutoff) i++;
    if (i > 0) this.a.splice(0, i);
  }

  public ofi(from: number, to: number): number {
    let sum = 0;
    let prev: { t: number; bp: number; bq: number; ap: number; aq: number } | null = null;

    for (let i = 0; i < this.a.length; i++) {
      const x = this.a[i];
      if (x.t < from) {
        prev = x;
        continue;
      }
      if (x.t >= to) break;

      if (prev) {
        const dB = x.bp > prev.bp ? x.bq : x.bp === prev.bp ? x.bq - prev.bq : -prev.bq;
        const dA = x.ap < prev.ap ? x.aq : x.ap === prev.ap ? x.aq - prev.aq : -prev.aq;
        sum += dB - dA;
      }
      prev = x;
    }
    return sum;
  }

  public imbMean(from: number, to: number): number {
    let sum = 0, count = 0;
    for (let i = 0; i < this.a.length; i++) {
      const x = this.a[i];
      if (x.t < from) continue;
      if (x.t >= to) break;
      const i0 = (x.bq + x.aq) === 0 ? 0 : (x.bq - x.aq) / (x.bq + x.aq);
      sum += i0;
      count++;
    }
    return count > 0 ? sum / count : 0;
  }
}

export class AbsorptionDetector {
  private base: number[] = [];
  private cand: any = null;
  public confirmed: AbsorptionEvent | null = null;
  private lastEval = 0;

  public evaluate(now: number, trades: Trade[], walls: WallTracker, mid: number): AbsorptionEvent | null {
    if (now - this.lastEval < 900) return this.confirmed;
    this.lastEval = now;

    const from = now - 15_000;
    const win = trades.filter(t => t.timestamp >= from);
    if (win.length < 10) return this.confirmed;

    const lo = mid - 0.05, hi = mid + 0.05;
    let bv = 0, sv = 0;
    for (const t of win) {
      if (t.price >= lo && t.price <= hi) {
        if (t.signedQuantity > 0) bv += t.quantity;
        else sv += t.quantity;
      }
    }
    const tot = bv + sv;
    if (tot <= 0) return this.confirmed;

    return this.detectDirection({ now, win, walls, mid, bv, sv, tot });
  }

  private detectDirection(opts: {
    now: number;
    win: Trade[];
    walls: WallTracker;
    mid: number;
    bv: number;
    sv: number;
    tot: number;
  }): AbsorptionEvent | null {
    const { now, win, walls, mid, bv, sv, tot } = opts;
    this.base.push(tot);
    if (this.base.length > 40) this.base.shift();

    const sorted = [...this.base].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)] || tot;
    const hot = tot > med * 1.22;
    const disp = win[win.length - 1].price - win[0].price;

    const bp = Math.max(0, ...walls.top('bid', 4, now).filter(w => w.p <= mid).map(w => w.pers));
    const ap = Math.max(0, ...walls.top('ask', 4, now).filter(w => w.p >= mid).map(w => w.pers));

    let dir = 0;
    if (hot && sv > bv * 1.22 && disp > -0.018 && bp > 0.32) dir = 1;
    else if (hot && bv > sv * 1.22 && disp < 0.018 && ap > 0.32) dir = -1;

    if (dir !== 0) {
      if (!this.cand || this.cand.dir !== dir) this.cand = { dir, hits: 0, price: mid };
      this.cand.hits++;
      if (this.cand.hits >= 2) {
        this.confirmed = { dir: this.cand.dir, at: now, price: mid, hits: this.cand.hits, expires: now + 50_000 };
        this.cand = null;
        return this.confirmed;
      }
    } else {
      this.cand = null;
    }

    if (this.confirmed && now > this.confirmed.expires) this.confirmed = null;
    return this.confirmed;
  }
}

export class FlowManager {
  public raw = new RollingTrades(120_000);
  public buckets = new TradeBuckets(1000, 7200);
  public tob = new TopOfBookRing(25 * 60_000);
  public absorb = new AbsorptionDetector();

  public onTrade(trade: Trade): void {
    this.raw.add(trade);
    this.buckets.add(trade.timestamp, trade.price, trade.quantity, trade.aggressorSide);
  }

  public onBookTicker(t: number, bp: number, bq: number, ap: number, aq: number): void {
    this.tob.add(t, bp, bq, ap, aq);
  }

  private summarizeRaw(from: number, to: number): RawTradeSummary {
    const ev = this.raw.snapshot(to);
    let buy = 0, sell = 0, rv = 0, prev: number | null = null, o: number | null = null, c: number | null = null, n = 0;

    for (const e of ev) {
      if (e.timestamp < from) continue;
      if (e.signedQuantity > 0) buy += e.quantity;
      else sell += e.quantity;
      n++;
      if (o === null) o = e.price;
      if (prev !== null) {
        const lr = Math.log(e.price / prev);
        rv += lr * lr;
      }
      prev = e.price;
      c = e.price;
    }

    return {
      n, buy, sell, cvd: buy - sell,
      disp: o !== null && c !== null ? c - o : null,
      rv: Math.sqrt(rv) * 10_000,
      fill: n ? 1 : 0,
      src: 'raw ring'
    };
  }

  private summarizeBuckets(from: number, to: number): RawTradeSummary {
    const bs = this.buckets.range(from, to);
    let buy = 0, sell = 0, n = 0, rv = 0, prev: number | null = null, o: number | null = null, c: number | null = null;

    for (const b of bs) {
      buy += b.buy;
      sell += b.sell;
      n += b.n;
      if (o === null) o = b.o;
      c = b.c;
      if (prev !== null) {
        const lr = Math.log(b.c / prev);
        rv += lr * lr;
      }
      prev = b.c;
    }

    const cov = bs.length ? bs[bs.length - 1].t + 1000 - bs[0].t : 0;
    return {
      n, buy, sell, cvd: buy - sell,
      disp: o !== null && c !== null ? c - o : null,
      rv: Math.sqrt(rv) * 10_000,
      fill: Math.min(1, Math.max(0, cov / (to - from))),
      src: '1s buckets'
    };
  }

  public computeWindow(opts: { ms: number; label: string; role: string; now: number; mid: number }): WindowMetric {
    const { ms, label, role, now, mid } = opts;
    const raw = ms <= 120_000 ? this.summarizeRaw(now - ms, now) : this.summarizeBuckets(now - ms, now);
    const vol = Math.max(1, raw.buy + raw.sell);
    const ofiRaw = this.tob.ofi(now - ms, now);
    const ofi = Math.min(1, Math.max(-1, ofiRaw / (vol * 0.55)));
    const dispBps = mid && raw.disp !== null ? (raw.disp / mid) * 10_000 : null;

    return {
      label, ms, role, n: raw.n, buy: raw.buy, sell: raw.sell, cvd: raw.cvd, ofi,
      buyPct: (raw.buy / vol) * 100, dispBps, rv: raw.rv,
      eff: raw.rv > 0 && dispBps !== null ? Math.abs(dispBps) / raw.rv : null,
      fill: raw.fill, src: raw.src
    };
  }

  public getMatrix(now: number, mid: number): WindowMetric[] {
    return [
      this.computeWindow({ ms: 5_000, label: '5s', role: 'lead trigger', now, mid }),
      this.computeWindow({ ms: 30_000, label: '30s', role: 'filter', now, mid }),
      this.computeWindow({ ms: 120_000, label: '2m', role: 'bridge', now, mid }),
      this.computeWindow({ ms: 300_000, label: '5m', role: 'setup flow', now, mid }),
      this.computeWindow({ ms: 900_000, label: '15m', role: 'persistence', now, mid }),
      this.computeWindow({ ms: 3_600_000, label: '1h', role: 'macro regime', now, mid })
    ];
  }
}
