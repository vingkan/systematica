import { describe, it, expect, beforeEach } from 'vitest';
import { createGame } from '../engine/game';
import { endServerTurn, resetInstanceIdCounter } from '../engine/server-turn';
import { placeCardFaceDown, attachEffect, endClientTurn } from '../engine/client-turn';
import type { GameState } from '../engine/types';

function toClientTurn(state: GameState): GameState {
  return endServerTurn(state);
}

describe('Client Turn', () => {
  let state: GameState;

  beforeEach(() => {
    resetInstanceIdCounter();
    state = toClientTurn(createGame());
  });

  describe('placeCardFaceDown', () => {
    it('places a request card face down', () => {
      const result = placeCardFaceDown(state, 'view-event');
      expect(result.faceDownCards).toHaveLength(1);
      expect(result.faceDownCards[0].requestType).toBe('view-event');
      expect(result.faceDownCards[0].volume).toBe(10);
      expect(result.faceDownCards[0].resolved).toBe(false);
    });

    it('removes card from deck', () => {
      const before = state.clientDeck.filter(c => c === 'view-event').length;
      const result = placeCardFaceDown(state, 'view-event');
      const after = result.clientDeck.filter(c => c === 'view-event').length;
      expect(after).toBe(before - 1);
    });

    it('rejects effect cards', () => {
      const result = placeCardFaceDown(state, 'stampeding-herd');
      expect(result.faceDownCards).toHaveLength(0);
    });

    it('rejects if 5 cards already placed', () => {
      let s = state;
      for (let i = 0; i < 5; i++) {
        s = placeCardFaceDown(s, 'view-event');
      }
      expect(s.faceDownCards).toHaveLength(5);
      s = placeCardFaceDown(s, 'view-event');
      expect(s.faceDownCards).toHaveLength(5); // no change
    });

    it('respects custom cardsPerTurn', () => {
      const custom = toClientTurn(createGame({ cardsPerTurn: 2 }));
      let s = placeCardFaceDown(custom, 'view-event');
      s = placeCardFaceDown(s, 'view-event');
      expect(s.faceDownCards).toHaveLength(2);
      s = placeCardFaceDown(s, 'view-event');
      expect(s.faceDownCards).toHaveLength(2); // blocked
    });

    it('rejects if not client turn', () => {
      const serverState = createGame(); // server-turn phase
      const result = placeCardFaceDown(serverState, 'view-event');
      expect(result.faceDownCards).toHaveLength(0);
    });
  });

  describe('attachEffect', () => {
    it('attaches Stampeding Herd to any request', () => {
      let s = placeCardFaceDown(state, 'view-event');
      s = attachEffect(s, 'stampeding-herd', 0);
      expect(s.faceDownCards[0].attachedEffects).toContain('stampeding-herd');
    });

    it('attaches Stampeding Herd to write request', () => {
      let s = placeCardFaceDown(state, 'hold-ticket');
      s = attachEffect(s, 'stampeding-herd', 0);
      expect(s.faceDownCards[0].attachedEffects).toContain('stampeding-herd');
    });

    it('attaches Race Condition to write request', () => {
      let s = placeCardFaceDown(state, 'hold-ticket');
      s = attachEffect(s, 'race-condition', 0);
      expect(s.faceDownCards[0].attachedEffects).toContain('race-condition');
    });

    it('rejects Race Condition on read request', () => {
      let s = placeCardFaceDown(state, 'view-event');
      s = attachEffect(s, 'race-condition', 0);
      expect(s.faceDownCards[0].attachedEffects).toHaveLength(0);
    });

    it('attaches Server Error to any request', () => {
      let s = placeCardFaceDown(state, 'view-event');
      s = attachEffect(s, 'server-error', 0);
      expect(s.faceDownCards[0].attachedEffects).toContain('server-error');
    });

    it('removes effect from deck', () => {
      let s = placeCardFaceDown(state, 'view-event');
      const before = s.clientDeck.filter(c => c === 'server-error').length;
      s = attachEffect(s, 'server-error', 0);
      const after = s.clientDeck.filter(c => c === 'server-error').length;
      expect(after).toBe(before - 1);
    });

    it('allows multiple effects on one card', () => {
      let s = placeCardFaceDown(state, 'hold-ticket');
      s = attachEffect(s, 'stampeding-herd', 0);
      s = attachEffect(s, 'race-condition', 0);
      expect(s.faceDownCards[0].attachedEffects).toHaveLength(2);
    });

    it('rejects invalid face-down index', () => {
      let s = placeCardFaceDown(state, 'view-event');
      s = attachEffect(s, 'server-error', 5); // out of bounds
      expect(s.faceDownCards[0].attachedEffects).toHaveLength(0);
    });
  });

  describe('endClientTurn', () => {
    it('transitions to resolution phase when all slots filled', () => {
      let s = state;
      for (let i = 0; i < 5; i++) {
        s = placeCardFaceDown(s, 'view-event');
      }
      s = endClientTurn(s);
      expect(s.phase).toBe('resolution');
      expect(s.activePlayer).toBe('server');
    });

    it('rejects if not enough cards placed', () => {
      let s = placeCardFaceDown(state, 'view-event');
      s = endClientTurn(s);
      expect(s.phase).toBe('client-turn'); // blocked
    });

    it('allows ending with fewer cards if deck has no more request cards', () => {
      // Custom game with only 2 request cards
      const custom = createGame({
        clientDeck: ['view-event', 'view-event', 'server-error'],
        cardsPerTurn: 5,
      });
      let s = toClientTurn(custom);
      s = placeCardFaceDown(s, 'view-event');
      s = placeCardFaceDown(s, 'view-event');
      s = endClientTurn(s);
      expect(s.phase).toBe('resolution');
    });
  });
});
