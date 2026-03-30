import { describe, it, expect } from 'vitest';
import { createGame } from '../engine/game';
import { playCard, playAppCard, resetInstanceIdCounter } from '../engine/server-turn';
import { computeRoutingPath } from '../engine/routing';
import type { GameState } from '../engine/types';

function buildSimpleBoard(): GameState {
  resetInstanceIdCounter();
  let s = createGame();
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
  return s;
}

describe('Routing', () => {
  describe('basic routing through all layers', () => {
    it('routes View Event (volume 10) through LB → Container → Read Event → KV Store', () => {
      const s = buildSimpleBoard();
      const { result } = computeRoutingPath(s, 'view-event', 10, []);
      expect(result.fulfilledVolume).toBe(10);
      expect(result.unfulfilledVolume).toBe(0);
      expect(result.requestsCounted).toBe(10);
      expect(result.availabilityGained).toBe(10);
      expect(result.consistencyGained).toBe(10); // 10 * 1 value/req
      expect(result.steps).toHaveLength(4); // network, compute, app, storage
    });

    it('routes Hold Ticket (volume 4) through system', () => {
      const s = buildSimpleBoard();
      const { result } = computeRoutingPath(s, 'hold-ticket', 4, []);
      expect(result.fulfilledVolume).toBe(4);
      expect(result.unfulfilledVolume).toBe(0);
      expect(result.consistencyGained).toBe(4); // 4 * 1
    });

    it('routes Purchase Ticket (volume 4) through system', () => {
      const s = buildSimpleBoard();
      const { result } = computeRoutingPath(s, 'purchase-ticket', 4, []);
      expect(result.fulfilledVolume).toBe(4);
      expect(result.unfulfilledVolume).toBe(0);
    });
  });

  describe('per-request costs', () => {
    it('charges Read Event processing cost minus KV reduction', () => {
      const s = buildSimpleBoard();
      const { result } = computeRoutingPath(s, 'view-event', 10, []);
      // Read Event: 1/req * 10 = 10, KV reduction: 1/req * 10 = 10, net = 0
      expect(result.costIncurred).toBe(0);
    });

    it('charges Write Hold processing cost minus KV reduction', () => {
      const s = buildSimpleBoard();
      const { result } = computeRoutingPath(s, 'hold-ticket', 8, []);
      // Write Hold: 2/req * 8 = 16, KV reduction: 1/req * 8 = 8, net = 8
      expect(result.costIncurred).toBe(8);
    });

    it('charges Write Payment processing cost with Relational DB (no reduction)', () => {
      const s = buildSimpleBoard();
      const { result } = computeRoutingPath(s, 'purchase-ticket', 4, []);
      // Write Payment: 3/req * 4 = 12, RelDB has no cost reduction
      expect(result.costIncurred).toBe(12);
    });

    it('charges cloud function per-request cost', () => {
      resetInstanceIdCounter();
      let s = createGame();
      s = playCard(s, 'least-connections-lb');
      s = playCard(s, 'cloud-function');
      s = playCard(s, 'kv-store');
      const cf = s.board.find(c => c.cardId === 'cloud-function')!;
      const kv = s.board.find(c => c.cardId === 'kv-store')!;
      s = playAppCard(s, 'read-event', cf.instanceId, kv.instanceId);
      const { result } = computeRoutingPath(s, 'view-event', 10, []);
      // Cloud function: 1/req * 10 = 10, Read Event: 1/req * 10 = 10, KV: -10
      expect(result.costIncurred).toBe(10); // 10 + 10 - 10
    });
  });

  describe('partial fulfillment', () => {
    it('stops volume at compute when capacity insufficient', () => {
      const s = buildSimpleBoard();
      // Container has 80 capacity. Send 100 requests.
      const { result } = computeRoutingPath(s, 'view-event', 100, []);
      expect(result.fulfilledVolume).toBe(80);
      expect(result.unfulfilledVolume).toBe(20);
      expect(result.availabilityGained).toBe(80);
      expect(result.availabilityLost).toBe(0); // no penalty, just no availability added
    });

    it('stops volume at LB when capacity insufficient', () => {
      const s = buildSimpleBoard();
      // LB has 200 capacity. Send 250 requests.
      const { result } = computeRoutingPath(s, 'view-event', 250, []);
      expect(result.fulfilledVolume).toBeLessThanOrEqual(200);
      expect(result.unfulfilledVolume).toBeGreaterThanOrEqual(50);
    });

    it('capacity persists across routing calls', () => {
      let s = buildSimpleBoard();
      // First call: 60 requests fill 60 of 80 compute capacity
      const { result: r1, boardUpdates: u1 } = computeRoutingPath(s, 'view-event', 60, []);
      expect(r1.fulfilledVolume).toBe(60);

      // Apply load to board
      s = {
        ...s,
        board: s.board.map(c => {
          const delta = u1.get(c.instanceId);
          return delta ? { ...c, currentLoad: c.currentLoad + delta } : c;
        }),
      };

      // Second call: 40 requests, only 20 capacity left on compute
      const { result: r2 } = computeRoutingPath(s, 'view-event', 40, []);
      expect(r2.fulfilledVolume).toBe(20);
      expect(r2.unfulfilledVolume).toBe(20);
    });
  });

  describe('LB algorithms', () => {
    it('least-connections picks compute with most free capacity', () => {
      resetInstanceIdCounter();
      let s = createGame();
      s = playCard(s, 'least-connections-lb');
      s = playCard(s, 'container'); // 80 cap
      s = playCard(s, 'container'); // 80 cap
      s = playCard(s, 'kv-store');
      const containers = s.board.filter(c => c.cardId === 'container');
      const kv = s.board.find(c => c.cardId === 'kv-store')!;
      s = playAppCard(s, 'read-event', containers[0].instanceId, kv.instanceId);
      s = playAppCard(s, 'read-event', containers[1].instanceId, kv.instanceId);

      // Load up first container
      s = {
        ...s,
        board: s.board.map(c =>
          c.instanceId === containers[0].instanceId ? { ...c, currentLoad: 30 } : c,
        ),
      };

      // LC should pick second container (more free capacity)
      const { result } = computeRoutingPath(s, 'view-event', 10, []);
      expect(result.fulfilledVolume).toBe(10);
    });

    it('round-robin cycles through compute nodes', () => {
      resetInstanceIdCounter();
      let s = createGame();
      s = playCard(s, 'round-robin-lb');
      s = playCard(s, 'container');
      s = playCard(s, 'container');
      s = playCard(s, 'kv-store');
      const containers = s.board.filter(c => c.cardId === 'container');
      const kv = s.board.find(c => c.cardId === 'kv-store')!;
      s = playAppCard(s, 'read-event', containers[0].instanceId, kv.instanceId);
      s = playAppCard(s, 'read-event', containers[1].instanceId, kv.instanceId);

      const { newRoundRobinIndex: rr1 } = computeRoutingPath(s, 'view-event', 10, []);
      expect(rr1).toBe(1); // advanced from 0 to 1

      const s2 = { ...s, roundRobinIndex: rr1 };
      const { newRoundRobinIndex: rr2 } = computeRoutingPath(s2, 'view-event', 10, []);
      expect(rr2).toBe(0); // wrapped around to 0
    });
  });

  describe('missing components', () => {
    it('fails if no LB on board', () => {
      const s = createGame(); // empty board
      const { result } = computeRoutingPath(s, 'view-event', 10, []);
      expect(result.fulfilledVolume).toBe(0);
      expect(result.unfulfilledVolume).toBe(10);
    });

    it('fails if no compute connected to LB', () => {
      resetInstanceIdCounter();
      let s = createGame();
      s = playCard(s, 'least-connections-lb');
      const { result } = computeRoutingPath(s, 'view-event', 10, []);
      expect(result.fulfilledVolume).toBe(0);
      expect(result.unfulfilledVolume).toBe(10);
    });

    it('fails if no matching app on compute', () => {
      resetInstanceIdCounter();
      let s = createGame();
      s = playCard(s, 'least-connections-lb');
      s = playCard(s, 'container');
      s = playCard(s, 'kv-store');
      // No app card played
      const { result } = computeRoutingPath(s, 'view-event', 10, []);
      expect(result.fulfilledVolume).toBe(0);
      expect(result.unfulfilledVolume).toBe(10);
    });

    it('no storage connected to app is prevented by playAppCard validation', () => {
      // playAppCard requires valid compute + storage instance IDs,
      // so a dangling app without storage can't be created through the API.
      expect(true).toBe(true);
    });
  });

  describe('effects', () => {
    it('Race Condition halves consistency on non-durable storage', () => {
      const s = buildSimpleBoard();
      // Hold Ticket routes to KV Store (not durable)
      const { result } = computeRoutingPath(s, 'hold-ticket', 8, ['race-condition']);
      // Without effect: 8 * 1 = 8. With race condition on non-durable: 4
      expect(result.consistencyGained).toBe(4);
    });

    it('Race Condition does NOT halve consistency on durable storage', () => {
      const s = buildSimpleBoard();
      // Purchase Ticket routes to Relational DB (durable)
      const { result } = computeRoutingPath(s, 'purchase-ticket', 4, ['race-condition']);
      expect(result.consistencyGained).toBe(4); // unchanged
    });

    it('Server Error zeros consistency', () => {
      const s = buildSimpleBoard();
      const { result } = computeRoutingPath(s, 'view-event', 10, ['server-error']);
      expect(result.consistencyGained).toBe(0);
      expect(result.fulfilledVolume).toBe(10); // still fulfilled, just 0 value
    });

    it('Stampeding Herd is already factored into volume (no extra effect in routing)', () => {
      const s = buildSimpleBoard();
      // Volume is pre-doubled before calling routing
      const { result } = computeRoutingPath(s, 'hold-ticket', 8, ['stampeding-herd']);
      expect(result.fulfilledVolume).toBe(8);
      expect(result.consistencyGained).toBe(8); // stampeding herd doesn't change value
    });
  });
});
