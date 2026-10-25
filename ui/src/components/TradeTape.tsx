import React from 'react';
import { Trade } from '../types.ts';

interface TapeProps {
  trades: Trade[];
}

export const TradeTape: React.FC<TapeProps> = ({ trades }) => {
  return (
    <div className="panel" style={{ height: '100%' }}>
      <div className="panel-head">
        <span>TRADE TAPE</span>
        <span style={{ fontSize: '10px', color: 'var(--muted)' }}>AGGREGATED FLOW</span>
      </div>
      <div className="panel-body" style={{ padding: '4px', overflowY: 'auto', maxHeight: '420px', gap: '2px' }}>
        {trades.length === 0 ? (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--muted)' }}>
            Waiting for trades...
          </div>
        ) : (
          trades.slice(0, 30).map((t, idx) => (
            <div
              key={`${t.timestamp}-${idx}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '60px 1fr 1fr',
                padding: '3px 6px',
                fontSize: '11px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.03)'
              }}
            >
              <span style={{ color: 'var(--muted)', fontSize: '10px' }}>
                {new Date(t.timestamp).toISOString().slice(14, 19)}
              </span>
              <span style={{
                color: t.aggressorSide === 'BUY' ? 'var(--g)' : 'var(--r)',
                fontWeight: 600,
                textAlign: 'right'
              }}>
                ${t.price.toFixed(2)}
              </span>
              <span style={{ textAlign: 'right', color: 'var(--text)' }}>
                {t.quantity.toFixed(2)} SOL
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
