import type { GameState, SLAResult, Scoreboard } from './types';
import {
  VALUE_MULTIPLIER, SLA_VALUE_THRESHOLD,
  SLA_UPTIME_THRESHOLD, SLA_EFFICIENCY_THRESHOLD,
} from './types';

export function computeSLAs(scoreboard: Scoreboard): SLAResult {
  const value = (scoreboard.consistency * VALUE_MULTIPLIER) - scoreboard.cost;

  // Handle 0 requests: uptime defaults to 100%, efficiency defaults to 0
  const uptime = scoreboard.requests === 0 ? 1 : scoreboard.availability / scoreboard.requests;
  const efficiency = scoreboard.requests === 0 ? 0 : scoreboard.cost / scoreboard.requests;

  const valuePass = value > SLA_VALUE_THRESHOLD;
  const uptimePass = uptime > SLA_UPTIME_THRESHOLD;
  const efficiencyPass = efficiency < SLA_EFFICIENCY_THRESHOLD;

  return {
    value,
    uptime,
    efficiency,
    valuePass,
    uptimePass,
    efficiencyPass,
    serverWins: valuePass && uptimePass && efficiencyPass,
  };
}

export function getWinner(state: GameState): 'server' | 'client' | null {
  if (state.phase !== 'game-over') return null;
  const sla = computeSLAs(state.scoreboard);
  return sla.serverWins ? 'server' : 'client';
}
