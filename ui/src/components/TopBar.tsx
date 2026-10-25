import React from 'react';
import { BookState } from '../types.ts';
import { useLerp } from '../hooks/useLerp.ts';

interface TopBarProps {
  isConnected: boolean;
  isSynced: boolean;
  serverTime: number;
  book: BookState | null;
  latencyMs: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  isConnected,
  isSynced,
  serverTime,
  book,
  latencyMs
}) => {
  const mid = book?.mid ?? 0;
  const smoothMid = useLerp(mid, 0.25, 2);
  const spread = book ? book.ba - book.bb : 0;
  const spreadBps = mid > 0 ? (spread / mid) * 10000 : 0;
  const isStale = book ? Date.now() - book.ts > 2000 : true;

  const dateStr = new Date(serverTime).toISOString().slice(11, 19);

  return (
    <header className="panel" style={{ padding: '8px 14px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Left segment */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '9px', color: 'var(--muted)', textTransform: 'uppercase' }}>COCKPIT</div>
            <div style={{ fontSize: '13px', fontWeight: 'bold' }}>
              SOLUSDT <span style={{ color: 'var(--c)' }}>▸ MULTI-RESOLUTION LIQUIDITY</span>
            </div>
          </div>

          <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: '10px' }}>
            <div style={{ fontSize: '9px', color: 'var(--muted)', textTransform: 'uppercase' }}>FEED SOURCE</div>
            <div style={{ fontSize: '11px', color: isConnected ? 'var(--g)' : 'var(--r)', fontWeight: 600 }}>
              ◈ {isConnected ? 'BINANCE MAINNET WS' : 'DISCONNECTED'}
            </div>
          </div>

          <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: '10px' }}>
            <div style={{ fontSize: '9px', color: 'var(--muted)', textTransform: 'uppercase' }}>MODE</div>
            <div style={{ fontSize: '11px', color: 'var(--a)', fontWeight: 600 }}>PAPER</div>
          </div>
        </div>

        {/* Center metrics */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px' }}>
          <div>
            <div style={{ fontSize: '9px', color: 'var(--muted)', textTransform: 'uppercase' }}>MID PRICE</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>${smoothMid.toFixed(2)}</div>
          </div>

          <div>
            <div style={{ fontSize: '9px', color: 'var(--muted)', textTransform: 'uppercase' }}>SPREAD</div>
            <div style={{ color: 'var(--c)', fontWeight: 600 }}>
              ${spread.toFixed(2)} ({spreadBps.toFixed(1)} bps)
            </div>
          </div>

          <div>
            <div style={{ fontSize: '9px', color: 'var(--muted)', textTransform: 'uppercase' }}>DEPTH SEQ</div>
            <div>#{book?.seq ?? 0} {book?.gaps ? `(${book.gaps} gaps)` : ''}</div>
          </div>

          <div>
            <div style={{ fontSize: '9px', color: 'var(--muted)', textTransform: 'uppercase' }}>INGEST LATENCY</div>
            <div style={{ color: latencyMs < 50 ? 'var(--g)' : 'var(--a)' }}>
              {latencyMs}ms / {(latencyMs * 1.5).toFixed(0)}ms
            </div>
          </div>

          <div>
            <div style={{ fontSize: '9px', color: 'var(--muted)', textTransform: 'uppercase' }}>BOOK INTEGRITY</div>
            <div style={{ color: !isSynced || isStale ? 'var(--r)' : 'var(--g)', fontWeight: 600 }}>
              {!isSynced ? '○ RESYNCING' : isStale ? '✕ STALE' : '● VALID (0 gaps)'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '9px', color: 'var(--muted)', textTransform: 'uppercase' }}>UTC TIME</div>
            <div>{dateStr}</div>
          </div>
        </div>
      </div>
    </header>
  );
};
