import React, { useState, useEffect, useMemo } from 'react';
import { marked } from 'marked';

const SERVER_HTTP = 'http://localhost:8765';

interface DispatchMeta {
  model: string;
  role: string;
}

export const AiCopilot: React.FC = () => {
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('auto');
  const [output, setOutput] = useState<string>('');
  const [lastDispatch, setLastDispatch] = useState<DispatchMeta | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [customPrompt, setCustomPrompt] = useState<string>('');

  useEffect(() => {
    fetch(`${SERVER_HTTP}/api/ai/models`)
      .then((res) => res.json())
      .then((data) => {
        if (data.models?.length) setModels(data.models);
      })
      .catch(() => {});
  }, []);

  const renderedHtml = useMemo(() => {
    if (!output) return '';
    return marked.parse(output, { gfm: true, breaks: true }) as string;
  }, [output]);

  const runAnalysis = async () => {
    setIsLoading(true);
    setOutput('Auto-routing to Quantitative Flow Analyst (minicpm5-analyst)...');
    try {
      const res = await fetch(`${SERVER_HTTP}/api/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel })
      });
      const data = await res.json();
      setOutput(data.text || 'No response returned.');
      if (data.modelUsed) setLastDispatch({ model: data.modelUsed, role: data.role });
    } catch (err: any) {
      setOutput(`Inference error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

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
          <span style={{
            fontSize: '9px',
            background: 'rgba(188, 140, 255, 0.15)',
            color: 'var(--p)',
            padding: '2px 6px',
            borderRadius: '2px',
            border: '1px solid rgba(188, 140, 255, 0.3)'
          }}>
            ⚡ MULTI-AGENT AUTO-ROUTER ACTIVE
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '10px', color: 'var(--muted)' }}>MODE:</span>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            style={{
              background: 'var(--card-sub)',
              border: `1px solid ${selectedModel === 'auto' ? 'var(--c)' : 'var(--border)'}`,
              color: selectedModel === 'auto' ? 'var(--c)' : 'var(--text)',
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '3px'
            }}
          >
            <option value="auto">⚡ Auto-Route (All Specialists)</option>
            {models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="panel-body" style={{ gap: '8px' }}>
        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          fontSize: '10px',
          color: 'var(--muted)',
          background: 'var(--card-sub)',
          padding: '4px 8px',
          borderRadius: '3px',
          border: '1px solid var(--border)'
        }}>
          <span style={{ color: 'var(--c)', fontWeight: 600 }}>COOPERATIVE POOL:</span>
          <span>Analyst <i>(flow & SMC)</i></span> ·
          <span>Summarizer <i>(3-bullet TLDR)</i></span> ·
          <span>ToolAgent <i>(risk & walls)</i></span> ·
          <span>Router <i>(intent dispatch)</i></span>
        </div>

        {/* Action chips automatically routed */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={runAnalysis}
            disabled={isLoading}
            style={{
              background: 'var(--p)',
              border: 0,
              color: '#000',
              fontWeight: 700,
              fontSize: '10.5px',
              padding: '4px 10px',
              borderRadius: '3px',
              cursor: isLoading ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? '⏳ REASONING...' : '⚡ ANALYZE MARKET FLOW'}
          </button>

          <QuickChip label="3-Bullet Summary" onClick={() => askCustom('Provide a 3-bullet executive summary of flow and structure')} disabled={isLoading} />
          <QuickChip label="Flow Divergence" onClick={() => askCustom('Is there order flow divergence across the 5s, 30s, and 5m windows?')} disabled={isLoading} />
          <QuickChip label="Stop Loss Evaluation" onClick={() => askCustom('Evaluate our current stop loss placement against liquidity walls')} disabled={isLoading} />
          <QuickChip label="Absorption Check" onClick={() => askCustom('Are aggressive market orders currently being absorbed by passive limit walls?')} disabled={isLoading} />
        </div>

        {/* Custom prompt input */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Ask anything... intent automatically routed to the best MiniCPM specialist"
            onKeyDown={(e) => { if (e.key === 'Enter') { askCustom(customPrompt); setCustomPrompt(''); } }}
            style={{
              flex: 1,
              background: 'var(--card-sub)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              padding: '4px 8px',
              fontSize: '11px',
              borderRadius: '3px'
            }}
          />
          <button
            onClick={() => { askCustom(customPrompt); setCustomPrompt(''); }}
            disabled={isLoading || !customPrompt.trim()}
            style={{
              background: 'var(--card-sub)',
              border: '1px solid var(--c)',
              color: 'var(--c)',
              fontSize: '11px',
              fontWeight: 600,
              padding: '4px 12px',
              borderRadius: '3px',
              cursor: isLoading || !customPrompt.trim() ? 'not-allowed' : 'pointer'
            }}
          >
            Ask
          </button>
        </div>

        {/* AI Output Window with Rich Markdown Formatting */}
        <div style={{
          background: '#04070c',
          border: '1px solid var(--border-sub)',
          borderRadius: '4px',
          padding: '10px 12px',
          minHeight: '80px',
          maxHeight: '320px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          {lastDispatch && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '10px',
              color: 'var(--muted)',
              paddingBottom: '4px',
              borderBottom: '1px solid var(--border-sub)'
            }}>
              <span style={{ color: 'var(--c)' }}>⚡ DISPATCHED:</span>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{lastDispatch.model}</span>
              <span style={{ color: 'var(--p)' }}>({lastDispatch.role})</span>
            </div>
          )}
          {renderedHtml ? (
            <div
              className="ai-markdown"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          ) : (
            <span style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: '11px' }}>
              Click <b>Analyze Market Flow</b>, pick a quick chip, or type a question. The system will automatically dispatch the optimal MiniCPM specialist...
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const QuickChip: React.FC<{ label: string; onClick: () => void; disabled: boolean }> = ({ label, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      background: 'var(--card-sub)',
      border: '1px solid var(--border)',
      color: 'var(--text)',
      fontSize: '10px',
      padding: '3px 8px',
      borderRadius: '3px',
      cursor: disabled ? 'not-allowed' : 'pointer'
    }}
  >
    {label}
  </button>
);
