import { OllamaClient } from '@nemesis-oss/ollama-sdk';
import { BookState, StructureAnalysis, WindowMetric, SignalState, AbsorptionEvent } from './types.js';

export interface MarketContext {
  symbol: string;
  book: BookState;
  matrix: WindowMetric[];
  structure: Record<string, StructureAnalysis>;
  signal: SignalState;
  absorption: AbsorptionEvent | null;
}

export class AiService {
  private client = new OllamaClient();
  public defaultModel = 'minicpm5-analyst:latest';
  private cachedModels: string[] = [];

  constructor() {
    this.refreshModels().catch(() => {});
  }

  public async refreshModels(): Promise<string[]> {
    try {
      const res = await this.client.listModels();
      const list = Array.isArray(res) ? res : (res as any)?.models ?? [];
      const minicpm = list
        .map((m: any) => m.name || m.model)
        .filter((n: string) => n && n.toLowerCase().includes('minicpm'));

      this.cachedModels = minicpm.length > 0 ? minicpm : [this.defaultModel];
      return this.cachedModels;
    } catch {
      this.cachedModels = [this.defaultModel];
      return this.cachedModels;
    }
  }

  public getModels(): string[] {
    return this.cachedModels.length > 0 ? this.cachedModels : [this.defaultModel];
  }

  public async analyzeMarket(ctx: MarketContext, model = this.defaultModel): Promise<string> {
    const prompt = this.formatContextPrompt(ctx);
    return this.client.chatText({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are an institutional crypto order flow and SMC market structure analyst. Provide direct, concise, factual analysis based strictly on the provided market data. Highlight order flow divergence, wall persistence, absorption, and setup validity.'
        },
        { role: 'user', content: prompt }
      ]
    });
  }

  public async askQuestion(ctx: MarketContext, question: string, model = this.defaultModel): Promise<string> {
    const summary = this.formatContextPrompt(ctx);
    return this.client.chatText({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are an institutional crypto trading assistant. Answer the user question concisely using the live market data provided.'
        },
        {
          role: 'user',
          content: `Live Market Snapshot:\n${summary}\n\nQuestion: ${question}`
        }
      ]
    });
  }

  private formatContextPrompt(ctx: MarketContext): string {
    const mid = ctx.book.mid.toFixed(2);
    const spread = (ctx.book.ba - ctx.book.bb).toFixed(2);
    const w5m = ctx.matrix.find(m => m.label === '5m');
    const w2m = ctx.matrix.find(m => m.label === '2m');
    const st5m = ctx.structure['5m'];
    const st1h = ctx.structure['1h'];

    return [
      `Asset: ${ctx.symbol} (USDⓈ-M Perp)`,
      `Midpoint: $${mid}, Spread: $${spread}`,
      `Flow: 2m OFI ${w2m?.ofi.toFixed(2) ?? '—'}, 5m OFI ${w5m?.ofi.toFixed(2) ?? '—'}, 5m CVD ${w5m?.cvd.toFixed(0) ?? '—'} SOL`,
      `Structure: 5m ${st5m?.trend ?? '—'} (${st5m?.pattern ?? '—'}), 1h ${st1h?.trend ?? '—'}`,
      `Absorption: ${ctx.absorption ? `${ctx.absorption.dir > 0 ? 'Bullish' : 'Bearish'} @ $${ctx.absorption.price.toFixed(2)}` : 'None'}`,
      `Signal State: ${ctx.signal.state} (${ctx.signal.pts > 0 ? '+' : ''}${ctx.signal.pts.toFixed(1)} / 10 pts)`
    ].join('\n');
  }
}
