import React from 'react';
import { Trade } from '../types.ts';

interface TapeProps {
  trades: Trade[];
}

export const TradeTape: React.FC<TapeProps> = ({ trades }) => {
  let runningCvd = 0;
  const processed = trades.slice(0, 30).map((t) => {
    runningCvd += t.signedQuantity;
    return { ...t, runningCvd };
  });

  return (
    <div className="panel" style={{ height: '100%' }}>
      <div className="panel-head">
        <span>TRADE TAPE</span>
        <span style={{ fontSize: '10px', color: 'var(--muted)' }}>RAW RING · LIVE FLOW</span>
      </div>
      <div className="panel-body" style={{ padding: '4px', overflowY: 'auto', maxHeight: '420px', gap: '2px' }}>
        {processed.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--muted)' }}>
            Waiting for trades...
          </div>
        ) : (
          processed.map((t, idx) => (
            <div
              key={`${t.timestamp}-${idx}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '50px 14px 54px 50px 1fr',
                gap: '4px',
                alignItems: 'center',
                padding: '2px 4px',
                fontSize: '10.5px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.03)'
              }}
            >
              <span style={{ color: 'var(--muted)', fontSize: '10px' }}>
                {new Date(t.timestamp).toISOString().slice(14, 19)}
              </span>
              <span style={{ color: t.aggressorSide === 'BUY' ? 'var(--g)' : 'var(--r)', textAlign: 'center', fontWeight: 'bold' }}>
                {t.aggressorSide === 'BUY' ? '▲' : '▼'}
              </span>
              <span style={{
                color: t.aggressorSide === 'BUY' ? 'var(--g)' : 'var(--r)',
                fontWeight: 600,
                textAlign: 'right'
              }}>
                ${t.price.toFixed(2)}
              </span>
              <span style={{ textAlign: 'right', color: 'var(--text)' }}>
                {t.quantity.toFixed(1)}
              </span>
              <span style={{
                textAlign: 'right',
                color: t.runningCvd > 0 ? 'var(--g)' : t.runningCvd < 0 ? 'var(--r)' : 'var(--muted)',
                fontSize: '10px'
              }}>
                {t.runningCvd > 0 ? '+' : ''}{t.runningCvd.toFixed(1)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
