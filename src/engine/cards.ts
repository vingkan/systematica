import type { CardDefinition, ClientCardDefinition } from './types';

// === Server Card Definitions ===

export const CARD_DEFINITIONS: Record<string, CardDefinition> = {
  'round-robin-lb': {
    id: 'round-robin-lb',
    name: 'Round Robin LB',
    type: 'network',
    costPerTurn: 5,
    capacity: 200,
    lbAlgorithm: 'round-robin',
  },
  'least-connections-lb': {
    id: 'least-connections-lb',
    name: 'Least Connections LB',
    type: 'network',
    costPerTurn: 10,
    capacity: 200,
    lbAlgorithm: 'least-connections',
  },
  'container': {
    id: 'container',
    name: 'Container',
    type: 'compute',
    costPerTurn: 10,
    capacity: 80,
    appSlots: 4,
  },
  'cloud-function': {
    id: 'cloud-function',
    name: 'Cloud Function',
    type: 'compute',
    costPerRequest: 1,
    capacity: 200,
    appSlots: 1,
  },
  'relational-db': {
    id: 'relational-db',
    name: 'Relational DB',
    type: 'storage',
    costPerTurn: 10,
    capacity: 80,
    appSlots: 5,
    durable: true,
  },
  'kv-store': {
    id: 'kv-store',
    name: 'Key-Value Store',
    type: 'storage',
    costPerTurn: 5,
    capacity: 200,
    appSlots: 10,
    durable: false,
    costReduction: 1,
  },
  'read-event': {
    id: 'read-event',
    name: 'Read Event',
    type: 'application',
    costPerRequest: 1,
    storageOp: 'read',
  },
  'write-hold': {
    id: 'write-hold',
    name: 'Write Hold',
    type: 'application',
    costPerRequest: 2,
    storageOp: 'write',
  },
  'write-payment': {
    id: 'write-payment',
    name: 'Write Payment',
    type: 'application',
    costPerRequest: 3,
    storageOp: 'write',
  },
};

// === Client Card Definitions ===

export const CLIENT_CARD_DEFINITIONS: Record<string, ClientCardDefinition> = {
  'view-event': {
    id: 'view-event',
    name: 'View Event',
    type: 'request',
    requestType: 'view-event',
    volume: 10,
    valuePerRequest: 1,
    requiresApp: 'read-event',
  },
  'hold-ticket': {
    id: 'hold-ticket',
    name: 'Hold Ticket',
    type: 'request',
    requestType: 'hold-ticket',
    volume: 4,
    valuePerRequest: 1,
    requiresApp: 'write-hold',
  },
  'purchase-ticket': {
    id: 'purchase-ticket',
    name: 'Purchase Ticket',
    type: 'request',
    requestType: 'purchase-ticket',
    volume: 4,
    valuePerRequest: 1,
    requiresApp: 'write-payment',
  },
  'stampeding-herd': {
    id: 'stampeding-herd',
    name: 'Stampeding Herd',
    type: 'effect',
    effectType: 'stampeding-herd',
    attachesTo: 'any',
    negative: false,
  },
  'race-condition': {
    id: 'race-condition',
    name: 'Race Condition',
    type: 'effect',
    effectType: 'race-condition',
    attachesTo: 'write',
    negative: true,
  },
  'server-error': {
    id: 'server-error',
    name: 'Server Error',
    type: 'effect',
    effectType: 'server-error',
    attachesTo: 'any',
    negative: true,
  },
};

// === Deck Composition ===

const SERVER_DECK_COMPOSITION: Array<{ cardId: string; count: number }> = [
  { cardId: 'round-robin-lb', count: 1 },
  { cardId: 'least-connections-lb', count: 1 },
  { cardId: 'container', count: 2 },
  { cardId: 'cloud-function', count: 4 },
  { cardId: 'relational-db', count: 1 },
  { cardId: 'kv-store', count: 1 },
  { cardId: 'read-event', count: 8 },
  { cardId: 'write-hold', count: 6 },
  { cardId: 'write-payment', count: 6 },
];

const CLIENT_DECK_COMPOSITION: Array<{ cardId: string; count: number }> = [
  { cardId: 'view-event', count: 10 },
  { cardId: 'hold-ticket', count: 5 },
  { cardId: 'purchase-ticket', count: 5 },
  { cardId: 'stampeding-herd', count: 1 },
  { cardId: 'race-condition', count: 3 },
  { cardId: 'server-error', count: 6 },
];

export function getDefaultServerDeck(): string[] {
  const deck: string[] = [];
  for (const { cardId, count } of SERVER_DECK_COMPOSITION) {
    for (let i = 0; i < count; i++) {
      deck.push(cardId);
    }
  }
  return deck;
}

export function getDefaultClientDeck(): string[] {
  const deck: string[] = [];
  for (const { cardId, count } of CLIENT_DECK_COMPOSITION) {
    for (let i = 0; i < count; i++) {
      deck.push(cardId);
    }
  }
  return deck;
}

export function getCardDef(cardId: string): CardDefinition {
  const def = CARD_DEFINITIONS[cardId];
  if (!def) throw new Error(`Unknown server card: ${cardId}`);
  return def;
}

export function getClientCardDef(cardId: string): ClientCardDefinition {
  const def = CLIENT_CARD_DEFINITIONS[cardId];
  if (!def) throw new Error(`Unknown client card: ${cardId}`);
  return def;
}

export function isRequestCard(cardId: string): boolean {
  const def = CLIENT_CARD_DEFINITIONS[cardId];
  return def?.type === 'request';
}

export function isEffectCard(cardId: string): boolean {
  const def = CLIENT_CARD_DEFINITIONS[cardId];
  return def?.type === 'effect';
}
