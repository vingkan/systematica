import { describe, it, expect, beforeEach } from 'vitest';
import type { GameState } from '../types';
import { createInitialGameState, finalizeBuild, makeBuildChoice, assignAppToCompute } from '../engine/build';
import { resetInstanceCounter } from '../engine/build';
import { createRoutingContext, routeToCompute, routeToStorage, routeToService, advanceRouting, resolveCarryOver, getValidComputeTargets, getLBRecommendation, serverPassReaction, resetRequestIdCounter } from '../engine/routing';
import { endServerTurn } from '../engine/turns';
import { getCardDef } from '../cards';

function buildGameState(lbChoice: 'round-robin' | 'least-connections' = 'round-robin', computeChoice: 'cloud-functions' | 'container' = 'container', cache: boolean = false): GameState {
  resetInstanceCounter();
  resetRequestIdCounter();
  let state = createInitialGameState();
  state = makeBuildChoice(state, 'lb', lbChoice);
  state = makeBuildChoice(state, 'compute', computeChoice);
  state = makeBuildChoice(state, 'cache', cache);
  state = assignAppToCompute(state, {});
  state = finalizeBuild(state);
  state = endServerTurn(state);
  return state;
}

// Helper: pass through server reaction to get to AT_LB
function passReaction(state: GameState): GameState {
  if (state.routingContext?.state === 'AWAITING_SERVER_REACTION') {
    return serverPassReaction(state);
  }
  return state;
}

describe('AWAITING_SERVER_REACTION', () => {
  it('triggers when server has energy > 0', () => {
    const state = buildGameState();
    const result = createRoutingContext(state, 'view-event');
    expect(result.routingContext).not.toBeNull();
    expect(result.routingContext!.state).toBe('AWAITING_SERVER_REACTION');
  });

  it('skips when server has energy === 0', () => {
    let state = buildGameState();
    state = { ...state, turnState: { ...state.turnState, serverEnergy: 0 } };
    const result = createRoutingContext(state, 'view-event');
    expect(result.routingContext).not.toBeNull();
    expect(result.routingContext!.state).toBe('AT_LB');
  });
});

describe('serverPassReaction', () => {
  it('transitions from AWAITING_SERVER_REACTION to AT_LB', () => {
    let state = buildGameState();
    state = createRoutingContext(state, 'view-event');
    expect(state.routingContext!.state).toBe('AWAITING_SERVER_REACTION');

    const result = serverPassReaction(state);
    expect(result.routingContext!.state).toBe('AT_LB');
    expect(result.routingContext!.validTargets.length).toBeGreaterThan(0);
  });

  it('sets WAITING_AT_LB when all compute is full after interrupts', () => {
    let state = buildGameState('round-robin', 'cloud-functions', false);
    const computeCards = state.board.filter(c => c.cardId === 'cloud-function');
    const fakeRequests = computeCards.map((c, i) => ({
      id: `fake-${i}`,
      type: 'view-event' as const,
      location: c.instanceId,
      turnPlayed: 1,
      status: 'active' as const,
    }));
    state = { ...state, requests: [...state.requests, ...fakeRequests] };

    state = createRoutingContext(state, 'view-event');
    expect(state.routingContext!.state).toBe('AWAITING_SERVER_REACTION');

    const result = serverPassReaction(state);
    expect(result.routingContext!.state).toBe('WAITING_AT_LB');
  });

  it('is no-op when not in AWAITING_SERVER_REACTION', () => {
    const state = buildGameState();
    const result = serverPassReaction(state);
    expect(result).toBe(state);
  });
});

describe('createRoutingContext', () => {
  let state: GameState;

  beforeEach(() => {
    state = buildGameState();
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
    expect(result.routingContext!.requestId).toBe('req-1');
  });

  it('blocks playing when card limit reached', () => {
    let s = { ...state, turnState: { ...state.turnState, cardLimit: 1, cardsPlayedThisTurn: 1 } };
    const result = createRoutingContext(s, 'view-event');
    expect(result.routingContext).toBeNull();
  });

  it('fails when LB throughput exceeded', () => {
    let s = { ...state, turnState: { ...state.turnState, lbThroughputUsed: 20 } };
    const result = createRoutingContext(s, 'view-event');
    expect(result.routingContext!.state).toBe('FAILED');
    expect(result.failedRequests.length).toBe(1);
  });
});

describe('routeToCompute', () => {
  let state: GameState;

  beforeEach(() => {
    state = buildGameState();
    state = createRoutingContext(state, 'hold-ticket');
    state = passReaction(state);
  });

  it('routes to a valid compute node', () => {
    const target = state.routingContext!.validTargets[0];
    const result = routeToCompute(state, target);
    expect(result.routingContext!.state).toBe('AT_APP');
    expect(result.routingContext!.computeNodeId).toBe(target);
  });

  it('rejects routing to disabled node', () => {
    // Disable the compute node
    const target = state.routingContext!.validTargets[0];
    state = {
      ...state,
      board: state.board.map(c =>
        c.instanceId === target ? { ...c, disabledUntilTurn: state.currentTurn + 1 } : c,
      ),
    };
    const result = routeToCompute(state, target);
    expect(result.routingContext!.nudgeMessage).toContain('disabled');
  });

  it('uses capacityModifier for capacity check', () => {
    const target = state.routingContext!.validTargets[0];
    // Set capacity to 0
    state = {
      ...state,
      board: state.board.map(c =>
        c.instanceId === target ? { ...c, capacityModifier: 0 } : c,
      ),
    };
    const result = routeToCompute(state, target);
    expect(result.routingContext!.nudgeMessage).toContain('capacity');
  });
});

describe('getValidComputeTargets', () => {
  it('returns compute nodes with available capacity', () => {
    const state = buildGameState('round-robin', 'container', false);
    const targets = getValidComputeTargets(state);
    expect(targets.length).toBeGreaterThan(0);
  });

  it('excludes disabled nodes', () => {
    let state = buildGameState('round-robin', 'container', false);
    const computeCard = state.board.find(c => getCardDef(c.cardId).type === 'compute')!;
    state = {
      ...state,
      board: state.board.map(c =>
        c.instanceId === computeCard.instanceId ? { ...c, disabledUntilTurn: state.currentTurn + 1 } : c,
      ),
    };
    const targets = getValidComputeTargets(state);
    expect(targets).not.toContain(computeCard.instanceId);
  });

  it('uses capacityModifier when set', () => {
    let state = buildGameState('round-robin', 'container', false);
    const computeCard = state.board.find(c => getCardDef(c.cardId).type === 'compute')!;
    // Set capacity to 0
    state = {
      ...state,
      board: state.board.map(c =>
        c.instanceId === computeCard.instanceId ? { ...c, capacityModifier: 0 } : c,
      ),
    };
    const targets = getValidComputeTargets(state);
    expect(targets).not.toContain(computeCard.instanceId);
  });
});

// Helper: fully resolve a request through the interactive routing flow
function resolveThrough(s: GameState): GameState {
  if (s.routingContext?.state === 'AWAITING_SERVER_REACTION') {
    s = serverPassReaction(s);
  }
  if (s.routingContext?.state === 'AT_LB' && s.routingContext.validTargets.length > 0) {
    s = routeToCompute(s, s.routingContext.validTargets[0]);
  }
  if (s.routingContext?.state === 'AT_APP' && s.routingContext.validTargets.length > 0) {
    s = routeToStorage(s, s.routingContext.validTargets[0]);
  }
  // Handle AT_SERVICE for purchase tickets
  if (s.routingContext?.state === 'AT_SERVICE' && s.routingContext.validTargets.length > 0) {
    s = routeToService(s, s.routingContext.validTargets[0]);
  }
  if (s.routingContext && ['COMPLETED', 'FAILED'].includes(s.routingContext.state)) {
    s = advanceRouting(s);
  }
  return s;
}

describe('routeToStorage', () => {
  let state: GameState;

  beforeEach(() => {
    state = buildGameState('round-robin', 'container', false);
    state = createRoutingContext(state, 'hold-ticket');
    state = passReaction(state);
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

  it('routes to AT_SERVICE for purchase tickets', () => {
    let s = buildGameState('round-robin', 'container', false);
    s = createRoutingContext(s, 'purchase-ticket');
    s = passReaction(s);
    s = routeToCompute(s, s.routingContext!.validTargets[0]);
    expect(s.routingContext!.state).toBe('AT_APP');
    // Find storage target (not service)
    const storageTargets = s.routingContext!.validTargets.filter(id => {
      const card = s.board.find(c => c.instanceId === id);
      return card && getCardDef(card.cardId).type === 'storage';
    });
    if (storageTargets.length > 0) {
      s = routeToStorage(s, storageTargets[0]);
      expect(s.routingContext!.state).toBe('AT_SERVICE');
    }
  });

  it('fails when storage throughput is exhausted', () => {
    let s = state;
    s = resolveThrough(s);

    for (let i = 0; i < 2; i++) {
      s = createRoutingContext(s, 'hold-ticket');
      s = resolveThrough(s);
    }

    s = createRoutingContext(s, 'hold-ticket');
    if (s.routingContext?.state === 'AWAITING_SERVER_REACTION') {
      s = serverPassReaction(s);
    }
    if (s.routingContext?.state === 'AT_LB') {
      s = routeToCompute(s, s.routingContext.validTargets[0]);
      if (s.routingContext?.state === 'AT_APP') {
        s = routeToStorage(s, s.routingContext.validTargets[0]);
        expect(s.routingContext!.state).toBe('FAILED');
        expect(s.failedRequests.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('routeToService', () => {
  it('completes purchase ticket through service card', () => {
    let s = buildGameState('round-robin', 'container', false);
    s = createRoutingContext(s, 'purchase-ticket');
    s = passReaction(s);
    s = routeToCompute(s, s.routingContext!.validTargets[0]);

    // Route through storage
    const storageTargets = s.routingContext!.validTargets.filter(id => {
      const card = s.board.find(c => c.instanceId === id);
      return card && getCardDef(card.cardId).type === 'storage';
    });
    if (storageTargets.length > 0) {
      s = routeToStorage(s, storageTargets[0]);
      expect(s.routingContext!.state).toBe('AT_SERVICE');

      // Route through service
      s = routeToService(s, s.routingContext!.validTargets[0]);
      expect(s.routingContext!.state).toBe('COMPLETED');
      expect(s.completedRequests.length).toBe(1);
      expect(s.completedRequests[0].type).toBe('purchase-ticket');
    }
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
  it('returns state unchanged when no carry-over', () => {
    const state = buildGameState();
    const result = resolveCarryOver(state);
    expect(result.routingContext).toBeNull();
  });
});
