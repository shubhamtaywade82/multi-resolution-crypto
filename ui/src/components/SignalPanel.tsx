import React from 'react';
import { SignalState, AbsorptionEvent } from '../types.ts';
import { useLerp } from '../hooks/useLerp.ts';

interface SignalPanelProps {
  signal: SignalState | null;
  absorption: AbsorptionEvent | null;
}

export const SignalPanel: React.FC<SignalPanelProps> = ({ signal, absorption }) => {
  const pts = signal?.pts ?? 0;
  const smoothPts = useLerp(pts, 0.2, 1);
  const state = signal?.state ?? 'NO_TRADE';

  const markerPct = Math.min(100, Math.max(0, ((smoothPts + 10) / 20) * 100));
  const stateColor = state === 'LONG' ? 'var(--g)' : state === 'SHORT' ? 'var(--r)' : 'var(--muted)';
  const stateBg = state === 'LONG' ? 'var(--g-dim)' : state === 'SHORT' ? 'var(--r-dim)' : 'var(--card-sub)';

  return (
    <div className="panel">
      <div className="panel-head">
        <span>SIGNAL STATE MACHINE</span>
        <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
          CONFLUENCE POINTS · NOT PROBABILITY
        </span>
      </div>

      <div className="panel-body" style={{ gap: '10px' }}>
        {/* Main State Card */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 14px',
          background: stateBg,
          borderRadius: '4px',
          border: `1px solid ${state === 'NO_TRADE' ? 'var(--border)' : stateColor}`
        }}>
          <div>
            <div style={{ fontSize: '9px', color: 'var(--muted)', textTransform: 'uppercase' }}>STATE</div>
            <div style={{ fontSize: '17px', fontWeight: 'bold', color: stateColor }}>{state}</div>
            <div style={{ fontSize: '10px', color: 'var(--muted)' }}>
              {state === 'NO_TRADE' ? 'insufficient confluence' : 'held above exit threshold (5 pts)'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '9px', color: 'var(--muted)', textTransform: 'uppercase' }}>CONFLUENCE</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
              {smoothPts > 0 ? '+' : ''}{smoothPts.toFixed(1)} <span style={{ fontSize: '11px', color: 'var(--muted)' }}>/ ±10</span>
            </div>
            <div style={{ fontSize: '9px', color: 'var(--muted)' }}>entry ≥ 6 · exit ≤ 2.5</div>
          </div>
        </div>

        {/* Confluence Gauge Bar with Thresholds */}
        <div style={{ position: 'relative', height: '16px', background: 'var(--card-sub)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: '0', width: '20%', top: 0, bottom: 0, background: 'rgba(248, 81, 73, 0.25)' }} />
          <div style={{ position: 'absolute', right: '0', width: '20%', top: 0, bottom: 0, background: 'rgba(63, 185, 80, 0.25)' }} />
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: 'var(--border-sub)' }} />
          <div style={{
            position: 'absolute',
            left: `${markerPct}%`,
            top: 0,
            bottom: 0,
            width: '4px',
            marginLeft: '-2px',
            background: smoothPts > 0 ? 'var(--g)' : smoothPts < 0 ? 'var(--r)' : 'var(--text)',
            borderRadius: '2px',
            boxShadow: '0 0 6px rgba(255,255,255,0.4)',
            transition: 'left 0.1s linear'
          }} />
        </div>

        {/* Absorption Banner */}
        {absorption && (
          <div style={{
            padding: '6px 10px',
            background: 'rgba(163, 113, 247, 0.15)',
            border: '1px solid var(--p)',
            borderRadius: '3px',
            fontSize: '11px',
            color: 'var(--p)'
          }}>
            ● ABSORPTION CONFIRMED: {absorption.dir > 0 ? 'Sell' : 'Buy'} flow absorbed @ ${absorption.price.toFixed(2)}
          </div>
        )}

        {/* Confluence Ledger Breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 600 }}>CONFLUENCE LEDGER</div>
          {signal?.ledger.map((l) => {
            const barW = Math.min(100, (Math.abs(l.pts) / l.max) * 100);
            return (
              <div key={l.n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', padding: '2px 0' }}>
                <div style={{ flex: 1, paddingRight: '6px' }}>
                  <div style={{ color: 'var(--text)' }}>{l.n}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '9px' }}>{l.note}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '90px', justifyContent: 'flex-end' }}>
                  <span style={{ color: l.pts > 0 ? 'var(--g)' : l.pts < 0 ? 'var(--r)' : 'var(--muted)', fontWeight: 600 }}>
                    {l.pts > 0 ? '+' : ''}{l.pts.toFixed(1)}
                  </span>
                  <div style={{ width: '40px', height: '5px', background: 'var(--card-sub)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${barW}%`, background: l.pts >= 0 ? 'var(--g)' : 'var(--r)' }} />
                  </div>
                  <span style={{ color: 'var(--muted)', fontSize: '9px' }}>/{l.max}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Confirmation Gates */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
          <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 600 }}>CONFIRMATION GATES</div>
          {signal?.gates.map((g) => (
            <div key={g.n} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
              <span style={{ color: g.ok ? 'var(--text)' : 'var(--muted)' }}>
                {g.ok ? '✓' : '✕'} {g.n}
              </span>
              <span style={{ color: g.ok ? 'var(--g)' : 'var(--r)', fontSize: '10px' }}>
                {g.note}
              </span>
            </div>
          ))}
        </div>

        {/* Narrative Evidence */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
          <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 600 }}>EVIDENCE</div>
          {signal?.reasons?.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px' }}>
              <span style={{ color: r.c === 'g' ? 'var(--g)' : r.c === 'r' ? 'var(--r)' : 'var(--muted)' }}>●</span>
              <span style={{ flex: 1, color: 'var(--text)' }}>{r.t}</span>
              <span style={{ color: 'var(--muted)', fontSize: '9px' }}>{r.s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
