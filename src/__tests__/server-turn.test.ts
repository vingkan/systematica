import { describe, it, expect, beforeEach } from 'vitest';
import { createGame } from '../engine/game';
import { playCard, playAppCard, removeCard, endServerTurn, resetInstanceIdCounter } from '../engine/server-turn';
import type { GameState } from '../engine/types';

describe('Server Turn', () => {
  let state: GameState;

  beforeEach(() => {
    resetInstanceIdCounter();
    state = createGame();
  });

  describe('playCard', () => {
    it('plays a network card onto the board', () => {
      const result = playCard(state, 'least-connections-lb');
      expect(result.board).toHaveLength(1);
      expect(result.board[0].cardId).toBe('least-connections-lb');
      expect(result.serverDeck.filter(c => c === 'least-connections-lb')).toHaveLength(0);
    });

    it('plays a compute card and auto-connects to existing network', () => {
      let s = playCard(state, 'least-connections-lb');
      s = playCard(s, 'container');
      const lb = s.board.find(c => c.cardId === 'least-connections-lb')!;
      const container = s.board.find(c => c.cardId === 'container')!;
      expect(lb.connections).toContain(container.instanceId);
    });

    it('plays a network card and auto-connects to existing compute', () => {
      let s = playCard(state, 'container');
      s = playCard(s, 'least-connections-lb');
      const lb = s.board.find(c => c.cardId === 'least-connections-lb')!;
      const container = s.board.find(c => c.cardId === 'container')!;
      expect(lb.connections).toContain(container.instanceId);
    });

    it('plays a storage card onto the board', () => {
      const result = playCard(state, 'relational-db');
      expect(result.board).toHaveLength(1);
      expect(result.board[0].cardId).toBe('relational-db');
    });

    it('rejects if card not in deck', () => {
      let s = playCard(state, 'relational-db');
      // Only 1 relational-db in deck, second should fail
      s = playCard(s, 'relational-db');
      expect(s.board).toHaveLength(1);
    });

    it('rejects application cards (use playAppCard)', () => {
      const result = playCard(state, 'read-event');
      expect(result.board).toHaveLength(0);
    });

    it('rejects if not server turn', () => {
      const clientState = { ...state, phase: 'client-turn' as const };
      const result = playCard(clientState, 'container');
      expect(result.board).toHaveLength(0);
    });
  });

  describe('playAppCard', () => {
    it('connects app to compute and storage', () => {
      let s = playCard(state, 'container');
      s = playCard(s, 'kv-store');
      const compute = s.board.find(c => c.cardId === 'container')!;
      const storage = s.board.find(c => c.cardId === 'kv-store')!;
      s = playAppCard(s, 'read-event', compute.instanceId, storage.instanceId);
      expect(s.board).toHaveLength(3);
      const app = s.board.find(c => c.cardId === 'read-event')!;
      expect(app.connections).toContain(compute.instanceId);
      expect(app.connections).toContain(storage.instanceId);
    });

    it('rejects if compute has no free app slots', () => {
      let s = playCard(state, 'cloud-function'); // 1 app slot
      s = playCard(s, 'kv-store');
      const cf = s.board.find(c => c.cardId === 'cloud-function')!;
      const kv = s.board.find(c => c.cardId === 'kv-store')!;
      s = playAppCard(s, 'read-event', cf.instanceId, kv.instanceId);
      expect(s.board).toHaveLength(3); // app placed
      // Second app should fail (cloud function has only 1 slot)
      s = playAppCard(s, 'write-hold', cf.instanceId, kv.instanceId);
      expect(s.board).toHaveLength(3); // no change
    });

    it('rejects duplicate app types on same compute', () => {
      let s = playCard(state, 'container'); // 4 app slots
      s = playCard(s, 'kv-store');
      const compute = s.board.find(c => c.cardId === 'container')!;
      const storage = s.board.find(c => c.cardId === 'kv-store')!;
      s = playAppCard(s, 'read-event', compute.instanceId, storage.instanceId);
      // Second read-event on same compute should fail
      s = playAppCard(s, 'read-event', compute.instanceId, storage.instanceId);
      expect(s.board.filter(c => c.cardId === 'read-event')).toHaveLength(1);
    });

    it('rejects if storage has no free app slots', () => {
      // Relational DB has 5 app slots — fill them up
      let s = playCard(state, 'container');
      s = playCard(s, 'container');
      s = playCard(s, 'relational-db');
      const compute1 = s.board.find(c => c.cardId === 'container')!;
      const db = s.board.find(c => c.cardId === 'relational-db')!;

      // Play 5 different apps onto compute1 -> db (container has 4 slots)
      s = playAppCard(s, 'read-event', compute1.instanceId, db.instanceId);
      s = playAppCard(s, 'write-hold', compute1.instanceId, db.instanceId);
      s = playAppCard(s, 'write-payment', compute1.instanceId, db.instanceId);

      // Get second container for more apps
      const compute2 = s.board.filter(c => c.cardId === 'container')[1];
      s = playAppCard(s, 'read-event', compute2.instanceId, db.instanceId);
      s = playAppCard(s, 'write-hold', compute2.instanceId, db.instanceId);

      // DB now has 5 apps — next should fail
      const boardBefore = s.board.length;
      s = playAppCard(s, 'write-payment', compute2.instanceId, db.instanceId);
      expect(s.board).toHaveLength(boardBefore);
    });
  });

  describe('removeCard', () => {
    it('removes a card and returns it to deck', () => {
      let s = playCard(state, 'container');
      const container = s.board.find(c => c.cardId === 'container')!;
      s = removeCard(s, container.instanceId);
      expect(s.board).toHaveLength(0);
      expect(s.serverDeck.filter(c => c === 'container')).toHaveLength(2);
    });

    it('removes dependent app cards when removing compute', () => {
      let s = playCard(state, 'container');
      s = playCard(s, 'kv-store');
      const compute = s.board.find(c => c.cardId === 'container')!;
      const storage = s.board.find(c => c.cardId === 'kv-store')!;
      s = playAppCard(s, 'read-event', compute.instanceId, storage.instanceId);
      expect(s.board).toHaveLength(3);

      s = removeCard(s, compute.instanceId);
      // Container and read-event should both be removed
      expect(s.board).toHaveLength(1); // only kv-store remains
      expect(s.serverDeck.filter(c => c === 'container')).toHaveLength(2);
      expect(s.serverDeck.filter(c => c === 'read-event')).toHaveLength(8);
    });
  });

  describe('endServerTurn', () => {
    it('adds per-turn costs to scoreboard', () => {
      let s = playCard(state, 'least-connections-lb');  // 10/turn
      s = playCard(s, 'container');                      // 10/turn
      s = playCard(s, 'relational-db');                  // 10/turn
      s = playCard(s, 'kv-store');                       // 5/turn
      s = endServerTurn(s);
      expect(s.scoreboard.cost).toBe(35);
    });

    it('does not charge per-request costs at turn end', () => {
      let s = playCard(state, 'cloud-function'); // 1/request, NOT per-turn
      s = endServerTurn(s);
      expect(s.scoreboard.cost).toBe(0);
    });

    it('transitions to client-turn phase', () => {
      const s = endServerTurn(state);
      expect(s.phase).toBe('client-turn');
      expect(s.activePlayer).toBe('client');
    });
  });
});
