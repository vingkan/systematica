import type {
  GameState, BuildStep, BuildChoices, PlacedCard,
} from '../types';
import { ALWAYS_PLACED_APPS, ALWAYS_PLACED_SERVICES, getCardDef, INITIAL_CLIENT_DECK } from '../cards';
import { createInitialTurnState } from './turns';

let instanceCounter = 0;
function nextInstanceId(cardId: string): string {
  return `${cardId}-${++instanceCounter}`;
}

export function resetInstanceCounter(): void {
  instanceCounter = 0;
}

export function createInitialGameState(): GameState {
  return {
    phase: 'build',
    buildStep: 'lb',
    buildChoices: {},
    currentTurn: 0,
    activePlayer: 'server',
    board: [],
    reserve: [],
    requests: [],
    completedRequests: [],
    failedRequests: [],
    clientDeck: INITIAL_CLIENT_DECK.map(e => ({ ...e })),
    turnState: createInitialTurnState(0),
    routingContext: null,
    effectAttachments: [],
    selectedEffect: null,
  };
}

export function makeBuildChoice(
  state: GameState,
  step: BuildStep,
  value: string | boolean,
): GameState {
  const choices = { ...state.buildChoices };

  switch (step) {
    case 'lb':
      choices.lb = value as 'round-robin' | 'least-connections';
      return { ...state, buildChoices: choices, buildStep: 'compute' };

    case 'compute':
      choices.compute = value as 'cloud-functions' | 'container';
      return { ...state, buildChoices: choices, buildStep: 'cache' };

    case 'cache':
      choices.cache = value as boolean;
      return { ...state, buildChoices: choices, buildStep: 'app-assignment' };

    default:
      return state;
  }
}

export function assignAppToCompute(
  state: GameState,
  assignments: Record<string, string>,
): GameState {
  const choices = { ...state.buildChoices, appAssignments: assignments };
  return { ...state, buildChoices: choices };
}

export function finalizeBuild(state: GameState): GameState {
  const { board, reserve } = generateInitialBoard(state.buildChoices);
  return {
    ...state,
    buildStep: 'done',
    phase: 'play',
    currentTurn: 1,
    activePlayer: 'server',
    board,
    reserve,
    turnState: createInitialTurnState(5),
    routingContext: null,
    effectAttachments: [],
    selectedEffect: null,
  };
}

export function generateInitialBoard(choices: BuildChoices): {
  board: PlacedCard[];
  reserve: string[];
} {
  const board: PlacedCard[] = [];
  const reserve: string[] = [];

  // LB
  const lbId = choices.lb === 'round-robin' ? 'round-robin-lb' : 'least-connections-lb';
  const lbInstance = nextInstanceId(lbId);
  board.push({ instanceId: lbInstance, cardId: lbId, connections: [] });

  // Reserve the unchosen LB
  const otherLb = choices.lb === 'round-robin' ? 'least-connections-lb' : 'round-robin-lb';
  reserve.push(otherLb);

  // Compute
  const computeInstances: string[] = [];
  if (choices.compute === 'cloud-functions') {
    // Start with 2 Cloud Functions, 1 in reserve
    for (let i = 0; i < 2; i++) {
      const id = nextInstanceId('cloud-function');
      board.push({ instanceId: id, cardId: 'cloud-function', connections: [] });
      computeInstances.push(id);
    }
    reserve.push('cloud-function'); // 1 in reserve
    reserve.push('container', 'container'); // both containers in reserve
  } else {
    // Start with 1 Container, 1 in reserve
    const id = nextInstanceId('container');
    board.push({ instanceId: id, cardId: 'container', connections: [] });
    computeInstances.push(id);
    reserve.push('container'); // 1 in reserve
    reserve.push('cloud-function', 'cloud-function', 'cloud-function'); // all 3 in reserve
  }

  // Connect LB to compute cards
  const lbCard = board.find(c => c.instanceId === lbInstance)!;
  lbCard.connections = [...computeInstances];

  // Storage: Relational DB always starts in play
  const rdbInstance = nextInstanceId('relational-db');
  board.push({ instanceId: rdbInstance, cardId: 'relational-db', connections: [] });

  let kvInstance: string | undefined;
  if (choices.cache) {
    kvInstance = nextInstanceId('kv-store');
    board.push({ instanceId: kvInstance, cardId: 'kv-store', connections: [] });
  } else {
    reserve.push('kv-store');
  }

  // Application cards: always placed
  const appInstances: Record<string, string> = {};
  for (const appId of ALWAYS_PLACED_APPS) {
    const inst = nextInstanceId(appId);
    board.push({ instanceId: inst, cardId: appId, connections: [] });
    appInstances[appId] = inst;
  }

  // Connect apps to compute based on assignments
  if (choices.appAssignments && Object.keys(choices.appAssignments).length > 0) {
    for (const [appCardId, computeInstanceId] of Object.entries(choices.appAssignments)) {
      const computeCard = board.find(c => c.instanceId === computeInstanceId);
      const appInstance = appInstances[appCardId];
      if (computeCard && appInstance) {
        computeCard.connections.push(appInstance);
      }
    }
  } else {
    // Auto-assign: distribute apps across compute cards round-robin
    const appIds = ALWAYS_PLACED_APPS;
    appIds.forEach((appId, i) => {
      const computeIdx = i % computeInstances.length;
      const computeCard = board.find(c => c.instanceId === computeInstances[computeIdx]);
      if (computeCard) {
        computeCard.connections.push(appInstances[appId]);
      }
    });
  }

  // Connect app cards to storage
  // Read Event connects to KV Store if caching, else Relational DB
  const readEventInst = appInstances['read-event'];
  const readEventCard = board.find(c => c.instanceId === readEventInst);
  if (readEventCard) {
    readEventCard.connections = [choices.cache && kvInstance ? kvInstance : rdbInstance];
  }

  // Write Ticket Hold connects to KV Store if caching, else Relational DB
  const writeHoldInst = appInstances['write-ticket-hold'];
  const writeHoldCard = board.find(c => c.instanceId === writeHoldInst);
  if (writeHoldCard) {
    writeHoldCard.connections = [choices.cache && kvInstance ? kvInstance : rdbInstance];
  }

  // Service cards: always placed
  const serviceInstances: Record<string, string> = {};
  for (const serviceId of ALWAYS_PLACED_SERVICES) {
    const inst = nextInstanceId(serviceId);
    board.push({ instanceId: inst, cardId: serviceId, connections: [] });
    serviceInstances[serviceId] = inst;
  }

  // Write Purchase connects to Relational DB + Payment Service
  const writePurchaseInst = appInstances['write-purchase'];
  const writePurchaseCard = board.find(c => c.instanceId === writePurchaseInst);
  if (writePurchaseCard) {
    const connections = [rdbInstance];
    if (serviceInstances['payment-service']) {
      connections.push(serviceInstances['payment-service']);
    }
    writePurchaseCard.connections = connections;
  }

  return { board, reserve };
}

export function getComputeCards(board: PlacedCard[]): PlacedCard[] {
  return board.filter(c => {
    const def = getCardDef(c.cardId);
    return def.type === 'compute';
  });
}

export function getNetworkCard(board: PlacedCard[]): PlacedCard | undefined {
  return board.find(c => {
    const def = getCardDef(c.cardId);
    return def.type === 'network';
  });
}

export function getAppCardsOnCompute(board: PlacedCard[], computeInstanceId: string): string[] {
  const compute = board.find(c => c.instanceId === computeInstanceId);
  if (!compute) return [];
  return compute.connections.filter(connId => {
    const connected = board.find(c => c.instanceId === connId);
    if (!connected) return false;
    const def = getCardDef(connected.cardId);
    return def.type === 'application';
  });
}
