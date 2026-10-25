import React, { useState } from 'react';

interface CadenceProps {
  evRate: number;
  fps: number;
  flowFill: number;
  structureProgress: number;
  isStale: boolean;
  smoothing: boolean;
  setSmoothing: (val: boolean) => void;
  use4h: boolean;
  setUse4h: (val: boolean) => void;
  countertrend: boolean;
  setCountertrend: (val: boolean) => void;
  persistSec: number;
  setPersistSec: (val: number) => void;
  showTape: boolean;
  setShowTape: (val: boolean) => void;
  initialCollapsed?: boolean;
}

export const CadencePanel: React.FC<CadenceProps> = ({
  evRate,
  fps,
  flowFill,
  structureProgress,
  isStale,
  smoothing,
  setSmoothing,
  use4h,
  setUse4h,
  countertrend,
  setCountertrend,
  persistSec,
  setPersistSec,
  showTape,
  setShowTape,
  initialCollapsed = false
}) => {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  return (
    <div className="panel" style={{ padding: '4px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, color: 'var(--text)' }}>CADENCE &amp; ENGINE:</span>
          <span>L0 Ingest: <b style={{ color: isStale ? 'var(--r)' : 'var(--c)' }}>{evRate} ev/s</b></span>
          <span>L1 Render: <b style={{ color: 'var(--g)' }}>{fps.toFixed(0)} fps</b></span>
          <span>L2 Flow: <b style={{ color: 'var(--c)' }}>{(flowFill * 100).toFixed(0)}%</b></span>
          <span>L3 Struct: <b style={{ color: 'var(--p)' }}>{(structureProgress * 100).toFixed(0)}%</b></span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '10px' }}>
            <input type="checkbox" checked={smoothing} onChange={(e) => setSmoothing(e.target.checked)} />
            <span>smooth</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '10px' }}>
            <input type="checkbox" checked={use4h} onChange={(e) => setUse4h(e.target.checked)} />
            <span>4h filter</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '10px' }}>
            <input type="checkbox" checked={countertrend} onChange={(e) => setCountertrend(e.target.checked)} />
            <span>countertrend</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '10px' }}>
            <input type="checkbox" checked={showTape} onChange={(e) => setShowTape(e.target.checked)} />
            <span style={{ color: showTape ? 'var(--c)' : 'var(--muted)' }}>tape</span>
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px' }}>
            <span style={{ color: 'var(--muted)' }}>pers:</span>
            <input
              type="number"
              min={3}
              max={20}
              value={persistSec}
              onChange={(e) => setPersistSec(Math.max(3, parseInt(e.target.value) || 3))}
              style={{ width: '34px', background: 'var(--card-sub)', border: '1px solid var(--border)', color: 'var(--text)', textAlign: 'center', borderRadius: '2px', fontSize: '10px' }}
            />
            <span style={{ color: 'var(--muted)' }}>s</span>
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--muted)',
              fontSize: '10px',
              padding: '1px 6px',
              borderRadius: '2px',
              cursor: 'pointer'
            }}
          >
            {collapsed ? '▼ Details' : '▲ Collapse'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', marginTop: '8px', paddingTop: '6px', borderTop: '1px solid var(--border-sub)' }}>
          <CadenceCard name="INGEST · L0" status={isStale ? "● STALE" : "● OK"} desc="depth 100ms · trade · kline" metric={`${evRate} ev/s`} meterPct={isStale ? 20 : 100} meterColor={isStale ? "var(--r)" : "var(--c)"} />
          <CadenceCard name="RENDER · L1" status={`● ${fps.toFixed(0)} fps`} desc="60fps LERP · smooth bars" metric={`${fps.toFixed(1)} fps`} meterPct={Math.min(100, (fps / 60) * 100)} meterColor="var(--g)" />
          <CadenceCard name="FLOW · L2" status={flowFill >= 0.95 ? "● READY" : "● FILL"} desc="rolling 5s/30s/2m/5m + OFI" metric={`${(flowFill * 100).toFixed(0)}% of 5m`} meterPct={flowFill * 100} meterColor="var(--c)" />
          <CadenceCard name="STRUCTURE · L3" status="● on close" desc="1m trigger · 5m setup · 1h context" metric={`${(structureProgress * 100).toFixed(0)}% of 1m`} meterPct={structureProgress * 100} meterColor="var(--p)" />
        </div>
      )}
    </div>
  );
};

const CadenceCard: React.FC<{
  name: string;
  status: string;
  desc: string;
  metric: string;
  meterPct: number;
  meterColor: string;
}> = ({ name, status, desc, metric, meterPct, meterColor }) => (
  <div style={{ background: 'var(--card-sub)', border: '1px solid var(--border)', borderRadius: '3px', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontWeight: 600 }}>
      <span>{name}</span>
      <span style={{ color: status.includes('STALE') ? 'var(--r)' : 'var(--g)' }}>{status}</span>
    </div>
    <div style={{ fontSize: '9px', color: 'var(--muted)' }}>{desc}</div>
    <div style={{ fontSize: '10.5px', color: 'var(--text)', marginTop: '1px' }}>{metric}</div>
    <div style={{ height: '2px', background: 'var(--dim)', borderRadius: '1px', overflow: 'hidden', marginTop: '1px' }}>
      <div style={{ height: '100%', width: `${meterPct}%`, background: meterColor, transition: 'width 0.3s ease' }} />
    </div>
  </div>
);
