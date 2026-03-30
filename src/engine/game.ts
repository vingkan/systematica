import type { GameState, GameConfig } from './types';
import { DEFAULT_CARDS_PER_TURN, DEFAULT_TOTAL_TURNS } from './types';
import { getDefaultServerDeck, getDefaultClientDeck } from './cards';

export function createGame(config?: GameConfig): GameState {
  const serverDeck = config?.serverDeck ?? getDefaultServerDeck();
  const clientDeck = config?.clientDeck ?? getDefaultClientDeck();

  return {
    phase: 'server-turn',
    currentTurn: 1,
    activePlayer: 'server',
    serverDeck: [...serverDeck],
    clientDeck: [...clientDeck],
    board: [],
    faceDownCards: [],
    resolutionIndex: 0,
    currentResolution: null,
    resolutionStepIndex: 0,
    scoreboard: { consistency: 0, availability: 0, cost: 0, requests: 0 },
    roundRobinIndex: 0,
    config: {
      cardsPerTurn: config?.cardsPerTurn ?? DEFAULT_CARDS_PER_TURN,
      totalTurns: config?.totalTurns ?? DEFAULT_TOTAL_TURNS,
      ...config,
    },
  };
}
