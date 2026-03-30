import { describe, it, expect } from 'vitest';
import {
  getDefaultServerDeck, getDefaultClientDeck,
  getCardDef, getClientCardDef, isRequestCard, isEffectCard,
} from '../engine/cards';

describe('Server deck', () => {
  it('has exactly 30 cards', () => {
    expect(getDefaultServerDeck()).toHaveLength(30);
  });

  it('has correct quantities per card type', () => {
    const deck = getDefaultServerDeck();
    const counts: Record<string, number> = {};
    for (const id of deck) {
      counts[id] = (counts[id] ?? 0) + 1;
    }
    expect(counts['round-robin-lb']).toBe(1);
    expect(counts['least-connections-lb']).toBe(1);
    expect(counts['container']).toBe(2);
    expect(counts['cloud-function']).toBe(4);
    expect(counts['relational-db']).toBe(1);
    expect(counts['kv-store']).toBe(1);
    expect(counts['read-event']).toBe(8);
    expect(counts['write-hold']).toBe(6);
    expect(counts['write-payment']).toBe(6);
  });
});

describe('Client deck', () => {
  it('has exactly 30 cards', () => {
    expect(getDefaultClientDeck()).toHaveLength(30);
  });

  it('has correct quantities per card type', () => {
    const deck = getDefaultClientDeck();
    const counts: Record<string, number> = {};
    for (const id of deck) {
      counts[id] = (counts[id] ?? 0) + 1;
    }
    expect(counts['view-event']).toBe(10);
    expect(counts['hold-ticket']).toBe(5);
    expect(counts['purchase-ticket']).toBe(5);
    expect(counts['stampeding-herd']).toBe(1);
    expect(counts['race-condition']).toBe(3);
    expect(counts['server-error']).toBe(6);
  });

  it('has 20 request cards and 10 effect cards', () => {
    const deck = getDefaultClientDeck();
    const requests = deck.filter(isRequestCard);
    const effects = deck.filter(isEffectCard);
    expect(requests).toHaveLength(20);
    expect(effects).toHaveLength(10);
  });
});

describe('Card definitions', () => {
  it('getCardDef returns correct definition', () => {
    const container = getCardDef('container');
    expect(container.type).toBe('compute');
    expect(container.capacity).toBe(80);
    expect(container.costPerTurn).toBe(10);
    expect(container.appSlots).toBe(4);
  });

  it('getCardDef throws on unknown card', () => {
    expect(() => getCardDef('nonexistent')).toThrow('Unknown server card');
  });

  it('getClientCardDef returns correct definition', () => {
    const viewEvent = getClientCardDef('view-event');
    expect(viewEvent.type).toBe('request');
    expect(viewEvent.volume).toBe(10);
    expect(viewEvent.valuePerRequest).toBe(1);
    expect(viewEvent.requiresApp).toBe('read-event');
  });

  it('LC LB costs 10/turn (card def canonical)', () => {
    expect(getCardDef('least-connections-lb').costPerTurn).toBe(10);
  });

  it('RR LB costs 5/turn', () => {
    expect(getCardDef('round-robin-lb').costPerTurn).toBe(5);
  });

  it('KV Store is not durable and reduces cost by 1', () => {
    const kv = getCardDef('kv-store');
    expect(kv.durable).toBe(false);
    expect(kv.costReduction).toBe(1);
  });

  it('Relational DB is durable', () => {
    expect(getCardDef('relational-db').durable).toBe(true);
  });

  it('Cloud Function has per-request cost, no per-turn cost', () => {
    const cf = getCardDef('cloud-function');
    expect(cf.costPerRequest).toBe(1);
    expect(cf.costPerTurn).toBeUndefined();
  });

  it('Stampeding Herd attaches to any request', () => {
    expect(getClientCardDef('stampeding-herd').attachesTo).toBe('any');
  });

  it('Race Condition attaches to write requests', () => {
    expect(getClientCardDef('race-condition').attachesTo).toBe('write');
  });

  it('Server Error attaches to any request', () => {
    expect(getClientCardDef('server-error').attachesTo).toBe('any');
  });
});
