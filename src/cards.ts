import type { CardDefinition, ClientDeckEntry } from './types';

// === SERVER DECK ===

export const CARD_DEFINITIONS: Record<string, CardDefinition> = {
  'round-robin-lb': {
    id: 'round-robin-lb',
    name: 'Round Robin LB',
    type: 'network',
    throughputPerTurn: 20,
    cost: 3,
    lbAlgorithm: 'round-robin',
  },
  'least-connections-lb': {
    id: 'least-connections-lb',
    name: 'Least Connections LB',
    type: 'network',
    throughputPerTurn: 20,
    cost: 3,
    lbAlgorithm: 'least-connections',
  },
  'cloud-function': {
    id: 'cloud-function',
    name: 'Cloud Function',
    type: 'compute',
    capacity: 1,
    appSlots: 1,
    cost: 1,
  },
  'container': {
    id: 'container',
    name: 'Container',
    type: 'compute',
    capacity: 8,
    appSlots: 4,
    cost: 4,
  },
  'relational-db': {
    id: 'relational-db',
    name: 'Relational DB',
    type: 'storage',
    readsPerTurn: 5,
    writesPerTurn: 3,
    cost: 3,
  },
  'kv-store': {
    id: 'kv-store',
    name: 'Key-Value Store',
    type: 'storage',
    readsPerTurn: 10,
    writesPerTurn: 10,
    cost: 2,
  },
  'read-event': {
    id: 'read-event',
    name: 'Read Event',
    type: 'application',
    cost: 0,
  },
  'write-ticket-hold': {
    id: 'write-ticket-hold',
    name: 'Write Ticket Hold',
    type: 'application',
    cost: 0,
  },
  'write-purchase': {
    id: 'write-purchase',
    name: 'Write Purchase',
    type: 'application',
    cost: 0,
  },
  'payment-service': {
    id: 'payment-service',
    name: 'Payment Service',
    type: 'service',
    cost: 1,
  },
};

export function getCardDef(cardId: string): CardDefinition {
  const def = CARD_DEFINITIONS[cardId];
  if (!def) throw new Error(`Unknown card: ${cardId}`);
  return def;
}

// === CLIENT DECK (Ticket Booking Scenario) ===

export const INITIAL_CLIENT_DECK: ClientDeckEntry[] = [
  { type: 'view-event', remaining: 6 },
  { type: 'hold-ticket', remaining: 6 },
  { type: 'purchase-ticket', remaining: 4 },
  { type: 'stampeding-herd', remaining: 2 },
  { type: 'race-condition', remaining: 2 },
  { type: 'payment-error', remaining: 2 },
];

// Application cards that are always placed regardless of build choices
export const ALWAYS_PLACED_APPS = ['read-event', 'write-ticket-hold', 'write-purchase'];

// Service cards that are always placed (third-party dependencies)
export const ALWAYS_PLACED_SERVICES = ['payment-service'];

// Storage operation type for each request
export const REQUEST_STORAGE_OP: Record<string, 'read' | 'write'> = {
  'view-event': 'read',
  'hold-ticket': 'write',
  'purchase-ticket': 'write',
};
