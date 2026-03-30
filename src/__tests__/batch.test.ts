import { describe, it, expect } from 'vitest';
import type { GameState } from '../types';
import { BATCH_SIZES } from '../types';
import { createInitialGameState, finalizeBuild, makeBuildChoice, assignAppToCompute, resetInstanceCounter } from '../engine/build';
import { createRoutingContext, routeToCompute, routeToStorage, routeToService, advanceRouting, serverPassReaction, resetRequestIdCounter } from '../engine/routing';
import { playStampedingherd } from '../engine/effects';
import { endServerTurn } from '../engine/turns';
import { getCardDef } from '../cards';

function buildGameState(compute: 'container' | 'cloud-functions' = 'container'): GameState {
  resetInstanceCounter();
  resetRequestIdCounter();
  let state = createInitialGameState();
  state = makeBuildChoice(state, 'lb', 'round-robin');
  state = makeBuildChoice(state, 'compute', compute);
  state = makeBuildChoice(state, 'cache', false);
  state = assignAppToCompute(state, {});
  state = finalizeBuild(state);
  state = endServerTurn(state);
  return state;
}

function passReaction(state: GameState): GameState {
  if (state.routingContext?.state === 'AWAITING_SERVER_REACTION') {
    return serverPassReaction(state);
  }
  return state;
}

// Fully resolve one request through manual routing
function resolveOneRequest(state: GameState): GameState {
  let s = passReaction(state);
  if (s.routingContext?.state === 'AT_LB' && s.routingContext.validTargets.length > 0) {
    s = routeToCompute(s, s.routingContext.validTargets[0]);
  }
  if (s.routingContext?.state === 'AT_APP' && s.routingContext.validTargets.length > 0) {
    // Pick storage target (not service)
    const storageTargets = s.routingContext.validTargets.filter(id => {
      const card = s.board.find(c => c.instanceId === id);
      return card && getCardDef(card.cardId).type === 'storage';
    });
    if (storageTargets.length > 0) {
      s = routeToStorage(s, storageTargets[0]);
    }
  }
  if (s.routingContext?.state === 'AT_SERVICE' && s.routingContext.validTargets.length > 0) {
    s = routeToService(s, s.routingContext.validTargets[0]);
  }
  return s;
}

describe('batch context initialization', () => {
  it('creates batch context for View Event (size 3)', () => {
    const state = buildGameState();
    const result = createRoutingContext(state, 'view-event');
    expect(result.batchContext).not.toBeNull();
    expect(result.batchContext!.batchSize).toBe(BATCH_SIZES['view-event']); // 3
    expect(result.batchContext!.currentIndex).toBe(1);
    expect(result.batchContext!.cardType).toBe('view-event');
  });

  it('creates batch context for Hold Ticket (size 2)', () => {
    const state = buildGameState();
    const result = createRoutingContext(state, 'hold-ticket');
    expect(result.batchContext!.batchSize).toBe(BATCH_SIZES['hold-ticket']); // 2
  });

  it('creates batch context for Purchase Ticket (size 1)', () => {
    const state = buildGameState();
    const result = createRoutingContext(state, 'purchase-ticket');
    expect(result.batchContext!.batchSize).toBe(BATCH_SIZES['purchase-ticket']); // 1
  });
});

describe('batch auto-routing', () => {
  it('auto-routes 2nd request after 1st completes (Hold Ticket)', () => {
    let state = buildGameState();
    state = createRoutingContext(state, 'hold-ticket');
    expect(state.batchContext!.batchSize).toBe(2);

    // Resolve first request manually
    state = resolveOneRequest(state);
    expect(state.routingContext!.state).toBe('COMPLETED');
    expect(state.completedRequests.length).toBe(1);

    // Advance — should auto-route 2nd request
    state = advanceRouting(state);

    // 2nd request should be auto-completed or in terminal state
    if (state.routingContext) {
      // Auto-routed and hit COMPLETED or FAILED
      expect(['COMPLETED', 'FAILED'].includes(state.routingContext.state)).toBe(true);
    }
    // Batch index should have advanced
    expect(state.batchContext!.currentIndex).toBe(2);
  });

  it('clears batch context after all requests complete', () => {
    let state = buildGameState();
    state = createRoutingContext(state, 'purchase-ticket'); // batch size 1
    state = resolveOneRequest(state);
    expect(state.routingContext!.state).toBe('COMPLETED');

    state = advanceRouting(state);
    expect(state.routingContext).toBeNull();
    expect(state.batchContext).toBeNull();
  });

  it('View Event batch creates 3 requests total', () => {
    let state = buildGameState();
    state = createRoutingContext(state, 'view-event');
    expect(state.batchContext!.batchSize).toBe(3);

    // Resolve and advance through all 3
    for (let i = 0; i < 3; i++) {
      state = resolveOneRequest(state);
      state = advanceRouting(state);
    }

    // All requests should be completed or failed
    const total = state.completedRequests.length + state.failedRequests.length;
    expect(total).toBe(3);
    expect(state.batchContext).toBeNull();
  });
});

describe('Stampeding Herd doubles batch size', () => {
  it('doubles View Event from 3 to 6', () => {
    let state = buildGameState();
    state = playStampedingherd(state);
    expect(state.turnState.stampedeActive).toBe(true);

    state = createRoutingContext(state, 'view-event');
    expect(state.batchContext!.batchSize).toBe(6); // 3 * 2
  });

  it('doubles Hold Ticket from 2 to 4', () => {
    let state = buildGameState();
    state = playStampedingherd(state);
    state = createRoutingContext(state, 'hold-ticket');
    expect(state.batchContext!.batchSize).toBe(4); // 2 * 2
  });

  it('doubles Purchase Ticket from 1 to 2', () => {
    let state = buildGameState();
    state = playStampedingherd(state);
    state = createRoutingContext(state, 'purchase-ticket');
    expect(state.batchContext!.batchSize).toBe(2); // 1 * 2
  });
});

describe('batch with effects', () => {
  it('carries effect to all requests in batch', () => {
    let state = buildGameState();
    state = createRoutingContext(state, 'hold-ticket');
    // Manually set effectForBatch to simulate attachment
    if (state.batchContext) {
      state = { ...state, batchContext: { ...state.batchContext, effectForBatch: 'race-condition' } };
      // Also set on the first request
      state = { ...state, requests: state.requests.map(r => ({ ...r, effectAttached: 'race-condition' as const })) };
    }

    // Resolve first request (race condition causes failure)
    state = resolveOneRequest(state);
    const firstFailed = state.failedRequests.some(r => r.effectAttached === 'race-condition');
    expect(firstFailed).toBe(true);

    // Advance to 2nd request (auto-routes, also has race-condition)
    state = advanceRouting(state);

    // 2nd request should also fail due to race-condition
    // After auto-routing with race-condition, it lands in FAILED
    if (state.routingContext?.state === 'FAILED') {
      // Good — auto-routed and failed
      state = advanceRouting(state);
    }

    // Both requests should be failed with race-condition
    const rcFailed = state.failedRequests.filter(r => r.effectAttached === 'race-condition');
    expect(rcFailed.length).toBe(2);
  });
});
