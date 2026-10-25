import React, { useMemo } from 'react';
import { BookState, Level } from '../types.ts';

interface LadderProps {
  book: BookState | null;
}

export const OrderBookLadder: React.FC<LadderProps> = ({ book }) => {
  const asks = useMemo(() => {
    if (!book?.asks.length) return [];
    return [...book.asks.slice(0, 11)].reverse();
  }, [book?.asks]);

  const bids = useMemo(() => {
    if (!book?.bids.length) return [];
    return book.bids.slice(0, 11);
  }, [book?.bids]);

  const maxQty = useMemo(() => {
    let m = 1;
    if (book) {
      for (const l of book.asks.slice(0, 11)) if (l.q > m) m = l.q;
      for (const l of book.bids.slice(0, 11)) if (l.q > m) m = l.q;
    }
    return m;
  }, [book]);

  const imb = book?.imbalance;
  const spread = book ? book.ba - book.bb : 0;
  const spreadBps = book && book.mid > 0 ? (spread / book.mid) * 10000 : 0;

  return (
    <div className="panel" style={{ height: '100%' }}>
      <div className="panel-head">
        <span>L1 · LIVE MICROSTRUCTURE</span>
        <span style={{ fontSize: '10px', color: 'var(--muted)' }}>DEPTH LADDER · 100ms</span>
      </div>

      <div className="panel-body" style={{ padding: '6px', gap: '6px' }}>
        {/* Top of Book Imbalance Summary */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '4px',
          padding: '6px',
          background: 'var(--card-sub)',
          borderRadius: '3px',
          fontSize: '10px'
        }}>
          <div>
            <span style={{ color: 'var(--muted)' }}>instant (L1): </span>
            <span style={{ color: (imb?.instant ?? 0) > 0 ? 'var(--g)' : 'var(--r)', fontWeight: 600 }}>
              {(imb?.instant ?? 0) > 0 ? '+' : ''}{(imb?.instant ?? 0).toFixed(3)}
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--muted)' }}>5s mean: </span>
            <span style={{ color: (imb?.m5 ?? 0) > 0 ? 'var(--g)' : 'var(--r)', fontWeight: 600 }}>
              {(imb?.m5 ?? 0) > 0 ? '+' : ''}{(imb?.m5 ?? 0).toFixed(3)}
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--muted)' }}>30s mean: </span>
            <span style={{ color: (imb?.m30 ?? 0) > 0 ? 'var(--g)' : 'var(--r)', fontWeight: 600 }}>
              {(imb?.m30 ?? 0) > 0 ? '+' : ''}{(imb?.m30 ?? 0).toFixed(3)}
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--muted)' }}>10-lv ratio: </span>
            <span style={{ color: (imb?.ratio10 ?? 0) > 0 ? 'var(--g)' : 'var(--r)', fontWeight: 600 }}>
              {(imb?.ratio10 ?? 0) > 0 ? '+' : ''}{(imb?.ratio10 ?? 0).toFixed(3)}
            </span>
          </div>
        </div>

        {/* Asks Ladder */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {asks.map((l) => (
            <LadderRow key={`a-${l.p}`} level={l} side="ask" maxQty={maxQty} />
          ))}
        </div>

        {/* Midpoint row */}
        <div style={{
          padding: '5px 8px',
          background: 'var(--card-sub)',
          borderTop: '1px solid var(--border)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          fontWeight: 'bold'
        }}>
          <span style={{ color: 'var(--c)' }}>
            ${spread.toFixed(2)} · {spreadBps.toFixed(1)} bps
          </span>
          <span style={{ fontSize: '13px' }}>${book?.mid.toFixed(2) ?? '—'}</span>
          <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
            {(imb?.bidVol10 ? imb.bidVol10 / 1000 : 0).toFixed(1)}k / {(imb?.askVol10 ? imb.askVol10 / 1000 : 0).toFixed(1)}k
          </span>
        </div>

        {/* Bids Ladder */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {bids.map((l) => (
            <LadderRow key={`b-${l.p}`} level={l} side="bid" maxQty={maxQty} />
          ))}
        </div>
      </div>
    </div>
  );
};

const LadderRow: React.FC<{ level: Level; side: 'bid' | 'ask'; maxQty: number }> = ({
  level,
  side,
  maxQty
}) => {
  const pct = Math.min(100, Math.max(2, (level.q / maxQty) * 100));
  const isWall = level.q >= 100;

  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      justifyContent: 'space-between',
      padding: '3px 8px',
      fontSize: '11px',
      overflow: 'hidden',
      borderRadius: '2px'
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        [side === 'bid' ? 'left' : 'right']: 0,
        width: `${pct}%`,
        background: side === 'bid' ? 'rgba(63, 185, 80, 0.16)' : 'rgba(248, 81, 73, 0.16)',
        transition: 'width 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: 'none'
      }} />

      <span style={{
        position: 'relative',
        zIndex: 1,
        color: side === 'bid' ? 'var(--g)' : 'var(--r)',
        fontWeight: isWall ? 'bold' : 'normal'
      }}>
        ${level.p.toFixed(2)}
        {isWall && <span style={{ fontSize: '9px', marginLeft: '4px', opacity: 0.8 }}>██</span>}
      </span>

      <span style={{ position: 'relative', zIndex: 1, color: 'var(--text)' }}>
        {level.q.toFixed(2)}
      </span>
    </div>
  );
};
