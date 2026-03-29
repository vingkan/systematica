import { describe, it, expect, beforeEach } from 'vitest';
import type { GameState } from '../types';
import { createInitialGameState, finalizeBuild, makeBuildChoice, assignAppToCompute, resetInstanceCounter } from '../engine/build';
import { createRoutingContext, routeToCompute, advanceRouting, resetRequestIdCounter } from '../engine/routing';
import { playEffect } from '../engine/effects';
import { endServerTurn } from '../engine/turns';

function buildGameState(): GameState {
  resetInstanceCounter();
  resetRequestIdCounter();
  let state = createInitialGameState();
  state = makeBuildChoice(state, 'lb', 'round-robin');
  state = makeBuildChoice(state, 'compute', 'container');
  state = makeBuildChoice(state, 'cache', false);
  state = assignAppToCompute(state, {});
  state = finalizeBuild(state);
  state = endServerTurn(state);
  return state;
}

function playAndResolve(state: GameState, type: 'view-event' | 'hold-ticket' | 'purchase-ticket'): GameState {
  let s = createRoutingContext(state, type);
  if (s.routingContext?.state === 'AT_LB' && s.routingContext.validTargets.length > 0) {
    s = routeToCompute(s, s.routingContext.validTargets[0]);
    while (s.routingContext && !['COMPLETED', 'FAILED', 'WAITING_AT_LB'].includes(s.routingContext.state)) {
      s = advanceRouting(s);
    }
    // For AT_PAYMENT, advance to park
    if (s.routingContext?.state === 'COMPLETED' || s.routingContext?.state === 'FAILED') {
      s = advanceRouting(s); // clear
    }
  }
  return s;
}

describe('Stampeding Herd', () => {
  it('increases card limit by 10 when played first', () => {
    const state = buildGameState();
    const result = playEffect(state, 'stampeding-herd');
    expect(result.turnState.cardLimit).toBe(state.turnState.cardLimit + 10);
    expect(result.turnState.cardsPlayedThisTurn).toBe(1);
  });

  it('rejects if not played first', () => {
    let state = buildGameState();
    // Play a request first
    state = playAndResolve(state, 'view-event');
    const result = playEffect(state, 'stampeding-herd');
    // Card limit should be unchanged
    expect(result.turnState.cardLimit).toBe(state.turnState.cardLimit);
  });
});

describe('Race Condition', () => {
  let state: GameState;

  beforeEach(() => {
    state = buildGameState();
    // Complete 2 hold-tickets
    state = playAndResolve(state, 'hold-ticket');
    state = playAndResolve(state, 'hold-ticket');
  });

  it('moves 2 completed hold-tickets to failed', () => {
    expect(state.completedRequests.filter(r => r.type === 'hold-ticket').length).toBeGreaterThanOrEqual(2);
    const targets = state.completedRequests
      .filter(r => r.type === 'hold-ticket')
      .slice(0, 2)
      .map(r => r.id);

    const result = playEffect(state, 'race-condition', targets);
    expect(result.completedRequests.filter(r => r.type === 'hold-ticket').length).toBe(
      state.completedRequests.filter(r => r.type === 'hold-ticket').length - 2
    );
    expect(result.failedRequests.filter(r => r.effectAttached === 'race-condition').length).toBe(2);
  });

  it('rejects when fewer than 2 completed hold-tickets', () => {
    let s = buildGameState();
    s = playAndResolve(s, 'hold-ticket');
    const targets = s.completedRequests
      .filter(r => r.type === 'hold-ticket')
      .map(r => r.id);
    if (targets.length < 2) {
      const result = playEffect(s, 'race-condition', [targets[0], 'fake-id']);
      // Should be unchanged
      expect(result.completedRequests.length).toBe(s.completedRequests.length);
    }
  });
});

describe('Payment Error', () => {
  it('attaches effect to an active purchase ticket', () => {
    let state = buildGameState();
    // Play a purchase ticket but don't fully resolve
    state = createRoutingContext(state, 'purchase-ticket');
    if (state.routingContext?.state === 'AT_LB') {
      state = routeToCompute(state, state.routingContext.validTargets[0]);
      state = advanceRouting(state); // AT_STORAGE
      state = advanceRouting(state); // AT_PAYMENT
      state = advanceRouting(state); // park
    }

    const purchaseReq = state.requests.find(r => r.type === 'purchase-ticket');
    if (purchaseReq) {
      const result = playEffect(state, 'payment-error', [purchaseReq.id]);
      const updated = result.requests.find(r => r.id === purchaseReq.id);
      expect(updated?.effectAttached).toBe('payment-error');
    }
  });

  it('rejects when no valid target', () => {
    const state = buildGameState();
    const result = playEffect(state, 'payment-error', ['nonexistent']);
    expect(result).toEqual(state);
  });
});
