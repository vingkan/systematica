import type { GameState, EffectType } from '../types';

export function playEffect(
  state: GameState,
  effectType: EffectType,
  targets?: string[],
): GameState {
  const deck = state.clientDeck.map(e => ({ ...e }));
  const entry = deck.find(e => e.type === effectType);
  if (!entry || entry.remaining <= 0) return state;
  if (state.routingContext) return state; // Can't play effects during routing

  let newState = { ...state, clientDeck: deck };
  const turnState = { ...newState.turnState };

  switch (effectType) {
    case 'stampeding-herd':
      return playStampedingherd(newState, entry, turnState);
    case 'race-condition':
      return playRaceCondition(newState, entry, turnState, targets);
    case 'payment-error':
      return playPaymentError(newState, entry, turnState, targets);
    default:
      return state;
  }
}

function playStampedingherd(
  state: GameState,
  entry: { type: string; remaining: number },
  turnState: GameState['turnState'],
): GameState {
  if (turnState.cardsPlayedThisTurn > 0) return { ...state, clientDeck: state.clientDeck }; // Must be played first
  entry.remaining--;
  turnState.cardLimit += 10;
  turnState.cardsPlayedThisTurn++;
  return { ...state, turnState };
}

function playRaceCondition(
  state: GameState,
  entry: { type: string; remaining: number },
  turnState: GameState['turnState'],
  targets?: string[],
): GameState {
  if (!targets || targets.length !== 2) return { ...state, clientDeck: state.clientDeck };

  // v2: targets COMPLETED Hold Tickets (not active)
  const completedRequests = state.completedRequests.map(r => ({ ...r }));
  const validTargets = targets.filter(id => {
    const req = completedRequests.find(r => r.id === id);
    return req && req.type === 'hold-ticket';
  });
  if (validTargets.length !== 2) return { ...state, clientDeck: state.clientDeck };

  entry.remaining--;
  turnState.cardsPlayedThisTurn++;

  // Move targeted completed requests to failed
  const targeted = completedRequests.filter(r => validTargets.includes(r.id));
  for (const req of targeted) {
    req.status = 'failed';
    req.effectAttached = 'race-condition';
  }

  const remainingCompleted = completedRequests.filter(r => !validTargets.includes(r.id));
  const newFailed = [...state.failedRequests, ...targeted];

  return {
    ...state,
    completedRequests: remainingCompleted,
    failedRequests: newFailed,
    turnState,
  };
}

function playPaymentError(
  state: GameState,
  entry: { type: string; remaining: number },
  turnState: GameState['turnState'],
  targets?: string[],
): GameState {
  if (!targets || targets.length !== 1) return { ...state, clientDeck: state.clientDeck };

  // Can target active or completed purchase tickets
  let targetReq = state.requests.find(
    r => r.id === targets[0] && r.type === 'purchase-ticket' && r.status === 'active' && !r.effectAttached,
  );

  let requests = state.requests;
  let completedRequests = state.completedRequests;

  if (targetReq) {
    requests = state.requests.map(r =>
      r.id === targets[0] ? { ...r, effectAttached: 'payment-error' as const } : r,
    );
  } else {
    // Try completed requests
    const completedTarget = state.completedRequests.find(
      r => r.id === targets[0] && r.type === 'purchase-ticket' && !r.effectAttached,
    );
    if (!completedTarget) return { ...state, clientDeck: state.clientDeck };
    completedRequests = state.completedRequests.map(r =>
      r.id === targets[0] ? { ...r, effectAttached: 'payment-error' as const } : r,
    );
  }

  entry.remaining--;
  turnState.cardsPlayedThisTurn++;

  return { ...state, requests, completedRequests, turnState };
}
