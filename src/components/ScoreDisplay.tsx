import type { GameState } from '../types';
import { computeScore, getRequestSummary } from '../engine/scoring';
import type { GameAction } from '../reducer';

interface ScoreDisplayProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export function ScoreDisplay({ state, dispatch }: ScoreDisplayProps) {
  const score = computeScore(state);
  const summary = getRequestSummary(state);

  return (
    <div className="score-screen">
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 12,
        letterSpacing: 3,
        textTransform: 'uppercase' as const,
        color: 'var(--text-muted)',
      }}>
        game over
      </div>

      <div className="score-title">
        <span style={{ color: score.total >= 0 ? 'var(--success)' : 'var(--danger)' }}>
          {score.total >= 0 ? '+' : ''}{score.total}
        </span>
      </div>

      <div className="score-breakdown">
        <div className="score-item">
          <div className="score-item-label">Earned</div>
          <div className="score-item-value" style={{ color: 'var(--success)' }}>+{score.earned}</div>
        </div>
        <div className="score-item">
          <div className="score-item-label">Cost</div>
          <div className="score-item-value" style={{ color: 'var(--storage)' }}>-{score.cost}</div>
        </div>
        <div className="score-item">
          <div className="score-item-label">Total</div>
          <div className="score-item-value" style={{ color: score.total >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {score.total}
          </div>
        </div>
      </div>

      <div className="request-summary">
        {summary.completed} completed / {summary.failed} failed / {summary.active} unresolved
        <br />
        {Object.entries(summary.byType).map(([type, counts]) => (
          <span key={type}>
            {type}: {counts.completed}ok {counts.failed}fail &nbsp;
          </span>
        ))}
      </div>

      <button className="btn primary" onClick={() => dispatch({ type: 'RESTART' })} style={{ marginTop: 'var(--sp-lg)' }}>
        Play Again
      </button>
    </div>
  );
}
