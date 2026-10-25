import React, { useState, useEffect } from 'react';

const SERVER_HTTP = 'http://localhost:8765';

export const AiCopilot: React.FC = () => {
  const [models, setModels] = useState<string[]>([
    'minicpm5-analyst:latest',
    'minicpm5-summarizer:latest',
    'minicpm5-router:latest',
    'minicpm5-toolagent:latest',
    'minicpm5:2b'
  ]);
  const [selectedModel, setSelectedModel] = useState<string>('minicpm5-analyst:latest');
  const [output, setOutput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [customPrompt, setCustomPrompt] = useState<string>('');

  useEffect(() => {
    fetch(`${SERVER_HTTP}/api/ai/models`)
      .then((res) => res.json())
      .then((data) => {
        if (data.models?.length) {
          setModels(data.models);
          if (data.models.includes('minicpm5-analyst:latest')) {
            setSelectedModel('minicpm5-analyst:latest');
          } else {
            setSelectedModel(data.models[0]);
          }
        }
      })
      .catch(() => {});
  }, []);

  const runAnalysis = async () => {
    setIsLoading(true);
    setOutput('Inferring market structure with ' + selectedModel + '...');
    try {
      const res = await fetch(`${SERVER_HTTP}/api/ai/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel })
      });
      const data = await res.json();
      setOutput(data.text || 'No response returned from model.');
    } catch (err: any) {
      setOutput(`Inference error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const askCustom = async (question: string) => {
    if (!question.trim()) return;
    setIsLoading(true);
    setOutput('Querying ' + selectedModel + '...');
    try {
      const res = await fetch(`${SERVER_HTTP}/api/ai/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, model: selectedModel })
      });
      const data = await res.json();
      setOutput(data.text || 'No response returned from model.');
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
          <span>AI COPILOT · MINICPM REASONING ENGINE</span>
          <span style={{ fontSize: '10px', color: 'var(--p)', fontWeight: 'bold' }}>@nemesis-oss/ollama-sdk</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '10px', color: 'var(--muted)' }}>VARIANT:</span>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            style={{
              background: 'var(--card-sub)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '3px'
            }}
          >
            {models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="panel-body" style={{ gap: '8px' }}>
        {/* Quick prompt action chips */}
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
          <QuickChip label="Stop Loss Evaluation" onClick={() => askCustom('Evaluate our current stop loss placement against liquidity walls and structure')} disabled={isLoading} />
          <QuickChip label="Absorption Check" onClick={() => askCustom('Are aggressive market orders currently being absorbed by passive limit walls?')} disabled={isLoading} />
        </div>

        {/* Custom prompt input */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Ask MiniCPM anything about current book, OFI, CVD, structure, or risk..."
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

        {/* AI Output Window */}
        <div style={{
          background: '#04070c',
          border: '1px solid var(--border-sub)',
          borderRadius: '4px',
          padding: '10px 12px',
          fontSize: '11px',
          lineHeight: 1.5,
          color: 'var(--text)',
          minHeight: '80px',
          maxHeight: '260px',
          overflowY: 'auto',
          whiteSpace: 'pre-wrap'
        }}>
          {output ? output : (
            <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
              Select a MiniCPM variant and click <b>Analyze Market Flow</b> or ask a question to generate institutional AI reasoning on real Binance USDⓈ-M flow...
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
