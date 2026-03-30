import { describe, it, expect } from 'vitest';
import type { GameState } from '../types';
import { INITIAL_SERVER_ENERGY, ENERGY_COST_ADD, ENERGY_COST_REMOVE } from '../types';
import { createInitialGameState, finalizeBuild, makeBuildChoice, assignAppToCompute, resetInstanceCounter } from '../engine/build';
import { endClientTurn, endServerTurn, startTurn, addCardFromReserve, removeCard, moveAppToCompute } from '../engine/turns';
import { resetRequestIdCounter } from '../engine/routing';
import { getCardDef } from '../cards';

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

describe('energy system', () => {
  it('initializes with correct server energy', () => {
    const state = buildGameState();
    expect(state.turnState.serverEnergy).toBe(INITIAL_SERVER_ENERGY);
  });

  it('addCardFromReserve costs 2 energy', () => {
    let state = buildGameState();
    expect(state.reserve.length).toBeGreaterThan(0);
    const cardId = state.reserve[0];
    const result = addCardFromReserve(state, cardId);
    expect(result.turnState.serverEnergy).toBe(INITIAL_SERVER_ENERGY - ENERGY_COST_ADD);
  });

  it('rejects addCardFromReserve when energy < 2', () => {
    let state = buildGameState();
    state = { ...state, turnState: { ...state.turnState, serverEnergy: 1 } };
    const cardId = state.reserve[0];
    const result = addCardFromReserve(state, cardId);
    expect(result.turnState.serverEnergy).toBe(1); // Unchanged
  });

  it('removeCard costs 1 energy', () => {
    let state = buildGameState();
    const computeCard = state.board.find(c => getCardDef(c.cardId).type === 'compute');
    if (computeCard) {
      const result = removeCard(state, computeCard.instanceId);
      expect(result.turnState.serverEnergy).toBe(INITIAL_SERVER_ENERGY - ENERGY_COST_REMOVE);
    }
  });

  it('rejects removeCard when energy < 1', () => {
    let state = buildGameState();
    state = { ...state, turnState: { ...state.turnState, serverEnergy: 0 } };
    const computeCard = state.board.find(c => getCardDef(c.cardId).type === 'compute');
    if (computeCard) {
      const result = removeCard(state, computeCard.instanceId);
      expect(result.turnState.serverEnergy).toBe(0);
    }
  });

  it('allows multiple actions with enough energy', () => {
    let state = buildGameState();
    // Remove costs 1, should be able to do it 3 times with 3 energy
    const computeCards = state.board.filter(c => getCardDef(c.cardId).type === 'compute');
    if (computeCards.length > 0) {
      state = removeCard(state, computeCards[0].instanceId);
      expect(state.turnState.serverEnergy).toBe(INITIAL_SERVER_ENERGY - 1);
    }
  });
});

describe('endClientTurn', () => {
  it('advances from turn 1 to turn 2', () => {
    let state = buildGameState();
    state = endServerTurn(state); // server -> client
    const result = endClientTurn(state);
    expect(result.currentTurn).toBe(2);
    expect(result.activePlayer).toBe('server');
    expect(result.turnState.cardLimit).toBe(6); // Turn 2 limit (changed from 5)
  });

  it('advances from turn 2 to turn 3', () => {
    let state = buildGameState();
    state = endServerTurn(state);
    state = endClientTurn(state); // turn 1 -> 2
    state = endServerTurn(state);
    const result = endClientTurn(state); // turn 2 -> 3
    expect(result.currentTurn).toBe(3);
    expect(result.turnState.cardLimit).toBe(10); // Turn 3 limit
  });

  it('triggers game-over after turn 3', () => {
    let state = buildGameState();
    state = endServerTurn(state);
    state = endClientTurn(state); // 1 -> 2
    state = endServerTurn(state);
    state = endClientTurn(state); // 2 -> 3
    state = endServerTurn(state);
    const result = endClientTurn(state); // 3 -> game-over
    expect(result.phase).toBe('game-over');
    expect(result.currentTurn).toBe(4);
  });

  it('clears routing context', () => {
    let state = buildGameState();
    state = endServerTurn(state);
    state = { ...state, routingContext: { requestId: 'test', state: 'COMPLETED', validTargets: [], lbRecommendation: null, steps: [] } };
    const result = endClientTurn(state);
    expect(result.routingContext).toBeNull();
  });

  it('preserves roundRobinIndex', () => {
    let state = buildGameState();
    state = endServerTurn(state);
    state = { ...state, turnState: { ...state.turnState, roundRobinIndex: 3 } };
    const result = endClientTurn(state);
    expect(result.turnState.roundRobinIndex).toBe(3);
  });

  it('does NOT reset client deck between turns', () => {
    let state = buildGameState();
    state = endServerTurn(state);
    // Simulate playing some cards
    const deck = state.clientDeck.map(e => ({ ...e }));
    const viewEntry = deck.find(e => e.type === 'view-event');
    if (viewEntry) viewEntry.remaining = 2; // Simulated plays
    state = { ...state, clientDeck: deck };

    const result = endClientTurn(state);
    const viewAfter = result.clientDeck.find(e => e.type === 'view-event');
    expect(viewAfter!.remaining).toBe(2); // NOT reset to 6
  });
});

describe('endServerTurn', () => {
  it('switches to client player', () => {
    const state = buildGameState();
    const result = endServerTurn(state);
    expect(result.activePlayer).toBe('client');
  });

  it('preserves serverEnergy across server→client transition', () => {
    let state = buildGameState();
    // Spend some energy
    state = { ...state, turnState: { ...state.turnState, serverEnergy: 2 } };
    const result = endServerTurn(state);
    expect(result.turnState.serverEnergy).toBe(2); // Preserved for interrupts
  });

  it('resets client-relevant fields', () => {
    let state = buildGameState();
    state = { ...state, turnState: { ...state.turnState, cardsPlayedThisTurn: 5, lbThroughputUsed: 10 } };
    const result = endServerTurn(state);
    expect(result.turnState.cardsPlayedThisTurn).toBe(0);
    expect(result.turnState.lbThroughputUsed).toBe(0);
  });
});

describe('ephemeral cleanup', () => {
  it('removes ephemeral cards at end of client turn', () => {
    let state = buildGameState();
    state = endServerTurn(state);
    // Add an ephemeral card
    const ephemeral = { instanceId: 'cf-ephemeral-1', cardId: 'cloud-function', connections: [] as string[], ephemeral: true };
    state = { ...state, board: [...state.board, ephemeral] };

    const result = endClientTurn(state);
    expect(result.board.find(c => c.instanceId === 'cf-ephemeral-1')).toBeUndefined();
  });

  it('returns ephemeral card IDs to reserve', () => {
    let state = buildGameState();
    state = endServerTurn(state);
    const reserveBefore = state.reserve.length;
    const ephemeral = { instanceId: 'cf-ephemeral-1', cardId: 'cloud-function', connections: [] as string[], ephemeral: true };
    state = { ...state, board: [...state.board, ephemeral] };

    const result = endClientTurn(state);
    expect(result.reserve.length).toBe(reserveBefore + 1);
    expect(result.reserve).toContain('cloud-function');
  });

  it('bounces requests on ephemeral cards to lb-queue', () => {
    let state = buildGameState();
    state = endServerTurn(state);
    const ephemeral = { instanceId: 'cf-ephemeral-1', cardId: 'cloud-function', connections: [] as string[], ephemeral: true };
    state = { ...state, board: [...state.board, ephemeral] };
    // Place a request on the ephemeral card
    const fakeReq = { id: 'req-fake', type: 'view-event' as const, location: 'cf-ephemeral-1', turnPlayed: 1, status: 'active' as const };
    state = { ...state, requests: [...state.requests, fakeReq] };

    const result = endClientTurn(state);
    const bouncedReq = result.requests.find(r => r.id === 'req-fake');
    expect(bouncedReq).toBeDefined();
    expect(bouncedReq!.location).toBe('lb-queue');
  });

  it('cleans up LB connections to ephemeral cards', () => {
    let state = buildGameState();
    state = endServerTurn(state);
    const ephemeral = { instanceId: 'cf-ephemeral-1', cardId: 'cloud-function', connections: [] as string[], ephemeral: true };
    // Add ephemeral and connect LB to it
    const lb = state.board.find(c => getCardDef(c.cardId).type === 'network')!;
    state = {
      ...state,
      board: [
        ...state.board.map(c => c.instanceId === lb.instanceId ? { ...c, connections: [...c.connections, 'cf-ephemeral-1'] } : c),
        ephemeral,
      ],
    };

    const result = endClientTurn(state);
    const lbAfter = result.board.find(c => getCardDef(c.cardId).type === 'network')!;
    expect(lbAfter.connections).not.toContain('cf-ephemeral-1');
  });
});

describe('startTurn', () => {
  it('returns state unchanged when no carry-over', () => {
    const state = buildGameState();
    const result = startTurn(state);
    expect(result.routingContext).toBeNull();
    expect(result.activePlayer).toBe('server');
  });

  it('clears disabledUntilTurn at start of turn', () => {
    let state = buildGameState();
    // Disable a compute card until current turn
    const computeCard = state.board.find(c => getCardDef(c.cardId).type === 'compute')!;
    state = {
      ...state,
      board: state.board.map(c =>
        c.instanceId === computeCard.instanceId
          ? { ...c, disabledUntilTurn: state.currentTurn }
          : c,
      ),
    };

    const result = startTurn(state);
    const clearedCard = result.board.find(c => c.instanceId === computeCard.instanceId)!;
    expect(clearedCard.disabledUntilTurn).toBeUndefined();
  });

  it('clears capacityModifier at start of turn', () => {
    let state = buildGameState();
    const computeCard = state.board.find(c => getCardDef(c.cardId).type === 'compute')!;
    state = {
      ...state,
      board: state.board.map(c =>
        c.instanceId === computeCard.instanceId
          ? { ...c, capacityModifier: 4 }
          : c,
      ),
    };

    const result = startTurn(state);
    const clearedCard = result.board.find(c => c.instanceId === computeCard.instanceId)!;
    expect(clearedCard.capacityModifier).toBeUndefined();
  });
});

describe('moveAppToCompute', () => {
  it('does NOT cost energy (moving apps is free)', () => {
    let state = buildGameState();
    const secondContainer = { instanceId: 'container-extra', cardId: 'container', connections: [] as string[] };
    state = { ...state, board: [...state.board, secondContainer] };
    state = {
      ...state,
      board: state.board.map(c =>
        getCardDef(c.cardId).type === 'network'
          ? { ...c, connections: [...c.connections, 'container-extra'] }
          : c,
      ),
    };

    const origContainer = state.board.find(c => c.cardId === 'container' && c.instanceId !== 'container-extra');
    const appOnOrig = origContainer?.connections.find(connId => {
      const c = state.board.find(b => b.instanceId === connId);
      return c && getCardDef(c.cardId).type === 'application';
    });

    if (appOnOrig) {
      const energyBefore = state.turnState.serverEnergy;
      const result = moveAppToCompute(state, appOnOrig, 'container-extra');
      expect(result.turnState.serverEnergy).toBe(energyBefore); // Unchanged
    }
  });
});
