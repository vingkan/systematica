import type { GameState } from './types';
import { DEFAULT_TOTAL_TURNS } from './types';
import { computeRoutingPath } from './routing';

export function flipNextCard(state: GameState): GameState {
  if (state.phase !== 'resolution') return state;
  if (state.resolutionIndex >= state.faceDownCards.length) return state;
  if (state.currentResolution !== null) return state; // Already flipped, step through first

  const card = state.faceDownCards[state.resolutionIndex];

  // Calculate effective volume (Stampeding Herd doubles it)
  let effectiveVolume = card.volume;
  if (card.attachedEffects.includes('stampeding-herd')) {
    effectiveVolume *= 2;
  }

  const { result, boardUpdates, newRoundRobinIndex } = computeRoutingPath(
    state,
    card.requestType,
    effectiveVolume,
    card.attachedEffects,
  );

  // Apply board load updates
  const newBoard = state.board.map(c => {
    const delta = boardUpdates.get(c.instanceId);
    if (delta) {
      return { ...c, currentLoad: c.currentLoad + delta };
    }
    return c;
  });

  return {
    ...state,
    board: newBoard,
    currentResolution: result,
    resolutionStepIndex: 0,
    roundRobinIndex: newRoundRobinIndex,
  };
}

export function stepResolution(state: GameState): GameState {
  if (state.phase !== 'resolution') return state;
  if (!state.currentResolution) return state;

  const nextStep = state.resolutionStepIndex + 1;

  if (nextStep >= state.currentResolution.steps.length) {
    // All steps shown — mark resolved but defer score updates to advanceResolution
    const newFaceDown = [...state.faceDownCards];
    newFaceDown[state.resolutionIndex] = {
      ...newFaceDown[state.resolutionIndex],
      resolved: true,
      resolutionResult: state.currentResolution,
    };

    return {
      ...state,
      faceDownCards: newFaceDown,
      currentResolution: null,
      resolutionStepIndex: 0,
    };
  }

  return {
    ...state,
    resolutionStepIndex: nextStep,
  };
}

export function advanceResolution(state: GameState): GameState {
  if (state.phase !== 'resolution') return state;
  if (state.currentResolution !== null) return state; // Must step through current card first

  // Apply deferred score updates from the resolved card
  const resolvedCard = state.faceDownCards[state.resolutionIndex];
  let scoreboard = state.scoreboard;
  if (resolvedCard?.resolutionResult) {
    const r = resolvedCard.resolutionResult;
    scoreboard = {
      consistency: scoreboard.consistency + r.consistencyGained,
      availability: scoreboard.availability + r.availabilityGained - r.availabilityLost,
      cost: scoreboard.cost + r.costIncurred,
      requests: scoreboard.requests + r.requestsCounted,
    };
  }

  const nextIndex = state.resolutionIndex + 1;

  if (nextIndex < state.faceDownCards.length) {
    return {
      ...state,
      scoreboard,
      resolutionIndex: nextIndex,
    };
  }

  // All cards resolved — advance to next turn or game over
  const totalTurns = state.config.totalTurns ?? DEFAULT_TOTAL_TURNS;

  if (state.currentTurn >= totalTurns) {
    return {
      ...state,
      scoreboard,
      phase: 'game-over',
      faceDownCards: [],
      resolutionIndex: 0,
    };
  }

  const newBoard = state.board.map(c => ({ ...c, currentLoad: 0 }));

  return {
    ...state,
    scoreboard,
    phase: 'server-turn',
    activePlayer: 'server',
    currentTurn: state.currentTurn + 1,
    board: newBoard,
    faceDownCards: [],
    resolutionIndex: 0,
    currentResolution: null,
    resolutionStepIndex: 0,
  };
}
