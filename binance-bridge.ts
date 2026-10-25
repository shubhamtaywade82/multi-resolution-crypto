#!/usr/bin/env npx tsx
import { WebSocketServer, WebSocket } from 'ws';
import { BinanceClient } from '@nemesis-oss/binance-sdk';

const SYMBOL = 'SOLUSDT';
const PORT = 8765;

interface Level {
  p: number;
  q: number;
}

interface SeedCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  tbv: number;
}

interface NormalizedBook {
  bids: Level[];
  asks: Level[];
  mid: number;
  bb: number;
  ba: number;
  seq: number;
  ts: number;
  gaps: number;
}

class BinanceBridge {
  private wss = new WebSocketServer({ port: PORT });
  private client = new BinanceClient();
  private clients = new Set<WebSocket>();

  private bids = new Map<number, number>();
  private asks = new Map<number, number>();
  private lastU = 0;
  private lastu = 0;
  private gaps = 0;
  private isSynced = false;
  private isResyncing = false;
  private buffer: any[] = [];
  private cachedCandles: Record<string, SeedCandle[]> | null = null;

  constructor() {
    this.setupServer();
    this.loadCandles();
    this.setupBinance();
  }

  private setupServer(): void {
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      ws.send(JSON.stringify({ type: 'handshake', symbol: SYMBOL, serverTime: Date.now() }));
      if (this.cachedCandles) {
        ws.send(JSON.stringify({ type: 'seed_candles', symbol: SYMBOL, candles: this.cachedCandles }));
      }
      ws.on('close', () => this.clients.delete(ws));
    });
    console.log(`[Bridge] WebSocket server active on ws://localhost:${PORT}`);
  }

  private async loadCandles(): Promise<void> {
    try {
      this.cachedCandles = await this.fetchHistoricalCandles();
      console.log('[Bridge] Seed candles loaded from Binance (1m/3m/5m/15m/1h/4h)');
      for (const ws of this.clients) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'seed_candles', symbol: SYMBOL, candles: this.cachedCandles }));
        }
      }
    } catch (err: any) {
      console.error(`[Bridge] Failed to load historical candles: ${err.message}`);
    }
  }

  private async fetchHistoricalCandles(): Promise<Record<string, SeedCandle[]>> {
    const mapK = (k: any): SeedCandle => ({
      t: k.openTime,
      o: k.open,
      h: k.high,
      l: k.low,
      c: k.close,
      v: k.volume,
      tbv: k.takerBuyBaseVolume ?? k.volume * 0.5,
    });

    const [m1, m3, m5, m15, h1, h4] = await Promise.all([
      this.client.futures.market.klines(SYMBOL, '1m', { limit: 180 }),
      this.client.futures.market.klines(SYMBOL, '3m', { limit: 120 }),
      this.client.futures.market.klines(SYMBOL, '5m', { limit: 120 }),
      this.client.futures.market.klines(SYMBOL, '15m', { limit: 96 }),
      this.client.futures.market.klines(SYMBOL, '1h', { limit: 72 }),
      this.client.futures.market.klines(SYMBOL, '4h', { limit: 40 }),
    ]);

    return {
      m1: m1.map(mapK),
      m3: m3.map(mapK),
      m5: m5.map(mapK),
      m15: m15.map(mapK),
      h1: h1.map(mapK),
      h4: h4.map(mapK),
    };
  }

  private broadcast(payload: Record<string, unknown>): void {
    if (this.clients.size === 0) return;
    const raw = JSON.stringify(payload);
    for (const ws of this.clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(raw);
    }
  }

  private setupBinance(): void {
    const sym = SYMBOL.toLowerCase();

    // Market route: trades and klines
    this.client.futures.ws.on('message', (stream: string, payload: any) => {
      if (stream.includes('aggTrade')) this.handleTrade(payload);
      else if (stream.includes('kline')) this.handleKline(payload);
    });
    this.client.futures.ws.subscribe([`${sym}@aggTrade`, `${sym}@kline_1m`]);

    // Public route: bookTicker and 100ms diff depth
    this.client.futures.wsPublic.on('message', (stream: string, payload: any) => {
      if (stream.includes('bookTicker')) this.handleBookTicker(payload);
      else if (stream.includes('depth')) this.handleDepth(payload);
    });
    this.client.futures.wsPublic.subscribe([`${sym}@bookTicker`, `${sym}@depth@100ms`]);

    setTimeout(() => this.resync(), 800);
  }

  private handleTrade(e: any): void {
    const price = parseFloat(e.p);
    const qty = parseFloat(e.q);
    const isBuyerMaker = Boolean(e.m);

    this.broadcast({
      type: 'trade',
      timestamp: e.T,
      price,
      quantity: qty,
      signedQuantity: isBuyerMaker ? -qty : qty,
      aggressorSide: isBuyerMaker ? 'SELL' : 'BUY',
    });
  }

  private handleBookTicker(e: any): void {
    this.broadcast({
      type: 'bookTicker',
      timestamp: Date.now(),
      bb: parseFloat(e.b),
      ba: parseFloat(e.a),
      bestBidQty: parseFloat(e.B),
      bestAskQty: parseFloat(e.A),
    });
  }

  private handleKline(e: any): void {
    const k = e.k;
    this.broadcast({
      type: 'kline',
      timestamp: k.t,
      close: parseFloat(k.c),
      high: parseFloat(k.h),
      low: parseFloat(k.l),
      open: parseFloat(k.o),
      volume: parseFloat(k.v),
      isClosed: k.x,
    });
  }

  private handleDepth(e: any): void {
    if (this.isResyncing) {
      this.buffer.push(e);
      return;
    }
    if (!this.isSynced) return;

    // Reject sequence discontinuity per Binance Futures sync rules
    if (e.pu !== this.lastu) {
      this.gaps++;
      console.warn(`[Bridge] Depth gap: pu(${e.pu}) !== lastu(${this.lastu}). Resyncing...`);
      this.resync();
      return;
    }

    this.applyDiff(e);
    this.emitBook(e.T || e.E);
  }

  private applyDiff(e: any): void {
    for (const [p, q] of e.b) {
      const price = parseFloat(p), qty = parseFloat(q);
      if (qty === 0) this.bids.delete(price);
      else this.bids.set(price, qty);
    }
    for (const [p, q] of e.a) {
      const price = parseFloat(p), qty = parseFloat(q);
      if (qty === 0) this.asks.delete(price);
      else this.asks.set(price, qty);
    }
    this.lastU = e.U;
    this.lastu = e.u;
  }

  private async resync(): Promise<void> {
    if (this.isResyncing) return;
    this.isResyncing = true;
    this.isSynced = false;
    this.buffer = [];

    try {
      const snap = await this.client.futures.market.depth(SYMBOL, 1000);
      this.bids.clear();
      this.asks.clear();
      for (const b of snap.bids) this.bids.set(parseFloat(b.price), parseFloat(b.qty));
      for (const a of snap.asks) this.asks.set(parseFloat(a.price), parseFloat(a.qty));

      const snapSeq = snap.lastUpdateId;
      const startIdx = this.findBridgingEvent(snapSeq);

      if (startIdx === -1) {
        setTimeout(() => { this.isResyncing = false; this.resync(); }, 300);
        return;
      }

      for (let i = startIdx; i < this.buffer.length; i++) {
        this.applyDiff(this.buffer[i]);
      }

      this.isResyncing = false;
      this.isSynced = true;
      console.log(`[Bridge] Book synced! lastUpdateId: ${this.lastu}`);
      this.emitBook(Date.now());
    } catch (err: any) {
      console.error(`[Bridge] Snapshot error: ${err.message}. Retrying in 1s...`);
      setTimeout(() => { this.isResyncing = false; this.resync(); }, 1000);
    }
  }

  private findBridgingEvent(snapSeq: number): number {
    for (let i = 0; i < this.buffer.length; i++) {
      const e = this.buffer[i];
      if (e.u < snapSeq) continue;
      if (e.U <= snapSeq && e.u >= snapSeq) return i;
    }
    return -1;
  }

  private emitBook(ts: number): void {
    const sortedBids = Array.from(this.bids.entries())
      .sort((a, b) => b[0] - a[0])
      .slice(0, 60)
      .map(([p, q]) => ({ p, q }));

    const sortedAsks = Array.from(this.asks.entries())
      .sort((a, b) => a[0] - b[0])
      .slice(0, 60)
      .map(([p, q]) => ({ p, q }));

    if (!sortedBids.length || !sortedAsks.length) return;

    const bb = sortedBids[0].p;
    const ba = sortedAsks[0].p;
    const book: NormalizedBook = {
      bids: sortedBids,
      asks: sortedAsks,
      bb,
      ba,
      mid: (bb + ba) / 2,
      seq: this.lastu,
      ts,
      gaps: this.gaps,
    };

    this.broadcast({ type: 'depth', book });
  }
}

new BinanceBridge();
