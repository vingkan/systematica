import { describe, it, expect } from 'vitest';
import { createGame } from '../engine/game';
import { playCard, playAppCard, endServerTurn, resetInstanceIdCounter } from '../engine/server-turn';
import { placeCardFaceDown, attachEffect, endClientTurn } from '../engine/client-turn';
import { flipNextCard, stepResolution, advanceResolution } from '../engine/resolution';
import type { GameState } from '../engine/types';

function setupResolution(customConfig?: { cardsPerTurn?: number }): GameState {
  resetInstanceIdCounter();
  let s = createGame({
    cardsPerTurn: customConfig?.cardsPerTurn ?? 2,
    clientDeck: ['view-event', 'view-event', 'hold-ticket', 'hold-ticket', 'server-error'],
  });

  // Server plays infrastructure
  s = playCard(s, 'least-connections-lb');
  s = playCard(s, 'container');
  s = playCard(s, 'kv-store');
  const compute = s.board.find(c => c.cardId === 'container')!;
  const kv = s.board.find(c => c.cardId === 'kv-store')!;
  s = playAppCard(s, 'read-event', compute.instanceId, kv.instanceId);
  s = playAppCard(s, 'write-hold', compute.instanceId, kv.instanceId);
  s = endServerTurn(s);

  // Client places cards face down
  s = placeCardFaceDown(s, 'view-event');
  s = placeCardFaceDown(s, 'hold-ticket');
  s = endClientTurn(s);

  return s;
}

describe('Resolution', () => {
  describe('flipNextCard', () => {
    it('computes routing path for first face-down card', () => {
      let s = setupResolution();
      s = flipNextCard(s);
      expect(s.currentResolution).not.toBeNull();
      expect(s.currentResolution!.fulfilledVolume).toBe(10); // View Event volume
      expect(s.currentResolution!.steps.length).toBeGreaterThan(0);
      expect(s.resolutionStepIndex).toBe(0);
    });

    it('updates board load', () => {
      let s = setupResolution();
      const kvBefore = s.board.find(c => c.cardId === 'kv-store')!;
      expect(kvBefore.currentLoad).toBe(0);
      s = flipNextCard(s);
      const kvAfter = s.board.find(c => c.cardId === 'kv-store')!;
      expect(kvAfter.currentLoad).toBe(10); // View Event volume
    });

    it('rejects if not in resolution phase', () => {
      const s = createGame();
      const result = flipNextCard(s);
      expect(result.currentResolution).toBeNull();
    });

    it('rejects if current resolution not yet stepped through', () => {
      let s = setupResolution();
      s = flipNextCard(s);
      // Try flipping again without stepping through
      const result = flipNextCard(s);
      // Should return same state (currentResolution already set)
      expect(result.resolutionIndex).toBe(s.resolutionIndex);
    });
  });

  describe('stepResolution', () => {
    it('advances step index', () => {
      let s = setupResolution();
      s = flipNextCard(s);
      expect(s.resolutionStepIndex).toBe(0);
      s = stepResolution(s);
      expect(s.resolutionStepIndex).toBe(1);
    });

    it('marks card resolved after last step but defers score updates to advanceResolution', () => {
      let s = setupResolution();
      s = flipNextCard(s);
      const totalSteps = s.currentResolution!.steps.length;
      for (let i = 0; i < totalSteps; i++) {
        s = stepResolution(s);
      }
      // Card is resolved but scores not yet applied
      expect(s.currentResolution).toBeNull();
      expect(s.faceDownCards[0].resolved).toBe(true);
      expect(s.faceDownCards[0].resolutionResult).not.toBeUndefined();
      expect(s.scoreboard.requests).toBe(0); // deferred

      // Scores applied on advance
      s = advanceResolution(s);
      expect(s.scoreboard.requests).toBe(10);
      expect(s.scoreboard.availability).toBe(10);
      expect(s.scoreboard.consistency).toBe(10);
    });
  });

  describe('advanceResolution', () => {
    it('moves to next face-down card', () => {
      let s = setupResolution();
      // Resolve first card
      s = flipNextCard(s);
      const steps = s.currentResolution!.steps.length;
      for (let i = 0; i < steps; i++) s = stepResolution(s);
      expect(s.resolutionIndex).toBe(0);

      s = advanceResolution(s);
      expect(s.resolutionIndex).toBe(1);
    });

    it('transitions to next server turn after all cards resolved', () => {
      let s = setupResolution();

      // Resolve card 1
      s = flipNextCard(s);
      let steps = s.currentResolution!.steps.length;
      for (let i = 0; i < steps; i++) s = stepResolution(s);
      s = advanceResolution(s);

      // Resolve card 2
      s = flipNextCard(s);
      steps = s.currentResolution!.steps.length;
      for (let i = 0; i < steps; i++) s = stepResolution(s);
      s = advanceResolution(s);

      expect(s.phase).toBe('server-turn');
      expect(s.currentTurn).toBe(2);
      expect(s.faceDownCards).toHaveLength(0);
    });

    it('resets board load between turns', () => {
      let s = setupResolution();

      // Resolve all cards
      s = flipNextCard(s);
      let steps = s.currentResolution!.steps.length;
      for (let i = 0; i < steps; i++) s = stepResolution(s);
      s = advanceResolution(s);
      s = flipNextCard(s);
      steps = s.currentResolution!.steps.length;
      for (let i = 0; i < steps; i++) s = stepResolution(s);
      s = advanceResolution(s);

      // Board loads should be reset
      for (const card of s.board) {
        expect(card.currentLoad).toBe(0);
      }
    });

    it('transitions to game-over after final turn', () => {
      resetInstanceIdCounter();
      let s = createGame({
        totalTurns: 1,
        cardsPerTurn: 1,
        clientDeck: ['view-event'],
      });
      s = playCard(s, 'least-connections-lb');
      s = playCard(s, 'container');
      s = playCard(s, 'kv-store');
      const compute = s.board.find(c => c.cardId === 'container')!;
      const kv = s.board.find(c => c.cardId === 'kv-store')!;
      s = playAppCard(s, 'read-event', compute.instanceId, kv.instanceId);
      s = endServerTurn(s);
      s = placeCardFaceDown(s, 'view-event');
      s = endClientTurn(s);
      s = flipNextCard(s);
      const steps = s.currentResolution!.steps.length;
      for (let i = 0; i < steps; i++) s = stepResolution(s);
      s = advanceResolution(s);
      expect(s.phase).toBe('game-over');
    });
  });

  describe('effects during resolution', () => {
    it('Stampeding Herd doubles volume', () => {
      resetInstanceIdCounter();
      let s = createGame({
        cardsPerTurn: 1,
        clientDeck: ['hold-ticket', 'stampeding-herd'],
      });
      s = playCard(s, 'least-connections-lb');
      s = playCard(s, 'container');
      s = playCard(s, 'kv-store');
      const compute = s.board.find(c => c.cardId === 'container')!;
      const kv = s.board.find(c => c.cardId === 'kv-store')!;
      s = playAppCard(s, 'write-hold', compute.instanceId, kv.instanceId);
      s = endServerTurn(s);
      s = placeCardFaceDown(s, 'hold-ticket');
      s = attachEffect(s, 'stampeding-herd', 0);
      s = endClientTurn(s);
      s = flipNextCard(s);
      // Hold Ticket volume 4, doubled to 8
      expect(s.currentResolution!.requestsCounted).toBe(8);
      expect(s.currentResolution!.fulfilledVolume).toBe(8);
    });

    it('Race Condition halves value on non-durable storage', () => {
      resetInstanceIdCounter();
      let s = createGame({
        cardsPerTurn: 1,
        clientDeck: ['hold-ticket', 'race-condition'],
      });
      s = playCard(s, 'least-connections-lb');
      s = playCard(s, 'container');
      s = playCard(s, 'kv-store');
      const compute = s.board.find(c => c.cardId === 'container')!;
      const kv = s.board.find(c => c.cardId === 'kv-store')!;
      s = playAppCard(s, 'write-hold', compute.instanceId, kv.instanceId);
      s = endServerTurn(s);
      s = placeCardFaceDown(s, 'hold-ticket');
      s = attachEffect(s, 'race-condition', 0);
      s = endClientTurn(s);
      s = flipNextCard(s);
      // Hold Ticket: 4 requests * 1 value = 4, halved = 2
      expect(s.currentResolution!.consistencyGained).toBe(2);
    });

    it('Server Error zeros value', () => {
      resetInstanceIdCounter();
      let s = createGame({
        cardsPerTurn: 1,
        clientDeck: ['view-event', 'server-error'],
      });
      s = playCard(s, 'least-connections-lb');
      s = playCard(s, 'container');
      s = playCard(s, 'kv-store');
      const compute = s.board.find(c => c.cardId === 'container')!;
      const kv = s.board.find(c => c.cardId === 'kv-store')!;
      s = playAppCard(s, 'read-event', compute.instanceId, kv.instanceId);
      s = endServerTurn(s);
      s = placeCardFaceDown(s, 'view-event');
      s = attachEffect(s, 'server-error', 0);
      s = endClientTurn(s);
      s = flipNextCard(s);
      expect(s.currentResolution!.consistencyGained).toBe(0);
      expect(s.currentResolution!.fulfilledVolume).toBe(10); // still fulfilled
    });
  });
});
