import type { GameState } from '../types';
import { computeScore } from '../engine/scoring';

export function PhaseBar({ state }: { state: GameState }) {
  const score = computeScore(state);

  return (
    <div className="phase-bar">
      <div className="phase-track">
        {[1, 2, 3].map(turn => {
          let cls = 'phase-chip';
          if (turn === state.currentTurn && state.phase === 'play') cls += ' active';
          else if (turn < state.currentTurn) cls += ' completed';
          return <div key={turn} className={cls}>Turn {turn}</div>;
        })}
      </div>

      <div className="active-player-label">
        {state.phase === 'play' && (
          <>
            {state.activePlayer === 'server' ? 'Server' : 'Client'} Turn
            {' '}// Turn {state.currentTurn}/3
          </>
        )}
        {state.phase === 'game-over' && 'Game Over'}
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-md)' }}>
        <div className="score-block">
          <span className="score-label">Score</span>
          <span className="score-value" style={{ color: score.total >= 0 ? 'var(--success)' : 'var(--danger)' }}>
            {score.total}
          </span>
        </div>
        <div className="score-block">
          <span className="score-label">Earned</span>
          <span className="score-value" style={{ color: 'var(--success)' }}>+{score.earned}</span>
        </div>
        <div className="score-block">
          <span className="score-label">Cost</span>
          <span className="score-value" style={{ color: 'var(--storage)' }}>-{score.cost}</span>
        </div>
      </div>
    </div>
  );
}
