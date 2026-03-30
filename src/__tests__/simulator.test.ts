import { describe, it, expect } from 'vitest';
import { simulateGame, runSimulation } from '../engine/simulator';

describe('Simulator', () => {
  it('completes a single game without crashing', () => {
    const result = simulateGame(42);
    expect(result.winner).toMatch(/^(server|client)$/);
    expect(result.scoreboard.requests).toBeGreaterThanOrEqual(0);
    expect(result.sla).toBeDefined();
  });

  it('produces deterministic results with same seed', () => {
    const r1 = simulateGame(123);
    const r2 = simulateGame(123);
    expect(r1.winner).toBe(r2.winner);
    expect(r1.scoreboard).toEqual(r2.scoreboard);
    expect(r1.sla.value).toBe(r2.sla.value);
  });

  it('produces different results with different seeds', () => {
    const results = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const r = simulateGame(i * 1000);
      results.add(`${r.sla.value}-${r.scoreboard.cost}`);
    }
    // Should have at least some variety
    expect(results.size).toBeGreaterThan(1);
  });

  it('runs a batch simulation and produces a report', () => {
    const report = runSimulation(50, 0);
    expect(report.totalGames).toBe(50);
    expect(report.serverWins + report.clientWins).toBe(50);
    expect(report.results).toHaveLength(50);
    expect(report.avgValue).toBeDefined();
    expect(report.avgUptime).toBeDefined();
    expect(report.avgEfficiency).toBeDefined();
    expect(report.minValue).toBeLessThanOrEqual(report.maxValue);
  });

  it('shows score distribution across many games', () => {
    const report = runSimulation(100, 0);
    // Just log the report for visibility during balancing
    console.log('=== Simulation Report (100 games) ===');
    console.log(`Server wins: ${report.serverWins}/${report.totalGames} (${(report.serverWins / report.totalGames * 100).toFixed(0)}%)`);
    console.log(`Avg Value: ${report.avgValue.toFixed(1)}`);
    console.log(`Avg Uptime: ${(report.avgUptime * 100).toFixed(1)}%`);
    console.log(`Avg Efficiency: ${report.avgEfficiency.toFixed(2)}`);
    console.log(`Avg Cost: ${report.avgCost.toFixed(1)}`);
    console.log(`Value range: ${report.minValue} to ${report.maxValue}`);

    // Basic sanity: at least some games should have non-zero scores
    expect(report.results.some(r => r.scoreboard.requests > 0)).toBe(true);
  });
});
