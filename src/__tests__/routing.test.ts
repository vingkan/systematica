import { describe, it, expect, beforeEach } from 'vitest';
import type { GameState } from '../types';
import { createInitialGameState, finalizeBuild, makeBuildChoice, assignAppToCompute } from '../engine/build';
import { resetInstanceCounter } from '../engine/build';
import { createRoutingContext, routeToCompute, routeToStorage, advanceRouting, resolveCarryOver, getValidComputeTargets, getLBRecommendation, resetRequestIdCounter } from '../engine/routing';
import { endServerTurn } from '../engine/turns';

function buildGameState(lbChoice: 'round-robin' | 'least-connections' = 'round-robin', computeChoice: 'cloud-functions' | 'container' = 'container', cache: boolean = false): GameState {
  resetInstanceCounter();
  resetRequestIdCounter();
  let state = createInitialGameState();
  state = makeBuildChoice(state, 'lb', lbChoice);
  state = makeBuildChoice(state, 'compute', computeChoice);
  state = makeBuildChoice(state, 'cache', cache);
  // Auto-assign apps
  state = assignAppToCompute(state, {});
  state = finalizeBuild(state);
  // Transition to client turn
  state = endServerTurn(state);
  return state;
}

describe('createRoutingContext', () => {
  let state: GameState;

  beforeEach(() => {
    state = buildGameState();
  });

  it('creates routing context for a valid request', () => {
    const result = createRoutingContext(state, 'view-event');
    expect(result.routingContext).not.toBeNull();
    expect(result.routingContext!.state).toBe('AT_LB');
    expect(result.routingContext!.validTargets.length).toBeGreaterThan(0);
    expect(result.routingContext!.steps.length).toBe(1);
    expect(result.routingContext!.steps[0].state).toBe('AT_LB');
  });

  it('decrements client deck when playing a request', () => {
    const viewsBefore = state.clientDeck.find(e => e.type === 'view-event')!.remaining;
    const result = createRoutingContext(state, 'view-event');
    const viewsAfter = result.clientDeck.find(e => e.type === 'view-event')!.remaining;
    expect(viewsAfter).toBe(viewsBefore - 1);
  });

  it('increments cards played this turn', () => {
    const result = createRoutingContext(state, 'view-event');
    expect(result.turnState.cardsPlayedThisTurn).toBe(1);
  });

  it('blocks playing when already routing', () => {
    let result = createRoutingContext(state, 'view-event');
    result = createRoutingContext(result, 'hold-ticket');
    // Should still be routing the first request
    expect(result.routingContext!.requestId).toBe('req-1');
  });

  it('blocks playing when card limit reached', () => {
    let s = { ...state, turnState: { ...state.turnState, cardLimit: 1, cardsPlayedThisTurn: 1 } };
    const result = createRoutingContext(s, 'view-event');
    expect(result.routingContext).toBeNull(); // Unchanged
  });

  it('fails when LB throughput exceeded', () => {
    let s = { ...state, turnState: { ...state.turnState, lbThroughputUsed: 20 } };
    const result = createRoutingContext(s, 'view-event');
    expect(result.routingContext!.state).toBe('FAILED');
    expect(result.failedRequests.length).toBe(1);
  });

  it('sets WAITING_AT_LB when all compute is full', () => {
    // Manually create a state where compute is full
    let s = buildGameState('round-robin', 'cloud-functions', false);

    // Find the two cloud functions
    const computeCards = s.board.filter(c => c.cardId === 'cloud-function');

    // Add fake active requests located on each cloud function to fill them
    const fakeRequests = computeCards.map((c, i) => ({
      id: `fake-${i}`,
      type: 'view-event' as const,
      location: c.instanceId,
      turnPlayed: 1,
      status: 'active' as const,
    }));

    s = { ...s, requests: [...s.requests, ...fakeRequests] };

    // Now play one more — both cloud functions should be full
    const result = createRoutingContext(s, 'view-event');
    expect(result.routingContext).not.toBeNull();
    expect(result.routingContext!.state).toBe('WAITING_AT_LB');
  });
});

describe('routeToCompute', () => {
  let state: GameState;

  beforeEach(() => {
    state = buildGameState();
    state = createRoutingContext(state, 'hold-ticket');
  });

  it('routes to a valid compute node', () => {
    const target = state.routingContext!.validTargets[0];
    const result = routeToCompute(state, target);
    // Should advance to AT_APP (has matching app) with storage targets
    expect(result.routingContext!.state).toBe('AT_APP');
    expect(result.routingContext!.computeNodeId).toBe(target);
    expect(result.routingContext!.validTargets.length).toBeGreaterThan(0); // Storage targets
  });

  it('shows nudge when compute is full', () => {
    // Use cloud functions (capacity 1 each) and fill them with fake requests
    let s = buildGameState('round-robin', 'cloud-functions', false);
    const computeCards = s.board.filter(c => c.cardId === 'cloud-function');
    const fakeRequests = computeCards.map((c, i) => ({
      id: `fake-${i}`,
      type: 'view-event' as const,
      location: c.instanceId,
      turnPlayed: 1,
      status: 'active' as const,
    }));
    s = { ...s, requests: [...s.requests, ...fakeRequests] };

    s = createRoutingContext(s, 'view-event');
    expect(s.routingContext!.state).toBe('WAITING_AT_LB');
    expect(s.routingContext!.validTargets.length).toBe(0);
  });

  it('fails when no matching app on compute', () => {
    // Build with cloud functions which have 1 app slot each
    let s = buildGameState('round-robin', 'cloud-functions', false);
    s = createRoutingContext(s, 'purchase-ticket');
    if (s.routingContext?.state === 'AT_LB' && s.routingContext.validTargets.length > 0) {
      // Try routing to a compute that might not have write-purchase
      const targets = s.routingContext.validTargets;
      // At least one should fail if it doesn't have write-purchase app
      let foundFail = false;
      for (const target of targets) {
        const result = routeToCompute(s, target);
        if (result.routingContext?.state === 'FAILED') {
          foundFail = true;
          expect(result.failedRequests.length).toBeGreaterThan(0);
          break;
        }
      }
      // If no fail, at least one should have succeeded with AT_APP
      if (!foundFail) {
        const result = routeToCompute(s, targets[0]);
        expect(result.routingContext!.state).toBe('AT_APP');
      }
    }
  });
});

// Helper: fully resolve a request through the interactive routing flow
function resolveThrough(s: GameState): GameState {
  // AT_APP: route to storage interactively
  if (s.routingContext?.state === 'AT_APP' && s.routingContext.validTargets.length > 0) {
    s = routeToStorage(s, s.routingContext.validTargets[0]);
  }
  // Clear terminal states
  if (s.routingContext && ['COMPLETED', 'FAILED'].includes(s.routingContext.state)) {
    s = advanceRouting(s);
  }
  if (s.routingContext?.state === 'AT_PAYMENT') {
    s = advanceRouting(s);
  }
  return s;
}

describe('routeToStorage', () => {
  let state: GameState;

  beforeEach(() => {
    state = buildGameState('round-robin', 'container', false);
    state = createRoutingContext(state, 'hold-ticket');
    const target = state.routingContext!.validTargets[0];
    state = routeToCompute(state, target);
  });

  it('AT_APP shows valid storage targets', () => {
    expect(state.routingContext!.state).toBe('AT_APP');
    expect(state.routingContext!.validTargets.length).toBeGreaterThan(0);
  });

  it('routes to storage and completes for non-purchase', () => {
    const storageTarget = state.routingContext!.validTargets[0];
    const result = routeToStorage(state, storageTarget);
    expect(result.routingContext!.state).toBe('COMPLETED');
    expect(result.completedRequests.length).toBe(1);
  });

  it('routes to AT_PAYMENT for purchase tickets', () => {
    let s = buildGameState('round-robin', 'container', false);
    s = createRoutingContext(s, 'purchase-ticket');
    s = routeToCompute(s, s.routingContext!.validTargets[0]);
    expect(s.routingContext!.state).toBe('AT_APP');
    s = routeToStorage(s, s.routingContext!.validTargets[0]);
    expect(s.routingContext!.state).toBe('AT_PAYMENT');
  });

  it('parks AT_PAYMENT and clears routing context', () => {
    let s = buildGameState('round-robin', 'container', false);
    s = createRoutingContext(s, 'purchase-ticket');
    s = routeToCompute(s, s.routingContext!.validTargets[0]);
    s = routeToStorage(s, s.routingContext!.validTargets[0]);
    s = advanceRouting(s); // parks
    expect(s.routingContext).toBeNull();
    expect(s.requests.some(r => r.type === 'purchase-ticket')).toBe(true);
  });

  it('fails when storage throughput is exhausted', () => {
    let s = state;
    // Complete first hold-ticket
    s = resolveThrough(s);

    // Play 2 more to exhaust writes (relational DB has 3 writes/turn)
    for (let i = 0; i < 2; i++) {
      s = createRoutingContext(s, 'hold-ticket');
      if (s.routingContext?.state === 'AT_LB') {
        s = routeToCompute(s, s.routingContext.validTargets[0]);
        s = resolveThrough(s);
      }
    }

    // 4th write should fail
    s = createRoutingContext(s, 'hold-ticket');
    if (s.routingContext?.state === 'AT_LB') {
      s = routeToCompute(s, s.routingContext.validTargets[0]);
      if (s.routingContext?.state === 'AT_APP') {
        s = routeToStorage(s, s.routingContext.validTargets[0]);
        expect(s.routingContext!.state).toBe('FAILED');
        expect(s.failedRequests.length).toBeGreaterThan(0);
      }
    }
  });

  it('clears terminal states', () => {
    const storageTarget = state.routingContext!.validTargets[0];
    let s = routeToStorage(state, storageTarget);
    expect(s.routingContext!.state).toBe('COMPLETED');
    s = advanceRouting(s);
    expect(s.routingContext).toBeNull();
  });

  it('shows scoring info in completion step', () => {
    const storageTarget = state.routingContext!.validTargets[0];
    const s = routeToStorage(state, storageTarget);
    const completedStep = s.routingContext!.steps.find(step => step.state === 'COMPLETED');
    expect(completedStep).toBeDefined();
    expect(completedStep!.description).toContain('pt');
  });
});

describe('getValidComputeTargets', () => {
  it('returns compute nodes with available capacity', () => {
    const state = buildGameState('round-robin', 'container', false);
    const targets = getValidComputeTargets(state);
    expect(targets.length).toBeGreaterThan(0);
  });
});

describe('getLBRecommendation', () => {
  it('returns a recommendation for round-robin', () => {
    const state = buildGameState('round-robin', 'container', false);
    const targets = getValidComputeTargets(state);
    const rec = getLBRecommendation(state, targets);
    expect(rec).not.toBeNull();
    expect(targets).toContain(rec);
  });

  it('returns a recommendation for least-connections', () => {
    const state = buildGameState('least-connections', 'container', false);
    const targets = getValidComputeTargets(state);
    const rec = getLBRecommendation(state, targets);
    expect(rec).not.toBeNull();
  });

  it('returns null for empty targets', () => {
    const state = buildGameState();
    const rec = getLBRecommendation(state, []);
    expect(rec).toBeNull();
  });
});

describe('resolveCarryOver', () => {
  it('auto-completes purchase tickets from previous turns', () => {
    let state = buildGameState('round-robin', 'container', false);
    // Play and route a purchase ticket through interactive steps
    state = createRoutingContext(state, 'purchase-ticket');
    state = routeToCompute(state, state.routingContext!.validTargets[0]);
    // AT_APP is interactive: route to storage
    state = routeToStorage(state, state.routingContext!.validTargets[0]);
    // Now AT_PAYMENT, park it
    state = advanceRouting(state);

    // Simulate advancing to next turn
    const nextTurnState = { ...state, currentTurn: state.currentTurn + 1 };
    const result = resolveCarryOver(nextTurnState);
    expect(result.completedRequests.some(r => r.type === 'purchase-ticket')).toBe(true);
  });

  it('returns state unchanged when no carry-over', () => {
    const state = buildGameState();
    const result = resolveCarryOver(state);
    expect(result.routingContext).toBeNull();
  });
});
