// === Card Types ===

export type CardType = 'network' | 'compute' | 'storage' | 'application';
export type RequestType = 'view-event' | 'hold-ticket' | 'purchase-ticket';
export type EffectType = 'stampeding-herd' | 'race-condition' | 'server-error';
export type GamePhase = 'server-turn' | 'client-turn' | 'resolution' | 'game-over';
export type ActivePlayer = 'server' | 'client';

// === Card Definitions ===

export interface CardDefinition {
  id: string;
  name: string;
  type: CardType;
  costPerTurn?: number;
  costPerRequest?: number;
  capacity?: number;
  appSlots?: number;
  durable?: boolean;
  costReduction?: number;
  lbAlgorithm?: 'round-robin' | 'least-connections';
  storageOp?: 'read' | 'write';
}

export interface ClientCardDefinition {
  id: string;
  name: string;
  type: 'request' | 'effect';
  requestType?: RequestType;
  effectType?: EffectType;
  volume?: number;
  valuePerRequest?: number;
  requiresApp?: string;
  attachesTo?: 'read' | 'write' | 'any';
  negative?: boolean;
}

// === Board State ===

export interface PlacedCard {
  instanceId: string;
  cardId: string;
  connections: string[];
  currentLoad: number;
}

export interface FaceDownCard {
  deckCardId: string;
  requestType: RequestType;
  volume: number;
  attachedEffects: EffectType[];
  resolved: boolean;
  resolutionResult?: ResolutionResult;
}

// === Routing & Resolution ===

export interface RoutingStep {
  layer: 'network' | 'compute' | 'application' | 'storage' | 'effect';
  cardInstanceId: string;
  volumeThrough: number;
  volumeStopped: number;
  description: string;
  negative?: boolean;
}

export interface ResolutionResult {
  steps: RoutingStep[];
  fulfilledVolume: number;
  unfulfilledVolume: number;
  consistencyGained: number;
  availabilityGained: number;
  availabilityLost: number;
  costIncurred: number;
  requestsCounted: number;
}

// === Scoring ===

export interface Scoreboard {
  consistency: number;
  availability: number;
  cost: number;
  requests: number;
}

export interface SLAResult {
  value: number;
  uptime: number;
  efficiency: number;
  valuePass: boolean;
  uptimePass: boolean;
  efficiencyPass: boolean;
  serverWins: boolean;
}

// === Game Config ===

export interface GameConfig {
  serverDeck?: string[];
  clientDeck?: string[];
  cardsPerTurn?: number;
  totalTurns?: number;
}

// === Game State ===

export interface GameState {
  phase: GamePhase;
  currentTurn: number;
  activePlayer: ActivePlayer;
  serverDeck: string[];
  clientDeck: string[];
  board: PlacedCard[];
  faceDownCards: FaceDownCard[];
  resolutionIndex: number;
  currentResolution: ResolutionResult | null;
  resolutionStepIndex: number;
  scoreboard: Scoreboard;
  roundRobinIndex: number;
  config: GameConfig;
}

// === Constants ===

export const DEFAULT_CARDS_PER_TURN = 5;
export const DEFAULT_TOTAL_TURNS = 3;
export const VALUE_MULTIPLIER = 20;
export const SLA_VALUE_THRESHOLD = 50;
export const SLA_UPTIME_THRESHOLD = 0.95;
export const SLA_EFFICIENCY_THRESHOLD = 8;

export const REQUIRED_APP_FOR_REQUEST: Record<RequestType, string> = {
  'view-event': 'read-event',
  'hold-ticket': 'write-hold',
  'purchase-ticket': 'write-payment',
};

export const STORAGE_OP_FOR_APP: Record<string, 'read' | 'write'> = {
  'read-event': 'read',
  'write-hold': 'write',
  'write-payment': 'write',
};
