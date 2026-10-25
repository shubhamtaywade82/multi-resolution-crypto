import { Candle } from './types.js';

export class CandleBuilder {
  public cur: Candle | null = null;
  public closed: Candle[] = [];
  public onClose?: (candle: Candle) => void;

  constructor(
    public readonly ms: number,
    public readonly keep: number,
    public readonly label: string
  ) {}

  public seed(candles: Candle[]): void {
    this.closed = [];
    if (!candles.length) return;

    for (let i = 0; i < candles.length - 1; i++) {
      const c = candles[i];
      this.closed.push({ ...c, closed: true });
    }

    if (this.closed.length > this.keep) {
      this.closed.splice(0, this.closed.length - this.keep);
    }

    const last = candles[candles.length - 1];
    if (last) {
      this.cur = { ...last, closed: false };
    }
  }

  public onPrice(t: number, p: number, v = 0, tbv = 0): void {
    const k = Math.floor(t / this.ms);
    const candleStart = k * this.ms;

    if (!this.cur || Math.floor(this.cur.t / this.ms) !== k) {
      if (this.cur) {
        this.cur.closed = true;
        this.closed.push(this.cur);
        if (this.closed.length > this.keep) this.closed.shift();
        this.onClose?.(this.cur);
      }
      this.cur = { t: candleStart, o: p, h: p, l: p, c: p, v, tbv };
      return;
    }

    if (p > this.cur.h) this.cur.h = p;
    if (p < this.cur.l) this.cur.l = p;
    this.cur.c = p;
    this.cur.v += v;
    this.cur.tbv += tbv;
  }

  public progress(now: number): number {
    if (!this.cur) return 0;
    const p = (now - this.cur.t) / this.ms;
    return Math.max(0, Math.min(1, p));
  }

  public last(): Candle | null {
    return this.closed.length ? this.closed[this.closed.length - 1] : null;
  }
}

export class MultiResolutionCandles {
  public readonly m1 = new CandleBuilder(60_000, 180, '1m');
  public readonly m3 = new CandleBuilder(180_000, 120, '3m');
  public readonly m5 = new CandleBuilder(300_000, 120, '5m');
  public readonly m15 = new CandleBuilder(900_000, 96, '15m');
  public readonly h1 = new CandleBuilder(3_600_000, 72, '1h');
  public readonly h4 = new CandleBuilder(14_400_000, 40, '4h');

  private all(): CandleBuilder[] {
    return [this.m1, this.m3, this.m5, this.m15, this.h1, this.h4];
  }

  public onTrade(t: number, p: number, v: number, isBuyerMaker: boolean): void {
    const tbv = isBuyerMaker ? 0 : v;
    for (const cb of this.all()) {
      cb.onPrice(t, p, v, tbv);
    }
  }

  public seedAll(data: Record<string, Candle[]>): void {
    if (data.m1) this.m1.seed(data.m1);
    if (data.m3) this.m3.seed(data.m3);
    if (data.m5) this.m5.seed(data.m5);
    if (data.m15) this.m15.seed(data.m15);
    if (data.h1) this.h1.seed(data.h1);
    if (data.h4) this.h4.seed(data.h4);
  }

  public getSnapshot(): Record<string, Candle[]> {
    const out: Record<string, Candle[]> = {};
    for (const cb of this.all()) {
      const list = [...cb.closed];
      if (cb.cur) list.push(cb.cur);
      out[cb.label] = list;
    }
    return out;
  }
}
