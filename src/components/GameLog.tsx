import { useState, useEffect } from 'react';

export interface LogEntry {
  id: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

let logId = 0;

const logEntries: LogEntry[] = [];
const listeners: Set<() => void> = new Set();

export function addLog(message: string, type: LogEntry['type'] = 'info') {
  logEntries.unshift({ id: ++logId, message, type });
  if (logEntries.length > 20) logEntries.pop();
  listeners.forEach(fn => fn());
}

export function clearLog() {
  logEntries.length = 0;
  listeners.forEach(fn => fn());
}

export function GameLog() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick(t => t + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  if (logEntries.length === 0) return null;

  const typeColors: Record<string, string> = {
    info: 'var(--info)',
    success: 'var(--success)',
    error: 'var(--danger)',
    warning: 'var(--warning)',
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 60,
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      zIndex: 100,
      pointerEvents: 'none',
      maxWidth: 500,
    }}>
      {logEntries.slice(0, 5).map((entry, i) => (
        <div key={entry.id} style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: typeColors[entry.type] || 'var(--text-secondary)',
          background: 'var(--bg-surface)',
          border: `1px solid ${typeColors[entry.type] || 'var(--grid-line-major)'}33`,
          borderRadius: 'var(--radius-md)',
          padding: '4px 12px',
          opacity: 1 - (i * 0.2),
          textAlign: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {entry.message}
        </div>
      ))}
    </div>
  );
}
