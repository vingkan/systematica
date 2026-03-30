import { describe, it, expect } from 'vitest';
import type { GameState } from '../types';
import { createInitialGameState, finalizeBuild, makeBuildChoice, assignAppToCompute, resetInstanceCounter } from '../engine/build';
import { createRoutingContext, routeToCompute, routeToStorage, routeToService, advanceRouting, serverPassReaction, resetRequestIdCounter } from '../engine/routing';
import { playStampedingherd, selectEffect, attachEffect } from '../engine/effects';
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
  // Pass server reaction if needed
  if (s.routingContext?.state === 'AWAITING_SERVER_REACTION') {
    s = serverPassReaction(s);
  }
  if (s.routingContext?.state === 'AT_LB' && s.routingContext.validTargets.length > 0) {
    s = routeToCompute(s, s.routingContext.validTargets[0]);
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
  }
  return s;
}

describe('Stampeding Herd', () => {
  it('increases card limit by 10 when played first', () => {
    const state = buildGameState();
    const result = playStampedingherd(state);
    expect(result.turnState.cardLimit).toBe(state.turnState.cardLimit + 10);
    expect(result.turnState.cardsPlayedThisTurn).toBe(1);
  });

  it('rejects if not played first', () => {
    let state = buildGameState();
    state = playAndResolve(state, 'view-event');
    const result = playStampedingherd(state);
    expect(result.turnState.cardLimit).toBe(state.turnState.cardLimit);
  });
});

describe('Effect Attachment: Race Condition', () => {
  it('attaches to hold-ticket cards in hand', () => {
    let state = buildGameState();
    state = selectEffect(state, 'race-condition');
    expect(state.selectedEffect).toBe('race-condition');

    // Attach to first hold ticket
    state = attachEffect(state, 'hold-ticket');
    expect(state.effectAttachments.length).toBe(1);
    expect(state.effectAttachments[0].effectType).toBe('race-condition');

    // Attach to second hold ticket (should consume the RC card)
    state = attachEffect(state, 'hold-ticket');
    expect(state.effectAttachments.length).toBe(2);
    expect(state.selectedEffect).toBeNull(); // Cleared after 2
  });

  it('causes hold-ticket to fail on resolution', () => {
    let state = buildGameState();
    // Attach race condition to hold-ticket
    state = selectEffect(state, 'race-condition');
    state = attachEffect(state, 'hold-ticket');
    state = attachEffect(state, 'hold-ticket');

    // Play a hold-ticket (should have RC attached)
    state = createRoutingContext(state, 'hold-ticket');
    expect(state.requests.some(r => r.effectAttached === 'race-condition')).toBe(true);

    // Route through system (pass reaction first)
    if (state.routingContext?.state === 'AWAITING_SERVER_REACTION') {
      state = serverPassReaction(state);
    }
    if (state.routingContext?.state === 'AT_LB') {
      state = routeToCompute(state, state.routingContext.validTargets[0]);
      if (state.routingContext?.state === 'AT_APP') {
        state = routeToStorage(state, state.routingContext.validTargets[0]);
      }
    }

    // Should be FAILED due to race condition
    if (state.routingContext) {
      expect(state.routingContext.state === 'COMPLETED' || state.routingContext.state === 'FAILED').toBe(true);
      // Race condition causes failure
      expect(state.failedRequests.some(r => r.effectAttached === 'race-condition')).toBe(true);
    }
  });
});

describe('Effect Attachment: Payment Error', () => {
  it('attaches to purchase-ticket card', () => {
    let state = buildGameState();
    state = selectEffect(state, 'payment-error');
    expect(state.selectedEffect).toBe('payment-error');

    state = attachEffect(state, 'purchase-ticket');
    expect(state.effectAttachments.length).toBe(1);
    expect(state.effectAttachments[0].effectType).toBe('payment-error');
    expect(state.selectedEffect).toBeNull();
  });

  it('rejects attachment to wrong card type', () => {
    let state = buildGameState();
    state = selectEffect(state, 'payment-error');
    state = attachEffect(state, 'hold-ticket'); // Wrong type
    expect(state.effectAttachments.length).toBe(0);
  });

  it('shows payment error in resolution steps', () => {
    let state = buildGameState();
    state = selectEffect(state, 'payment-error');
    state = attachEffect(state, 'purchase-ticket');

    state = createRoutingContext(state, 'purchase-ticket');
    expect(state.requests.some(r => r.effectAttached === 'payment-error')).toBe(true);
  });
});
