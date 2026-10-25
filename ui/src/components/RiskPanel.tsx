import React from 'react';
import { BookState, SignalState } from '../types.ts';

interface RiskProps {
  book: BookState | null;
  signal: SignalState | null;
  isStale: boolean;
}

export const RiskPanel: React.FC<RiskProps> = ({ book, signal, isStale }) => {
  const mid = book?.mid ?? 0;
  const state = signal?.state ?? 'NO_TRADE';

  const entry = state !== 'NO_TRADE' ? mid : null;
  const inv = entry ? (state === 'LONG' ? entry - 0.25 : entry + 0.25) : null;
  const stop = inv ? (state === 'LONG' ? inv - 0.05 : inv + 0.05) : null;

  const distBps = stop && mid > 0 ? (Math.abs(mid - stop) / mid) * 10000 : null;
  const distPct = distBps ? Math.min(100, Math.max(0, (distBps / 50) * 100)) : 0;

  return (
    <div className="panel">
      <div className="panel-head">
        <span>RISK GUARD</span>
        <span style={{ fontSize: '10px', color: 'var(--muted)' }}>IMMEDIATE PATH · RISK MONITORING</span>
      </div>

      <div className="panel-body" style={{ gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span style={{ color: 'var(--muted)' }}>paper position</span>
          <span style={{
            fontWeight: 'bold',
            color: state === 'LONG' ? 'var(--g)' : state === 'SHORT' ? 'var(--r)' : 'var(--muted)'
          }}>
            {state === 'NO_TRADE' ? 'FLAT' : state}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span style={{ color: 'var(--muted)' }}>entry</span>
          <span>{entry ? `$${entry.toFixed(2)}` : '—'}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span style={{ color: 'var(--muted)' }}>invalidation (structure)</span>
          <span style={{ color: 'var(--a)' }}>{inv ? `$${inv.toFixed(2)}` : '—'}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span style={{ color: 'var(--muted)' }}>stop loss</span>
          <span style={{ color: 'var(--r)' }}>{stop ? `$${stop.toFixed(2)}` : '—'}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span style={{ color: 'var(--muted)' }}>distance to stop</span>
          <span>{distBps ? `${distBps.toFixed(1)} bps` : '—'}</span>
        </div>

        {/* Distance Progress Bar */}
        <div style={{ height: '6px', background: 'var(--card-sub)', borderRadius: '3px', overflow: 'hidden', position: 'relative' }}>
          <div style={{
            height: '100%',
            width: `${distPct}%`,
            background: distPct > 40 ? 'var(--g)' : distPct > 15 ? 'var(--a)' : 'var(--r)',
            transition: 'width 0.2s linear'
          }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginTop: '4px' }}>
          <span style={{ color: 'var(--muted)' }}>open pnl</span>
          <span style={{ color: 'var(--g)' }}>{state !== 'NO_TRADE' ? '+0.0 bps' : '—'}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <span style={{ color: 'var(--muted)' }}>max adverse excursion</span>
          <span>0.0 bps</span>
        </div>

        <div style={{
          padding: '6px',
          background: isStale ? 'var(--r-dim)' : 'var(--card-sub)',
          border: `1px solid ${isStale ? 'var(--r)' : 'var(--border)'}`,
          borderRadius: '3px',
          fontSize: '11px',
          textAlign: 'center',
          marginTop: '4px'
        }}>
          {isStale ? '⚠ INTERLOCK FROZEN — DATA STALE' : state !== 'NO_TRADE' ? `● MONITORING ${state}` : '● IDLE — NO OPEN RISK'}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
          <span>new entries: <b style={{ color: isStale ? 'var(--r)' : 'var(--g)' }}>{isStale ? 'FROZEN' : 'ENABLED'}</b></span>
          <span>{isStale ? 'depth age > limit' : 'feed nominal'}</span>
        </div>
      </div>
    </div>
  );
};
