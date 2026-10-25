import React from 'react';
import { BookState } from '../types.ts';
import { useLerp } from '../hooks/useLerp.ts';

export type LayoutMode = 'studio' | 'tabs' | 'stream';

interface TopBarProps {
  isConnected: boolean;
  isSynced: boolean;
  serverTime: number;
  book: BookState | null;
  latencyMs: number;
  layoutMode: LayoutMode;
  setLayoutMode: (mode: LayoutMode) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  isConnected,
  isSynced,
  serverTime,
  book,
  latencyMs,
  layoutMode,
  setLayoutMode
}) => {
  const mid = book?.mid ?? 0;
  const smoothMid = useLerp(mid, 0.25, 2);
  const spread = book ? book.ba - book.bb : 0;
  const spreadBps = mid > 0 ? (spread / mid) * 10000 : 0;
  const isStale = book ? Date.now() - book.ts > 2000 : true;
  const dateStr = new Date(serverTime).toISOString().slice(11, 19);

  return (
    <header className="panel" style={{ padding: '6px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div>
            <div style={{ fontSize: '9px', color: 'var(--muted)', textTransform: 'uppercase' }}>COCKPIT</div>
            <div style={{ fontSize: '13px', fontWeight: 'bold' }}>
              SOLUSDT <span style={{ color: 'var(--c)' }}>▸ MULTI-RESOLUTION</span>
            </div>
          </div>

          <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: '8px' }}>
            <div style={{ fontSize: '9px', color: 'var(--muted)', textTransform: 'uppercase' }}>PROVENANCE</div>
            <div style={{ fontSize: '10.5px', color: 'var(--g)', fontWeight: 600 }}>● REAL MAINNET</div>
          </div>

          <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: '8px' }}>
            <div style={{ fontSize: '9px', color: 'var(--muted)', textTransform: 'uppercase' }}>FEED</div>
            <div style={{ fontSize: '10.5px', color: isConnected ? 'var(--g)' : 'var(--r)', fontWeight: 600 }}>
              ◈ {isConnected ? 'BINANCE WS' : 'DISCONNECTED'}
            </div>
          </div>
        </div>

        {/* Center telemetry */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px' }}>
          <div>
            <div style={{ fontSize: '9px', color: 'var(--muted)' }}>MID</div>
            <div style={{ fontSize: '13px', fontWeight: 'bold' }}>${smoothMid.toFixed(2)}</div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: 'var(--muted)' }}>SPREAD</div>
            <div style={{ color: 'var(--c)', fontWeight: 600 }}>${spread.toFixed(2)} ({spreadBps.toFixed(1)} bps)</div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: 'var(--muted)' }}>SEQ / LATENCY</div>
            <div>#{book?.seq ?? 0} · <span style={{ color: latencyMs < 50 ? 'var(--g)' : 'var(--a)' }}>{latencyMs}ms</span></div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: 'var(--muted)' }}>INTEGRITY</div>
            <div style={{ color: !isSynced || isStale ? 'var(--r)' : 'var(--g)', fontWeight: 600 }}>
              {!isSynced ? '○ RESYNC' : isStale ? '✕ STALE' : '● VALID'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '9px', color: 'var(--muted)' }}>UTC</div>
            <div>{dateStr}</div>
          </div>
        </div>

        {/* Right Layout Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'var(--card-sub)', padding: '2px', borderRadius: '4px', border: '1px solid var(--border)' }}>
          <button onClick={() => setLayoutMode('studio')} style={modeBtn(layoutMode === 'studio')} title="Studio Mode: Compact 3-column, zero-scroll command center">
            🎛️ STUDIO
          </button>
          <button onClick={() => setLayoutMode('tabs')} style={modeBtn(layoutMode === 'tabs')} title="Tabbed Focus: Deep-dive tabs without scrolling">
            📑 TABS
          </button>
          <button onClick={() => setLayoutMode('stream')} style={modeBtn(layoutMode === 'stream')} title="Stream Mode: Classic full-page vertical scroll">
            📜 STREAM
          </button>
        </div>
      </div>
    </header>
  );
};

function modeBtn(active: boolean): React.CSSProperties {
  return {
    background: active ? 'var(--c)' : 'transparent',
    color: active ? '#000' : 'var(--muted)',
    border: 0,
    fontWeight: active ? 700 : 500,
    fontSize: '10px',
    padding: '3px 8px',
    borderRadius: '3px',
    cursor: 'pointer'
  };
}
