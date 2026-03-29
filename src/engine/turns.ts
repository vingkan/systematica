import type { GameState, TurnState } from '../types';
import { TURN_CARD_LIMITS } from '../types';
import { getCardDef } from '../cards';
import { resolveCarryOver } from './routing';

export function createInitialTurnState(cardLimit: number): TurnState {
  return {
    cardsPlayedThisTurn: 0,
    cardLimit,
    storageOps: {},
    lbThroughputUsed: 0,
    roundRobinIndex: 0,
    serverActionsUsed: 0,
  };
}

export function startTurn(state: GameState): GameState {
  // Resolve carry-over (AT_PAYMENT auto-completes, WAITING_AT_LB re-routes or times out)
  let newState = resolveCarryOver(state);

  // If resolveCarryOver created a routingContext (for WAITING_AT_LB re-routing),
  // stay in client mode so the player can route the queued request.
  // Otherwise, set up for server's turn.
  if (newState.routingContext) {
    return { ...newState, activePlayer: 'client' };
  }

  return { ...newState, activePlayer: 'server' };
}

export function endClientTurn(state: GameState): GameState {
  const nextTurn = state.currentTurn + 1;

  if (nextTurn > 3) {
    // Game over
    return {
      ...state,
      phase: 'game-over',
      currentTurn: nextTurn,
      activePlayer: 'server',
      routingContext: null,
    };
  }

  const cardLimit = TURN_CARD_LIMITS[nextTurn] || 5;

  return {
    ...state,
    currentTurn: nextTurn,
    activePlayer: 'server',
    routingContext: null,
    turnState: {
      ...createInitialTurnState(cardLimit),
      roundRobinIndex: state.turnState.roundRobinIndex,
    },
  };
}

export function endServerTurn(state: GameState): GameState {
  const cardLimit = TURN_CARD_LIMITS[state.currentTurn] || 5;

  return {
    ...state,
    activePlayer: 'client',
    turnState: {
      ...createInitialTurnState(cardLimit),
      roundRobinIndex: state.turnState.roundRobinIndex,
    },
  };
}

export function addCardFromReserve(state: GameState, cardId: string): GameState {
  if (state.activePlayer !== 'server') return state;
  if (state.turnState.serverActionsUsed >= 1) return state;

  const reserveIdx = state.reserve.indexOf(cardId);
  if (reserveIdx === -1) return state;

  const newReserve = [...state.reserve];
  newReserve.splice(reserveIdx, 1);

  const instanceId = `${cardId}-added-${state.currentTurn}`;
  const newBoard = [...state.board, { instanceId, cardId, connections: [] }];

  // Auto-connect: if it's a compute card, connect LB to it
  const def = getCardDef(cardId);
  if (def.type === 'compute') {
    const lb = newBoard.find(c => getCardDef(c.cardId).type === 'network');
    if (lb) {
      const updatedBoard = newBoard.map(c =>
        c.instanceId === lb.instanceId
          ? { ...c, connections: [...c.connections, instanceId] }
          : c,
      );
      return {
        ...state,
        board: updatedBoard,
        reserve: newReserve,
        turnState: { ...state.turnState, serverActionsUsed: 1 },
      };
    }
  }

  return {
    ...state,
    board: newBoard,
    reserve: newReserve,
    turnState: { ...state.turnState, serverActionsUsed: 1 },
  };
}

export function removeCard(state: GameState, instanceId: string): GameState {
  if (state.activePlayer !== 'server') return state;
  if (state.turnState.serverActionsUsed >= 1) return state;

  const card = state.board.find(c => c.instanceId === instanceId);
  if (!card) return state;

  const def = getCardDef(card.cardId);
  if (def.type === 'network' || def.type === 'application') return state;

  // Move requests on this card back to LB queue
  const requests = state.requests.map(r =>
    r.location === instanceId ? { ...r, location: 'lb-queue' } : r,
  );

  const newBoard = state.board
    .filter(c => c.instanceId !== instanceId)
    .map(c => ({
      ...c,
      connections: c.connections.filter(conn => conn !== instanceId),
    }));

  const newReserve = [...state.reserve, card.cardId];

  return {
    ...state,
    board: newBoard,
    reserve: newReserve,
    requests,
    turnState: { ...state.turnState, serverActionsUsed: 1 },
  };
}

export function moveAppToCompute(
  state: GameState,
  appInstanceId: string,
  targetComputeInstanceId: string,
): GameState {
  if (state.activePlayer !== 'server') return state;
  if (state.turnState.serverActionsUsed >= 1) return state;

  const appCard = state.board.find(c => c.instanceId === appInstanceId);
  if (!appCard) return state;
  const appDef = getCardDef(appCard.cardId);
  if (appDef.type !== 'application') return state;

  const targetCompute = state.board.find(c => c.instanceId === targetComputeInstanceId);
  if (!targetCompute) return state;
  const targetDef = getCardDef(targetCompute.cardId);
  if (targetDef.type !== 'compute') return state;

  const currentApps = targetCompute.connections.filter(connId => {
    const c = state.board.find(b => b.instanceId === connId);
    return c && getCardDef(c.cardId).type === 'application';
  });
  if (targetDef.appSlots && currentApps.length >= targetDef.appSlots) return state;

  const newBoard = state.board.map(c => {
    const def = getCardDef(c.cardId);
    if (def.type === 'compute') {
      const filtered = c.connections.filter(conn => conn !== appInstanceId);
      if (c.instanceId === targetComputeInstanceId) {
        return { ...c, connections: [...filtered, appInstanceId] };
      }
      return { ...c, connections: filtered };
    }
    return c;
  });

  return {
    ...state,
    board: newBoard,
    turnState: { ...state.turnState, serverActionsUsed: 1 },
  };
}
