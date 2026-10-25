import React from 'react';
import { WindowMetric, AbsorptionEvent } from '../types.ts';

interface MatrixProps {
  matrix: WindowMetric[];
  absorption: AbsorptionEvent | null;
}

export const FlowMatrixTable: React.FC<MatrixProps> = ({ matrix, absorption }) => {
  const w5 = matrix.find(m => m.label === '5s');
  const w30 = matrix.find(m => m.label === '30s');
  const w2m = matrix.find(m => m.label === '2m');
  const w5m = matrix.find(m => m.label === '5m');

  const verdict = getVerdictText(w5, w30, w2m, w5m);

  return (
    <div className="panel">
      <div className="panel-head">
        <span>L2 · MULTI-RESOLUTION FLOW MATRIX</span>
        <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
          NOISE FILTER: SHORT VS MEDIUM VS LONG COMPUTED TOGETHER
        </span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>window</th>
              <th>src</th>
              <th>trades</th>
              <th>OFI norm</th>
              <th>CVD</th>
              <th>buy %</th>
              <th>displ bps</th>
              <th>RV bps</th>
              <th>efficiency</th>
              <th>fill</th>
              <th>read</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((m) => {
              const cvdColor = m.cvd > 0 ? 'var(--g)' : m.cvd < 0 ? 'var(--r)' : 'var(--muted)';
              const ofiColor = m.ofi > 0.12 ? 'var(--g)' : m.ofi < -0.12 ? 'var(--r)' : 'var(--muted)';
              const read = Math.abs(m.ofi) < 0.12 ? 'balanced' : m.ofi > 0.4 ? 'strong bid' : m.ofi > 0 ? 'bid lean' : m.ofi < -0.4 ? 'strong ask' : 'ask lean';

              return (
                <tr key={m.label} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ fontWeight: 600 }}>{m.label} <span style={{ color: 'var(--muted)', fontSize: '10px' }}>{m.role}</span></td>
                  <td style={{ color: 'var(--muted)', fontSize: '10px' }}>{m.src}</td>
                  <td>{m.n.toLocaleString()}</td>
                  <td style={{ color: ofiColor, fontWeight: 600 }}>
                    {m.ofi > 0.12 ? '▲ ' : m.ofi < -0.12 ? '▼ ' : '· '}
                    {m.ofi > 0 ? '+' : ''}{m.ofi.toFixed(2)}
                  </td>
                  <td style={{ color: cvdColor, fontWeight: 600 }}>
                    {m.cvd > 0 ? '+' : ''}{m.cvd.toFixed(0)}
                  </td>
                  <td>
                    <span style={{ color: m.buyPct > 50 ? 'var(--g)' : 'var(--r)' }}>
                      {m.buyPct.toFixed(0)}%
                    </span>
                  </td>
                  <td>{m.dispBps !== null ? `${m.dispBps > 0 ? '+' : ''}${m.dispBps.toFixed(1)}` : '—'}</td>
                  <td>{m.rv.toFixed(0)}</td>
                  <td style={{ color: (m.eff ?? 0) > 0.55 ? 'var(--c)' : (m.eff ?? 0) < 0.2 ? 'var(--a)' : 'var(--text)' }}>
                    {m.eff !== null ? m.eff.toFixed(2) : '—'}
                  </td>
                  <td>{(m.fill * 100).toFixed(0)}%</td>
                  <td style={{ color: 'var(--muted)', fontSize: '10px' }}>{read}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Noise Filter Interpretation Verdict */}
      <div style={{ padding: '8px 12px', background: 'var(--card-sub)', borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: '9px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '2px' }}>
          NOISE-FILTER INTERPRETATION
        </div>
        <div style={{ color: verdict.color, fontWeight: 'bold', fontSize: '11px', letterSpacing: '0.5px' }}>
          {verdict.short}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px', lineHeight: 1.4 }}>
          {verdict.long}
        </div>
      </div>

      {/* Absorption & Liquidity Persistence */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
        padding: '8px 12px',
        borderTop: '1px solid var(--border)',
        fontSize: '11px'
      }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '3px' }}>
            ABSORPTION · 15s EVENT WINDOW
          </div>
          {absorption ? (
            <div style={{ color: absorption.dir > 0 ? 'var(--g)' : 'var(--r)', fontWeight: 600 }}>
              ● CONFIRMED: {absorption.dir > 0 ? 'Sell flow absorbed' : 'Buy flow absorbed'} @ ${absorption.price.toFixed(2)} ({absorption.hits} hits)
            </div>
          ) : (
            <div style={{ color: 'var(--muted)', fontSize: '10px' }}>
              no confirmed absorption — flow and displacement are consistent
            </div>
          )}
        </div>

        <div>
          <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '3px' }}>
            LIQUIDITY PERSISTENCE
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '10px' }}>
            Persistent levels tracked via L2 snapshots with ≥110 SOL peak threshold
          </div>
        </div>
      </div>
    </div>
  );
};

function getVerdictText(w5?: WindowMetric, w30?: WindowMetric, w2m?: WindowMetric, w5m?: WindowMetric) {
  if (!w5 || !w30 || !w2m || !w5m) return { short: 'WARMING UP', long: 'Collecting multi-resolution flow samples...', color: 'var(--muted)' };

  const s = (v: number) => v > 0.12 ? 1 : v < -0.12 ? -1 : 0;
  const a = s(w5.ofi), b = s(w30.ofi), c = s(w2m.ofi), d = s(w5m.ofi);
  const eff = w5m.eff ?? 0;

  if (a !== 0 && a === b && b === c && c === d && Math.abs(w2m.ofi) > 0.25) {
    return {
      short: 'SUSTAINED DIRECTIONAL FLOW',
      long: `All four resolutions agree ${a > 0 ? 'bid-side' : 'ask-side'} (5s→5m). Flow is not a burst. Displacement efficiency ${eff.toFixed(2)}.`,
      color: a > 0 ? 'var(--g)' : 'var(--r)'
    };
  }
  if (a !== 0 && a !== b && a !== c && b === c && b !== 0) {
    return {
      short: `${a > 0 ? 'BUY' : 'SELL'} BURST vs LARGER ${b > 0 ? 'BUY' : 'SELL'} BACKDROP`,
      long: `5s OFI opposes 30s and 2m. Short burst against larger trend.`,
      color: 'var(--a)'
    };
  }
  if (a !== 0 && a === b && c !== 0 && c !== a) {
    return {
      short: 'EMERGING SHIFT · UNCONFIRMED',
      long: '5s and 30s turned while 2m is still opposed. Possible rotation; awaiting 2m confirmation.',
      color: 'var(--a)'
    };
  }
  if (a === 0 && b === 0 && c === 0) {
    return {
      short: 'BALANCED / CHURN',
      long: 'No resolution shows directional order flow (|OFI| ≤ 0.12). Two-sided churn, no microstructure edge.',
      color: 'var(--muted)'
    };
  }
  return {
    short: 'MIXED · NO CLEAN READ',
    long: 'Resolutions disagree across time horizons. Treat as noise until one window dominates.',
    color: 'var(--muted)'
  };
}
