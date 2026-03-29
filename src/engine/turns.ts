import type { GameState, GamePhase, TurnState } from '../types';
import { PHASE_CARD_LIMITS } from '../types';
import { getCardDef } from '../cards';
import { resolveActiveRequests } from './resolution';

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

function getNextPhaseAndTurn(_currentPhase: GamePhase, currentTurn: number): {
  phase: GamePhase;
  turn: number;
} {
  // Turn sequence: 1 (smoke) -> 2,3 (ramp) -> 4,5 (peak) -> game-over
  // Each turn has server then client sub-turns
  const nextTurn = currentTurn + 1;

  if (nextTurn <= 1) return { phase: 'smoke-test', turn: nextTurn };
  if (nextTurn <= 3) return { phase: 'ramp-up', turn: nextTurn };
  if (nextTurn <= 5) return { phase: 'peak-load', turn: nextTurn };
  return { phase: 'game-over', turn: nextTurn };
}

export function endClientTurn(state: GameState): GameState {
  // Resolve all active requests
  let newState = resolveActiveRequests(state);

  // Advance to next turn
  const { phase, turn } = getNextPhaseAndTurn(state.phase, state.currentTurn);

  if (phase === 'game-over') {
    return {
      ...newState,
      phase: 'game-over',
      currentTurn: turn,
      activePlayer: 'server',
    };
  }

  // Smoke test goes directly to ramp-up (no server turn between)
  const isSmoke = state.phase === 'smoke-test';
  const nextPlayer = isSmoke ? 'client' : 'server';
  const cardLimit = PHASE_CARD_LIMITS[phase] || 5;

  return {
    ...newState,
    phase,
    currentTurn: turn,
    activePlayer: nextPlayer,
    turnState: {
      ...createInitialTurnState(cardLimit),
      roundRobinIndex: newState.turnState.roundRobinIndex,
    },
  };
}

export function endServerTurn(state: GameState): GameState {
  const cardLimit = PHASE_CARD_LIMITS[state.phase] || 5;

  return {
    ...state,
    activePlayer: 'client',
    turnState: {
      ...createInitialTurnState(cardLimit),
      roundRobinIndex: state.turnState.roundRobinIndex,
      // Reset storage ops and LB throughput for client's turn
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
  // Don't allow removing the LB or application cards
  if (def.type === 'network' || def.type === 'application') return state;

  // Move requests on this card back to LB queue
  const requests = state.requests.map(r =>
    r.location === instanceId ? { ...r, location: 'lb-queue' } : r,
  );

  // Remove card from board and remove connections to it
  const newBoard = state.board
    .filter(c => c.instanceId !== instanceId)
    .map(c => ({
      ...c,
      connections: c.connections.filter(conn => conn !== instanceId),
    }));

  // Add card ID back to reserve
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

  const appCard = state.board.find(c => c.instanceId === appInstanceId);
  if (!appCard) return state;
  const appDef = getCardDef(appCard.cardId);
  if (appDef.type !== 'application') return state;

  const targetCompute = state.board.find(c => c.instanceId === targetComputeInstanceId);
  if (!targetCompute) return state;
  const targetDef = getCardDef(targetCompute.cardId);
  if (targetDef.type !== 'compute') return state;

  // Check target has app slots available
  const currentApps = targetCompute.connections.filter(connId => {
    const c = state.board.find(b => b.instanceId === connId);
    return c && getCardDef(c.cardId).type === 'application';
  });
  if (targetDef.appSlots && currentApps.length >= targetDef.appSlots) return state;

  // Remove app from all compute cards' connections, add to target
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

  return { ...state, board: newBoard };
}
