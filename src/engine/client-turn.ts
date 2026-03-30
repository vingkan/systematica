import type { GameState, FaceDownCard } from './types';
import { REQUIRED_APP_FOR_REQUEST, STORAGE_OP_FOR_APP } from './types';
import { getClientCardDef, isRequestCard, isEffectCard } from './cards';

export function placeCardFaceDown(state: GameState, cardId: string): GameState {
  if (state.phase !== 'client-turn') return state;

  if (!isRequestCard(cardId)) return state;

  const cardsPerTurn = state.config.cardsPerTurn ?? 5;
  if (state.faceDownCards.length >= cardsPerTurn) return state;

  const deckIndex = state.clientDeck.indexOf(cardId);
  if (deckIndex === -1) return state;

  const def = getClientCardDef(cardId);
  if (!def.requestType || !def.volume) return state;

  const newDeck = [...state.clientDeck];
  newDeck.splice(deckIndex, 1);

  const faceDown: FaceDownCard = {
    deckCardId: cardId,
    requestType: def.requestType,
    volume: def.volume,
    attachedEffects: [],
    resolved: false,
  };

  return {
    ...state,
    clientDeck: newDeck,
    faceDownCards: [...state.faceDownCards, faceDown],
  };
}

export function attachEffect(
  state: GameState,
  effectCardId: string,
  faceDownIndex: number,
): GameState {
  if (state.phase !== 'client-turn') return state;

  if (!isEffectCard(effectCardId)) return state;

  const deckIndex = state.clientDeck.indexOf(effectCardId);
  if (deckIndex === -1) return state;

  if (faceDownIndex < 0 || faceDownIndex >= state.faceDownCards.length) return state;

  const target = state.faceDownCards[faceDownIndex];
  const effectDef = getClientCardDef(effectCardId);
  if (!effectDef.effectType) return state;

  // Validate attachment rules
  const requiredApp = REQUIRED_APP_FOR_REQUEST[target.requestType];
  const storageOp = STORAGE_OP_FOR_APP[requiredApp];

  if (effectDef.attachesTo === 'write' && storageOp !== 'write') return state;
  if (effectDef.attachesTo === 'read' && storageOp !== 'read') return state;

  const newDeck = [...state.clientDeck];
  newDeck.splice(deckIndex, 1);

  const newFaceDown = [...state.faceDownCards];
  newFaceDown[faceDownIndex] = {
    ...target,
    attachedEffects: [...target.attachedEffects, effectDef.effectType],
  };

  return {
    ...state,
    clientDeck: newDeck,
    faceDownCards: newFaceDown,
  };
}

export function takeBackFaceDownCard(state: GameState, faceDownIndex: number): GameState {
  if (state.phase !== 'client-turn') return state;
  if (faceDownIndex < 0 || faceDownIndex >= state.faceDownCards.length) return state;

  const card = state.faceDownCards[faceDownIndex];

  // Return the request card and all attached effects to the deck
  const returnedCards = [card.deckCardId];
  for (const effect of card.attachedEffects) {
    // Find the client card ID for this effect type
    const effectCardId = effect === 'stampeding-herd' ? 'stampeding-herd'
      : effect === 'race-condition' ? 'race-condition'
      : 'server-error';
    returnedCards.push(effectCardId);
  }

  const newFaceDown = [...state.faceDownCards];
  newFaceDown.splice(faceDownIndex, 1);

  return {
    ...state,
    clientDeck: [...state.clientDeck, ...returnedCards],
    faceDownCards: newFaceDown,
  };
}

export function detachEffect(state: GameState, faceDownIndex: number, effectIndex: number): GameState {
  if (state.phase !== 'client-turn') return state;
  if (faceDownIndex < 0 || faceDownIndex >= state.faceDownCards.length) return state;

  const card = state.faceDownCards[faceDownIndex];
  if (effectIndex < 0 || effectIndex >= card.attachedEffects.length) return state;

  const effect = card.attachedEffects[effectIndex];
  const effectCardId = effect === 'stampeding-herd' ? 'stampeding-herd'
    : effect === 'race-condition' ? 'race-condition'
    : 'server-error';

  const newEffects = [...card.attachedEffects];
  newEffects.splice(effectIndex, 1);

  const newFaceDown = [...state.faceDownCards];
  newFaceDown[faceDownIndex] = { ...card, attachedEffects: newEffects };

  return {
    ...state,
    clientDeck: [...state.clientDeck, effectCardId],
    faceDownCards: newFaceDown,
  };
}

export function endClientTurn(state: GameState): GameState {
  if (state.phase !== 'client-turn') return state;

  const cardsPerTurn = state.config.cardsPerTurn ?? 5;
  const requestCardsInDeck = state.clientDeck.filter(isRequestCard).length;
  const requiredCards = Math.min(cardsPerTurn, requestCardsInDeck + state.faceDownCards.length);

  // Client must fill all slots (or play all remaining request cards if fewer than cardsPerTurn)
  if (state.faceDownCards.length < requiredCards) return state;

  return {
    ...state,
    phase: 'resolution',
    activePlayer: 'server',
    resolutionIndex: 0,
    currentResolution: null,
    resolutionStepIndex: 0,
  };
}
