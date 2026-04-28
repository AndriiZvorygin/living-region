import { describe, expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';

describe('CLI compare', () => {
  test('demo compare command exits successfully', () => {
    const result = spawnSync('node', ['command/run_demo_compare.mjs'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('No Adaptation');
    expect(result.stdout).toContain('Adaptation');
    expect(result.stdout).toContain('transportDieselDemandLitre');
    expect(result.stdout).toContain('nonDieselPassengerKm');
  });
});
