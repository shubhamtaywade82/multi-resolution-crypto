import React, { useRef, useEffect, useState } from 'react';
import { BookState, Trade } from '../types.ts';

interface HeatmapProps {
  book: BookState | null;
  recentTrades: Trade[];
}

export const LiquidityHeatmap: React.FC<HeatmapProps> = ({ book, recentTrades }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [view, setView] = useState<'5m' | '30m' | '2h'>('5m');
  const historyRef = useRef<Array<{ t: number; mid: number; bids: any[]; asks: any[] }>>([]);

  useEffect(() => {
    if (!book || book.mid === 0) return;
    historyRef.current.push({
      t: Date.now(),
      mid: book.mid,
      bids: book.bids.slice(0, 20),
      asks: book.asks.slice(0, 20)
    });
    if (historyRef.current.length > 300) historyRef.current.shift();
  }, [book]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Dark grid background
    ctx.fillStyle = '#080c12';
    ctx.fillRect(0, 0, width, height);

    if (!historyRef.current.length || !book) return;

    const mid = book.mid;
    const range = 0.8;
    const minP = mid - range;
    const maxP = mid + range;

    const toY = (p: number) => height - ((p - minP) / (maxP - minP)) * height;

    // Draw historical mid trajectory line
    ctx.strokeStyle = 'rgba(88, 166, 255, 0.85)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    historyRef.current.forEach((pt, i) => {
      const x = (i / Math.max(1, historyRef.current.length - 1)) * (width - 70);
      const y = toY(pt.mid);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw persistent wall lines
    drawPersistentWalls(ctx, book, toY, width);

    // Draw right-edge live book profile silhouette
    drawBookProfile(ctx, book, toY, width, height);

    // Draw price axis
    drawPriceAxis(ctx, mid, range, toY, width);
  }, [book, recentTrades, view]);

  return (
    <div className="panel">
      <div className="panel-head">
        <span>LIQUIDITY PRESSURE FIELD</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['5m', '30m', '2h'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                background: view === v ? 'var(--card-sub)' : 'transparent',
                border: `1px solid ${view === v ? 'var(--c)' : 'var(--border)'}`,
                color: view === v ? 'var(--text)' : 'var(--muted)',
                borderRadius: '2px',
                padding: '2px 8px',
                fontSize: '10px',
                cursor: 'pointer'
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="panel-body" style={{ padding: '8px', gap: '8px' }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={200}
          style={{ width: '100%', height: '200px', borderRadius: '4px', display: 'block' }}
        />

        {/* Persistent Wall Summary Tables */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          fontSize: '11px',
          marginTop: '4px'
        }}>
          <WallList side="BID" walls={book?.walls?.bids ?? []} color="var(--g)" />
          <WallList side="ASK" walls={book?.walls?.asks ?? []} color="var(--r)" />
        </div>
      </div>
    </div>
  );
};

function drawPersistentWalls(
  ctx: CanvasRenderingContext2D,
  book: BookState,
  toY: (p: number) => number,
  width: number
): void {
  const allWalls = [...(book.walls?.bids ?? []), ...(book.walls?.asks ?? [])];
  for (const w of allWalls) {
    if (w.life < 15) continue;
    const y = toY(w.p);
    ctx.strokeStyle = w.side === 'bid' ? 'rgba(63, 185, 80, 0.45)' : 'rgba(248, 81, 73, 0.45)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width - 70, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawBookProfile(
  ctx: CanvasRenderingContext2D,
  book: BookState,
  toY: (p: number) => number,
  width: number,
  height: number
): void {
  const profileW = 60;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.moveTo(width - profileW, 0);
  ctx.lineTo(width - profileW, height);
  ctx.stroke();

  const maxQ = Math.max(1, ...book.bids.slice(0, 15).map(b => b.q), ...book.asks.slice(0, 15).map(a => a.q));

  for (const b of book.bids.slice(0, 15)) {
    const y = toY(b.p);
    const barW = (b.q / maxQ) * (profileW - 10);
    ctx.fillStyle = 'rgba(63, 185, 80, 0.35)';
    ctx.fillRect(width - profileW, y - 2, barW, 4);
  }

  for (const a of book.asks.slice(0, 15)) {
    const y = toY(a.p);
    const barW = (a.q / maxQ) * (profileW - 10);
    ctx.fillStyle = 'rgba(248, 81, 73, 0.35)';
    ctx.fillRect(width - profileW, y - 2, barW, 4);
  }
}

function drawPriceAxis(
  ctx: CanvasRenderingContext2D,
  mid: number,
  range: number,
  toY: (p: number) => number,
  width: number
): void {
  ctx.fillStyle = 'rgba(139, 148, 158, 0.9)';
  ctx.font = '10px JetBrains Mono';
  ctx.textAlign = 'right';

  for (let step = -range; step <= range; step += range / 3) {
    const p = mid + step;
    const y = toY(p);
    ctx.fillText(`$${p.toFixed(2)}`, width - 5, y + 3);
  }
}

const WallList: React.FC<{ side: string; walls: any[]; color: string }> = ({ side, walls, color }) => (
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
