import { useState, useEffect, useRef } from 'react';
import {
  BookState,
  Trade,
  Candle,
  StructureAnalysis,
  WindowMetric,
  SignalState,
  AbsorptionEvent,
  BootstrapPayload
} from '../types.ts';

const SERVER_HTTP = 'http://localhost:8765';
const SERVER_WS = 'ws://localhost:8765';

export interface StreamState {
  isConnected: boolean;
  isSynced: boolean;
  serverTime: number;
  book: BookState | null;
  candles: Record<string, Candle[]>;
  recentTrades: Trade[];
  structure: Record<string, StructureAnalysis>;
  matrix: WindowMetric[];
  signal: SignalState | null;
  absorption: AbsorptionEvent | null;
  latencyMs: number;
}

const INITIAL_STATE: StreamState = {
  isConnected: false,
  isSynced: false,
  serverTime: Date.now(),
  book: null,
  candles: {},
  recentTrades: [],
  structure: {},
  matrix: [],
  signal: null,
  absorption: null,
  latencyMs: 0
};

export function useTradingStream(): StreamState {
  const [state, setState] = useState<StreamState>(INITIAL_STATE);
  const tradesRef = useRef<Trade[]>([]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let isMounted = true;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const safeClose = (socket: WebSocket | null) => {
      if (!socket) return;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      if (socket.readyState === WebSocket.OPEN) {
        socket.close(1000, 'Normal Closure');
      } else if (socket.readyState === WebSocket.CONNECTING) {
        // Prevent browser handshake abort error by closing only after handshake completes
        socket.onopen = () => { socket.close(1000, 'Closed after abort'); };
      }
    };

    const loadBootstrap = async () => {
      try {
        const res = await fetch(`${SERVER_HTTP}/api/bootstrap`);
        if (!res.ok || !isMounted) return;
        const data: BootstrapPayload = await res.json();

        setState((prev) => ({
          ...prev,
          isSynced: true,
          serverTime: data.serverTime,
          book: data.book,
          candles: data.candles || {},
          structure: data.structure,
          matrix: data.matrix,
          signal: data.signal,
          absorption: data.absorption
        }));
      } catch {
        // Failed bootstrap will resolve on first websocket broadcast
      }
    };

    loadBootstrap();

    const connectWs = () => {
      if (!isMounted) return;
      safeClose(ws);
      ws = new WebSocket(SERVER_WS);

      ws.onopen = () => {
        if (!isMounted) { safeClose(ws); return; }
        setState((prev) => ({ ...prev, isConnected: true }));
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const msg = JSON.parse(event.data);
          handleMessage(msg, setState, tradesRef);
        } catch {}
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setState((prev) => ({ ...prev, isConnected: false, isSynced: false }));
        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connectWs, 2000);
      };

      ws.onerror = () => {
        // Handled by browser onclose transition
      };
    };

    connectWs();

    return () => {
      isMounted = false;
      clearTimeout(reconnectTimeout);
      safeClose(ws);
    };
  }, []);

  return state;
}

function handleMessage(
  msg: any,
  setState: React.Dispatch<React.SetStateAction<StreamState>>,
  tradesRef: React.MutableRefObject<Trade[]>
): void {
  if (msg.type === 'hot') {
    if (msg.trades?.length) {
      tradesRef.current = [...msg.trades, ...tradesRef.current].slice(0, 40);
    }
    const latency = Math.max(0, Date.now() - msg.ts);
    setState((prev) => ({
      ...prev,
      book: msg.book,
      recentTrades: [...tradesRef.current],
      serverTime: msg.ts,
      isSynced: true,
      latencyMs: latency
    }));
  } else if (msg.type === 'cadence') {
    setState((prev) => ({
      ...prev,
      structure: msg.structure,
      matrix: msg.matrix,
      signal: msg.signal,
      absorption: msg.absorption
    }));
  }
}
