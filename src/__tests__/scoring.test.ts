import { describe, it, expect } from 'vitest';
import { computeSLAs, getWinner } from '../engine/scoring';
import { createGame } from '../engine/game';
import type { Scoreboard, GameState } from '../engine/types';

describe('computeSLAs', () => {
  it('calculates value = (consistency * 20) - cost', () => {
    const scoreboard: Scoreboard = { consistency: 14, availability: 18, cost: 113, requests: 18 };
    const sla = computeSLAs(scoreboard);
    expect(sla.value).toBe(14 * 20 - 113); // 167
  });

  it('calculates uptime = availability / requests', () => {
    const scoreboard: Scoreboard = { consistency: 10, availability: 9, cost: 50, requests: 10 };
    const sla = computeSLAs(scoreboard);
    expect(sla.uptime).toBe(0.9);
  });

  it('calculates efficiency = cost / requests', () => {
    const scoreboard: Scoreboard = { consistency: 10, availability: 10, cost: 80, requests: 10 };
    const sla = computeSLAs(scoreboard);
    expect(sla.efficiency).toBe(8);
  });

  it('server wins when all 3 SLAs pass', () => {
    const scoreboard: Scoreboard = { consistency: 14, availability: 18, cost: 113, requests: 18 };
    const sla = computeSLAs(scoreboard);
    expect(sla.valuePass).toBe(true);   // 167 > 50
    expect(sla.uptimePass).toBe(true);  // 1.0 > 0.95
    expect(sla.efficiencyPass).toBe(true); // 6.28 < 8
    expect(sla.serverWins).toBe(true);
  });

  it('client wins when value SLA fails', () => {
    const scoreboard: Scoreboard = { consistency: 2, availability: 10, cost: 100, requests: 10 };
    const sla = computeSLAs(scoreboard);
    expect(sla.value).toBe(2 * 20 - 100); // -60
    expect(sla.valuePass).toBe(false);
    expect(sla.serverWins).toBe(false);
  });

  it('client wins when uptime SLA fails', () => {
    const scoreboard: Scoreboard = { consistency: 100, availability: 9, cost: 50, requests: 10 };
    const sla = computeSLAs(scoreboard);
    expect(sla.uptime).toBe(0.9);
    expect(sla.uptimePass).toBe(false);
    expect(sla.serverWins).toBe(false);
  });

  it('client wins when efficiency SLA fails', () => {
    const scoreboard: Scoreboard = { consistency: 100, availability: 10, cost: 100, requests: 10 };
    const sla = computeSLAs(scoreboard);
    expect(sla.efficiency).toBe(10);
    expect(sla.efficiencyPass).toBe(false);
    expect(sla.serverWins).toBe(false);
  });

  it('handles 0 requests without division by zero', () => {
    const scoreboard: Scoreboard = { consistency: 0, availability: 0, cost: 50, requests: 0 };
    const sla = computeSLAs(scoreboard);
    expect(sla.uptime).toBe(1);
    expect(sla.efficiency).toBe(0);
    expect(sla.uptimePass).toBe(true);
    expect(sla.efficiencyPass).toBe(true);
  });
});

describe('getWinner', () => {
  it('returns null if game is not over', () => {
    const state = createGame();
    expect(getWinner(state)).toBeNull();
  });

  it('returns server when all SLAs pass', () => {
    const state: GameState = {
      ...createGame(),
      phase: 'game-over',
      scoreboard: { consistency: 14, availability: 18, cost: 113, requests: 18 },
    };
    expect(getWinner(state)).toBe('server');
  });

  it('returns client when any SLA fails', () => {
    const state: GameState = {
      ...createGame(),
      phase: 'game-over',
      scoreboard: { consistency: 1, availability: 10, cost: 100, requests: 10 },
    };
    expect(getWinner(state)).toBe('client');
  });
});
