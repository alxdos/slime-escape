import { describe, expect, it } from 'vitest';

import { buildSessionDefinition } from './buildSession';
import { getOnlineModeCatalog, getPlayableModeCatalog, resolveModePreset } from './sessions';

describe('getPlayableModeCatalog', () => {
  it('contains player-facing entries sorted by order', () => {
    const catalog = getPlayableModeCatalog();

    expect(catalog).toHaveLength(3);
    expect(catalog.map((entry) => entry.presetId)).toEqual([
      'campaign-easy',
      'campaign-normal',
      'campaign-hard'
    ]);
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

describe('getOnlineModeCatalog', () => {
  it('contains online entries sorted by content order', () => {
    const catalog = getOnlineModeCatalog();

    expect(catalog.map((entry) => entry.presetId)).toEqual(['public-arena', 'coop-slime']);
    expect(catalog.map((entry) => entry.displayName)).toEqual([
      'Public Arena',
      'Co-Op vs Slimes'
    ]);
    expect(catalog.map((entry) => entry.online.lobbyKind)).toEqual([
      'none',
      'hostControlled'
    ]);
    expect([...catalog].sort((left, right) => left.order - right.order)).toEqual(catalog);
  });
});
