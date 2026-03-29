import type {
  GameState, ActiveRequest, RequestType, RoutingContext, RoutingStep,
} from '../types';
import {
  LB_THROUGHPUT_PER_TURN, REQUIRED_APP_FOR_REQUEST, REQUEST_TIMEOUT_TURNS,
  REQUEST_POINTS,
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
    // Find next available compute in rotation
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
    // Least connections: pick compute with fewest requests
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
  // Validate deck entry
  const deck = state.clientDeck.map(e => ({ ...e }));
  const entry = deck.find(e => e.type === requestType);
  if (!entry || entry.remaining <= 0) return state;
  if (state.turnState.cardsPlayedThisTurn >= state.turnState.cardLimit) return state;
  if (state.routingContext) return state; // Already routing

  entry.remaining--;

  const request: ActiveRequest = {
    id: nextRequestId(),
    type: requestType,
    location: 'lb-queue',
    turnPlayed: state.currentTurn,
    status: 'active',
  };

  const requests = [...state.requests, request];
  const turnState = {
    ...state.turnState,
    cardsPlayedThisTurn: state.turnState.cardsPlayedThisTurn + 1,
  };

  // Check LB throughput
  if (turnState.lbThroughputUsed >= LB_THROUGHPUT_PER_TURN) {
    const failedRequest = { ...request, status: 'failed' as const };
    const steps: RoutingStep[] = [
      { state: 'AT_LB', description: `${requestType} arrived at Load Balancer`, result: 'failed' },
    ];
    return {
      ...state,
      clientDeck: deck,
      requests: requests.filter(r => r.id !== request.id),
      failedRequests: [...state.failedRequests, failedRequest],
      turnState: { ...turnState, lbThroughputUsed: turnState.lbThroughputUsed + 1 },
      routingContext: {
        requestId: request.id,
        state: 'FAILED',
        validTargets: [],
        lbRecommendation: null,
        steps,
        nudgeMessage: 'Load Balancer throughput exceeded! Request failed.',
      },
    };
  }

  const newTurnState = { ...turnState, lbThroughputUsed: turnState.lbThroughputUsed + 1 };
  const newState = { ...state, clientDeck: deck, requests, turnState: newTurnState };

  // Get valid targets
  const validTargets = getValidComputeTargets(newState);
  const lbRecommendation = getLBRecommendation(newState, validTargets);

  const steps: RoutingStep[] = [
    { state: 'AT_LB', description: `${formatRequestName(requestType)} arrived at Load Balancer`, result: 'pending' },
  ];

  if (validTargets.length === 0) {
    // All compute full -> WAITING_AT_LB
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
          { state: 'AT_LB', description: `${formatRequestName(requestType)} arrived at Load Balancer`, result: 'success' },
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

  // Validate target
  const computeCard = state.board.find(c => c.instanceId === computeInstanceId);
  if (!computeCard) return state;

  const def = getCardDef(computeCard.cardId);
  if (def.type !== 'compute') return state;

  // Check capacity (recompute in case state changed)
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

  // Check for matching app
  const request = state.requests.find(r => r.id === ctx.requestId);
  if (!request) return state;

  const requiredApp = REQUIRED_APP_FOR_REQUEST[request.type];
  const appCards = getAppCardsOnCompute(state.board, computeInstanceId);
  const matchingAppInstance = appCards.find(appInstId => {
    const appCard = state.board.find(c => c.instanceId === appInstId);
    return appCard && appCard.cardId === requiredApp;
  });

  // Move request to compute
  const updatedRequests = state.requests.map(r =>
    r.id === ctx.requestId ? { ...r, location: computeInstanceId } : r,
  );

  // Update round-robin index
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
    // No matching app -> FAILED
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
        ],
      },
    };
  }

  // Has matching app -> AT_APP
  const appCard = state.board.find(c => c.instanceId === matchingAppInstance)!;
  const appStep: RoutingStep = {
    state: 'AT_APP',
    description: `Matched: ${getCardDef(appCard.cardId).name}`,
    cardInstanceId: matchingAppInstance,
    result: 'pending',
  };

  return {
    ...state,
    requests: updatedRequests,
    turnState: { ...state.turnState, roundRobinIndex: newRRIndex },
    routingContext: {
      ...ctx,
      state: 'AT_APP',
      computeNodeId: computeInstanceId,
      validTargets: [],
      nudgeMessage: null,
      steps: [
        ...ctx.steps.map(s => s.state === 'AT_LB' ? { ...s, result: 'success' as const } : s),
        computeStep,
        appStep,
      ],
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

  if (ctx.state === 'AT_APP') {
    return advanceFromApp(state, ctx);
  }

  if (ctx.state === 'AT_STORAGE') {
    return advanceFromStorage(state, ctx);
  }

  if (ctx.state === 'AT_PAYMENT') {
    // Park the request, clear routing context so player can play next card
    return { ...state, routingContext: null };
  }

  return state;
}

function advanceFromApp(state: GameState, ctx: RoutingContext): GameState {
  const request = state.requests.find(r => r.id === ctx.requestId);
  if (!request || !ctx.computeNodeId) return { ...state, routingContext: null };

  // Find storage connected to the matching app
  const appCards = getAppCardsOnCompute(state.board, ctx.computeNodeId);
  const requiredApp = REQUIRED_APP_FOR_REQUEST[request.type];
  const matchingAppInstance = appCards.find(appInstId => {
    const appCard = state.board.find(c => c.instanceId === appInstId);
    return appCard && appCard.cardId === requiredApp;
  });

  if (!matchingAppInstance) return { ...state, routingContext: null };

  const appCard = state.board.find(c => c.instanceId === matchingAppInstance);
  if (!appCard || appCard.connections.length === 0) {
    return { ...state, routingContext: null };
  }

  const storageInstanceId = appCard.connections[0];
  const storageCard = state.board.find(c => c.instanceId === storageInstanceId);
  if (!storageCard) return { ...state, routingContext: null };

  const storageDef = getCardDef(storageCard.cardId);
  const op = REQUEST_STORAGE_OP[request.type];

  const storageStep: RoutingStep = {
    state: 'AT_STORAGE',
    description: `${op === 'read' ? 'Reading from' : 'Writing to'} ${storageDef.name}`,
    cardInstanceId: storageInstanceId,
    result: 'pending',
  };

  return {
    ...state,
    routingContext: {
      ...ctx,
      state: 'AT_STORAGE',
      steps: [
        ...ctx.steps.map(s => s.state === 'AT_APP' ? { ...s, result: 'success' as const } : s),
        storageStep,
      ],
    },
  };
}

function advanceFromStorage(state: GameState, ctx: RoutingContext): GameState {
  const request = state.requests.find(r => r.id === ctx.requestId);
  if (!request || !ctx.computeNodeId) return { ...state, routingContext: null };

  // Find storage card from the last step
  const storageStep = ctx.steps.findLast(s => s.state === 'AT_STORAGE');
  if (!storageStep?.cardInstanceId) return { ...state, routingContext: null };

  const storageInstanceId = storageStep.cardInstanceId;
  const storageCard = state.board.find(c => c.instanceId === storageInstanceId);
  if (!storageCard) return { ...state, routingContext: null };

  const storageDef = getCardDef(storageCard.cardId);
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

  // Purchase Ticket -> AT_PAYMENT
  if (request.type === 'purchase-ticket') {
    const paymentStep: RoutingStep = {
      state: 'AT_PAYMENT',
      description: 'Payment processing (completes next turn)',
      result: 'pending',
    };

    const updatedSteps = ctx.steps.map(s =>
      s.state === 'AT_STORAGE' && s.result === 'pending'
        ? { ...s, result: 'success' as const, description: `${s.description} (${ops[op === 'read' ? 'reads' : 'writes']}/${op === 'read' ? storageDef.readsPerTurn : storageDef.writesPerTurn})` }
        : s
    );

    return {
      ...state,
      turnState: newTurnState,
      routingContext: {
        ...ctx,
        state: 'AT_PAYMENT',
        steps: [...updatedSteps, paymentStep],
        nudgeMessage: null,
      },
    };
  }

  // Non-purchase -> COMPLETED
  const completedRequest = { ...request, status: 'completed' as const };
  const points = request.effectAttached === 'payment-error' ? 0 : REQUEST_POINTS[request.type];

  const updatedSteps = ctx.steps.map(s =>
    s.state === 'AT_STORAGE' && s.result === 'pending'
      ? { ...s, result: 'success' as const, description: `${s.description} (${ops[op === 'read' ? 'reads' : 'writes']}/${op === 'read' ? storageDef.readsPerTurn : storageDef.writesPerTurn})` }
      : s
  );

  const completedStep: RoutingStep = {
    state: 'COMPLETED',
    description: `COMPLETED${points > 0 ? ` +${points} pt${points !== 1 ? 's' : ''}` : ''}`,
    result: 'success',
  };

  return {
    ...state,
    requests: state.requests.filter(r => r.id !== request.id),
    completedRequests: [...state.completedRequests, completedRequest],
    turnState: newTurnState,
    routingContext: {
      ...ctx,
      state: 'COMPLETED',
      steps: [...updatedSteps, completedStep],
      nudgeMessage: null,
    },
  };
}

function failRequest(
  state: GameState,
  ctx: RoutingContext,
  request: ActiveRequest,
  reason: string,
): GameState {
  const failedRequest = { ...request, status: 'failed' as const };

  const updatedSteps = ctx.steps.map(s =>
    s.state === 'AT_STORAGE' && s.result === 'pending'
      ? { ...s, result: 'failed' as const }
      : s
  );

  const failStep: RoutingStep = {
    state: 'FAILED',
    description: `FAILED: ${reason}`,
    result: 'failed',
  };

  return {
    ...state,
    requests: state.requests.filter(r => r.id !== request.id),
    failedRequests: [...state.failedRequests, failedRequest],
    routingContext: {
      ...ctx,
      state: 'FAILED',
      steps: [...updatedSteps, failStep],
      nudgeMessage: reason,
    },
  };
}

export function resolveCarryOver(state: GameState): GameState {
  let newState = { ...state };

  // Step 1: Auto-advance AT_PAYMENT requests to COMPLETED
  // Find requests that have been parked at payment service (purchase-ticket type
  // played in a previous turn)
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

  // Check timeouts
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

  // If any WAITING_AT_LB requests remain, create routing context for the first one
  const remainingWaiting = newState.requests.filter(r =>
    r.status === 'active' && r.location === 'lb-queue' && r.waitingSince != null,
  );

  if (remainingWaiting.length > 0) {
    const req = remainingWaiting[0];
    const validTargets = getValidComputeTargets(newState);
    const lbRecommendation = getLBRecommendation(newState, validTargets);

    if (validTargets.length === 0) {
      // Still full, keep waiting (will timeout next turn if still stuck)
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
