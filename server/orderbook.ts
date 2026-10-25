import { Level, BookState } from './types.js';

export interface Wall {
  p: number;
  side: 'bid' | 'ask';
  peak: number;
  life: number;
  replen: number;
  state: 'ACTIVE' | 'GONE' | 'CONSUMED';
  pers: number;
  traded: number;
  score: number;
}

interface WallRecord {
  p: number;
  side: 'bid' | 'ask';
  first: number;
  last: number;
  snaps: number;
  peak: number;
  sum: number;
  replen: number;
  prev: number;
  state: 'ACTIVE' | 'GONE' | 'CONSUMED';
  goneAt: number;
  traded: number;
  q: number;
}

export class WallTracker {
  private m = new Map<string, WallRecord>();
  public snaps = 0;

  constructor(
    private readonly tick = 0.01,
    private readonly minQty = 110
  ) {}

  private key(p: number, side: 'bid' | 'ask'): string {
    return (side === 'bid' ? 'b' : 'a') + Math.round(p / this.tick);
  }

  public observe(bids: Level[], asks: Level[], t: number): void {
    this.snaps++;
    const seen = new Set<string>();

    const proc = (lv: Level, side: 'bid' | 'ask') => {
      const k = this.key(lv.p, side);
      seen.add(k);
      let r = this.m.get(k);
      if (!r) {
        r = {
          p: lv.p, side, first: t, last: t, snaps: 0,
          peak: 0, sum: 0, replen: 0, prev: 0, state: 'ACTIVE',
          goneAt: 0, traded: 0, q: lv.q
        };
        this.m.set(k, r);
      }
      r.last = t;
      r.snaps++;
      r.sum += lv.q;
      r.q = lv.q;
      if (lv.q > r.peak) r.peak = lv.q;
      if (lv.q > r.prev + 0.5) r.replen++;
      r.prev = lv.q;
      if (r.state === 'GONE') r.state = 'ACTIVE';
    };

    for (const l of bids) proc(l, 'bid');
    for (const l of asks) proc(l, 'ask');

    for (const [k, r] of this.m) {
      if (r.state === 'ACTIVE' && !seen.has(k)) {
        r.state = 'GONE';
        r.goneAt = t;
      } else if (r.state === 'GONE' && t - r.goneAt > 90000) {
        this.m.delete(k);
      }
    }
  }

  public onTrade(price: number, qty: number, agg: 'BUY' | 'SELL'): void {
    const side: 'bid' | 'ask' = agg === 'BUY' ? 'ask' : 'bid';
    const base = Math.round(price / this.tick);
    for (let d = -2; d <= 2; d++) {
      const k = (side === 'bid' ? 'b' : 'a') + (base + d);
      const r = this.m.get(k);
      if (r && r.peak >= this.minQty) {
        r.traded += qty;
        if (r.traded > r.peak * 0.5 && r.state !== 'GONE') {
          r.state = 'CONSUMED';
        }
      }
    }
  }

  public pers(r: WallRecord, now: number, span = 60000): number {
    const dur = Math.max(1, (Math.min(r.last, now) - r.first) / 1000);
    const life = Math.min(1, Math.max(0, (Math.min(r.last, now) - r.first) / span));
    const dens = Math.min(1, Math.max(0, r.snaps / dur));
    return Math.min(1, Math.max(0, life * 0.6 + dens * 0.4));
  }

  public top(side: 'bid' | 'ask', n: number, now: number): Wall[] {
    const out: Wall[] = [];
    for (const r of this.m.values()) {
      if (r.side !== side || r.peak < this.minQty) continue;
      const p = this.pers(r, now);
      if (p < 0.22) continue;
      out.push({
        p: r.p,
        side: r.side,
        peak: r.peak,
        life: (r.last - r.first) / 1000,
        replen: r.replen,
        state: r.state,
        pers: p,
        traded: r.traded,
        score: r.peak * (0.35 + p)
      });
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, n);
  }

  public bias(now: number): number {
    const b = this.top('bid', 5, now).reduce((s, r) => s + r.score, 0);
    const a = this.top('ask', 5, now).reduce((s, r) => s + r.score, 0);
    return b + a === 0 ? 0 : (b - a) / (b + a);
  }
}

export class OrderBook {
  private bids = new Map<number, number>();
  private asks = new Map<number, number>();
  public walls = new WallTracker();
  public lastu = 0;
  public gaps = 0;
  public isSynced = false;
  private buffer: any[] = [];
  private isResyncing = false;

  public handleDiff(diff: any, onResyncNeeded: () => void): boolean {
    if (this.isResyncing) {
      this.buffer.push(diff);
      return false;
    }
    if (!this.isSynced) return false;

    // Binance Futures sequence continuity check
    if (diff.pu !== this.lastu) {
      this.gaps++;
      this.isSynced = false;
      onResyncNeeded();
      return false;
    }

    this.applyDiff(diff);
    return true;
  }

  public applyDiff(diff: any): void {
    for (const [p, q] of diff.b) {
      const price = parseFloat(p), qty = parseFloat(q);
      if (qty === 0) this.bids.delete(price);
      else this.bids.set(price, qty);
    }
    for (const [p, q] of diff.a) {
      const price = parseFloat(p), qty = parseFloat(q);
      if (qty === 0) this.asks.delete(price);
      else this.asks.set(price, qty);
    }
    this.lastu = diff.u;
  }

  public setResyncing(val: boolean): void {
    this.isResyncing = val;
    if (val) {
      this.buffer = [];
      this.isSynced = false;
    }
  }

  public applySnapshot(snap: { lastUpdateId: number; bids: any[]; asks: any[] }): boolean {
    this.bids.clear();
    this.asks.clear();
    for (const b of snap.bids) this.bids.set(parseFloat(b.price || b[0]), parseFloat(b.qty || b[1]));
    for (const a of snap.asks) this.asks.set(parseFloat(a.price || a[0]), parseFloat(a.qty || a[1]));

    const snapSeq = snap.lastUpdateId;
    const startIdx = this.findBridgingEvent(snapSeq);
    if (startIdx === -1) return false;

    for (let i = startIdx; i < this.buffer.length; i++) {
      this.applyDiff(this.buffer[i]);
    }
    this.isSynced = true;
    this.isResyncing = false;
    return true;
  }

  private findBridgingEvent(snapSeq: number): number {
    for (let i = 0; i < this.buffer.length; i++) {
      const e = this.buffer[i];
      if (e.u < snapSeq) continue;
      // Per Binance Futures sync rules, first bridging event must bracket snapshot
      if (e.U <= snapSeq && e.u >= snapSeq) return i;
    }
    return -1;
  }

  public getState(ts = Date.now(), depth = 60): BookState {
    const sortedBids = Array.from(this.bids.entries())
      .sort((a, b) => b[0] - a[0])
      .slice(0, depth)
      .map(([p, q]) => ({ p, q }));

    const sortedAsks = Array.from(this.asks.entries())
      .sort((a, b) => a[0] - b[0])
      .slice(0, depth)
      .map(([p, q]) => ({ p, q }));

    const bb = sortedBids.length ? sortedBids[0].p : 0;
    const ba = sortedAsks.length ? sortedAsks[0].p : 0;
    const mid = bb && ba ? (bb + ba) / 2 : 0;

    this.walls.observe(sortedBids, sortedAsks, ts);

    let b10 = 0, a10 = 0;
    for (let i = 0; i < Math.min(10, sortedBids.length); i++) b10 += sortedBids[i].q;
    for (let i = 0; i < Math.min(10, sortedAsks.length); i++) a10 += sortedAsks[i].q;
    const ratio10 = b10 + a10 === 0 ? 0 : (b10 - a10) / (b10 + a10);

    const b0 = sortedBids.length ? sortedBids[0].q : 0;
    const a0 = sortedAsks.length ? sortedAsks[0].q : 0;
    const instant = b0 + a0 === 0 ? 0 : (b0 - a0) / (b0 + a0);

    return {
      bids: sortedBids,
      asks: sortedAsks,
      bb,
      ba,
      mid,
      seq: this.lastu,
      ts,
      gaps: this.gaps,
      walls: {
        bids: this.walls.top('bid', 4, ts),
        asks: this.walls.top('ask', 4, ts)
      },
      imbalance: {
        instant,
        m5: 0,
        m30: 0,
        ratio10,
        bidVol10: b10,
        askVol10: a10
      }
    };
  }
}
