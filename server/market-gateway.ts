import { BinanceClient } from '@nemesis-oss/binance-sdk';
import { Candle, Trade } from './types.js';

export interface GatewayHandlers {
  onTrade: (trade: Trade) => void;
  onBookTicker: (t: number, bp: number, bq: number, ap: number, aq: number) => void;
  onDepthDiff: (diff: any) => void;
  onKline: (k: any) => void;
}

export class MarketGateway {
  private client = new BinanceClient();

  constructor(
    private readonly symbol: string,
    private readonly handlers: GatewayHandlers
  ) {}

  public async fetchSnapshot(): Promise<{ lastUpdateId: number; bids: any[]; asks: any[] }> {
    return this.client.futures.market.depth(this.symbol, 1000);
  }

  public async fetchHistoricalCandles(): Promise<Record<string, Candle[]>> {
    const mapK = (k: any): Candle => ({
      t: k.openTime,
      o: k.open,
      h: k.high,
      l: k.low,
      c: k.close,
      v: k.volume,
      tbv: k.takerBuyBaseVolume ?? k.volume * 0.5,
      closed: true
    });

    const [m1, m3, m5, m15, h1, h4] = await Promise.all([
      this.client.futures.market.klines(this.symbol, '1m', { limit: 180 }),
      this.client.futures.market.klines(this.symbol, '3m', { limit: 120 }),
      this.client.futures.market.klines(this.symbol, '5m', { limit: 120 }),
      this.client.futures.market.klines(this.symbol, '15m', { limit: 96 }),
      this.client.futures.market.klines(this.symbol, '1h', { limit: 72 }),
      this.client.futures.market.klines(this.symbol, '4h', { limit: 40 })
    ]);

    return {
      m1: m1.map(mapK),
      m3: m3.map(mapK),
      m5: m5.map(mapK),
      m15: m15.map(mapK),
      h1: h1.map(mapK),
      h4: h4.map(mapK)
    };
  }

  public start(): void {
    const sym = this.symbol.toLowerCase();

    // Binance USD-M split URL routing: trades and klines on /market
    this.client.futures.ws.on('error', (err: any) => {
      console.warn(`[Gateway] WS market stream warning: ${err?.message || err}`);
    });
    this.client.futures.ws.on('message', (stream: string, payload: any) => {
      if (stream.includes('aggTrade')) this.handleAggTrade(payload);
      else if (stream.includes('kline')) this.handlers.onKline(payload);
    });
    this.client.futures.ws.subscribe([`${sym}@aggTrade`, `${sym}@kline_1m`]);

    // bookTicker and 100ms depth diffs on /public
    this.client.futures.wsPublic.on('error', (err: any) => {
      console.warn(`[Gateway] WS public stream warning: ${err?.message || err}`);
    });
    this.client.futures.wsPublic.on('message', (stream: string, payload: any) => {
      if (stream.includes('bookTicker')) this.handleBookTicker(payload);
      else if (stream.includes('depth')) this.handlers.onDepthDiff(payload);
    });
    this.client.futures.wsPublic.subscribe([`${sym}@bookTicker`, `${sym}@depth@100ms`]);
  }

  private handleAggTrade(e: any): void {
    const price = parseFloat(e.p);
    const quantity = parseFloat(e.q);
    const isBuyerMaker = Boolean(e.m);

    this.handlers.onTrade({
      timestamp: e.T,
      price,
      quantity,
      signedQuantity: isBuyerMaker ? -quantity : quantity,
      aggressorSide: isBuyerMaker ? 'SELL' : 'BUY'
    });
  }

  private handleBookTicker(e: any): void {
    this.handlers.onBookTicker(
      Date.now(),
      parseFloat(e.b),
      parseFloat(e.B),
      parseFloat(e.a),
      parseFloat(e.A)
    );
  }
}
