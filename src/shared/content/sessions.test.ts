import { describe, expect, it } from 'vitest';

import { buildSessionDefinition } from './buildSession';
import { getPlayableModeCatalog, resolveModePreset } from './sessions';

describe('getPlayableModeCatalog', () => {
  it('contains only player-facing campaign and training entries sorted by order', () => {
    const catalog = getPlayableModeCatalog();

    expect(catalog).toHaveLength(2);
    expect(catalog.map((entry) => entry.presetId)).toEqual(['campaign', 'training']);
    expect([...catalog].sort((left, right) => left.order - right.order)).toEqual(catalog);
  });

  it('resolves every catalog entry to a buildable session definition', () => {
    for (const entry of getPlayableModeCatalog()) {
      const preset = resolveModePreset(entry.presetId);
      expect(() => buildSessionDefinition(preset, { seed: 42 })).not.toThrow();
      const session = buildSessionDefinition(preset, { seed: 42 });
      expect(session.encounters.length).toBeGreaterThan(0);
    }
  });
});
