import type {
  GameState, ActiveRequest, RequestType, RoutingContext, RoutingStep,
} from '../types';
import {
  LB_THROUGHPUT_PER_TURN, REQUIRED_APP_FOR_REQUEST, REQUEST_TIMEOUT_TURNS,
  REQUEST_POINTS,
} from '../types';
import { getCardDef, REQUEST_STORAGE_OP } from '../cards';
import { getNetworkCard, getComputeCards, getAppCardsOnCompute } from './build';
import { consumeAttachment } from './effects';

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

export function getValidComputeTargets(state: GameState): string[] {
  const lb = getNetworkCard(state.board);
  if (!lb) return [];

  const computeCards = getComputeCards(state.board).filter(c =>
    lb.connections.includes(c.instanceId),
  );

  return computeCards.filter(c => {
    const def = getCardDef(c.cardId);
    const load = countRequestsOnCard(state.requests, c.instanceId);
    return def.capacity != null && load < def.capacity;
  }).map(c => c.instanceId);
}

export function getLBRecommendation(
  state: GameState,
  computeTargets: string[],
): string | null {
  if (computeTargets.length === 0) return null;

  const lb = getNetworkCard(state.board);
  if (!lb) return null;

  const lbDef = getCardDef(lb.cardId);
  const computeCards = getComputeCards(state.board).filter(c =>
    computeTargets.includes(c.instanceId),
  );

  if (lbDef.lbAlgorithm === 'round-robin') {
    const allCompute = getComputeCards(state.board).filter(c =>
      lb.connections.includes(c.instanceId),
    );
    for (let i = 0; i < allCompute.length; i++) {
      const idx = (state.turnState.roundRobinIndex + i) % allCompute.length;
      const candidate = allCompute[idx];
      if (computeTargets.includes(candidate.instanceId)) {
        return candidate.instanceId;
      }
    }
    return computeTargets[0];
  } else {
    let minLoad = Infinity;
    let best: string | null = null;
    for (const c of computeCards) {
      const load = countRequestsOnCard(state.requests, c.instanceId);
      if (load < minLoad) {
        minLoad = load;
        best = c.instanceId;
      }
    }
    return best;
  }
}

export function createRoutingContext(
  state: GameState,
  requestType: RequestType,
): GameState {
  const deck = state.clientDeck.map(e => ({ ...e }));
  const entry = deck.find(e => e.type === requestType);
  if (!entry || entry.remaining <= 0) return state;
  if (state.turnState.cardsPlayedThisTurn >= state.turnState.cardLimit) return state;
  if (state.routingContext) return state;

  entry.remaining--;

  // Check for attached effect
  const { effectType: attachedEffect, newAttachments } = consumeAttachment(state, requestType);

  const request: ActiveRequest = {
    id: nextRequestId(),
    type: requestType,
    location: 'lb-queue',
    turnPlayed: state.currentTurn,
    status: 'active',
    effectAttached: attachedEffect,
  };

  const requests = [...state.requests, request];
  const turnState = {
    ...state.turnState,
    cardsPlayedThisTurn: state.turnState.cardsPlayedThisTurn + 1,
  };

  const effectLabel = attachedEffect ? ` (${formatEffectName(attachedEffect)} attached)` : '';

  // Check LB throughput
  if (turnState.lbThroughputUsed >= LB_THROUGHPUT_PER_TURN) {
    const failedRequest = { ...request, status: 'failed' as const };
    return {
      ...state,
      clientDeck: deck,
      effectAttachments: newAttachments,
      selectedEffect: null,
      requests: requests.filter(r => r.id !== request.id),
      failedRequests: [...state.failedRequests, failedRequest],
      turnState: { ...turnState, lbThroughputUsed: turnState.lbThroughputUsed + 1 },
      routingContext: {
        requestId: request.id,
        state: 'FAILED',
        validTargets: [],
        lbRecommendation: null,
        steps: [
          { state: 'AT_LB', description: `${formatRequestName(requestType)}${effectLabel} arrived at Load Balancer`, result: 'failed' },
          { state: 'FAILED', description: 'FAILED: LB throughput exceeded | 0 pts', result: 'failed' },
        ],
        nudgeMessage: 'Load Balancer throughput exceeded! Request failed.',
      },
    };
  }

  const newTurnState = { ...turnState, lbThroughputUsed: turnState.lbThroughputUsed + 1 };
  const newState = { ...state, clientDeck: deck, effectAttachments: newAttachments, selectedEffect: null, requests, turnState: newTurnState };

  const validTargets = getValidComputeTargets(newState);
  const lbRecommendation = getLBRecommendation(newState, validTargets);

  const steps: RoutingStep[] = [
    { state: 'AT_LB', description: `${formatRequestName(requestType)}${effectLabel} arrived at Load Balancer`, result: 'pending' },
  ];

  if (validTargets.length === 0) {
    const waitingRequest = { ...request, location: 'lb-queue', waitingSince: state.currentTurn };
    return {
      ...newState,
      requests: newState.requests.map(r => r.id === request.id ? waitingRequest : r),
      routingContext: {
        requestId: request.id,
        state: 'WAITING_AT_LB',
        validTargets: [],
        lbRecommendation: null,
        steps: [
          { state: 'AT_LB', description: `${formatRequestName(requestType)}${effectLabel} arrived at Load Balancer`, result: 'success' },
          { state: 'WAITING_AT_LB', description: 'All compute nodes full. Queued until next turn.', result: 'pending' },
        ],
        nudgeMessage: 'All compute nodes are full. This request stays queued at the Load Balancer.',
      },
    };
  }

  return {
    ...newState,
    routingContext: {
      requestId: request.id,
      state: 'AT_LB',
      validTargets,
      lbRecommendation,
      steps,
      nudgeMessage: null,
    },
  };
}

export function routeToCompute(
  state: GameState,
  computeInstanceId: string,
): GameState {
  const ctx = state.routingContext;
  if (!ctx || ctx.state !== 'AT_LB') return state;

  const computeCard = state.board.find(c => c.instanceId === computeInstanceId);
  if (!computeCard) return state;

  const def = getCardDef(computeCard.cardId);
  if (def.type !== 'compute') return state;

  const load = countRequestsOnCard(state.requests, computeInstanceId);
  if (def.capacity != null && load >= def.capacity) {
    return {
      ...state,
      routingContext: {
        ...ctx,
        nudgeMessage: `${def.name} is at capacity (${load}/${def.capacity}). Choose a node with room.`,
      },
    };
  }

  const request = state.requests.find(r => r.id === ctx.requestId);
  if (!request) return state;

  const requiredApp = REQUIRED_APP_FOR_REQUEST[request.type];
  const appCards = getAppCardsOnCompute(state.board, computeInstanceId);
  const matchingAppInstance = appCards.find(appInstId => {
    const appCard = state.board.find(c => c.instanceId === appInstId);
    return appCard && appCard.cardId === requiredApp;
  });

  const updatedRequests = state.requests.map(r =>
    r.id === ctx.requestId ? { ...r, location: computeInstanceId } : r,
  );

  const lb = getNetworkCard(state.board);
  const allCompute = lb ? getComputeCards(state.board).filter(c => lb.connections.includes(c.instanceId)) : [];
  const computeIdx = allCompute.findIndex(c => c.instanceId === computeInstanceId);
  const newRRIndex = computeIdx >= 0 ? (computeIdx + 1) % allCompute.length : state.turnState.roundRobinIndex;

  const computeStep: RoutingStep = {
    state: 'AT_COMPUTE',
    description: `Routed to ${def.name} (${load + 1}/${def.capacity})`,
    cardInstanceId: computeInstanceId,
    result: 'success',
  };

  if (!matchingAppInstance) {
    const failedRequest = { ...request, location: computeInstanceId, status: 'failed' as const };
    const appStep: RoutingStep = {
      state: 'AT_COMPUTE',
      description: `No matching app: needs ${requiredApp}`,
      cardInstanceId: computeInstanceId,
      result: 'failed',
    };
    return {
      ...state,
      requests: updatedRequests.filter(r => r.id !== ctx.requestId),
      failedRequests: [...state.failedRequests, failedRequest],
      turnState: { ...state.turnState, roundRobinIndex: newRRIndex },
      routingContext: {
        ...ctx,
        state: 'FAILED',
        computeNodeId: computeInstanceId,
        validTargets: [],
        nudgeMessage: `This node doesn't have ${requiredApp}. The request needs that app to process.`,
        steps: [
          ...ctx.steps.map(s => s.state === 'AT_LB' ? { ...s, result: 'success' as const } : s),
          computeStep,
          appStep,
          { state: 'FAILED', description: 'FAILED: no matching app | 0 pts', result: 'failed' },
        ],
      },
    };
  }

  // Has matching app -> AT_APP (now interactive: player picks storage)
  const appCard = state.board.find(c => c.instanceId === matchingAppInstance)!;
  const appDef = getCardDef(appCard.cardId);

  // Find valid storage targets connected to this app
  const storageTargets = appCard.connections.filter(connId => {
    const card = state.board.find(c => c.instanceId === connId);
    return card && getCardDef(card.cardId).type === 'storage';
  });

  const appStep: RoutingStep = {
    state: 'AT_APP',
    description: `Matched: ${appDef.name}`,
    cardInstanceId: matchingAppInstance,
    result: 'success',
  };

  const op = REQUEST_STORAGE_OP[request.type];
  const storagePrompt = storageTargets.length > 0
    ? `Select storage for ${op === 'read' ? 'read' : 'write'} operation`
    : null;

  return {
    ...state,
    requests: updatedRequests,
    turnState: { ...state.turnState, roundRobinIndex: newRRIndex },
    routingContext: {
      ...ctx,
      state: 'AT_APP',
      computeNodeId: computeInstanceId,
      validTargets: storageTargets,
      nudgeMessage: storagePrompt,
      steps: [
        ...ctx.steps.map(s => s.state === 'AT_LB' ? { ...s, result: 'success' as const } : s),
        computeStep,
        appStep,
      ],
    },
  };
}

// New: player clicks a storage card after app match
export function routeToStorage(
  state: GameState,
  storageInstanceId: string,
): GameState {
  const ctx = state.routingContext;
  if (!ctx || ctx.state !== 'AT_APP') return state;

  const request = state.requests.find(r => r.id === ctx.requestId);
  if (!request) return state;

  const storageCard = state.board.find(c => c.instanceId === storageInstanceId);
  if (!storageCard) return state;

  const storageDef = getCardDef(storageCard.cardId);
  if (storageDef.type !== 'storage') return state;

  // Validate it's a valid target
  if (!ctx.validTargets.includes(storageInstanceId)) {
    return {
      ...state,
      routingContext: {
        ...ctx,
        nudgeMessage: `${storageDef.name} is not connected to this app. Choose a highlighted storage card.`,
      },
    };
  }

  const op = REQUEST_STORAGE_OP[request.type];

  // Check storage throughput
  const storageOps = { ...state.turnState.storageOps };
  if (!storageOps[storageInstanceId]) {
    storageOps[storageInstanceId] = { reads: 0, writes: 0 };
  }
  const ops = { ...storageOps[storageInstanceId] };

  if (op === 'read') {
    if (storageDef.readsPerTurn && ops.reads >= storageDef.readsPerTurn) {
      return failRequest(state, ctx, request,
        `Storage read limit reached: ${ops.reads}/${storageDef.readsPerTurn} reads used this turn`);
    }
    ops.reads++;
  } else {
    if (storageDef.writesPerTurn && ops.writes >= storageDef.writesPerTurn) {
      return failRequest(state, ctx, request,
        `Storage write limit reached: ${ops.writes}/${storageDef.writesPerTurn} writes used this turn`);
    }
    ops.writes++;
  }

  storageOps[storageInstanceId] = ops;
  const newTurnState = { ...state.turnState, storageOps };

  const opsUsed = op === 'read' ? ops.reads : ops.writes;
  const opsMax = op === 'read' ? storageDef.readsPerTurn : storageDef.writesPerTurn;
  const storageStep: RoutingStep = {
    state: 'AT_STORAGE',
    description: `${op === 'read' ? 'Read from' : 'Wrote to'} ${storageDef.name} (${opsUsed}/${opsMax})`,
    cardInstanceId: storageInstanceId,
    result: 'success',
  };

  // Purchase Ticket -> AT_PAYMENT
  if (request.type === 'purchase-ticket') {
    const paymentStep: RoutingStep = {
      state: 'AT_PAYMENT',
      description: 'Payment processing (completes next turn)',
      result: 'pending',
    };

    const effectNote = request.effectAttached === 'payment-error' ? ' | Payment Error: will earn 0 pts' : ' | +5 pts when complete';

    return {
      ...state,
      turnState: newTurnState,
      routingContext: {
        ...ctx,
        state: 'AT_PAYMENT',
        validTargets: [],
        steps: [...ctx.steps, storageStep, { ...paymentStep, description: paymentStep.description + effectNote }],
        nudgeMessage: null,
      },
    };
  }

  // Non-purchase -> COMPLETED
  const completedRequest = { ...request, status: 'completed' as const };
  const basePoints = REQUEST_POINTS[request.type];
  const actualPoints = request.effectAttached === 'payment-error' ? 0 : basePoints;
  const effectNote = request.effectAttached === 'race-condition'
    ? ' | Race Condition: 0 pts'
    : request.effectAttached === 'payment-error'
      ? ' | Payment Error: 0 pts'
      : '';

  const pointsDesc = actualPoints > 0 ? `+${actualPoints} pt${actualPoints !== 1 ? 's' : ''}` : `${basePoints} pts`;

  const completedStep: RoutingStep = {
    state: 'COMPLETED',
    description: `COMPLETED | ${pointsDesc}${effectNote}`,
    result: request.effectAttached === 'race-condition' ? 'failed' : 'success',
  };

  // Race Condition: auto-fail on completion
  if (request.effectAttached === 'race-condition') {
    const failedRequest = { ...request, status: 'failed' as const };
    return {
      ...state,
      requests: state.requests.filter(r => r.id !== request.id),
      failedRequests: [...state.failedRequests, failedRequest],
      turnState: newTurnState,
      routingContext: {
        ...ctx,
        state: 'COMPLETED',
        validTargets: [],
        steps: [...ctx.steps, storageStep, { ...completedStep, description: 'FAILED | Race Condition: consistency error | 0 pts', state: 'FAILED', result: 'failed' }],
        nudgeMessage: 'Race Condition triggered! Request failed due to consistency error.',
      },
    };
  }

  return {
    ...state,
    requests: state.requests.filter(r => r.id !== request.id),
    completedRequests: [...state.completedRequests, completedRequest],
    turnState: newTurnState,
    routingContext: {
      ...ctx,
      state: 'COMPLETED',
      validTargets: [],
      steps: [...ctx.steps, storageStep, completedStep],
      nudgeMessage: null,
    },
  };
}

export function advanceRouting(state: GameState): GameState {
  const ctx = state.routingContext;
  if (!ctx) return state;

  // Terminal states -> clear routing context
  if (ctx.state === 'COMPLETED' || ctx.state === 'FAILED' || ctx.state === 'WAITING_AT_LB') {
    return { ...state, routingContext: null };
  }

  if (ctx.state === 'AT_PAYMENT') {
    // Park the request, clear routing context
    return { ...state, routingContext: null };
  }

  // AT_APP and AT_STORAGE are now interactive (player picks storage)
  // so advanceRouting shouldn't auto-advance them
  return state;
}

function failRequest(
  state: GameState,
  ctx: RoutingContext,
  request: ActiveRequest,
  reason: string,
): GameState {
  const failedRequest = { ...request, status: 'failed' as const };

  const failStep: RoutingStep = {
    state: 'FAILED',
    description: `FAILED: ${reason} | 0 pts`,
    result: 'failed',
  };

  return {
    ...state,
    requests: state.requests.filter(r => r.id !== request.id),
    failedRequests: [...state.failedRequests, failedRequest],
    routingContext: {
      ...ctx,
      state: 'FAILED',
      validTargets: [],
      steps: [...ctx.steps, failStep],
      nudgeMessage: reason,
    },
  };
}

export function resolveCarryOver(state: GameState): GameState {
  let newState = { ...state };

  // Step 1: Auto-advance AT_PAYMENT requests to COMPLETED
  const atPayment = newState.requests.filter(r =>
    r.status === 'active' && r.type === 'purchase-ticket' && r.turnPlayed < newState.currentTurn,
  );

  for (const req of atPayment) {
    const completedReq = { ...req, status: 'completed' as const };
    newState = {
      ...newState,
      requests: newState.requests.filter(r => r.id !== req.id),
      completedRequests: [...newState.completedRequests, completedReq],
    };
  }

  // Step 2: Handle WAITING_AT_LB requests
  const waiting = newState.requests.filter(r =>
    r.status === 'active' && r.location === 'lb-queue' && r.waitingSince != null,
  );

  for (const req of waiting) {
    if (req.waitingSince != null && newState.currentTurn - req.waitingSince >= REQUEST_TIMEOUT_TURNS) {
      const failedReq = { ...req, status: 'failed' as const };
      newState = {
        ...newState,
        requests: newState.requests.filter(r => r.id !== req.id),
        failedRequests: [...newState.failedRequests, failedReq],
      };
    }
  }

  const remainingWaiting = newState.requests.filter(r =>
    r.status === 'active' && r.location === 'lb-queue' && r.waitingSince != null,
  );

  if (remainingWaiting.length > 0) {
    const req = remainingWaiting[0];
    const validTargets = getValidComputeTargets(newState);
    const lbRecommendation = getLBRecommendation(newState, validTargets);

    if (validTargets.length === 0) {
      return newState;
    }

    return {
      ...newState,
      routingContext: {
        requestId: req.id,
        state: 'AT_LB',
        validTargets,
        lbRecommendation,
        steps: [
          { state: 'AT_LB', description: `${formatRequestName(req.type)} re-entering from queue`, result: 'pending' },
        ],
        nudgeMessage: null,
      },
    };
  }

  return newState;
}

function formatRequestName(type: RequestType): string {
  const names: Record<RequestType, string> = {
    'view-event': 'View Event',
    'hold-ticket': 'Hold Ticket',
    'purchase-ticket': 'Purchase Ticket',
  };
  return names[type] || type;
}

function formatEffectName(type: string): string {
  const names: Record<string, string> = {
    'race-condition': 'Race Condition',
    'payment-error': 'Payment Error',
    'stampeding-herd': 'Stampeding Herd',
  };
  return names[type] || type;
}
