export interface Level {
  p: number;
  q: number;
}

export interface Wall {
  p: number;
  side: 'bid' | 'ask';
  peak: number;
  life: number;
  replen: number;
  state: 'ACTIVE' | 'GONE' | 'CONSUMED';
  pers: number;
  traded: number;
  score: number;
}

export interface ImbalanceMetrics {
  instant: number;
  m5: number;
  m30: number;
  ratio10: number;
  bidVol10: number;
  askVol10: number;
}

export interface BookState {
  bids: Level[];
  asks: Level[];
  bb: number;
  ba: number;
  mid: number;
  seq: number;
  ts: number;
  gaps: number;
  walls?: { bids: Wall[]; asks: Wall[] };
  imbalance?: ImbalanceMetrics;
}

export interface Trade {
  timestamp: number;
  price: number;
  quantity: number;
  signedQuantity: number;
  aggressorSide: 'BUY' | 'SELL';
}

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  tbv: number;
  closed?: boolean;
}

export interface StructureAnalysis {
  tf: string;
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL / RANGE';
  pattern: string;
  bias: number;
  lastC: Candle | null;
  cur: Candle | null;
  sma: number;
  bos: { dir: number; at: number; t: number } | null;
  sweeps: Array<{ type: string; p: number; t: number; bull: boolean }>;
  zones: Array<{ p: number; type: string; t: number; d: number }>;
  progress: number;
  ok: boolean;
}

export interface WindowMetric {
  label: string;
  ms: number;
  role: string;
  n: number;
  buy: number;
  sell: number;
  cvd: number;
  ofi: number;
  buyPct: number;
  dispBps: number | null;
  rv: number;
  eff: number | null;
  fill: number;
  src: string;
}

export interface SignalState {
  state: 'NO_TRADE' | 'LONG' | 'SHORT';
  pts: number;
  ledger: Array<{ n: string; pts: number; max: number; note: string }>;
  gates: Array<{ n: string; ok: boolean; note: string }>;
  reasons?: Array<{ c: string; t: string; s: string }>;
  ageSec: number;
  lastChange: number;
}

export interface AbsorptionEvent {
  dir: number;
  at: number;
  price: number;
  hits: number;
  expires: number;
}

export interface BootstrapPayload {
  symbol: string;
  serverTime: number;
  book: BookState;
  candles: Record<string, Candle[]>;
  structure: Record<string, StructureAnalysis>;
  matrix: WindowMetric[];
  signal: SignalState;
  absorption: AbsorptionEvent | null;
}
