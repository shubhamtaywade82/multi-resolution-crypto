import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      justifyContent: 'space-between',
      border: '1px solid var(--border)',
      background: 'var(--card)',
      padding: '6px 12px',
      fontSize: '10px',
      color: 'var(--muted)',
      borderRadius: '4px',
      marginTop: '6px'
    }}>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span>SHORTCUTS:</span>
        <span><kbd style={kbdStyle}>v</kbd> view mode</span>
        <span><kbd style={kbdStyle}>1</kbd> <kbd style={kbdStyle}>2</kbd> <kbd style={kbdStyle}>3</kbd> heat view</span>
        <span><kbd style={kbdStyle}>t</kbd> trade tape</span>
        <span><kbd style={kbdStyle}>s</kbd> smoothing</span>
        <span><kbd style={kbdStyle}>4</kbd> 4h filter</span>
        <span><kbd style={kbdStyle}>x</kbd> countertrend</span>
        <span><kbd style={kbdStyle}>[</kbd> <kbd style={kbdStyle}>]</kbd> persist sec</span>
      </div>

      <div>
        <span>BINANCE USDⓈ-M MAINNET · REAL-TIME STREAMING TERMINAL</span>
      </div>
    </footer>
  );
};

const kbdStyle: React.CSSProperties = {
  background: 'var(--card-sub)',
  border: '1px solid var(--border)',
  padding: '1px 4px',
  borderRadius: '2px',
  color: 'var(--text)'
};
