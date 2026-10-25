import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { MarketGateway } from './market-gateway.js';
import { OrderBook } from './orderbook.js';
import { MultiResolutionCandles } from './candles.js';
import { FlowManager } from './flow-metrics.js';
import { SignalEngine } from './signal-engine.js';
import { analyzeStructure } from './structure.js';
import { AiService } from './ai-service.js';
import { BootstrapPayload, Trade, StructureAnalysis } from './types.js';

process.on('uncaughtException', (err) => {
  console.error('[Engine] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Engine] Unhandled Rejection:', reason);
});

const SYMBOL = 'SOLUSDT';
const PORT = 8765;
const MAX_QUEUE_SIZE = 100;

interface ClientMeta {
  ws: WebSocket;
  isAlive: boolean;
  queueSize: number;
}

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let d = '';
    req.on('data', chunk => { d += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(d)); } catch { resolve({}); }
    });
  });
}

export class TradingEngineServer {
  private server = http.createServer();
  private wss = new WebSocketServer({ server: this.server });
  private clients = new Map<WebSocket, ClientMeta>();

  private book = new OrderBook();
  private candles = new MultiResolutionCandles();
  private flow = new FlowManager();
  private signals = new SignalEngine();
  private ai = new AiService();
  private recentTrades: Trade[] = [];
  private gateway: MarketGateway;

  constructor() {
    this.gateway = new MarketGateway(SYMBOL, {
      onTrade: (t) => this.handleTrade(t),
      onBookTicker: (t, bp, bq, ap, aq) => this.flow.onBookTicker(t, bp, bq, ap, aq),
      onDepthDiff: (diff) => this.book.handleDiff(diff, () => this.resync()),
      onKline: (k) => this.candles.m1.onPrice(k.k.t, parseFloat(k.k.c), parseFloat(k.k.v), 0)
    });

    this.setupHttp();
    this.setupWs();
    this.startHeartbeat();
    this.startBroadcastLoops();
  }

  private setupHttp(): void {
    this.server.on('request', async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', synced: this.book.isSynced, symbol: SYMBOL }));
        return;
      }
      if (req.url === '/api/bootstrap') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.getBootstrapPayload()));
        return;
      }
      if (req.url?.startsWith('/api/ai')) {
        await this.handleAi(req, res);
        return;
      }
      res.writeHead(404); res.end('Not Found');
    });
  }

  private async handleAi(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    res.setHeader('Content-Type', 'application/json');
    try {
      if (req.url === '/api/ai/models') {
        res.end(JSON.stringify({ models: this.ai.getModels() }));
        return;
      }
      const body = await readBody(req);
      const ctx = this.getBootstrapPayload();
      if (req.url === '/api/ai/analyze') {
        const result = await this.ai.analyzeMarket(ctx, body.model);
        res.end(JSON.stringify(result));
        return;
      }
      if (req.url === '/api/ai/event') {
        const ev = body.event || { type: 'REGIME_CHANGE', summary: 'Regime shift detected', triggerTime: Date.now() };
        const result = await this.ai.analyzeEvent(ctx, ev, body.model);
        res.end(JSON.stringify(result));
        return;
      }
      if (req.url === '/api/ai/ask') {
        const result = await this.ai.askQuestion(ctx, body.question || 'Summarize current edge', body.model);
        res.end(JSON.stringify(result));
        return;
      }
      res.writeHead(404); res.end('{"error":"not found"}');
    } catch (err: any) {
      console.warn(`[Engine] AI endpoint error: ${err?.message || err}`);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err?.message || 'AI request failed' }));
    }
  }

  private setupWs(): void {
    this.wss.on('connection', (ws) => {
      const meta: ClientMeta = { ws, isAlive: true, queueSize: 0 };
      this.clients.set(ws, meta);
      this.safeSend(meta, { type: 'handshake', symbol: SYMBOL, serverTime: Date.now(), synced: this.book.isSynced });
      ws.on('pong', () => { meta.isAlive = true; });
      ws.on('close', () => { this.clients.delete(ws); });
      ws.on('error', () => { this.clients.delete(ws); });
    });
  }

  private startHeartbeat(): void {
    setInterval(() => {
      for (const [ws, meta] of this.clients) {
        if (!meta.isAlive) { ws.terminate(); this.clients.delete(ws); continue; }
        meta.isAlive = false;
        ws.ping();
      }
    }, 30_000);
  }

  private safeSend(meta: ClientMeta, data: unknown): void {
    if (meta.ws.readyState !== WebSocket.OPEN || meta.queueSize > MAX_QUEUE_SIZE) return;
    meta.queueSize++;
    meta.ws.send(JSON.stringify(data), () => { meta.queueSize--; });
  }

  private broadcast(data: unknown): void {
    for (const meta of this.clients.values()) this.safeSend(meta, data);
  }

  private handleTrade(trade: Trade): void {
    this.recentTrades.push(trade);
    if (this.recentTrades.length > 50) this.recentTrades.shift();
    this.flow.onTrade(trade);
    this.candles.onTrade(trade.timestamp, trade.price, trade.quantity, trade.aggressorSide === 'SELL');
    this.book.walls.onTrade(trade.price, trade.quantity, trade.aggressorSide);
  }

  private async resync(): Promise<void> {
    this.book.setResyncing(true);
    try {
      const snap = await this.gateway.fetchSnapshot();
      if (!this.book.applySnapshot(snap)) {
        setTimeout(() => this.resync(), 400);
      }
    } catch (err: any) {
      console.warn(`[Engine] Snapshot fetch error: ${err?.message || err}`);
      setTimeout(() => this.resync(), 1000);
    }
  }

  private computeStructures(now: number, mid: number): Record<string, StructureAnalysis> {
    return {
      m1: analyzeStructure(this.candles.m1, mid, now),
      m3: analyzeStructure(this.candles.m3, mid, now),
      m5: analyzeStructure(this.candles.m5, mid, now),
      m15: analyzeStructure(this.candles.m15, mid, now),
      h1: analyzeStructure(this.candles.h1, mid, now),
      h4: analyzeStructure(this.candles.h4, mid, now)
    };
  }

  public getBootstrapPayload(): BootstrapPayload {
    const now = Date.now();
    const bookState = this.book.getState(now, 60);
    if (bookState.imbalance) {
      bookState.imbalance.m5 = this.flow.tob.imbMean(now - 5000, now);
      bookState.imbalance.m30 = this.flow.tob.imbMean(now - 30000, now);
    }
    const mid = bookState.mid;
    const structure = this.computeStructures(now, mid);
    const matrix = this.flow.getMatrix(now, mid);
    const trades = this.flow.raw.snapshot(now);
    const abs = this.flow.absorb.evaluate(now, trades, this.book.walls, mid);

    const signal = this.signals.evaluate({
      now, bookTs: bookState.ts, bookGaps: bookState.gaps,
      w5: matrix[0], w30: matrix[1], w2m: matrix[2], w5m: matrix[3],
      st: structure, abs, wallBias: this.book.walls.bias(now)
    });

    return {
      symbol: SYMBOL, serverTime: now, book: bookState,
      candles: this.candles.getSnapshot(), structure, matrix,
      signal, absorption: abs
    };
  }

  private startBroadcastLoops(): void {
    setInterval(() => {
      if (this.clients.size === 0) return;
      const now = Date.now();
      const book = this.book.getState(now, 30);
      if (book.mid === 0) return;
      if (book.imbalance) {
        book.imbalance.m5 = this.flow.tob.imbMean(now - 5000, now);
        book.imbalance.m30 = this.flow.tob.imbMean(now - 30000, now);
      }
      const trades = [...this.recentTrades];
      this.recentTrades = [];
      this.broadcast({ type: 'hot', ts: now, book, trades });
    }, 100);

    setInterval(() => {
      if (this.clients.size === 0) return;
      const p = this.getBootstrapPayload();
      if (p.book.mid === 0) return;
      this.broadcast({
        type: 'cadence', ts: p.serverTime, structure: p.structure,
        matrix: p.matrix, signal: p.signal, absorption: p.absorption
      });
    }, 1000);
  }

  public async start(): Promise<void> {
    try {
      const historical = await this.gateway.fetchHistoricalCandles();
      this.candles.seedAll(historical);
    } catch (err: any) {
      console.warn(`[Engine] Initial candles fetch deferred: ${err.message}`);
    }

    this.server.listen(PORT, () => {
      console.log(`[Engine] Headless Trading Engine active on http/ws port ${PORT}`);
    });

    this.gateway.start();
    setTimeout(() => this.resync(), 800);
  }
}

const engine = new TradingEngineServer();
engine.start();
