import React from 'react';

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
  setPersistSec
}) => {
  return (
    <div className="panel">
      <div className="panel-head">
        <span>CADENCE & RESOLUTION</span>
        <span style={{ fontSize: '10px', color: 'var(--muted)' }}>
          INGEST SOURCE RATE · RENDER THROTTLED · DECIDE AT 1s
        </span>
      </div>

      <div className="panel-body" style={{ gap: '10px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '8px'
        }}>
          <CadenceCard
            name="INGEST · L0"
            status={isStale ? "● STALE" : "● OK"}
            desc="depth 100ms · aggTrade · kline"
            metric={`${evRate} ev/s`}
            meterPct={isStale ? 20 : 100}
            meterColor={isStale ? "var(--r)" : "var(--c)"}
          />
          <CadenceCard
            name="RENDER · L1 MICRO"
            status={`● ${fps.toFixed(0)} fps`}
            desc="60fps LERP · smooth transitions"
            metric={`${fps.toFixed(1)} fps`}
            meterPct={Math.min(100, (fps / 60) * 100)}
            meterColor="var(--g)"
          />
          <CadenceCard
            name="SUMMARIZE · L2 FLOW"
            status={flowFill >= 0.95 ? "● COMPLETE" : "● FILLING"}
            desc="rolling 5s/30s/2m/5m + OFI"
            metric={`${(flowFill * 100).toFixed(0)}% of 5m`}
            meterPct={flowFill * 100}
            meterColor="var(--c)"
          />
          <CadenceCard
            name="STRUCTURE · L3/L4"
            status="● on close"
            desc="1m trigger · 5m setup · 1h context"
            metric={`${(structureProgress * 100).toFixed(0)}% of 1m`}
            meterPct={structureProgress * 100}
            meterColor="var(--p)"
          />
        </div>

        {/* Interactive Controls Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          paddingTop: '6px',
          borderTop: '1px solid var(--border-sub)',
          fontSize: '11px'
        }}>
          <span style={{ color: 'var(--muted)', fontWeight: 600 }}>CONTROLS:</span>

          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={smoothing}
              onChange={(e) => setSmoothing(e.target.checked)}
            />
            <span>ladder smoothing (α .35)</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={use4h}
              onChange={(e) => setUse4h(e.target.checked)}
            />
            <span>4h filter blocks intraday</span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={countertrend}
              onChange={(e) => setCountertrend(e.target.checked)}
            />
            <span>allow countertrend vs 1h</span>
          </label>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--muted)' }}>persistence:</span>
            <input
              type="number"
              min={3}
              max={20}
              value={persistSec}
              onChange={(e) => setPersistSec(Math.max(3, parseInt(e.target.value) || 3))}
              style={{
                width: '44px',
                background: 'var(--card-sub)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                borderRadius: '3px',
                padding: '2px 4px',
                textAlign: 'center'
              }}
            />
            <span style={{ color: 'var(--muted)' }}>s</span>
          </div>
        </div>
      </div>
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
  <div style={{
    background: 'var(--card-sub)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px'
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600 }}>
      <span>{name}</span>
      <span style={{ color: status.includes('STALE') || status.includes('FILLING') ? 'var(--a)' : 'var(--g)' }}>
        {status}
      </span>
    </div>
    <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{desc}</div>
    <div style={{ fontSize: '11px', color: 'var(--text)', marginTop: '2px' }}>{metric}</div>
    <div style={{ height: '3px', background: 'var(--dim)', borderRadius: '2px', overflow: 'hidden', marginTop: '2px' }}>
      <div style={{
        height: '100%',
        width: `${meterPct}%`,
        background: meterColor,
        transition: 'width 0.3s ease'
      }} />
    </div>
  </div>
);
