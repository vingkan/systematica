import type { GameState, PlacedCard, ResolutionResult, RoutingStep, EffectType, RequestType } from './types';
import { REQUIRED_APP_FOR_REQUEST } from './types';
import { getCardDef, getClientCardDef } from './cards';

function getNetworkCard(board: PlacedCard[]): PlacedCard | undefined {
  return board.find(c => getCardDef(c.cardId).type === 'network');
}

function getComputeCards(board: PlacedCard[]): PlacedCard[] {
  return board.filter(c => getCardDef(c.cardId).type === 'compute');
}

function findAppOnCompute(board: PlacedCard[], computeInstanceId: string, appCardId: string): PlacedCard | undefined {
  return board.find(c => {
    const def = getCardDef(c.cardId);
    return def.type === 'application' && c.cardId === appCardId && c.connections.includes(computeInstanceId);
  });
}

function findStorageForApp(board: PlacedCard[], appCard: PlacedCard): PlacedCard | undefined {
  for (const connId of appCard.connections) {
    const card = board.find(c => c.instanceId === connId);
    if (card && getCardDef(card.cardId).type === 'storage') {
      return card;
    }
  }
  return undefined;
}

function selectComputeTarget(
  state: GameState,
  lb: PlacedCard,
  computeCards: PlacedCard[],
): PlacedCard | undefined {
  const connectedCompute = computeCards.filter(c => lb.connections.includes(c.instanceId));
  if (connectedCompute.length === 0) return undefined;

  const lbDef = getCardDef(lb.cardId);

  if (lbDef.lbAlgorithm === 'round-robin') {
    const idx = state.roundRobinIndex % connectedCompute.length;
    return connectedCompute[idx];
  }

  // least-connections: pick compute with most free capacity
  let bestCard: PlacedCard | undefined;
  let bestFree = -1;
  for (const c of connectedCompute) {
    const def = getCardDef(c.cardId);
    const free = (def.capacity ?? 0) - c.currentLoad;
    if (free > bestFree) {
      bestFree = free;
      bestCard = c;
    }
  }
  return bestCard;
}

export function computeRoutingPath(
  state: GameState,
  requestType: RequestType,
  volume: number,
  effects: EffectType[],
): { result: ResolutionResult; boardUpdates: Map<string, number>; newRoundRobinIndex: number } {
  const steps: RoutingStep[] = [];
  const boardUpdates = new Map<string, number>(); // instanceId -> load delta
  let fulfilled = 0;
  let unfulfilled = 0;
  let costIncurred = 0;

  const requiredApp = REQUIRED_APP_FOR_REQUEST[requestType];
  const clientDef = getClientCardDef(requestType);
  const baseValuePerReq = clientDef.valuePerRequest ?? 0;

  // Step 1: Network (LB)
  const lb = getNetworkCard(state.board);
  if (!lb) {
    unfulfilled = volume;
    return {
      result: {
        steps: [{ layer: 'network', cardInstanceId: '', volumeThrough: 0, volumeStopped: volume, description: 'No load balancer on board' }],
        fulfilledVolume: 0, unfulfilledVolume: volume,
        consistencyGained: 0, availabilityGained: 0, availabilityLost: 0,
        costIncurred: 0, requestsCounted: volume,
      },
      boardUpdates,
      newRoundRobinIndex: state.roundRobinIndex,
    };
  }

  const lbDef = getCardDef(lb.cardId);
  const lbCapacity = lbDef.capacity ?? Infinity;
  const lbCurrentLoad = lb.currentLoad + (boardUpdates.get(lb.instanceId) ?? 0);
  const lbFree = Math.max(0, lbCapacity - lbCurrentLoad);
  const volumeEnteringLB = Math.min(volume, lbFree);
  const volumeStoppedAtLB = volume - volumeEnteringLB;

  if (volumeStoppedAtLB > 0) {
    unfulfilled += volumeStoppedAtLB;
  }

  steps.push({
    layer: 'network',
    cardInstanceId: lb.instanceId,
    volumeThrough: volumeEnteringLB,
    volumeStopped: volumeStoppedAtLB,
    description: volumeStoppedAtLB > 0
      ? `${lb.instanceId}: ${volumeEnteringLB}/${volume} requests entered (LB at ${lbCurrentLoad + volumeEnteringLB}/${lbCapacity})`
      : `${lb.instanceId}: ${volumeEnteringLB} requests entered`,
  });

  boardUpdates.set(lb.instanceId, (boardUpdates.get(lb.instanceId) ?? 0) + volumeEnteringLB);

  if (volumeEnteringLB === 0) {
    return {
      result: {
        steps, fulfilledVolume: 0, unfulfilledVolume: volume,
        consistencyGained: 0, availabilityGained: 0, availabilityLost: 0,
        costIncurred: 0, requestsCounted: volume,
      },
      boardUpdates,
      newRoundRobinIndex: state.roundRobinIndex,
    };
  }

  // Step 2: Compute
  const computeCards = getComputeCards(state.board);
  const compute = selectComputeTarget(state, lb, computeCards);

  let newRRIndex = state.roundRobinIndex;
  if (lbDef.lbAlgorithm === 'round-robin') {
    const connected = computeCards.filter(c => lb.connections.includes(c.instanceId));
    newRRIndex = (state.roundRobinIndex + 1) % Math.max(1, connected.length);
  }

  if (!compute) {
    unfulfilled += volumeEnteringLB;
    // Unfulfilled volume stops at LB (already counted in LB load)
    steps.push({
      layer: 'compute',
      cardInstanceId: '',
      volumeThrough: 0,
      volumeStopped: volumeEnteringLB,
      description: 'No compute nodes connected to LB',
    });
    return {
      result: {
        steps, fulfilledVolume: 0, unfulfilledVolume: volume,
        consistencyGained: 0, availabilityGained: 0, availabilityLost: 0,
        costIncurred: 0, requestsCounted: volume,
      },
      boardUpdates,
      newRoundRobinIndex: newRRIndex,
    };
  }

  const computeDef = getCardDef(compute.cardId);
  const computeCapacity = computeDef.capacity ?? Infinity;
  const computeCurrentLoad = compute.currentLoad + (boardUpdates.get(compute.instanceId) ?? 0);
  const computeFree = Math.max(0, computeCapacity - computeCurrentLoad);
  const volumeEnteringCompute = Math.min(volumeEnteringLB, computeFree);
  const volumeStoppedAtCompute = volumeEnteringLB - volumeEnteringCompute;

  if (volumeStoppedAtCompute > 0) {
    unfulfilled += volumeStoppedAtCompute;
    // Stopped volume stays at LB (already in LB load from step 1)
  }

  steps.push({
    layer: 'compute',
    cardInstanceId: compute.instanceId,
    volumeThrough: volumeEnteringCompute,
    volumeStopped: volumeStoppedAtCompute,
    description: volumeStoppedAtCompute > 0
      ? `${computeDef.name}: ${volumeEnteringCompute}/${volumeEnteringLB} requests (${volumeStoppedAtCompute} stopped at LB)`
      : `${computeDef.name}: ${volumeEnteringCompute} requests routed`,
  });

  boardUpdates.set(compute.instanceId, (boardUpdates.get(compute.instanceId) ?? 0) + volumeEnteringCompute);

  if (volumeEnteringCompute === 0) {
    return {
      result: {
        steps, fulfilledVolume: 0, unfulfilledVolume: volume,
        consistencyGained: 0, availabilityGained: 0, availabilityLost: 0,
        costIncurred: 0, requestsCounted: volume,
      },
      boardUpdates,
      newRoundRobinIndex: newRRIndex,
    };
  }

  // Per-request cost for compute (cloud functions)
  if (computeDef.costPerRequest) {
    costIncurred += computeDef.costPerRequest * volumeEnteringCompute;
  }

  // Step 3: Application
  const appCard = findAppOnCompute(state.board, compute.instanceId, requiredApp);

  if (!appCard) {
    unfulfilled += volumeEnteringCompute;
    steps.push({
      layer: 'application',
      cardInstanceId: '',
      volumeThrough: 0,
      volumeStopped: volumeEnteringCompute,
      description: `No ${requiredApp} app on ${computeDef.name}. Requests stop at compute.`,
    });
    return {
      result: {
        steps, fulfilledVolume: 0, unfulfilledVolume: volume,
        consistencyGained: 0, availabilityGained: 0, availabilityLost: 0,
        costIncurred, requestsCounted: volume,
      },
      boardUpdates,
      newRoundRobinIndex: newRRIndex,
    };
  }

  const appDef = getCardDef(appCard.cardId);
  // App processing cost
  if (appDef.costPerRequest) {
    costIncurred += appDef.costPerRequest * volumeEnteringCompute;
  }

  steps.push({
    layer: 'application',
    cardInstanceId: appCard.instanceId,
    volumeThrough: volumeEnteringCompute,
    volumeStopped: 0,
    description: `${appDef.name}: processing ${volumeEnteringCompute} requests`,
  });

  // Step 4: Storage
  const storageCard = findStorageForApp(state.board, appCard);

  if (!storageCard) {
    unfulfilled += volumeEnteringCompute;
    steps.push({
      layer: 'storage',
      cardInstanceId: '',
      volumeThrough: 0,
      volumeStopped: volumeEnteringCompute,
      description: `No storage connected to ${appDef.name}. Requests stop at app.`,
    });
    return {
      result: {
        steps, fulfilledVolume: 0, unfulfilledVolume: volume,
        consistencyGained: 0, availabilityGained: 0, availabilityLost: 0,
        costIncurred, requestsCounted: volume,
      },
      boardUpdates,
      newRoundRobinIndex: newRRIndex,
    };
  }

  const storageDef = getCardDef(storageCard.cardId);
  const storageCapacity = storageDef.capacity ?? Infinity;
  const storageCurrentLoad = storageCard.currentLoad + (boardUpdates.get(storageCard.instanceId) ?? 0);
  const storageFree = Math.max(0, storageCapacity - storageCurrentLoad);
  const volumeEnteringStorage = Math.min(volumeEnteringCompute, storageFree);
  const volumeStoppedAtStorage = volumeEnteringCompute - volumeEnteringStorage;

  if (volumeStoppedAtStorage > 0) {
    unfulfilled += volumeStoppedAtStorage;
  }

  // KV Store cost reduction applies to the processing cost
  if (storageDef.costReduction) {
    costIncurred -= storageDef.costReduction * volumeEnteringStorage;
    costIncurred = Math.max(0, costIncurred);
  }

  boardUpdates.set(storageCard.instanceId, (boardUpdates.get(storageCard.instanceId) ?? 0) + volumeEnteringStorage);

  fulfilled = volumeEnteringStorage;

  steps.push({
    layer: 'storage',
    cardInstanceId: storageCard.instanceId,
    volumeThrough: volumeEnteringStorage,
    volumeStopped: volumeStoppedAtStorage,
    description: volumeStoppedAtStorage > 0
      ? `${storageDef.name}: ${volumeEnteringStorage}/${volumeEnteringCompute} stored (${volumeStoppedAtStorage} stopped at compute)`
      : `${storageDef.name}: ${volumeEnteringStorage} requests stored`,
  });

  // Calculate scoring
  let consistencyGained = fulfilled * baseValuePerReq;
  const availabilityGained = fulfilled;
  const availabilityLost = 0; // Unfulfilled requests simply don't add availability (no penalty)

  // Apply effects (Stampeding Herd is already factored into volume)
  const hasRaceCondition = effects.includes('race-condition');
  if (hasRaceCondition) {
    if (storageDef.durable === false) {
      const before = consistencyGained;
      consistencyGained = Math.floor(consistencyGained / 2);
      steps.push({
        layer: 'effect',
        cardInstanceId: storageCard.instanceId,
        volumeThrough: fulfilled,
        volumeStopped: 0,
        description: `Race Condition: ${storageDef.name} is not durable, value halved (${before} -> ${consistencyGained})`,
        negative: true,
      });
    } else {
      steps.push({
        layer: 'effect',
        cardInstanceId: storageCard.instanceId,
        volumeThrough: fulfilled,
        volumeStopped: 0,
        description: `Race Condition: ${storageDef.name} is durable, no effect`,
        negative: false,
      });
    }
  }

  const hasServerError = effects.includes('server-error');
  if (hasServerError) {
    consistencyGained = 0;
    steps.push({
      layer: 'effect',
      cardInstanceId: '',
      volumeThrough: fulfilled,
      volumeStopped: 0,
      description: `Server Error: all value reduced to 0`,
      negative: true,
    });
  }

  return {
    result: {
      steps,
      fulfilledVolume: fulfilled,
      unfulfilledVolume: unfulfilled,
      consistencyGained,
      availabilityGained,
      availabilityLost,
      costIncurred,
      requestsCounted: volume,
    },
    boardUpdates,
    newRoundRobinIndex: newRRIndex,
  };
}
