import React, { useState } from 'react';

export interface LogEvent {
  t: number;
  k: 'signal' | 'risk' | 'breach' | 'absorb' | 'wall' | 'regime' | 'struct' | 'sys';
  msg: string;
  tag: string;
}

interface EventLogProps {
  events: LogEvent[];
}

const ICONS: Record<string, string> = {
  signal: '▸',
  risk: '◈',
  breach: '⚠',
  absorb: '◉',
  wall: '▚',
  regime: '≋',
  struct: '◆'
};

const COLORS: Record<string, string> = {
  signal: 'var(--g)',
  risk: 'var(--a)',
  breach: 'var(--r)',
  absorb: 'var(--p)',
  wall: 'var(--p)',
  regime: 'var(--c)',
  struct: 'var(--c)'
};

export const EventLog: React.FC<EventLogProps> = ({ events }) => {
  const [filter, setFilter] = useState<string>('ALL');

  const filtered = filter === 'ALL' ? events : events.filter(e => e.k.toUpperCase() === filter);

  return (
    <div className="panel">
      <div className="panel-head">
        <span>CONFIRMED EVENT LOG</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '10px', color: 'var(--muted)' }}>{events.length} EVENTS</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {['ALL', 'SIGNAL', 'WALL', 'STRUCT'].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                style={{
                  background: filter === cat ? 'var(--card-sub)' : 'transparent',
                  border: `1px solid ${filter === cat ? 'var(--c)' : 'var(--border)'}`,
                  color: filter === cat ? 'var(--text)' : 'var(--muted)',
                  borderRadius: '2px',
                  padding: '1px 6px',
                  fontSize: '9px',
                  cursor: 'pointer'
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="panel-body" style={{ padding: '6px', maxHeight: '180px', overflowY: 'auto', gap: '3px' }}>
        {filtered.length === 0 ? (
          <div style={{ color: 'var(--muted)', padding: '12px', textAlign: 'center', fontSize: '11px' }}>
            No events recorded yet
          </div>
        ) : (
          filtered.slice(0, 40).map((e, idx) => (
            <div
              key={`${e.t}-${idx}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '2px 4px',
                fontSize: '11px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.02)'
              }}
            >
              <span style={{ color: 'var(--muted)', fontSize: '10px', width: '56px' }}>
                {new Date(e.t).toISOString().slice(14, 19)}
              </span>
              <span style={{ color: COLORS[e.k] || 'var(--muted)', fontWeight: 'bold', width: '12px', textAlign: 'center' }}>
                {ICONS[e.k] || '·'}
              </span>
              <span style={{ flex: 1, color: 'var(--text)' }}>
                {e.msg}
              </span>
              <span style={{ color: 'var(--muted)', fontSize: '9px' }}>
                {e.tag}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
