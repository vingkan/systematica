import type { GameState, EffectType, RequestType } from '../types';

// Stampeding Herd: standalone effect, played on its own
export function playStampedingherd(state: GameState): GameState {
  const deck = state.clientDeck.map(e => ({ ...e }));
  const entry = deck.find(e => e.type === 'stampeding-herd');
  if (!entry || entry.remaining <= 0) return state;
  if (state.routingContext) return state;

  const turnState = { ...state.turnState };
  if (turnState.cardsPlayedThisTurn > 0) return state; // Must be played first

  entry.remaining--;
  turnState.stampedeActive = true;
  turnState.cardsPlayedThisTurn++;
  return { ...state, clientDeck: deck, turnState };
}

// Select an effect card for attachment (UI state only)
export function selectEffect(state: GameState, effectType: EffectType): GameState {
  if (state.routingContext) return state;
  if (effectType === 'stampeding-herd') return state; // Stampeding Herd is standalone

  const entry = state.clientDeck.find(e => e.type === effectType);
  if (!entry || entry.remaining <= 0) return state;

  // Toggle selection
  if (state.selectedEffect === effectType) {
    return { ...state, selectedEffect: null };
  }
  return { ...state, selectedEffect: effectType };
}

// Attach a selected effect to a request type in hand
export function attachEffect(state: GameState, requestType: RequestType): GameState {
  if (!state.selectedEffect) return state;
  if (state.routingContext) return state;

  const effectType = state.selectedEffect;

  // Validate the combination
  if (effectType === 'race-condition' && requestType !== 'hold-ticket') return state;
  if (effectType === 'payment-error' && requestType !== 'purchase-ticket') return state;

  // Check if the target request type has remaining cards
  const requestEntry = state.clientDeck.find(e => e.type === requestType);
  if (!requestEntry || requestEntry.remaining <= 0) return state;

  // Check how many attachments of this effect type already exist for this request type
  const existingAttachments = state.effectAttachments.filter(
    a => a.effectType === effectType && a.requestType === requestType,
  );

  // Race Condition needs 2 attachments total
  if (effectType === 'race-condition') {
    const totalRCAttachments = state.effectAttachments.filter(a => a.effectType === 'race-condition');
    if (totalRCAttachments.length >= 2) return state; // Already attached 2

    // Check we have enough hold-ticket cards for the attachments
    if (existingAttachments.length + 1 > requestEntry.remaining) return state;

    const newAttachments = [...state.effectAttachments, { effectType, requestType }];

    // If we now have 2 race-condition attachments, consume the card
    if (totalRCAttachments.length + 1 >= 2) {
      const deck = state.clientDeck.map(e => ({ ...e }));
      const rcEntry = deck.find(e => e.type === 'race-condition');
      if (rcEntry) rcEntry.remaining--;
      const turnState = { ...state.turnState, cardsPlayedThisTurn: state.turnState.cardsPlayedThisTurn + 1 };
      return { ...state, effectAttachments: newAttachments, selectedEffect: null, clientDeck: deck, turnState };
    }

    // Only 1 so far, keep selecting
    return { ...state, effectAttachments: newAttachments };
  }

  // Payment Error: 1 attachment, consume immediately
  if (effectType === 'payment-error') {
    const deck = state.clientDeck.map(e => ({ ...e }));
    const peEntry = deck.find(e => e.type === 'payment-error');
    if (peEntry) peEntry.remaining--;
    const turnState = { ...state.turnState, cardsPlayedThisTurn: state.turnState.cardsPlayedThisTurn + 1 };
    const newAttachments = [...state.effectAttachments, { effectType, requestType }];
    return { ...state, effectAttachments: newAttachments, selectedEffect: null, clientDeck: deck, turnState };
  }

  return state;
}

// Consume an attachment when a request is played (called by routing.ts)
export function consumeAttachment(state: GameState, requestType: RequestType): {
  effectType: EffectType | undefined;
  newAttachments: GameState['effectAttachments'];
} {
  const idx = state.effectAttachments.findIndex(a => a.requestType === requestType);
  if (idx === -1) return { effectType: undefined, newAttachments: state.effectAttachments };

  const attachment = state.effectAttachments[idx];
  const newAttachments = [...state.effectAttachments];
  newAttachments.splice(idx, 1);
  return { effectType: attachment.effectType, newAttachments };
}
