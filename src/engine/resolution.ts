import type {
  GameState, ActiveRequest, RequestType, EffectType,
} from '../types';
import {
  LB_THROUGHPUT_PER_TURN, REQUIRED_APP_FOR_REQUEST, REQUEST_TIMEOUT_TURNS,
} from '../types';
import { getCardDef, REQUEST_STORAGE_OP } from '../cards';
import { getNetworkCard, getComputeCards, getAppCardsOnCompute } from './build';

let requestIdCounter = 0;

export function resetRequestIdCounter(): void {
  requestIdCounter = 0;
}

function nextRequestId(): string {
  return `req-${++requestIdCounter}`;
}

function countRequestsOnCard(requests: ActiveRequest[], instanceId: string): number {
  return requests.filter(r => r.location === instanceId && r.status === 'active').length;
}

export function playRequest(state: GameState, requestType: RequestType): GameState {
  const newState = { ...state };
  const deck = newState.clientDeck.map(e => ({ ...e }));
  const entry = deck.find(e => e.type === requestType);
  if (!entry || entry.remaining <= 0) return state;
  if (newState.turnState.cardsPlayedThisTurn >= newState.turnState.cardLimit) return state;

  entry.remaining--;

  const request: ActiveRequest = {
    id: nextRequestId(),
    type: requestType,
    location: 'lb-queue',
    turnPlayed: newState.currentTurn,
    status: 'active',
  };

  const requests = [...newState.requests, request];
  const turnState = {
    ...newState.turnState,
    cardsPlayedThisTurn: newState.turnState.cardsPlayedThisTurn + 1,
  };

  // Attempt to route immediately
  const routedState = routeFromLB({ ...newState, requests, clientDeck: deck, turnState });
  return routedState;
}

export function playEffect(
  state: GameState,
  effectType: EffectType,
  targets?: string[],
): GameState {
  const deck = state.clientDeck.map(e => ({ ...e }));
  const entry = deck.find(e => e.type === effectType);
  if (!entry || entry.remaining <= 0) return state;

  let newState = { ...state, clientDeck: deck };
  const turnState = { ...newState.turnState };

  switch (effectType) {
    case 'stampeding-herd': {
      if (turnState.cardsPlayedThisTurn > 0) return state; // Must be played first
      entry.remaining--;
      turnState.cardLimit += 10;
      turnState.cardsPlayedThisTurn++;
      return { ...newState, turnState };
    }

    case 'race-condition': {
      if (!targets || targets.length !== 2) return state;
      const requests = newState.requests.map(r => ({ ...r }));
      const validTargets = targets.filter(id => {
        const req = requests.find(r => r.id === id);
        return req && req.type === 'hold-ticket' && req.status === 'active';
      });
      if (validTargets.length !== 2) return state;

      entry.remaining--;
      turnState.cardsPlayedThisTurn++;
      for (const targetId of validTargets) {
        const req = requests.find(r => r.id === targetId)!;
        req.status = 'failed';
        req.effectAttached = 'race-condition';
      }

      const failedRequests = [
        ...newState.failedRequests,
        ...requests.filter(r => validTargets.includes(r.id)),
      ];
      const activeRequests = requests.filter(r => !validTargets.includes(r.id));

      return { ...newState, requests: activeRequests, failedRequests, turnState };
    }

    case 'payment-error': {
      if (!targets || targets.length !== 1) return state;
      const requests = newState.requests.map(r => ({ ...r }));
      const target = requests.find(
        r => r.id === targets[0] && r.type === 'purchase-ticket' && r.status === 'active',
      );
      if (!target) return state;

      entry.remaining--;
      turnState.cardsPlayedThisTurn++;
      target.effectAttached = 'payment-error';

      return { ...newState, requests, turnState };
    }

    default:
      return state;
  }
}

function routeFromLB(state: GameState): GameState {
  const lb = getNetworkCard(state.board);
  if (!lb) return state;

  const lbDef = getCardDef(lb.cardId);
  let requests = state.requests.map(r => ({ ...r }));
  let turnState = { ...state.turnState };

  // Find all requests at LB queue
  const atLB = requests.filter(r => r.location === 'lb-queue' && r.status === 'active');

  for (const req of atLB) {
    if (turnState.lbThroughputUsed >= LB_THROUGHPUT_PER_TURN) {
      // LB throughput exceeded, request fails
      req.status = 'failed';
      continue;
    }

    turnState.lbThroughputUsed++;

    // Route to compute
    const computeCards = getComputeCards(state.board).filter(c =>
      lb.connections.includes(c.instanceId),
    );

    if (computeCards.length === 0) {
      req.status = 'failed';
      continue;
    }

    let targetCompute: string | null = null;

    if (lbDef.lbAlgorithm === 'round-robin') {
      // Try each compute card in rotation
      for (let i = 0; i < computeCards.length; i++) {
        const idx = (turnState.roundRobinIndex + i) % computeCards.length;
        const candidate = computeCards[idx];
        const def = getCardDef(candidate.cardId);
        const currentLoad = countRequestsOnCard(requests, candidate.instanceId);
        if (def.capacity && currentLoad < def.capacity) {
          targetCompute = candidate.instanceId;
          turnState.roundRobinIndex = (idx + 1) % computeCards.length;
          break;
        }
      }
      if (!targetCompute) {
        // All compute full, advance round robin anyway
        turnState.roundRobinIndex = (turnState.roundRobinIndex + 1) % computeCards.length;
      }
    } else {
      // Least connections: pick compute with fewest requests
      let minLoad = Infinity;
      for (const c of computeCards) {
        const def = getCardDef(c.cardId);
        const load = countRequestsOnCard(requests, c.instanceId);
        if (def.capacity && load < def.capacity && load < minLoad) {
          minLoad = load;
          targetCompute = c.instanceId;
        }
      }
    }

    if (targetCompute) {
      req.location = targetCompute;
    }
    // If no compute available, request stays at lb-queue
  }

  return { ...state, requests, turnState };
}

export function resolveActiveRequests(state: GameState): GameState {
  let requests = state.requests.map(r => ({ ...r }));
  const completedRequests = [...state.completedRequests];
  const failedRequests = [...state.failedRequests];
  const turnState = { ...state.turnState };
  const storageOps = { ...turnState.storageOps };

  // Process requests on compute cards (try to advance to storage)
  for (const req of requests) {
    if (req.status !== 'active') continue;
    if (req.location === 'lb-queue') continue;

    const computeCard = state.board.find(c => c.instanceId === req.location);
    if (!computeCard) continue;
    const computeDef = getCardDef(computeCard.cardId);
    if (computeDef.type !== 'compute') continue;

    // Find matching app card on this compute
    const appCards = getAppCardsOnCompute(state.board, computeCard.instanceId);
    const requiredApp = REQUIRED_APP_FOR_REQUEST[req.type];
    const matchingAppInstance = appCards.find(appInstId => {
      const appCard = state.board.find(c => c.instanceId === appInstId);
      return appCard && appCard.cardId === requiredApp;
    });

    if (!matchingAppInstance) continue; // No matching app, request waits

    // Find storage connected to this app
    const appCard = state.board.find(c => c.instanceId === matchingAppInstance);
    if (!appCard || appCard.connections.length === 0) continue;

    const storageInstanceId = appCard.connections[0];
    const storageCard = state.board.find(c => c.instanceId === storageInstanceId);
    if (!storageCard) continue;

    const storageDef = getCardDef(storageCard.cardId);
    const op = REQUEST_STORAGE_OP[req.type];

    // Check storage throughput
    if (!storageOps[storageInstanceId]) {
      storageOps[storageInstanceId] = { reads: 0, writes: 0 };
    }
    const ops = storageOps[storageInstanceId];

    if (op === 'read') {
      if (storageDef.readsPerTurn && ops.reads >= storageDef.readsPerTurn) continue;
      ops.reads++;
    } else {
      if (storageDef.writesPerTurn && ops.writes >= storageDef.writesPerTurn) continue;
      ops.writes++;
    }

    // Success: request completed
    req.status = 'completed';
    completedRequests.push({ ...req });
  }

  // Check timeouts
  for (const req of requests) {
    if (req.status !== 'active') continue;
    if (state.currentTurn - req.turnPlayed >= REQUEST_TIMEOUT_TURNS) {
      req.status = 'failed';
      failedRequests.push({ ...req });
    }
  }

  // Remove completed and failed from active
  const activeRequests = requests.filter(r => r.status === 'active');

  // Re-route requests still at LB
  const stateAfterResolve: GameState = {
    ...state,
    requests: activeRequests,
    completedRequests,
    failedRequests,
    turnState: { ...turnState, storageOps },
  };

  return routeFromLB(stateAfterResolve);
}
