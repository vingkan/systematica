import type { GameState } from '../engine/types';

export function PhaseBar({ state }: { state: GameState }) {
  const { consistency, availability, requests, cost } = state.scoreboard;

  const phaseLabel =
    state.phase === 'server-turn' ? 'Server Turn' :
    state.phase === 'client-turn' ? 'Client Turn' :
    state.phase === 'resolution' ? 'Resolution' :
    'Game Over';

  return (
    <div className="phase-bar">
      {/* Left: phase label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="active-player-label">{phaseLabel}</span>
      </div>

      {/* Center: Scoreboard */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div className="score-block" title="Consistency: value earned from fulfilled requests. Used in Value SLA = (Con x 20) - Cost > 50">
          <span className="score-label">Con</span>
          <span className="score-value" style={{ fontSize: 16, color: 'var(--info)' }}>{consistency}</span>
        </div>
        <div className="score-block" title="Availability: total fulfilled request volume. Unfulfilled requests simply don't count. Used in Uptime SLA = Avl / Req > 95%">
          <span className="score-label">Avl</span>
          <span className="score-value" style={{ fontSize: 16, color: 'var(--success)' }}>{availability}</span>
        </div>
        <div className="score-block" title="Requests: total request volume sent through the system. Used in Uptime and Efficiency SLAs.">
          <span className="score-label">Req</span>
          <span className="score-value" style={{ fontSize: 16, color: 'var(--request)' }}>{requests}</span>
        </div>
        <div className="score-block" title="Cost: infrastructure (per-turn) + processing (per-request) costs. Used in Value and Efficiency SLAs.">
          <span className="score-label">Cost</span>
          <span className="score-value" style={{ fontSize: 16, color: 'var(--warning)' }}>{cost}</span>
        </div>
      </div>

      {/* Right: empty (Rules button is fixed-positioned by App.tsx) */}
      <div style={{ width: 60 }} />
    </div>
  );
}
