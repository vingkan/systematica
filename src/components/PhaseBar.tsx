import type { GameState, GamePhase } from '../types';
import { computeScore } from '../engine/scoring';

const PHASES: { key: GamePhase; label: string }[] = [
  { key: 'build', label: 'Build' },
  { key: 'smoke-test', label: 'Smoke Test' },
  { key: 'ramp-up', label: 'Ramp Up' },
  { key: 'peak-load', label: 'Peak Load' },
];

const PHASE_ORDER: GamePhase[] = ['build', 'smoke-test', 'ramp-up', 'peak-load', 'game-over'];

export function PhaseBar({ state }: { state: GameState }) {
  const score = computeScore(state);
  const currentIdx = PHASE_ORDER.indexOf(state.phase);

  return (
    <div className="phase-bar">
      <div className="phase-track">
        {PHASES.map(p => {
          const idx = PHASE_ORDER.indexOf(p.key);
          let cls = 'phase-chip';
          if (p.key === state.phase) cls += ' active';
          else if (idx < currentIdx) cls += ' completed';
          return <div key={p.key} className={cls}>{p.label}</div>;
        })}
      </div>

      <div className="active-player-label">
        {state.phase !== 'game-over' && `${state.activePlayer === 'server' ? 'Server' : 'Client'} Turn`}
        {' '}// Turn {state.currentTurn}/5
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
