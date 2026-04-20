import { describe, expect, it } from 'vitest';

import { buildSessionDefinition } from './buildSession';
import { PLAYABLE_MODE_CATALOG } from './playableModes';
import { resolveModePreset } from './presets';

describe('PLAYABLE_MODE_CATALOG', () => {
  it('contains only player-facing campaign and training entries sorted by order', () => {
    expect(PLAYABLE_MODE_CATALOG).toHaveLength(2);
    expect(PLAYABLE_MODE_CATALOG.map((entry) => entry.presetId)).toEqual([
      'campaign',
      'training'
    ]);
    expect([...PLAYABLE_MODE_CATALOG].sort((left, right) => left.order - right.order)).toEqual(
      PLAYABLE_MODE_CATALOG
    );
  });

  it('resolves every catalog entry to a buildable session definition', () => {
    for (const entry of PLAYABLE_MODE_CATALOG) {
      const preset = resolveModePreset(entry.presetId);
      expect(() => buildSessionDefinition(preset, { seed: 42 })).not.toThrow();
      const session = buildSessionDefinition(preset, { seed: 42 });
      expect(session.encounters.length).toBeGreaterThan(0);
    }
  });
});
