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

export interface AiResponse {
  text: string;
  modelUsed: string;
  role: string;
}

export interface MarketEventPayload {
  type: string;
  summary: string;
  triggerTime: number;
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

  public resolveSpecialist(query?: string): { model: string; role: string } {
    const q = (query || '').toLowerCase();
    const available = this.getModels();

    if (q.includes('summary') || q.includes('recap') || q.includes('bullet') || q.includes('brief') || q.includes('tldr')) {
      const match = available.find((m) => m.includes('summarizer'));
      if (match) return { model: match, role: 'Executive Summarizer' };
    }

    if (q.includes('stop loss') || q.includes('absorption') || q.includes('risk') || q.includes('friction') || q.includes('tool')) {
      const match = available.find((m) => m.includes('toolagent'));
      if (match) return { model: match, role: 'Execution & Risk Tool Agent' };
    }

    const analyst = available.find((m) => m.includes('analyst'));
    if (analyst) return { model: analyst, role: 'Quantitative Flow Analyst' };

    return { model: available[0] || this.defaultModel, role: 'General Reasoner' };
  }

  // Gracefully handles timeouts or model initialization latency
  private async safeChat(model: string, messages: any[]): Promise<string> {
    try {
      return await this.client.chatText({ model, messages });
    } catch (err: any) {
      console.warn(`[AiService] Chat inference deferred on ${model}: ${err.message}`);
      return `⚠️ **Inference Advisory**: Local model ${model} timed out (${err.message || 'busy'}). Retrying on next regime event.`;
    }
  }

  public async analyzeMarket(ctx: MarketContext, modelParam?: string): Promise<AiResponse> {
    const isAuto = !modelParam || modelParam === 'auto';
    const target = isAuto ? this.resolveSpecialist('market flow analysis') : { model: modelParam, role: 'Manual Selected' };
    const prompt = this.formatContextPrompt(ctx);

    const text = await this.safeChat(target.model, [
      {
        role: 'system',
        content: 'You are an institutional crypto order flow and SMC market structure analyst. Provide direct, concise, factual analysis based strictly on the provided market data. Highlight order flow divergence, wall persistence, absorption, and setup validity.'
      },
      { role: 'user', content: prompt }
    ]);
    return { text, modelUsed: target.model, role: target.role };
  }

  public async analyzeEvent(
    ctx: MarketContext,
    event: MarketEventPayload,
    modelParam?: string
  ): Promise<AiResponse> {
    const isAuto = !modelParam || modelParam === 'auto';
    const target = isAuto ? this.resolveSpecialist(event.summary) : { model: modelParam, role: 'Manual Selected' };
    const prompt = [
      `### CRITICAL MARKET EVENT DETECTED:`,
      `Type: ${event.type}`,
      `Details: ${event.summary}`,
      `Time: ${new Date(event.triggerTime).toISOString()}`,
      `\n### Live Order Flow & SMC Context:`,
      this.formatContextPrompt(ctx)
    ].join('\n');

    const text = await this.safeChat(target.model, [
      {
        role: 'system',
        content: 'You are an institutional algorithmic trading copilot. A critical market event or regime shift just triggered. Provide an immediate, concise, data-driven event briefing. Analyze: (1) Event significance & structural impact, (2) Order flow validation or divergence, (3) Tactical guidance or risk invalidation.'
      },
      { role: 'user', content: prompt }
    ]);
    return { text, modelUsed: target.model, role: target.role };
  }

  public async askQuestion(ctx: MarketContext, question: string, modelParam?: string): Promise<AiResponse> {
    const isAuto = !modelParam || modelParam === 'auto';
    const target = isAuto ? this.resolveSpecialist(question) : { model: modelParam, role: 'Manual Selected' };
    const summary = this.formatContextPrompt(ctx);

    const text = await this.safeChat(target.model, [
      {
        role: 'system',
        content: 'You are an institutional crypto trading assistant. Answer the user question concisely using the live market data provided.'
      },
      {
        role: 'user',
        content: `Live Market Snapshot:\n${summary}\n\nQuestion: ${question}`
      }
    ]);
    return { text, modelUsed: target.model, role: target.role };
  }

  private formatContextPrompt(ctx: MarketContext): string {
    const mid = ctx.book.mid.toFixed(2);
    const spread = (ctx.book.ba - ctx.book.bb).toFixed(2);
    const w5m = ctx.matrix.find((m) => m.label === '5m');
    const w2m = ctx.matrix.find((m) => m.label === '2m');
    const st5m = ctx.structure['5m'] || ctx.structure['m5'];
    const st1h = ctx.structure['1h'] || ctx.structure['h1'];

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
