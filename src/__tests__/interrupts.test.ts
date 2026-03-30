import { describe, it, expect } from 'vitest';
import type { GameState } from '../types';
import { INITIAL_SERVER_ENERGY, ENERGY_COST_INTERRUPT } from '../types';
import { createInitialGameState, finalizeBuild, makeBuildChoice, assignAppToCompute, resetInstanceCounter } from '../engine/build';
import { createRoutingContext, resetRequestIdCounter } from '../engine/routing';
import { endServerTurn } from '../engine/turns';
import { hotSwap, autoScale, rateLimit, circuitBreaker } from '../engine/interrupts';
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

function playRequestToReaction(state: GameState): GameState {
  // Play a request — should trigger AWAITING_SERVER_REACTION if server has energy
  return createRoutingContext(state, 'view-event');
}

describe('executeInterrupt wrapper', () => {
  it('rejects when not in AWAITING_SERVER_REACTION', () => {
    const state = buildGameState();
    // No routing context — autoScale should be a no-op
    const result = autoScale(state);
    expect(result).toBe(state);
  });

  it('rejects when serverEnergy < 1', () => {
    let state = buildGameState();
    state = playRequestToReaction(state);
    expect(state.routingContext?.state).toBe('AWAITING_SERVER_REACTION');
    // Drain energy
    state = { ...state, turnState: { ...state.turnState, serverEnergy: 0 } };
    const result = autoScale(state);
    expect(result).toBe(state);
  });

  it('deducts 1 energy on successful interrupt', () => {
    let state = buildGameState('cloud-functions');
    state = playRequestToReaction(state);
    expect(state.routingContext?.state).toBe('AWAITING_SERVER_REACTION');
    expect(state.reserve).toContain('cloud-function');

    const energyBefore = state.turnState.serverEnergy;
    const result = autoScale(state);
    expect(result.turnState.serverEnergy).toBe(energyBefore - ENERGY_COST_INTERRUPT);
  });
});

describe('autoScale', () => {
  it('creates ephemeral cloud function from reserve', () => {
    let state = buildGameState('cloud-functions');
    state = playRequestToReaction(state);

    const boardBefore = state.board.length;
    const reserveBefore = state.reserve.filter(id => id === 'cloud-function').length;

    const result = autoScale(state);
    expect(result.board.length).toBe(boardBefore + 1);
    expect(result.reserve.filter(id => id === 'cloud-function').length).toBe(reserveBefore - 1);

    const ephemeral = result.board.find(c => c.ephemeral);
    expect(ephemeral).toBeDefined();
    expect(ephemeral!.cardId).toBe('cloud-function');
  });

  it('connects LB to ephemeral card', () => {
    let state = buildGameState('cloud-functions');
    state = playRequestToReaction(state);

    const result = autoScale(state);
    const ephemeral = result.board.find(c => c.ephemeral)!;
    const lb = result.board.find(c => getCardDef(c.cardId).type === 'network')!;
    expect(lb.connections).toContain(ephemeral.instanceId);
  });

  it('rejects when no cloud-function in reserve', () => {
    let state = buildGameState('container');
    // Remove all cloud functions from reserve
    state = { ...state, reserve: state.reserve.filter(id => id !== 'cloud-function') };
    state = playRequestToReaction(state);

    const result = autoScale(state);
    expect(result).toBe(state); // No change
  });
});

describe('rateLimit', () => {
  it('halves compute capacity', () => {
    let state = buildGameState();
    state = playRequestToReaction(state);

    const computeCard = state.board.find(c => getCardDef(c.cardId).type === 'compute')!;
    const def = getCardDef(computeCard.cardId);

    const result = rateLimit(state, computeCard.instanceId);
    const modified = result.board.find(c => c.instanceId === computeCard.instanceId)!;
    expect(modified.capacityModifier).toBe(Math.floor(def.capacity! / 2));
  });

  it('rejects for non-compute cards', () => {
    let state = buildGameState();
    state = playRequestToReaction(state);

    const storageCard = state.board.find(c => getCardDef(c.cardId).type === 'storage')!;
    const result = rateLimit(state, storageCard.instanceId);
    expect(result).toBe(state);
  });
});

describe('circuitBreaker', () => {
  it('disables compute node', () => {
    let state = buildGameState();
    state = playRequestToReaction(state);

    const computeCard = state.board.find(c => getCardDef(c.cardId).type === 'compute')!;
    const result = circuitBreaker(state, computeCard.instanceId);
    const disabled = result.board.find(c => c.instanceId === computeCard.instanceId)!;
    expect(disabled.disabledUntilTurn).toBe(state.currentTurn + 1);
  });

  it('bounces in-flight requests to lb-queue', () => {
    let state = buildGameState();
    state = playRequestToReaction(state);

    const computeCard = state.board.find(c => getCardDef(c.cardId).type === 'compute')!;
    // Place a fake request on the compute node
    const fakeReq = { id: 'req-fake', type: 'view-event' as const, location: computeCard.instanceId, turnPlayed: 1, status: 'active' as const };
    state = { ...state, requests: [...state.requests, fakeReq] };

    const result = circuitBreaker(state, computeCard.instanceId);
    const bounced = result.requests.find(r => r.id === 'req-fake')!;
    expect(bounced.location).toBe('lb-queue');
    expect(bounced.waitingSince).toBe(state.currentTurn);
  });
});

describe('hotSwap', () => {
  it('moves app between compute nodes', () => {
    let state = buildGameState();
    // Need a second compute node
    const secondContainer = { instanceId: 'container-extra', cardId: 'container', connections: [] as string[] };
    state = { ...state, board: [...state.board, secondContainer] };
    // Connect LB
    state = {
      ...state,
      board: state.board.map(c =>
        getCardDef(c.cardId).type === 'network'
          ? { ...c, connections: [...c.connections, 'container-extra'] }
          : c,
      ),
    };

    state = playRequestToReaction(state);

    const origCompute = state.board.find(c => c.cardId === 'container' && c.instanceId !== 'container-extra')!;
    const appOnOrig = origCompute.connections.find(connId => {
      const card = state.board.find(b => b.instanceId === connId);
      return card && getCardDef(card.cardId).type === 'application';
    });

    if (appOnOrig) {
      const result = hotSwap(state, appOnOrig, 'container-extra');
      const target = result.board.find(c => c.instanceId === 'container-extra')!;
      expect(target.connections).toContain(appOnOrig);
    }
  });
});

describe('multiple interrupts in one reaction', () => {
  it('chains Auto-Scale + Rate Limit (2 energy spent)', () => {
    let state = buildGameState('cloud-functions');
    state = playRequestToReaction(state);
    expect(state.turnState.serverEnergy).toBe(INITIAL_SERVER_ENERGY);

    // Auto-Scale
    state = autoScale(state);
    expect(state.turnState.serverEnergy).toBe(INITIAL_SERVER_ENERGY - 1);
    expect(state.routingContext?.state).toBe('AWAITING_SERVER_REACTION'); // Still in reaction

    // Rate Limit
    const computeCard = state.board.find(c => getCardDef(c.cardId).type === 'compute' && !c.ephemeral)!;
    state = rateLimit(state, computeCard.instanceId);
    expect(state.turnState.serverEnergy).toBe(INITIAL_SERVER_ENERGY - 2);
    expect(state.routingContext?.state).toBe('AWAITING_SERVER_REACTION'); // Still in reaction
  });
});
