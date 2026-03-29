export type GamePhase = 'build' | 'play' | 'game-over';
export type BuildStep = 'lb' | 'compute' | 'cache' | 'app-assignment' | 'done';
export type CardType = 'network' | 'compute' | 'storage' | 'application';
export type RequestType = 'view-event' | 'hold-ticket' | 'purchase-ticket';
export type EffectType = 'stampeding-herd' | 'race-condition' | 'payment-error';
export type ActivePlayer = 'server' | 'client';

export type RoutingState =
  | 'AT_LB'
  | 'WAITING_AT_LB'
  | 'AT_COMPUTE'
  | 'AT_APP'
  | 'AT_STORAGE'
  | 'AT_PAYMENT'
  | 'COMPLETED'
  | 'FAILED';

export interface RoutingStep {
  state: RoutingState;
  description: string;
  cardInstanceId?: string;
  result?: 'success' | 'failed' | 'pending';
}

export interface RoutingContext {
  requestId: string;
  state: RoutingState;
  validTargets: string[];
  lbRecommendation: string | null;
  steps: RoutingStep[];
  computeNodeId?: string;
  nudgeMessage?: string | null;
}

export interface CardDefinition {
  id: string;
  name: string;
  type: CardType;
  capacity?: number;
  readsPerTurn?: number;
  writesPerTurn?: number;
  throughputPerTurn?: number;
  appSlots?: number;
  cost: number;
  lbAlgorithm?: 'round-robin' | 'least-connections';
  requiresAppId?: string;
}

export interface PlacedCard {
  instanceId: string;
  cardId: string;
  connections: string[]; // instanceIds of downstream cards
}

export interface ActiveRequest {
  id: string;
  type: RequestType;
  location: string; // instanceId or 'lb-queue'
  turnPlayed: number;
  effectAttached?: EffectType;
  status: 'active' | 'completed' | 'failed';
  waitingSince?: number; // turn when request entered WAITING_AT_LB
}

export interface TurnState {
  cardsPlayedThisTurn: number;
  cardLimit: number;
  storageOps: Record<string, { reads: number; writes: number }>;
  lbThroughputUsed: number;
  roundRobinIndex: number;
  serverActionsUsed: number;
}

export interface BuildChoices {
  lb?: 'round-robin' | 'least-connections';
  compute?: 'cloud-functions' | 'container';
  cache?: boolean;
  appAssignments?: Record<string, string>; // appCardId -> computeInstanceId
}

export interface ClientDeckEntry {
  type: RequestType | EffectType;
  remaining: number;
}

export interface EffectAttachment {
  effectType: EffectType;
  requestType: RequestType;
}

export interface GameState {
  phase: GamePhase;
  buildStep: BuildStep;
  buildChoices: BuildChoices;
  currentTurn: number;
  activePlayer: ActivePlayer;
  board: PlacedCard[];
  reserve: string[];
  requests: ActiveRequest[];
  completedRequests: ActiveRequest[];
  failedRequests: ActiveRequest[];
  clientDeck: ClientDeckEntry[];
  turnState: TurnState;
  routingContext: RoutingContext | null;
  effectAttachments: EffectAttachment[];
  selectedEffect: EffectType | null;
}

export const REQUEST_TIMEOUT_TURNS = 2;
export const LB_THROUGHPUT_PER_TURN = 20;

export const REQUEST_POINTS: Record<RequestType, number> = {
  'view-event': 0,
  'hold-ticket': 1,
  'purchase-ticket': 5,
};

export const TURN_CARD_LIMITS: Record<number, number> = {
  1: 5,
  2: 5,
  3: 10,
};

export const REQUIRED_APP_FOR_REQUEST: Record<RequestType, string> = {
  'view-event': 'read-event',
  'hold-ticket': 'write-ticket-hold',
  'purchase-ticket': 'write-purchase',
};
