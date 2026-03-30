import { describe, it, expect } from 'vitest';
import type { GameState, ActiveRequest } from '../types';
import { createInitialGameState, finalizeBuild, makeBuildChoice, assignAppToCompute, resetInstanceCounter } from '../engine/build';
import { resetRequestIdCounter } from '../engine/routing';
import { computeScore } from '../engine/scoring';

function buildGameState(): GameState {
  resetInstanceCounter();
  resetRequestIdCounter();
  let state = createInitialGameState();
  state = makeBuildChoice(state, 'lb', 'round-robin');
  state = makeBuildChoice(state, 'compute', 'container');
  state = makeBuildChoice(state, 'cache', false);
  state = assignAppToCompute(state, {});
  state = finalizeBuild(state);
  return state;
}

function makeCompletedRequest(type: ActiveRequest['type'], turn: number, effect?: ActiveRequest['effectAttached']): ActiveRequest {
  return {
    id: `req-${Math.random()}`,
    type,
    location: 'completed',
    turnPlayed: turn,
    status: 'completed',
    effectAttached: effect,
  };
}

describe('combo scoring', () => {
  it('no combo for 5 or fewer completions in a turn', () => {
    let state = buildGameState();
    // 5 hold-tickets in turn 1 (5 * 1 pt = 5 pts, no combo)
    state = {
      ...state,
      completedRequests: Array.from({ length: 5 }, () => makeCompletedRequest('hold-ticket', 1)),
    };

    const score = computeScore(state);
    expect(score.earned).toBe(5); // 5 * 1 = 5
  });

  it('6th+ completion earns floor(base * 1.5) for hold-ticket', () => {
    let state = buildGameState();
    // 7 hold-tickets in turn 1
    state = {
      ...state,
      completedRequests: Array.from({ length: 7 }, () => makeCompletedRequest('hold-ticket', 1)),
    };

    const score = computeScore(state);
    // First 5: 5 * 1 = 5 pts
    // 6th + 7th: floor(1 * 1.5) = 1 each = 2 pts
    expect(score.earned).toBe(7); // Hold ticket combo: floor(1.5) = 1, so no visible difference
  });

  it('6th+ purchase-ticket earns 7 pts instead of 5', () => {
    let state = buildGameState();
    // 7 purchase-tickets in turn 1
    state = {
      ...state,
      completedRequests: Array.from({ length: 7 }, () => makeCompletedRequest('purchase-ticket', 1)),
    };

    const score = computeScore(state);
    // First 5: 5 * 5 = 25 pts
    // 6th + 7th: floor(5 * 1.5) = 7 each = 14 pts
    expect(score.earned).toBe(39); // 25 + 14
  });

  it('view-event stays 0 even with combo', () => {
    let state = buildGameState();
    // 8 view-events in turn 1
    state = {
      ...state,
      completedRequests: Array.from({ length: 8 }, () => makeCompletedRequest('view-event', 1)),
    };

    const score = computeScore(state);
    expect(score.earned).toBe(0); // 0 pts each, floor(0 * 1.5) = 0
  });

  it('combo is per-turn (different turns dont stack)', () => {
    let state = buildGameState();
    state = {
      ...state,
      completedRequests: [
        ...Array.from({ length: 4 }, () => makeCompletedRequest('purchase-ticket', 1)),
        ...Array.from({ length: 4 }, () => makeCompletedRequest('purchase-ticket', 2)),
      ],
    };

    const score = computeScore(state);
    // Turn 1: 4 * 5 = 20 (no combo, under 5)
    // Turn 2: 4 * 5 = 20 (no combo, under 5)
    expect(score.earned).toBe(40);
  });

  it('payment-error zeroes points even with combo', () => {
    let state = buildGameState();
    state = {
      ...state,
      completedRequests: [
        ...Array.from({ length: 5 }, () => makeCompletedRequest('purchase-ticket', 1)),
        makeCompletedRequest('purchase-ticket', 1, 'payment-error'),
      ],
    };

    const score = computeScore(state);
    // First 5: 5 * 5 = 25
    // 6th: payment-error = 0
    expect(score.earned).toBe(25);
  });
});

describe('infrastructure costs', () => {
  it('reflects new v3 costs', () => {
    const state = buildGameState();
    const score = computeScore(state);
    // Container build: 1 LB (3) + 1 Container (4) + 1 RelDB (3) + 1 PaymentService (1) = 11
    // Plus 3 app cards at 0 cost each
    expect(score.cost).toBe(11);
  });
});
