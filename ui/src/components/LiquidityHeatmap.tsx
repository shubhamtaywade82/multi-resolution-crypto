import React, { useRef, useEffect, useState, useCallback } from 'react';
import { BookState, Trade, Wall } from '../types.ts';
import {
  DepthHeatStore,
  HEAT_CONFIG,
  VIEW_SPAN,
  HeatBucketResult
} from '../utils/depthHeatStore.ts';
import {
  computeNormCeiling,
  computeTopTick,
  renderRasterHeatmap,
  renderVectorOverlay
} from '../utils/heatmapRenderer.ts';

interface HeatmapProps {
  book: BookState | null;
  recentTrades: Trade[];
}

export const LiquidityHeatmap: React.FC<HeatmapProps> = ({ book, recentTrades }) => {
  const heatCvRef = useRef<HTMLCanvasElement | null>(null);
  const ovlCvRef = useRef<HTMLCanvasElement | null>(null);
  const storeRef = useRef<DepthHeatStore>(new DepthHeatStore());
  const cacheRef = useRef<{ data: HeatBucketResult; t: number; span: number } | null>(null);

  const [view, setView] = useState<'5m' | '30m' | '2h'>('5m');
  const [zoom, setZoom] = useState<number>(1);
  const [note, setNote] = useState<string>('norm —');

  useEffect(() => {
    if (!book || book.mid === 0) return;
    const now = Date.now();
    storeRef.current.seedIfEmpty(book, now);
    storeRef.current.add(now, book, book.mid);
  }, [book]);

  const drawAll = useCallback(() => {
    const hCv = heatCvRef.current;
    const oCv = ovlCvRef.current;
    if (!hCv || !oCv || !book || book.mid === 0) return;

    const now = Date.now();
    const span = VIEW_SPAN[view];
    const colSpan = span / HEAT_CONFIG.cols;

    if (!cacheRef.current || now - cacheRef.current.t > 400 || cacheRef.current.span !== colSpan) {
      cacheRef.current = { data: storeRef.current.bucket(colSpan, now), t: now, span: colSpan };
    }

    const { cols, from, to, norm } = cacheRef.current.data;
    const ceil = computeNormCeiling(norm);
    const topT = computeTopTick(book.mid, storeRef.current, zoom);

    renderRasterHeatmap(hCv, cols, ceil, topT, zoom, storeRef.current.n);
    renderVectorOverlay(oCv, hCv, {
      cols,
      from,
      to,
      topT,
      tpr: zoom,
      store: storeRef.current,
      book,
      recentTrades
    });

    const dur = colSpan >= 1000 ? `${(colSpan / 1000).toFixed(1)}s` : `${colSpan.toFixed(0)}ms`;
    setNote(`norm p95 ${ceil.toFixed(0)} SOL · col ${dur} · span ${(span / 60000).toFixed(0)}m · ${storeRef.current.colsCount} snaps`);
  }, [book, recentTrades, view, zoom]);

  useEffect(() => {
    const anim = requestAnimationFrame(drawAll);
    return () => cancelAnimationFrame(anim);
  }, [drawAll]);

  return (
    <div className="panel">
      <div className="panel-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>LIQUIDITY PRESSURE FIELD</span>
          <span style={{ fontSize: '9px', color: 'var(--muted)', fontWeight: 400 }}>
            {view} · 150 cols · grid {HEAT_CONFIG.step} · zoom {zoom}x
          </span>
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['5m', '30m', '2h'] as const).map((v) => (
            <button
              key={v}
              onClick={() => { setView(v); cacheRef.current = null; }}
              style={btnStyle(view === v)}
            >
              {v}
            </button>
          ))}
          <button
            onClick={() => setZoom((z) => (z >= 4 ? 1 : z * 2))}
            style={btnStyle(zoom > 1)}
            title="Toggle tick compression zoom"
          >
            {zoom}x
          </button>
        </div>
      </div>

      <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="hm">
          <canvas ref={heatCvRef} className="heat-canvas" />
          <canvas ref={ovlCvRef} className="ovl-canvas" />
          <div className="hmnote">{note}</div>
          <div className="hmleg">
            <span><i className="sw" style={{ background: 'rgba(63,224,140,.9)' }} />bid depth</span>
            <span><i className="sw" style={{ background: 'rgba(255,93,120,.9)' }} />ask depth</span>
            <span><i className="sw" style={{ background: '#dff3ff' }} />persisted ≥ 6 obs</span>
            <span><i className="sw" style={{ background: 'var(--p)' }} />wall ≥ 15s</span>
            <span><i className="sw" style={{ background: 'var(--a)' }} />trade burst</span>
            <span><i className="sw" style={{ background: 'var(--c)' }} />book profile (right)</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <WallSummaryCard side="BID" walls={book?.walls?.bids ?? []} color="var(--g)" />
          <WallSummaryCard side="ASK" walls={book?.walls?.asks ?? []} color="var(--r)" />
        </div>
      </div>
    </div>
  );
};

const WallSummaryCard: React.FC<{ side: string; walls: Wall[]; color: string }> = ({
  side,
  walls,
  color
}) => (
  <div style={{ background: 'var(--card-sub)', padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--border)' }}>
    <div style={{ fontSize: '10px', color: 'var(--muted)', marginBottom: '3px' }}>
      {side}-SIDE PERSISTENT LEVELS
    </div>
    {walls.length === 0 ? (
      <div style={{ color: 'var(--muted)', fontSize: '10px' }}>none ≥ 110 SOL</div>
    ) : (
      walls.slice(0, 3).map((w, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
          <span style={{ color, fontWeight: 600 }}>${w.p.toFixed(2)}</span>
          <span style={{ color: 'var(--muted)' }}>
            peak {w.peak.toFixed(0)} · life {w.life.toFixed(0)}s · pers {(w.pers * 100).toFixed(0)}%
          </span>
        </div>
      ))
    )}
  </div>
);

function btnStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? '#0a3340' : 'transparent',
    border: `1px solid ${active ? 'var(--c)' : 'var(--border)'}`,
    color: active ? 'var(--c)' : 'var(--muted)',
    borderRadius: '2px',
    padding: '2px 8px',
    fontSize: '10px',
    cursor: 'pointer',
    fontWeight: active ? 700 : 400
  };
}
