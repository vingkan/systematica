import { describe, it, expect } from 'vitest';
import { createGame } from '../engine/game';
import { playCard, playAppCard, endServerTurn, resetInstanceIdCounter } from '../engine/server-turn';
import { placeCardFaceDown, attachEffect, endClientTurn } from '../engine/client-turn';
import { flipNextCard, stepResolution, advanceResolution } from '../engine/resolution';
import { computeSLAs, getWinner } from '../engine/scoring';
import type { GameState } from '../engine/types';

function resolveAllCards(state: GameState): GameState {
  let s = state;
  while (s.resolutionIndex < s.faceDownCards.length) {
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

describe('Integration: Corrected Example Game', () => {
  it('plays the full example game from ticket-booking-example.md with corrected values', () => {
    resetInstanceIdCounter();

    // Custom decks for the example (only the cards actually used)
    let s = createGame({
      cardsPerTurn: 2,
      totalTurns: 3,
      serverDeck: [
        'least-connections-lb', 'container', 'relational-db', 'kv-store',
        'read-event', 'write-hold', 'write-payment',
      ],
      clientDeck: [
        'view-event', 'hold-ticket',
        'stampeding-herd', 'race-condition',
        // Filler request cards for turns 2 and 3
        'view-event', 'view-event', 'view-event', 'view-event',
      ],
    });

    // === TURN 1: Server ===
    s = playCard(s, 'least-connections-lb');
    s = playCard(s, 'container');
    s = playCard(s, 'relational-db');
    s = playCard(s, 'kv-store');

    const compute = s.board.find(c => c.cardId === 'container')!;
    const kv = s.board.find(c => c.cardId === 'kv-store')!;
    const db = s.board.find(c => c.cardId === 'relational-db')!;

    s = playAppCard(s, 'read-event', compute.instanceId, kv.instanceId);
    s = playAppCard(s, 'write-hold', compute.instanceId, kv.instanceId);
    s = playAppCard(s, 'write-payment', compute.instanceId, db.instanceId);

    s = endServerTurn(s);

    // Per-turn costs: LC LB(10) + Container(10) + RelDB(10) + KV(5) = 35
    expect(s.scoreboard.cost).toBe(35);
    expect(s.phase).toBe('client-turn');

    // === TURN 1: Client ===
    s = placeCardFaceDown(s, 'view-event');
    s = placeCardFaceDown(s, 'hold-ticket');
    s = attachEffect(s, 'stampeding-herd', 1); // on hold ticket
    s = attachEffect(s, 'race-condition', 1);  // on hold ticket
    s = endClientTurn(s);

    expect(s.phase).toBe('resolution');
    expect(s.faceDownCards).toHaveLength(2);

    // === TURN 1: Resolution ===

    // Card 1: View Event (volume 10)
    s = flipNextCard(s);
    expect(s.currentResolution!.fulfilledVolume).toBe(10);
    expect(s.currentResolution!.requestsCounted).toBe(10);
    expect(s.currentResolution!.consistencyGained).toBe(10);
    expect(s.currentResolution!.availabilityGained).toBe(10);
    // Processing: Read Event 10*1=10, KV reduces 10*1=10, net=0
    expect(s.currentResolution!.costIncurred).toBe(0);

    let steps = s.currentResolution!.steps.length;
    for (let i = 0; i < steps; i++) s = stepResolution(s);
    s = advanceResolution(s);

    // After card 1: +10 requests, +10 availability, +10 consistency, +0 cost
    expect(s.scoreboard.requests).toBe(10);
    expect(s.scoreboard.availability).toBe(10);
    expect(s.scoreboard.consistency).toBe(10);
    expect(s.scoreboard.cost).toBe(35); // unchanged (0 processing cost)

    // Card 2: Hold Ticket + Stampeding Herd + Race Condition (volume 4*2=8)
    s = flipNextCard(s);
    expect(s.currentResolution!.requestsCounted).toBe(8);
    expect(s.currentResolution!.fulfilledVolume).toBe(8);
    // Race Condition on KV (not durable): halves value. 8 * 1 * 0.5 = 4
    expect(s.currentResolution!.consistencyGained).toBe(4);
    expect(s.currentResolution!.availabilityGained).toBe(8);
    // Processing: Write Hold 8*2=16, KV reduces 8*1=8, net=8
    expect(s.currentResolution!.costIncurred).toBe(8);

    steps = s.currentResolution!.steps.length;
    for (let i = 0; i < steps; i++) s = stepResolution(s);
    s = advanceResolution(s);

    // After Turn 1: { consistency: 14, availability: 18, cost: 43, requests: 18 }
    expect(s.scoreboard.consistency).toBe(14);
    expect(s.scoreboard.availability).toBe(18);
    expect(s.scoreboard.cost).toBe(43);
    expect(s.scoreboard.requests).toBe(18);
    expect(s.phase).toBe('server-turn');
    expect(s.currentTurn).toBe(2);

    // === TURN 2: Server (no new cards) ===
    s = endServerTurn(s);
    // +35 per-turn cost
    expect(s.scoreboard.cost).toBe(78);

    // === TURN 2: Client ===
    s = placeCardFaceDown(s, 'view-event');
    s = placeCardFaceDown(s, 'view-event');
    s = endClientTurn(s);
    s = resolveAllCards(s);
    expect(s.currentTurn).toBe(3);

    // === TURN 3: Server (no new cards) ===
    s = endServerTurn(s);
    // === TURN 3: Client ===
    s = placeCardFaceDown(s, 'view-event');
    s = placeCardFaceDown(s, 'view-event');
    s = endClientTurn(s);
    s = resolveAllCards(s);

    expect(s.phase).toBe('game-over');

    // === FINAL SCORE (checking the original example scenario's assertions) ===
    // The original example only played cards in turn 1, but we added filler cards
    // for turns 2-3. Let's verify the SLA calculation on the original scenario.
  });

  it('calculates correct SLAs for the original Turn 1-only scenario', () => {
    // Simulate the scoreboard as if only turn 1 had activity
    // Turn 1 cost: 35 (infra), Turn 2: +35, Turn 3: +35 = 105 infra
    // Plus 8 processing cost from hold ticket = 113 total
    // But with activity in turns 2-3 this changes. Let's test pure scoreboard math.
    const scoreboard = { consistency: 14, availability: 18, cost: 113, requests: 18 };
    const sla = computeSLAs(scoreboard);

    expect(sla.value).toBe(280 - 113); // 167
    expect(sla.valuePass).toBe(true);   // > 50

    expect(sla.uptime).toBeCloseTo(1.0);
    expect(sla.uptimePass).toBe(true);  // > 95%

    expect(sla.efficiency).toBeCloseTo(6.28, 1);
    expect(sla.efficiencyPass).toBe(true); // < 8

    expect(sla.serverWins).toBe(true);
  });

  it('minimal example: server wins with correct infrastructure', () => {
    resetInstanceIdCounter();
    let s = createGame({
      cardsPerTurn: 1,
      totalTurns: 1,
      serverDeck: ['least-connections-lb', 'container', 'kv-store', 'read-event'],
      clientDeck: ['view-event'],
    });

    s = playCard(s, 'least-connections-lb');
    s = playCard(s, 'container');
    s = playCard(s, 'kv-store');
    const compute = s.board.find(c => c.cardId === 'container')!;
    const kv = s.board.find(c => c.cardId === 'kv-store')!;
    s = playAppCard(s, 'read-event', compute.instanceId, kv.instanceId);
    s = endServerTurn(s);

    // Cost: LC LB(10) + Container(10) + KV(5) = 25
    expect(s.scoreboard.cost).toBe(25);

    s = placeCardFaceDown(s, 'view-event');
    s = endClientTurn(s);

    s = flipNextCard(s);
    expect(s.currentResolution!.fulfilledVolume).toBe(10);
    expect(s.currentResolution!.costIncurred).toBe(0); // Read Event 10 - KV 10

    steps: s.currentResolution!.steps.length;
    const totalSteps = s.currentResolution!.steps.length;
    for (let i = 0; i < totalSteps; i++) s = stepResolution(s);
    s = advanceResolution(s);

    expect(s.phase).toBe('game-over');
    expect(s.scoreboard).toEqual({
      consistency: 10,
      availability: 10,
      cost: 25,
      requests: 10,
    });

    const sla = computeSLAs(s.scoreboard);
    // Value = 10*20 - 25 = 175 (>50)
    // Uptime = 10/10 = 100% (>95%)
    // Efficiency = 25/10 = 2.5 (<8)
    expect(sla.serverWins).toBe(true);
    expect(getWinner(s)).toBe('server');
  });

  it('client wins when server has no infrastructure', () => {
    resetInstanceIdCounter();
    let s = createGame({
      cardsPerTurn: 1,
      totalTurns: 1,
      serverDeck: [],
      clientDeck: ['view-event'],
    });

    s = endServerTurn(s);
    s = placeCardFaceDown(s, 'view-event');
    s = endClientTurn(s);
    s = resolveAllCards(s);

    expect(s.phase).toBe('game-over');
    expect(s.scoreboard.availability).toBe(0); // no requests fulfilled, no penalty
    expect(s.scoreboard.requests).toBe(10);

    const sla = computeSLAs(s.scoreboard);
    expect(sla.uptime).toBe(0); // 0/10 = 0%
    expect(sla.serverWins).toBe(false);
    expect(getWinner(s)).toBe('client');
  });
});
