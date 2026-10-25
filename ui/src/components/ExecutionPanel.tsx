import React, { useState, useMemo } from 'react';
import { BookState, WindowMetric } from '../types.ts';

interface ExecutionProps {
  book: BookState | null;
  w5m?: WindowMetric;
}

export const ExecutionPanel: React.FC<ExecutionProps> = ({ book, w5m }) => {
  const [size, setSize] = useState(10);
  const [fee, setFee] = useState(4);
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');

  const mid = book?.mid ?? 0;
  const spread = book ? book.ba - book.bb : 0;
  const spreadBps = mid > 0 ? (spread / mid) * 10000 : 0;

  const estimate = useMemo(() => {
    if (!book || mid === 0) return null;
    const levels = side === 'BUY' ? book.asks : book.bids;
    let rem = size;
    let cost = 0;
    let lvCount = 0;

    for (const l of levels) {
      if (rem <= 0) break;
      const take = Math.min(l.q, rem);
      cost += take * l.p;
      rem -= take;
      lvCount++;
    }

    const filled = size - rem;
    const vwap = filled > 0 ? cost / filled : null;
    const slip = vwap !== null ? (Math.abs(vwap - mid) / mid) * 10000 : 0;
    const halfSpread = spreadBps / 2;
    const totalBps = slip + halfSpread + fee * 2;
    const totalUsd = (totalBps / 10000) * mid * size;
    const rngBps = w5m?.rv ?? 20;
    const budgetPct = rngBps > 0 ? (totalBps / rngBps) * 100 : 0;

    return {
      levels: lvCount,
      unfilled: rem,
      vwap,
      slip,
      halfSpread,
      totalBps,
      totalUsd,
      budgetPct
    };
  }, [book, mid, size, fee, side, spreadBps, w5m]);

  return (
    <div className="panel">
      <div className="panel-head">
        <span>EXECUTION FRICTION SIMULATOR</span>
        <span style={{ fontSize: '10px', color: 'var(--muted)' }}>ACTUAL VS ESTIMATE</span>
      </div>

      <div className="panel-body" style={{ gap: '8px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--muted)', fontSize: '11px' }}>size:</span>
          <input
            type="number"
            min={0.1}
            value={size}
            onChange={(e) => setSize(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
            style={{ width: '56px', background: 'var(--card-sub)', border: '1px solid var(--border)', color: 'var(--text)', padding: '2px 4px' }}
          />
          <span style={{ color: 'var(--muted)', fontSize: '11px' }}>fee:</span>
          <input
            type="number"
            min={0}
            value={fee}
            onChange={(e) => setFee(Math.max(0, parseFloat(e.target.value) || 0))}
            style={{ width: '44px', background: 'var(--card-sub)', border: '1px solid var(--border)', color: 'var(--text)', padding: '2px 4px' }}
          />
          <span style={{ color: 'var(--muted)', fontSize: '11px' }}>bps</span>

          <select
            value={side}
            onChange={(e) => setSide(e.target.value as 'BUY' | 'SELL')}
            style={{ background: 'var(--card-sub)', border: '1px solid var(--border)', color: 'var(--text)', padding: '2px 6px', marginLeft: 'auto' }}
          >
            <option value="BUY">BUY</option>
            <option value="SELL">SELL</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px' }}>
          <div style={{ color: 'var(--g)', fontWeight: 600, fontSize: '10px', marginTop: '2px' }}>
            ▸ ACTUAL — MEASURED FROM BOOK
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--muted)' }}>best b/a</span>
            <span>${book?.bb.toFixed(2)} / ${book?.ba.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--muted)' }}>spread</span>
            <span>${spread.toFixed(2)} ({spreadBps.toFixed(1)} bps)</span>
          </div>

          <div style={{ color: 'var(--a)', fontWeight: 600, fontSize: '10px', marginTop: '6px' }}>
            ▸ ESTIMATE — DEPTH-WALK SIMULATION
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--muted)' }}>levels walked / unfilled</span>
            <span style={{ color: estimate?.unfilled && estimate.unfilled > 0.01 ? 'var(--r)' : 'var(--text)' }}>
              {estimate?.levels ?? 0} {estimate?.unfilled && estimate.unfilled > 0.01 ? `(${estimate.unfilled.toFixed(2)} unfilled)` : ''}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--muted)' }}>fill VWAP</span>
            <span>${estimate?.vwap?.toFixed(3) ?? '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--muted)' }}>slippage vs mid</span>
            <span>{estimate?.slip.toFixed(1)} bps</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--muted)' }}>half-spread + fee×2</span>
            <span>{(estimate?.halfSpread ?? 0).toFixed(1)} + {(fee * 2).toFixed(1)} bps</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-sub)', paddingTop: '4px', fontWeight: 600 }}>
            <span>TOTAL round trip</span>
            <span style={{ color: (estimate?.totalBps ?? 0) < 6 ? 'var(--g)' : 'var(--a)' }}>
              {estimate?.totalBps.toFixed(1)} bps (${estimate?.totalUsd.toFixed(2)})
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--muted)' }}>
            <span>vs 5m range budget</span>
            <span>{(estimate?.budgetPct ?? 0).toFixed(1)}%</span>
          </div>
        </div>

        <ExecutionBadge totalBps={estimate?.totalBps ?? 0} unfilled={estimate?.unfilled ?? 0} />
      </div>
    </div>
  );
};

const ExecutionBadge: React.FC<{ totalBps: number; unfilled: number }> = ({ totalBps, unfilled }) => {
  if (unfilled > 0.01) {
    return (
      <div style={{ padding: '6px', background: 'var(--r-dim)', border: '1px solid var(--r)', borderRadius: '3px', color: 'var(--r)', fontSize: '11px', textAlign: 'center' }}>
        ✕ INSUFFICIENT DEPTH
      </div>
    );
  }
  if (totalBps < 6) {
    return (
      <div style={{ padding: '6px', background: 'var(--g-dim)', border: '1px solid var(--g)', borderRadius: '3px', color: 'var(--g)', fontSize: '11px', textAlign: 'center' }}>
        ✓ EXECUTABLE — estimate inside friction budget
      </div>
    );
  }
  return (
    <div style={{ padding: '6px', background: 'var(--a-dim)', border: '1px solid var(--a)', borderRadius: '3px', color: 'var(--a)', fontSize: '11px', textAlign: 'center' }}>
      ⚠ ELEVATED — consider passive limit or split
    </div>
  );
};
