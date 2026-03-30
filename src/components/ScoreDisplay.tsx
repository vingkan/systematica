import { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import type { GameState } from '../engine/types';
import { computeSLAs, getWinner } from '../engine/scoring';

interface ScoreDisplayProps {
  state: GameState;
  onRestart: () => void;
}

export function ScoreDisplay({ state, onRestart }: ScoreDisplayProps) {
  const sla = computeSLAs(state.scoreboard);
  const winner = getWinner(state);

  // Progressive reveal: 0=nothing, 1=scoreboard, 2=sla1, 3=sla2, 4=sla3, 5=winner+confetti, 6=play again
  const [revealStep, setRevealStep] = useState(0);

  const advance = useCallback(() => {
    setRevealStep(prev => Math.min(prev + 1, 6));
  }, []);

  // Fire confetti when winner is revealed
  useEffect(() => {
    if (revealStep === 5) {
      const colors = winner === 'server'
        ? ['#27ae60', '#3daa6f', '#4a9ece']
        : ['#e74c3c', '#e05555', '#9b6dcc'];
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors });
      setTimeout(() => confetti({ particleCount: 60, spread: 100, origin: { x: 0.3, y: 0.5 }, colors }), 300);
      setTimeout(() => confetti({ particleCount: 60, spread: 100, origin: { x: 0.7, y: 0.5 }, colors }), 600);
    }
  }, [revealStep, winner]);

  const slaRows = [
    { name: 'Value', formula: `(${state.scoreboard.consistency} x 20) - ${state.scoreboard.cost}`, value: String(sla.value), threshold: '> 50', pass: sla.valuePass },
    { name: 'Uptime', formula: `${state.scoreboard.availability} / ${state.scoreboard.requests}`, value: `${(sla.uptime * 100).toFixed(1)}%`, threshold: '> 95%', pass: sla.uptimePass },
    { name: 'Efficiency', formula: `${state.scoreboard.cost} / ${state.scoreboard.requests}`, value: sla.efficiency.toFixed(2), threshold: '< 8', pass: sla.efficiencyPass },
  ];

  const fadeIn = (step: number): React.CSSProperties => ({
    opacity: revealStep >= step ? 1 : 0,
    transform: revealStep >= step ? 'translateY(0)' : 'translateY(12px)',
    transition: 'opacity 0.4s ease, transform 0.4s ease',
    pointerEvents: revealStep >= step ? 'auto' : 'none',
  });

  return (
    <div className="score-screen" onClick={revealStep < 6 ? advance : undefined} style={{ cursor: revealStep < 6 ? 'pointer' : 'default' }}>

      {/* Prompt to click */}
      {revealStep < 6 && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          color: 'var(--text-muted)',
          animation: 'pulse 2s infinite',
        }}>
          Click to reveal
        </div>
      )}

      {/* Game Over label */}
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12,
        letterSpacing: 2,
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        ...fadeIn(0),
      }}>
        Game Over
      </div>

      {/* Scoreboard */}
      <div style={fadeIn(1)}>
        <div className="score-breakdown">
          <div className="score-item">
            <div className="score-item-label">Consistency</div>
            <div className="score-item-value" style={{ color: 'var(--info)' }}>{state.scoreboard.consistency}</div>
          </div>
          <div className="score-item">
            <div className="score-item-label">Availability</div>
            <div className="score-item-value" style={{ color: 'var(--success)' }}>{state.scoreboard.availability}</div>
          </div>
          <div className="score-item">
            <div className="score-item-label">Requests</div>
            <div className="score-item-value" style={{ color: 'var(--request)' }}>{state.scoreboard.requests}</div>
          </div>
          <div className="score-item">
            <div className="score-item-label">Cost</div>
            <div className="score-item-value" style={{ color: 'var(--warning)' }}>{state.scoreboard.cost}</div>
          </div>
        </div>
      </div>

      {/* SLA rows, one per click */}
      <div style={{ width: '100%', maxWidth: 480 }}>
        {slaRows.map((row, i) => (
          <div key={row.name} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            background: revealStep >= i + 2 ? (row.pass ? 'rgba(39, 174, 96, 0.08)' : 'rgba(231, 76, 60, 0.08)') : 'transparent',
            borderRadius: 6,
            marginBottom: 6,
            border: `1px solid ${revealStep >= i + 2 ? (row.pass ? 'rgba(39, 174, 96, 0.2)' : 'rgba(231, 76, 60, 0.2)') : 'transparent'}`,
            ...fadeIn(i + 2),
          }}>
            <div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: 'var(--text-primary)', fontWeight: 500 }}>
                {row.name}
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {row.formula} = {row.value}
              </div>
            </div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 13,
              fontWeight: 600,
              color: row.pass ? 'var(--success)' : 'var(--danger)',
            }}>
              {row.pass ? 'PASS' : 'FAIL'} ({row.threshold})
            </div>
          </div>
        ))}
      </div>

      {/* Winner announcement */}
      <div style={fadeIn(5)}>
        <div className="score-title" style={{
          color: winner === 'server' ? 'var(--success)' : 'var(--danger)',
          marginTop: 8,
        }}>
          {winner === 'server' ? 'Server Wins!' : 'Client Wins!'}
        </div>
      </div>

      {/* Play again */}
      <div style={fadeIn(6)}>
        <button className="btn primary" onClick={(e) => { e.stopPropagation(); onRestart(); }} style={{ marginTop: 16 }}>
          Play Again
        </button>
      </div>
    </div>
  );
}
