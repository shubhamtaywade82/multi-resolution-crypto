import React, { useState, useEffect, useMemo, useRef } from 'react';
import { marked } from 'marked';

const SERVER_HTTP = 'http://localhost:8765';

export interface MarketEvent {
  id: string;
  type: string;
  summary: string;
  triggerTime: number;
}

interface DispatchMeta {
  model: string;
  role: string;
}

interface CopilotProps {
  latestEvent?: MarketEvent | null;
}

export const AiCopilot: React.FC<CopilotProps> = ({ latestEvent }) => {
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('auto');
  const [output, setOutput] = useState<string>('');
  const [lastDispatch, setLastDispatch] = useState<DispatchMeta | null>(null);
  const [lastTrigger, setLastTrigger] = useState<MarketEvent | null>(null);
  const [autoPilot, setAutoPilot] = useState<boolean>(true);
  const [cooldown, setCooldown] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const processedEventIdRef = useRef<string>('');

  useEffect(() => {
    fetch(`${SERVER_HTTP}/api/ai/models`)
      .then((res) => res.json())
      .then((data) => { if (data.models?.length) setModels(data.models); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const runEventAnalysis = async (ev: MarketEvent) => {
    setIsLoading(true);
    setOutput(`⚡ AUTONOMOUS TRIGGER: Dispatching ${ev.type} to MiniCPM specialist...`);
    try {
      const res = await fetch(`${SERVER_HTTP}/api/ai/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: ev, model: selectedModel })
      });
      const data = await res.json();
      setOutput(data.text || 'No briefing returned.');
      if (data.modelUsed) setLastDispatch({ model: data.modelUsed, role: data.role });
    } catch (err: any) {
      setOutput(`Event analysis error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!autoPilot || !latestEvent || isLoading) return;
    if (latestEvent.id === processedEventIdRef.current || cooldown > 0) return;

    processedEventIdRef.current = latestEvent.id;
    setLastTrigger(latestEvent);
    setCooldown(25);
    runEventAnalysis(latestEvent);
  }, [latestEvent, autoPilot, cooldown, isLoading]);

  const renderedHtml = useMemo(() => {
    if (!output) return '';
    return marked.parse(output, { gfm: true, breaks: true }) as string;
  }, [output]);

  const askCustom = async (question: string) => {
    if (!question.trim()) return;
    setIsLoading(true);
    setOutput(`Routing question to optimal MiniCPM specialist...`);
    try {
      const res = await fetch(`${SERVER_HTTP}/api/ai/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, model: selectedModel })
      });
      const data = await res.json();
      setOutput(data.text || 'No response returned.');
      if (data.modelUsed) setLastDispatch({ model: data.modelUsed, role: data.role });
    } catch (err: any) {
      setOutput(`Query error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>AI COPILOT</span>
          <button onClick={() => setAutoPilot((v) => !v)} style={autoPilotStyle(autoPilot)}>
            <span>{autoPilot ? '● AUTO-PILOT ON' : '○ AUTO-PILOT OFF'}</span>
            {cooldown > 0 && <span style={{ color: 'var(--a)' }}>({cooldown}s)</span>}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '10px', color: 'var(--muted)' }}>MODE:</span>
          <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} style={selectStyle}>
            <option value="auto">⚡ Auto-Route (All Specialists)</option>
            {models.map((m) => (<option key={m} value={m}>{m}</option>))}
          </select>
        </div>
      </div>

      <div className="panel-body" style={{ gap: '8px' }}>
        <div style={poolBarStyle}>
          <span style={{ color: 'var(--c)', fontWeight: 600 }}>COOPERATIVE POOL:</span>
          <span>Analyst <i>(flow & SMC)</i></span> · <span>Summarizer <i>(3-bullet TLDR)</i></span> ·
          <span>ToolAgent <i>(risk & walls)</i></span> · <span>Router <i>(intent dispatch)</i></span>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => askCustom('Analyze comprehensive market flow')} disabled={isLoading} style={btnMainStyle(isLoading)}>
            {isLoading ? '⏳ REASONING...' : '⚡ ANALYZE MARKET FLOW'}
          </button>
          <QuickChip label="3-Bullet Summary" onClick={() => askCustom('Provide a 3-bullet executive summary of flow and structure')} disabled={isLoading} />
          <QuickChip label="Flow Divergence" onClick={() => askCustom('Is there order flow divergence across the 5s, 30s, and 5m windows?')} disabled={isLoading} />
          <QuickChip label="Stop Loss Evaluation" onClick={() => askCustom('Evaluate our current stop loss placement against liquidity walls')} disabled={isLoading} />
          <QuickChip label="Absorption Check" onClick={() => askCustom('Are aggressive market orders currently being absorbed by passive limit walls?')} disabled={isLoading} />
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            type="text" value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Ask anything... intent automatically routed to the best MiniCPM specialist"
            onKeyDown={(e) => { if (e.key === 'Enter') { askCustom(customPrompt); setCustomPrompt(''); } }}
            style={inputStyle}
          />
          <button onClick={() => { askCustom(customPrompt); setCustomPrompt(''); }} disabled={isLoading || !customPrompt.trim()} style={btnAskStyle}>
            Ask
          </button>
        </div>

        <div style={outputContainerStyle}>
          {lastTrigger && (
            <div style={triggerBannerStyle}>
              <span style={{ color: 'var(--c)', fontWeight: 600 }}>⚡ EVENT TRIGGER: {lastTrigger.type}</span>
              <span style={{ color: 'var(--text)' }}>{lastTrigger.summary}</span>
              <span style={{ color: 'var(--muted)', fontSize: '9px' }}>{new Date(lastTrigger.triggerTime).toISOString().slice(14, 19)}</span>
            </div>
          )}

          {lastDispatch && (
            <div style={dispatchMetaStyle}>
              <span style={{ color: 'var(--c)' }}>⚡ DISPATCHED:</span>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{lastDispatch.model}</span>
              <span style={{ color: 'var(--p)' }}>({lastDispatch.role})</span>
            </div>
          )}

          {renderedHtml ? (
            <div className="ai-markdown" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
          ) : (
            <span style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: '11px' }}>
              Auto-pilot active. When a confirmed market event or regime shift occurs, MiniCPM will automatically generate an institutional briefing...
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const QuickChip: React.FC<{ label: string; onClick: () => void; disabled: boolean }> = ({ label, onClick, disabled }) => (
  <button onClick={onClick} disabled={disabled} style={chipStyle}>{label}</button>
);

const autoPilotStyle = (active: boolean): React.CSSProperties => ({
  background: active ? 'rgba(63, 185, 80, 0.15)' : 'var(--card-sub)',
  border: `1px solid ${active ? 'var(--g)' : 'var(--border)'}`,
  color: active ? 'var(--g)' : 'var(--muted)',
  fontSize: '9px', fontWeight: 600, padding: '2px 8px', borderRadius: '3px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px'
});

const selectStyle: React.CSSProperties = {
  background: 'var(--card-sub)', border: '1px solid var(--border)', color: 'var(--c)', fontSize: '10px', padding: '2px 6px', borderRadius: '3px'
};

const poolBarStyle: React.CSSProperties = {
  display: 'flex', gap: '8px', alignItems: 'center', fontSize: '10px', color: 'var(--muted)',
  background: 'var(--card-sub)', padding: '4px 8px', borderRadius: '3px', border: '1px solid var(--border)'
};

const btnMainStyle = (isLoading: boolean): React.CSSProperties => ({
  background: 'var(--p)', border: 0, color: '#000', fontWeight: 700, fontSize: '10.5px', padding: '4px 10px', borderRadius: '3px', cursor: isLoading ? 'not-allowed' : 'pointer'
});

const chipStyle: React.CSSProperties = {
  background: 'var(--card-sub)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '10px', padding: '3px 8px', borderRadius: '3px', cursor: 'pointer'
};

const inputStyle: React.CSSProperties = {
  flex: 1, background: 'var(--card-sub)', border: '1px solid var(--border)', color: 'var(--text)', padding: '4px 8px', fontSize: '11px', borderRadius: '3px'
};

const btnAskStyle: React.CSSProperties = {
  background: 'var(--card-sub)', border: '1px solid var(--c)', color: 'var(--c)', fontSize: '11px', fontWeight: 600, padding: '4px 12px', borderRadius: '3px', cursor: 'pointer'
};

const outputContainerStyle: React.CSSProperties = {
  background: '#04070c', border: '1px solid var(--border-sub)', borderRadius: '4px', padding: '10px 12px',
  minHeight: '80px', maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px'
};

const triggerBannerStyle: React.CSSProperties = {
  background: 'rgba(88, 166, 255, 0.08)', border: '1px solid rgba(88, 166, 255, 0.25)', borderRadius: '3px',
  padding: '4px 8px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px'
};

const dispatchMetaStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--muted)', paddingBottom: '4px', borderBottom: '1px solid var(--border-sub)'
};
