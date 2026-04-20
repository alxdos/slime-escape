import { describe, expect, it, vi } from 'vitest';

import type { Log } from '../../shared/log';

import { createAudioMappings } from './AudioMappings';
import type { SampleRegistry } from './SampleRegistry';

function createLogHarness(): Log {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };
}

function createSampleRegistryHarness(): Pick<SampleRegistry, 'require'> {
  const knownSamples = new Set<string>([
    'weapons/pistol',
    'weapons/shotgun',
    'weapons/smg',
    'weapons/sniper',
    'weapons/laser',
    'slimes/hit-1',
    'slimes/hit-2',
    'slimes/hit-3',
    'slimes/hit-4',
    'boss/boss-fireball',
    'boss/boss-ahaha',
    'ui/open-1',
    'ui/open-2',
    'ui/switch-1',
    'ui/switch-2',
    'ui/switch-3',
    'ui/switch-4'
  ]);

  return {
    require(sampleId: string) {
      if (!knownSamples.has(sampleId)) {
        throw new Error(`missing sample ${sampleId}`);
      }
      return {
        id: sampleId,
        url: `/${sampleId}.mp3`,
        category: 'sfx',
        normalizedGain: 1,
        defaultGain: 1
      };
    }
  };
}

describe('createAudioMappings', () => {
  it('selects a deterministic sample from SampleSpec arrays using injected random', () => {
    const mappings = createAudioMappings({
      sampleRegistry: createSampleRegistryHarness(),
      random: () => 0.74
    });

    expect(mappings.resolveEnemySample('hit', 'slime-fast')).toBe('slimes/hit-3');
    expect(mappings.resolveUiSample('buttonClick')).toBe('ui/switch-3');
  });

  it('warns once per unique missing mapping key and skips playback', () => {
    const log = createLogHarness();
    const mappings = createAudioMappings({
      sampleRegistry: createSampleRegistryHarness(),
      log
    });

    expect(mappings.resolveWeaponFire('missing-weapon')).toBeNull();
    expect(mappings.resolveWeaponFire('missing-weapon')).toBeNull();
    expect(mappings.resolveEnemySample('death', 'training-target')).toBeNull();

    expect(log.warn).toHaveBeenCalledTimes(2);
    expect(log.warn).toHaveBeenNthCalledWith(1, 'audio mapping missing; skipping playback', {
      mappingKey: 'weapons.missing-weapon.fire'
    });
    expect(log.warn).toHaveBeenNthCalledWith(2, 'audio mapping missing; skipping playback', {
      mappingKey: 'enemies.training-target.death'
    });
  });

  it('validates all mapped sample ids against the registry during initialization', () => {
    const brokenRegistry: Pick<SampleRegistry, 'require'> = {
      require(sampleId: string) {
        if (sampleId === 'ui/open-2') {
          throw new Error(`missing sample ${sampleId}`);
        }
        return {
          id: sampleId,
          url: `/${sampleId}.mp3`,
          category: 'sfx',
          normalizedGain: 1,
          defaultGain: 1
        };
      }
    };

    expect(() =>
      createAudioMappings({
        sampleRegistry: brokenRegistry
      })
    ).toThrow('missing sample ui/open-2');
  });

  it('resolves configured boss, event and voice mappings', () => {
    const mappings = createAudioMappings({
      sampleRegistry: createSampleRegistryHarness(),
      random: () => 0
    });

    expect(mappings.resolveBossSample('fire', 'slime-king')).toBe('boss/boss-fireball');
    expect(mappings.resolveEventSample('dropPickup')).toBe('ui/open-2');
    expect(mappings.resolveUiSample('overlayShow')).toBe('ui/open-1');
    expect(mappings.resolveEnemyVoice('slime-tank')).toEqual({
      sampleIds: ['slimes/hit-1', 'slimes/hit-2', 'slimes/hit-3', 'slimes/hit-4'],
      intervalMinMs: 3500,
      intervalMaxMs: 7000
    });
  });
});
