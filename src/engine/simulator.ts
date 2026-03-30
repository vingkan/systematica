import type { GameState } from './types';
import { createGame } from './game';
import { playCard, playAppCard, endServerTurn, resetInstanceIdCounter } from './server-turn';
import { placeCardFaceDown, attachEffect, endClientTurn } from './client-turn';
import { flipNextCard, stepResolution, advanceResolution } from './resolution';
import { computeSLAs, getWinner } from './scoring';
import { getCardDef, isRequestCard, isEffectCard } from './cards';

export interface SimulationResult {
  winner: 'server' | 'client';
  scoreboard: GameState['scoreboard'];
  sla: ReturnType<typeof computeSLAs>;
}

export interface SimulationReport {
  totalGames: number;
  serverWins: number;
  clientWins: number;
  avgValue: number;
  avgUptime: number;
  avgEfficiency: number;
  avgCost: number;
  minValue: number;
  maxValue: number;
  results: SimulationResult[];
}

function resolveAll(state: GameState): GameState {
  let s = state;
  while (s.phase === 'resolution' && s.resolutionIndex < s.faceDownCards.length) {
    s = flipNextCard(s);
    if (!s.currentResolution) break;
    const steps = s.currentResolution.steps.length;
    for (let i = 0; i < steps; i++) {
      s = stepResolution(s);
    }
    s = advanceResolution(s);
  }
  return s;
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Simple seeded RNG (mulberry32)
function createRng(seed: number): () => number {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let v = t;
    v = Math.imul(v ^ (v >>> 15), v | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
}

function serverHeuristicPlay(state: GameState, rng: () => number): GameState {
  let s = state;

  // Strategy: play one LB, then compute + storage, then connect apps
  const deck = [...s.serverDeck];

  // Play network first (pick one LB)
  const lbs = deck.filter(id => getCardDef(id).type === 'network');
  const hasLB = s.board.some(c => getCardDef(c.cardId).type === 'network');
  if (!hasLB && lbs.length > 0) {
    const lb = lbs[Math.floor(rng() * lbs.length)];
    s = playCard(s, lb);
  }

  // Play compute (1-2 cards)
  const computeInDeck = s.serverDeck.filter(id => getCardDef(id).type === 'compute');
  const computeToPlay = Math.min(computeInDeck.length, s.currentTurn === 1 ? 2 : 1);
  for (let i = 0; i < computeToPlay; i++) {
    const shuffled = shuffle(s.serverDeck.filter(id => getCardDef(id).type === 'compute'), rng);
    if (shuffled.length > 0) {
      s = playCard(s, shuffled[0]);
    }
  }

  // Play storage (1-2 cards)
  const storageInDeck = s.serverDeck.filter(id => getCardDef(id).type === 'storage');
  const storageToPlay = Math.min(storageInDeck.length, s.currentTurn === 1 ? 2 : 0);
  for (let i = 0; i < storageToPlay; i++) {
    const shuffled = shuffle(s.serverDeck.filter(id => getCardDef(id).type === 'storage'), rng);
    if (shuffled.length > 0) {
      s = playCard(s, shuffled[0]);
    }
  }

  // Connect apps to compute + storage
  const computeCards = s.board.filter(c => getCardDef(c.cardId).type === 'compute');
  const storageCards = s.board.filter(c => getCardDef(c.cardId).type === 'storage');
  const appTypes = ['read-event', 'write-hold', 'write-payment'];

  for (const appType of appTypes) {
    if (!s.serverDeck.includes(appType)) continue;

    for (const compute of computeCards) {
      // Check if this compute already has this app type
      const hasApp = s.board.some(c =>
        c.cardId === appType && c.connections.includes(compute.instanceId),
      );
      if (hasApp) continue;

      const computeDef = getCardDef(compute.cardId);
      const currentApps = s.board.filter(c =>
        getCardDef(c.cardId).type === 'application' && c.connections.includes(compute.instanceId),
      ).length;
      if (computeDef.appSlots != null && currentApps >= computeDef.appSlots) continue;

      for (const storage of shuffle(storageCards, rng)) {
        const storageDef = getCardDef(storage.cardId);
        const storageApps = s.board.filter(c =>
          getCardDef(c.cardId).type === 'application' && c.connections.includes(storage.instanceId),
        ).length;
        if (storageDef.appSlots != null && storageApps >= storageDef.appSlots) continue;

        s = playAppCard(s, appType, compute.instanceId, storage.instanceId);
        break;
      }
    }
  }

  return s;
}

function clientHeuristicPlay(state: GameState, rng: () => number): GameState {
  let s = state;
  const cardsPerTurn = s.config.cardsPerTurn ?? 5;

  // Place request cards face down
  const requestCards = s.clientDeck.filter(isRequestCard);
  const toPlay = shuffle(requestCards, rng).slice(0, cardsPerTurn);

  for (const cardId of toPlay) {
    s = placeCardFaceDown(s, cardId);
  }

  // Attach effects randomly
  const effects = s.clientDeck.filter(isEffectCard);
  for (const effectId of effects) {
    if (s.faceDownCards.length === 0) break;
    if (rng() > 0.5) continue; // 50% chance to play each effect

    const targetIdx = Math.floor(rng() * s.faceDownCards.length);
    const before = s.clientDeck.length;
    s = attachEffect(s, effectId, targetIdx);
    if (s.clientDeck.length === before) continue; // attachment failed, skip
  }

  return s;
}

export function simulateGame(seed: number): SimulationResult {
  const rng = createRng(seed);
  resetInstanceIdCounter();
  let s = createGame();

  while (s.phase !== 'game-over') {
    if (s.phase === 'server-turn') {
      s = serverHeuristicPlay(s, rng);
      s = endServerTurn(s);
    } else if (s.phase === 'client-turn') {
      s = clientHeuristicPlay(s, rng);
      s = endClientTurn(s);
      // If endClientTurn didn't transition (not enough cards), force it
      if (s.phase === 'client-turn') {
        // Fill remaining slots with any available request cards
        const requestCards = s.clientDeck.filter(isRequestCard);
        for (const cardId of requestCards) {
          if (s.faceDownCards.length >= (s.config.cardsPerTurn ?? 5)) break;
          s = placeCardFaceDown(s, cardId);
        }
        s = endClientTurn(s);
        if (s.phase === 'client-turn') {
          // Still stuck — no request cards left. Manually transition.
          s = { ...s, phase: 'resolution', activePlayer: 'server', resolutionIndex: 0, currentResolution: null, resolutionStepIndex: 0 };
        }
      }
    } else if (s.phase === 'resolution') {
      s = resolveAll(s);
    }
  }

  const sla = computeSLAs(s.scoreboard);
  return {
    winner: getWinner(s) ?? 'client',
    scoreboard: s.scoreboard,
    sla,
  };
}

export function runSimulation(numGames: number, baseSeed = 42): SimulationReport {
  const results: SimulationResult[] = [];

  for (let i = 0; i < numGames; i++) {
    results.push(simulateGame(baseSeed + i));
  }

  const serverWins = results.filter(r => r.winner === 'server').length;
  const values = results.map(r => r.sla.value);
  const uptimes = results.map(r => r.sla.uptime);
  const efficiencies = results.map(r => r.sla.efficiency);
  const costs = results.map(r => r.scoreboard.cost);

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  return {
    totalGames: numGames,
    serverWins,
    clientWins: numGames - serverWins,
    avgValue: avg(values),
    avgUptime: avg(uptimes),
    avgEfficiency: avg(efficiencies),
    avgCost: avg(costs),
    minValue: Math.min(...values),
    maxValue: Math.max(...values),
    results,
  };
}
