import type { GameState, ActiveRequest } from '../types';
import { REQUEST_POINTS } from '../types';
import { getCardDef } from '../cards';

export function computeScore(state: GameState): { earned: number; cost: number; total: number } {
  let earned = 0;
  for (const req of state.completedRequests) {
    if (req.effectAttached === 'payment-error') {
      // Payment Error zeroes the points
      continue;
    }
    earned += REQUEST_POINTS[req.type] || 0;
  }

  let cost = 0;
  for (const card of state.board) {
    const def = getCardDef(card.cardId);
    cost += def.cost;
  }

  return { earned, cost, total: earned - cost };
}

export function getRequestSummary(state: GameState): {
  completed: number;
  failed: number;
  active: number;
  byType: Record<string, { completed: number; failed: number }>;
} {
  const byType: Record<string, { completed: number; failed: number }> = {};

  const countByType = (requests: ActiveRequest[], field: 'completed' | 'failed') => {
    for (const req of requests) {
      if (!byType[req.type]) byType[req.type] = { completed: 0, failed: 0 };
      byType[req.type][field]++;
    }
  };

  countByType(state.completedRequests, 'completed');
  countByType(state.failedRequests, 'failed');

  return {
    completed: state.completedRequests.length,
    failed: state.failedRequests.length,
    active: state.requests.length,
    byType,
  };
}
