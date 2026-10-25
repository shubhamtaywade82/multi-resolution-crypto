import React from 'react';
import { StructureAnalysis, Candle } from '../types.ts';

interface StructureProps {
  structure: Record<string, StructureAnalysis>;
  candles?: Record<string, Candle[]>;
}

const ROLES: Record<string, [string, string]> = {
  m1: ['1m', 'ENTRY TRIGGER · forming preview + closed'],
  m3: ['3m', 'LOCAL SETUP'],
  m5: ['5m', 'LOCAL SETUP / SWEEPS'],
  m15: ['15m', 'CONFIRMATION'],
  h1: ['1h', 'CONTEXT · closed candle only'],
  h4: ['4h', 'OPTIONAL SWING FILTER']
};

const ORDER = ['m1', 'm3', 'm5', 'm15', 'h1', 'h4'];

export const StructureGrid: React.FC<StructureProps> = ({ structure, candles }) => {
  return (
    <div className="panel">
      <div className="panel-head">
        <span>L3/L4 · PRICE STRUCTURE</span>
        <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
          CLOSED CANDLES ONLY FOR CONFIRMATION
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '8px',
        padding: '10px'
      }}>
        {ORDER.map((k) => (
          <StructureCard
            key={k}
            roleInfo={ROLES[k]}
            data={structure[k]}
            candleList={candles?.[k] ?? []}
          />
        ))}
      </div>
    </div>
  );
};

const StructureCard: React.FC<{
  roleInfo: [string, string];
  data?: StructureAnalysis;
  candleList: Candle[];
}> = ({ roleInfo, data, candleList }) => {
  const [tf, role] = roleInfo;

  if (!data || !data.ok) {
    return (
      <div style={{ background: 'var(--card-sub)', padding: '10px', borderRadius: '4px', border: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{tf} <span style={{ color: 'var(--muted)', fontSize: '10px' }}>{role}</span></div>
        <div style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '4px' }}>SEEDING CANDLES...</div>
      </div>
    );
  }

  const cl = data.lastC;
  const f = data.cur;
  const isBull = data.bias > 0;
  const isBear = data.bias < 0;
  const trendColor = isBull ? 'var(--g)' : isBear ? 'var(--r)' : 'var(--muted)';

  return (
    <div style={{
      background: 'var(--card-sub)',
      padding: '10px',
      borderRadius: '4px',
      border: `1px solid ${isBull ? '#1a402a' : isBear ? '#401a1a' : 'var(--border)'}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      fontSize: '11px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 'bold' }}>
          {tf} <span style={{ color: 'var(--muted)', fontSize: '10px', fontWeight: 'normal' }}>{role}</span>
        </span>
        <span style={{
          fontSize: '10px',
          padding: '2px 6px',
          borderRadius: '3px',
          fontWeight: 600,
          background: isBull ? 'var(--g-dim)' : isBear ? 'var(--r-dim)' : 'var(--dim)',
          color: trendColor
        }}>
          {data.trend}
        </span>
      </div>

      {cl && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--muted)' }}>last CLOSED</span>
          <span style={{ color: cl.c >= cl.o ? 'var(--g)' : 'var(--r)', fontWeight: 600 }}>
            ${cl.o.toFixed(2)} → ${cl.c.toFixed(2)} (H ${cl.h.toFixed(2)} / L ${cl.l.toFixed(2)})
          </span>
        </div>
      )}

      {f && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--muted)' }}>forming</span>
          <span>${f.o.toFixed(2)} → ${f.c.toFixed(2)} ({(data.progress * 100).toFixed(0)}%)</span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--muted)' }}>swing pattern</span>
        <span>{data.pattern}</span>
      </div>

      {data.bos && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--muted)' }}>break of structure</span>
          <span style={{ color: data.bos.dir > 0 ? 'var(--g)' : 'var(--r)', fontWeight: 600 }}>
            BOS {data.bos.dir > 0 ? '↑' : '↓'} ${data.bos.at.toFixed(2)}
          </span>
        </div>
      )}

      {cl && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--muted)' }}>close vs 10-SMA</span>
          <span style={{ color: cl.c > data.sma ? 'var(--g)' : 'var(--r)' }}>
            ${cl.c.toFixed(2)} vs ${data.sma.toFixed(2)} ({cl.c > data.sma ? 'ABOVE' : 'BELOW'})
          </span>
        </div>
      )}

      {data.zones.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
          <span style={{ color: 'var(--muted)' }}>unswept liquidity</span>
          <span style={{ color: 'var(--c)' }}>
            {data.zones.map(z => `${z.type} $${z.p.toFixed(2)}`).join(' · ')}
          </span>
        </div>
      )}

      {/* Sparkline candle bars */}
      <CandleSparkline candles={candleList} />

      {/* Forming progress bar */}
      <div style={{ height: '3px', background: 'var(--dim)', borderRadius: '2px', overflow: 'hidden', marginTop: '2px' }}>
        <div style={{
          height: '100%',
          width: `${(data.progress * 100).toFixed(0)}%`,
          background: 'var(--p)',
          transition: 'width 0.3s ease'
        }} />
      </div>
    </div>
  );
};

const CandleSparkline: React.FC<{ candles: Candle[] }> = ({ candles }) => {
  if (!candles.length) return null;
  const list = candles.slice(-24);
  const hi = Math.max(...list.map(c => c.h));
  const lo = Math.min(...list.map(c => c.l));
  const rg = hi - lo || 1;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1px', height: '20px', marginTop: '4px' }}>
      {list.map((c, i) => {
        const up = c.c >= c.o;
        const hgt = Math.max(2, ((c.h - c.l) / rg) * 20);
        return (
          <i
            key={i}
            style={{
              flex: 1,
              minWidth: '2px',
              height: `${hgt}px`,
              background: up ? 'rgba(63, 185, 80, 0.65)' : 'rgba(248, 81, 73, 0.65)',
              borderRadius: '1px',
              display: 'block'
            }}
          />
        );
      })}
    </div>
  );
};
