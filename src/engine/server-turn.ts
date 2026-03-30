import type { GameState, PlacedCard } from './types';
import { getCardDef } from './cards';

let instanceIdCounter = 0;

export function resetInstanceIdCounter(): void {
  instanceIdCounter = 0;
}

function nextInstanceId(cardId: string): string {
  return `${cardId}-${++instanceIdCounter}`;
}

function getNetworkCards(board: PlacedCard[]): PlacedCard[] {
  return board.filter(c => getCardDef(c.cardId).type === 'network');
}

function getComputeCards(board: PlacedCard[]): PlacedCard[] {
  return board.filter(c => getCardDef(c.cardId).type === 'compute');
}

function countAppsOnCard(board: PlacedCard[], instanceId: string): number {
  return board.filter(c => {
    const def = getCardDef(c.cardId);
    return def.type === 'application' && c.connections.includes(instanceId);
  }).length;
}

function getAppTypesOnCompute(board: PlacedCard[], computeInstanceId: string): string[] {
  return board
    .filter(c => {
      const def = getCardDef(c.cardId);
      return def.type === 'application' && c.connections.includes(computeInstanceId);
    })
    .map(c => c.cardId);
}

export function playCard(state: GameState, cardId: string): GameState {
  if (state.phase !== 'server-turn') return state;

  const def = getCardDef(cardId);
  if (def.type === 'application') return state; // Use playAppCard instead

  const deckIndex = state.serverDeck.indexOf(cardId);
  if (deckIndex === -1) return state;

  const newDeck = [...state.serverDeck];
  newDeck.splice(deckIndex, 1);

  const instanceId = nextInstanceId(cardId);
  const newCard: PlacedCard = {
    instanceId,
    cardId,
    connections: [],
    currentLoad: 0,
  };

  const newBoard = [...state.board, newCard];

  // Auto-connect compute to all network cards
  if (def.type === 'compute') {
    const networkCards = getNetworkCards(newBoard);
    for (const nc of networkCards) {
      const ncIdx = newBoard.findIndex(c => c.instanceId === nc.instanceId);
      newBoard[ncIdx] = {
        ...newBoard[ncIdx],
        connections: [...newBoard[ncIdx].connections, instanceId],
      };
    }
  }

  // Auto-connect new network card to all existing compute cards
  if (def.type === 'network') {
    const computeCards = getComputeCards(newBoard).filter(c => c.instanceId !== instanceId);
    const ncIdx = newBoard.findIndex(c => c.instanceId === instanceId);
    newBoard[ncIdx] = {
      ...newBoard[ncIdx],
      connections: [...newBoard[ncIdx].connections, ...computeCards.map(c => c.instanceId)],
    };
  }

  return { ...state, serverDeck: newDeck, board: newBoard };
}

export function playAppCard(
  state: GameState,
  cardId: string,
  computeInstanceId: string,
  storageInstanceId: string,
): GameState {
  if (state.phase !== 'server-turn') return state;

  const def = getCardDef(cardId);
  if (def.type !== 'application') return state;

  const deckIndex = state.serverDeck.indexOf(cardId);
  if (deckIndex === -1) return state;

  const computeCard = state.board.find(c => c.instanceId === computeInstanceId);
  if (!computeCard) return state;
  const computeDef = getCardDef(computeCard.cardId);
  if (computeDef.type !== 'compute') return state;

  const storageCard = state.board.find(c => c.instanceId === storageInstanceId);
  if (!storageCard) return state;
  const storageDef = getCardDef(storageCard.cardId);
  if (storageDef.type !== 'storage') return state;

  // Check compute app slots
  if (computeDef.appSlots != null) {
    const currentApps = countAppsOnCard(state.board, computeInstanceId);
    if (currentApps >= computeDef.appSlots) return state;
  }

  // Check storage app slots
  if (storageDef.appSlots != null) {
    const currentApps = countAppsOnCard(state.board, storageInstanceId);
    if (currentApps >= storageDef.appSlots) return state;
  }

  // No duplicate app types on same compute
  const existingAppTypes = getAppTypesOnCompute(state.board, computeInstanceId);
  if (existingAppTypes.includes(cardId)) return state;

  const newDeck = [...state.serverDeck];
  newDeck.splice(deckIndex, 1);

  const instanceId = nextInstanceId(cardId);
  const newCard: PlacedCard = {
    instanceId,
    cardId,
    connections: [computeInstanceId, storageInstanceId],
    currentLoad: 0,
  };

  return { ...state, serverDeck: newDeck, board: [...state.board, newCard] };
}

export function removeCard(state: GameState, instanceId: string): GameState {
  if (state.phase !== 'server-turn') return state;

  const card = state.board.find(c => c.instanceId === instanceId);
  if (!card) return state;

  const def = getCardDef(card.cardId);

  // If removing compute/storage, also remove dependent app cards
  let newBoard = state.board;
  if (def.type === 'compute' || def.type === 'storage') {
    const dependentApps = newBoard.filter(c => {
      const cDef = getCardDef(c.cardId);
      return cDef.type === 'application' && c.connections.includes(instanceId);
    });
    const removedAppIds = dependentApps.map(a => a.cardId);
    newBoard = newBoard.filter(c =>
      c.instanceId !== instanceId && !dependentApps.some(a => a.instanceId === c.instanceId),
    );

    // Clean up connections referencing removed cards
    const removedIds = new Set([instanceId, ...dependentApps.map(a => a.instanceId)]);
    newBoard = newBoard.map(c => ({
      ...c,
      connections: c.connections.filter(id => !removedIds.has(id)),
    }));

    return {
      ...state,
      serverDeck: [...state.serverDeck, card.cardId, ...removedAppIds],
      board: newBoard,
    };
  }

  // Remove the card
  newBoard = newBoard.filter(c => c.instanceId !== instanceId);
  newBoard = newBoard.map(c => ({
    ...c,
    connections: c.connections.filter(id => id !== instanceId),
  }));

  return {
    ...state,
    serverDeck: [...state.serverDeck, card.cardId],
    board: newBoard,
  };
}

export function endServerTurn(state: GameState): GameState {
  if (state.phase !== 'server-turn') return state;

  // Calculate per-turn costs
  let turnCost = 0;
  for (const card of state.board) {
    const def = getCardDef(card.cardId);
    if (def.costPerTurn) {
      turnCost += def.costPerTurn;
    }
  }

  return {
    ...state,
    phase: 'client-turn',
    activePlayer: 'client',
    scoreboard: {
      ...state.scoreboard,
      cost: state.scoreboard.cost + turnCost,
    },
  };
}
