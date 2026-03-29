import { describe, it, expect } from 'vitest';
import type { GameState } from '../types';
import { createInitialGameState, finalizeBuild, makeBuildChoice, assignAppToCompute, resetInstanceCounter } from '../engine/build';
import { endClientTurn, endServerTurn, startTurn, moveAppToCompute } from '../engine/turns';
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

describe('endClientTurn', () => {
  it('advances from turn 1 to turn 2', () => {
    let state = buildGameState();
    state = endServerTurn(state); // server -> client
    const result = endClientTurn(state);
    expect(result.currentTurn).toBe(2);
    expect(result.activePlayer).toBe('server');
    expect(result.turnState.cardLimit).toBe(5); // Turn 2 limit
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
});

describe('endServerTurn', () => {
  it('switches to client player', () => {
    const state = buildGameState();
    const result = endServerTurn(state);
    expect(result.activePlayer).toBe('client');
  });

  it('resets turn state', () => {
    let state = buildGameState();
    state = { ...state, turnState: { ...state.turnState, serverActionsUsed: 1, cardsPlayedThisTurn: 5 } };
    const result = endServerTurn(state);
    expect(result.turnState.serverActionsUsed).toBe(0);
    expect(result.turnState.cardsPlayedThisTurn).toBe(0);
  });
});

describe('startTurn', () => {
  it('returns state unchanged when no carry-over', () => {
    const state = buildGameState();
    const result = startTurn(state);
    expect(result.routingContext).toBeNull();
    expect(result.activePlayer).toBe('server');
  });
});

describe('moveAppToCompute', () => {
  it('costs the server action for the turn', () => {
    // Manually add a second container to the board so we can move apps between them
    let state = buildGameState();
    const secondContainer = { instanceId: 'container-extra', cardId: 'container', connections: [] as string[] };
    state = { ...state, board: [...state.board, secondContainer] };
    // Connect LB to new container
    state = {
      ...state,
      board: state.board.map(c =>
        getCardDef(c.cardId).type === 'network'
          ? { ...c, connections: [...c.connections, 'container-extra'] }
          : c,
      ),
    };

    // Find an app on the original container
    const origContainer = state.board.find(c => c.cardId === 'container' && c.instanceId !== 'container-extra');
    const appOnOrig = origContainer?.connections.find(connId => {
      const c = state.board.find(b => b.instanceId === connId);
      return c && getCardDef(c.cardId).type === 'application';
    });

    if (appOnOrig) {
      expect(state.turnState.serverActionsUsed).toBe(0);
      const result = moveAppToCompute(state, appOnOrig, 'container-extra');
      expect(result.turnState.serverActionsUsed).toBe(1);
    }
  });

  it('blocks when server action already used', () => {
    let state = buildGameState();
    state = { ...state, turnState: { ...state.turnState, serverActionsUsed: 1 } };
    const appCard = state.board.find(c => getCardDef(c.cardId).type === 'application');
    const computeCard = state.board.find(c => getCardDef(c.cardId).type === 'compute');

    if (appCard && computeCard) {
      const result = moveAppToCompute(state, appCard.instanceId, computeCard.instanceId);
      expect(result).toEqual(state); // Unchanged
    }
  });
});
