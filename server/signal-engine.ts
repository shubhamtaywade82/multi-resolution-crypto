import { SignalState, StructureAnalysis, WindowMetric, AbsorptionEvent } from './types.js';

interface SignalInputs {
  now: number;
  bookTs: number;
  bookGaps: number;
  w5: WindowMetric;
  w30: WindowMetric;
  w2m: WindowMetric;
  w5m: WindowMetric;
  st: Record<string, StructureAnalysis>;
  abs: AbsorptionEvent | null;
  wallBias: number;
}

export class SignalEngine {
  public state: 'NO_TRADE' | 'LONG' | 'SHORT' = 'NO_TRADE';
  public lastChange = Date.now();
  private pendDir = 0;
  private pendHits = 0;
  private readonly entryThreshold = 6.0;
  private readonly exitThreshold = 2.5;
  private readonly persistSec = 3;

  public evaluate(inputs: SignalInputs): SignalState {
    const { now, bookTs, bookGaps, st } = inputs;
    const ledger = this.buildLedger(inputs);
    let pts = ledger.reduce((acc, l) => acc + l.pts, 0);
    pts = Math.round(Math.max(-10, Math.min(10, pts)) * 10) / 10;

    const isStale = now - bookTs > 1500;
    const gates = this.evaluateGates({ pts, isStale, bookGaps, st, now, bookTs });
    this.updateState({ pts, gates, isStale, now, h1Bias: st.h1?.bias || 0 });
    const reasons = this.buildReasons(inputs, isStale);

    return {
      state: this.state,
      pts,
      ledger,
      gates,
      reasons,
      ageSec: (now - this.lastChange) / 1000,
      lastChange: this.lastChange
    };
  }

  private buildReasons(inputs: SignalInputs, isStale: boolean) {
    const { w5, w30, w2m, st, abs, bookTs, now } = inputs;
    const R: Array<{ c: string; t: string; s: string }> = [];
    if (isStale) R.push({ c: 'r', t: `DATA STALE — depth age ${(now - bookTs) | 0} ms`, s: 'interlock' });
    R.push({
      c: abs ? (abs.dir > 0 ? 'g' : 'r') : 'd',
      t: abs ? `absorption CONFIRMED ${abs.dir > 0 ? 'sell absorbed' : 'buy absorbed'} @ ${abs.price.toFixed(2)}` : 'no confirmed absorption in window',
      s: 'L2'
    });
    R.push({
      c: w5.ofi > 0.12 ? 'g' : w5.ofi < -0.12 ? 'r' : 'd',
      t: `noise filter: 5s OFI ${w5.ofi.toFixed(2)} vs 30s ${w30.ofi.toFixed(2)} vs 2m ${w2m.ofi.toFixed(2)}`,
      s: 'L2'
    });
    if (st.m5?.ok) R.push({ c: st.m5.bias > 0 ? 'g' : st.m5.bias < 0 ? 'r' : 'd', t: `5m structure ${st.m5.trend} · ${st.m5.pattern}`, s: 'L3' });
    if (st.h1?.ok) R.push({ c: st.h1.bias > 0 ? 'g' : st.h1.bias < 0 ? 'r' : 'd', t: `1h closed context ${st.h1.trend}`, s: 'L4' });
    return R;
  }

  private buildLedger(inputs: SignalInputs) {
    const { w5, w30, w2m, w5m, st, abs, wallBias: wb } = inputs;
    const L: Array<{ n: string; pts: number; max: number; note: string }> = [];
    const add = (n: string, pts: number, max: number, note: string) => {
      L.push({ n, pts: Math.max(-max, Math.min(max, pts)), max, note });
    };

    const sO = [w5.ofi, w30.ofi, w2m.ofi];
    const agree = sO.filter(v => v > 0.12).length - sO.filter(v => v < -0.12).length;
    add('micro flow agreement (5s/30s/2m OFI)', agree * 0.8, 2.4, `${w5.ofi.toFixed(2)} / ${w30.ofi.toFixed(2)} / ${w2m.ofi.toFixed(2)}`);

    const cvd2mNorm = Math.max(-1, Math.min(1, w2m.cvd / Math.max(60, (w2m.buy + w2m.sell) * 0.3)));
    const cvd5mNorm = Math.max(-1, Math.min(1, w5m.cvd / Math.max(120, (w5m.buy + w5m.sell) * 0.3)));
    add('CVD 2m + 5m signed flow', (cvd2mNorm * 0.6 + cvd5mNorm * 0.6) * 1.1, 2.0, `${w2m.cvd.toFixed(0)} / ${w5m.cvd.toFixed(0)} SOL`);

    add('absorption confirmed', abs ? abs.dir * Math.min(2, abs.hits * 0.5) : 0, 2.0, abs ? `${abs.dir > 0 ? 'sell' : 'buy'} absorbed @ ${abs.price.toFixed(2)}` : 'none');
    add('persistent wall bias', Math.max(-1, Math.min(1, wb * 1.8)), 1.0, `bias ${wb.toFixed(2)}`);

    const m1c = st.m1?.lastC;
    const m1d = m1c ? (m1c.c >= m1c.o ? 1 : -1) : 0;
    add('1m closed trigger candle', m1d, 1.0, m1c ? (m1d > 0 ? 'GREEN' : 'RED') : '—');

    const s5 = st.m5?.bias || 0, s3 = st.m3?.bias || 0;
    add('3m/5m setup structure', (s5 * 0.7 + s3 * 0.3) * 2, 2.0, `5m ${st.m5?.pattern || '—'} · 3m ${st.m3?.pattern || '—'}`);
    add('15m confirmation', (st.m15?.bias || 0), 1.0, st.m15?.ok ? st.m15.trend : 'insufficient candles');
    add('1h closed context', (st.h1?.bias || 0) * 2, 2.0, st.h1?.ok ? st.h1.trend : 'insufficient candles');
    add('execution friction acceptable', 1.0, 1.0, 'favorable spread');

    return L;
  }

  private evaluateGates(opts: {
    pts: number;
    isStale: boolean;
    bookGaps: number;
    st: Record<string, StructureAnalysis>;
    now: number;
    bookTs: number;
  }) {
    const { pts, isStale, bookGaps, st, now, bookTs } = opts;
    const dir = pts >= this.entryThreshold ? 1 : pts <= -this.entryThreshold ? -1 : 0;
    const held = (this.state === 'LONG' && pts > this.exitThreshold) || (this.state === 'SHORT' && pts < -this.exitThreshold);
    const m1c = st.m1?.lastC;
    const m1d = m1c ? (m1c.c >= m1c.o ? 1 : -1) : 0;

    return [
      { n: 'confluence ≥ entry threshold', ok: dir !== 0 || held, note: `${pts.toFixed(1)} / ${this.entryThreshold}` },
      { n: `persistence ${this.persistSec}s`, ok: this.pendHits >= this.persistSec || held, note: `${this.pendHits}/${this.persistSec}` },
      { n: '1m closed trigger candle', ok: dir === 0 || m1d === dir, note: m1c ? (m1d > 0 ? 'GREEN' : 'RED') : '—' },
      { n: '3m/5m setup structure aligned', ok: dir === 0 || (st.m5?.bias === dir || st.m5?.bias === 0), note: st.m5?.trend || 'n/a' },
      { n: '1h closed context aligned', ok: dir === 0 || st.h1?.bias === 0 || st.h1?.bias === dir, note: st.h1?.trend || 'n/a' },
      { n: 'book valid · data fresh', ok: !isStale, note: `${(now - bookTs) | 0} ms` },
      { n: 'seq integrity (no unresolved gap)', ok: bookGaps === 0 || !isStale, note: `${bookGaps} gaps` }
    ];
  }

  private updateState(opts: {
    pts: number;
    gates: Array<{ n: string; ok: boolean }>;
    isStale: boolean;
    now: number;
    h1Bias: number;
  }): void {
    const { pts, gates, isStale, now, h1Bias } = opts;
    const dir = pts >= this.entryThreshold ? 1 : pts <= -this.entryThreshold ? -1 : 0;
    let next = this.state;

    if (isStale) {
      next = 'NO_TRADE';
    } else if (this.state === 'NO_TRADE') {
      if (dir !== 0 && dir === this.pendDir) this.pendHits++;
      else {
        this.pendDir = dir;
        this.pendHits = dir !== 0 ? 1 : 0;
      }
      if (dir !== 0 && this.pendHits >= this.persistSec && gates.slice(2).every(g => g.ok)) {
        next = dir > 0 ? 'LONG' : 'SHORT';
      }
    } else if (this.state === 'LONG') {
      if (pts <= this.exitThreshold || (h1Bias !== 0 && h1Bias !== 1)) next = 'NO_TRADE';
    } else if (this.state === 'SHORT') {
      if (pts >= -this.exitThreshold || (h1Bias !== 0 && h1Bias !== -1)) next = 'NO_TRADE';
    }

    if (next !== this.state) {
      this.state = next;
      this.lastChange = now;
      this.pendHits = 0;
      this.pendDir = 0;
    }
  }
}
