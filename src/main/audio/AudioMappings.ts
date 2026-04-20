import { log as defaultLog, type Log } from '../../shared/log';

import type { SampleRegistry } from './SampleRegistry';
import type { AudioUiEventId } from './Audio';

export type SampleSpec = string | ReadonlyArray<string>;

export type VoiceSampleSpec = Readonly<{
  sample: SampleSpec;
  intervalMinMs: number;
  intervalMaxMs: number;
}>;

export type EnemyAudioMapping = Readonly<{
  hit?: SampleSpec;
  death?: SampleSpec;
  voice?: VoiceSampleSpec;
}>;

export type BossAudioMapping = Readonly<{
  fire?: SampleSpec;
  hit?: SampleSpec;
  death?: SampleSpec;
  phaseChange?: SampleSpec;
}>;

export type EventAudioMapping = Readonly<{
  dropPickup?: SampleSpec;
  dropSpawn?: SampleSpec;
  dropExpire?: SampleSpec;
  uiOverlayShow?: SampleSpec;
  uiButtonClick?: SampleSpec;
}>;

export type AudioMappingsInit = Readonly<{
  sampleRegistry: Pick<SampleRegistry, 'require'>;
  log?: Log;
  random?: () => number;
}>;

export type ResolvedVoiceSampleSpec = Readonly<{
  sampleIds: ReadonlyArray<string>;
  intervalMinMs: number;
  intervalMaxMs: number;
}>;

export type AudioMappings = Readonly<{
  resolveWeaponFire(weaponArchetypeId: string): string | null;
  resolveEnemySample(kind: 'hit' | 'death', enemyArchetypeId: string): string | null;
  resolveEnemyVoice(enemyArchetypeId: string): ResolvedVoiceSampleSpec | null;
  resolveBossSample(
    kind: 'fire' | 'hit' | 'death' | 'phaseChange',
    bossArchetypeId: string
  ): string | null;
  resolveEventSample(kind: keyof EventAudioMapping): string | null;
  resolveUiSample(eventId: AudioUiEventId): string | null;
}>;

const SLIME_VARIANTS = Object.freeze([
  'slimes/hit-1',
  'slimes/hit-2',
  'slimes/hit-3',
  'slimes/hit-4'
]);

const WEAPON_AUDIO_MAPPINGS: Readonly<Record<string, Readonly<{ fire: SampleSpec }>>> =
  Object.freeze({
  pistol: Object.freeze({ fire: 'weapons/pistol' }),
  shotgun: Object.freeze({ fire: 'weapons/shotgun' }),
  smg: Object.freeze({ fire: 'weapons/smg' }),
  sniper: Object.freeze({ fire: 'weapons/sniper' }),
  laser: Object.freeze({ fire: 'weapons/laser' })
  });

const ENEMY_AUDIO_MAPPINGS: Readonly<Record<string, EnemyAudioMapping>> = Object.freeze({
  'training-target': Object.freeze({}),
  'slime-fast': Object.freeze({
    hit: SLIME_VARIANTS,
    death: SLIME_VARIANTS,
    voice: Object.freeze({
      sample: SLIME_VARIANTS,
      intervalMinMs: 3000,
      intervalMaxMs: 6000
    })
  }),
  'slime-tank': Object.freeze({
    hit: SLIME_VARIANTS,
    death: SLIME_VARIANTS,
    voice: Object.freeze({
      sample: SLIME_VARIANTS,
      intervalMinMs: 3500,
      intervalMaxMs: 7000
    })
  })
});

const BOSS_AUDIO_MAPPINGS: Readonly<Record<string, BossAudioMapping>> = Object.freeze({
  'slime-king': Object.freeze({
    fire: 'boss/boss-fireball',
    phaseChange: 'boss/boss-ahaha'
  })
});

const EVENT_AUDIO_MAPPINGS: EventAudioMapping = Object.freeze({
  dropPickup: 'ui/open-2',
  uiOverlayShow: ['ui/open-1', 'ui/open-2'],
  uiButtonClick: ['ui/switch-1', 'ui/switch-2', 'ui/switch-3', 'ui/switch-4']
});

export function createAudioMappings(init: AudioMappingsInit): AudioMappings {
  const audioLog = init.log ?? defaultLog;
  const warnedMissingMappings = new Set<string>();

  validateMappings(init.sampleRegistry);

  function warnMissing(mappingKey: string): void {
    if (warnedMissingMappings.has(mappingKey)) {
      return;
    }
    warnedMissingMappings.add(mappingKey);
    audioLog.warn('audio mapping missing; skipping playback', {
      mappingKey
    });
  }

  function resolveSampleSpec(
    sampleSpec: SampleSpec | undefined,
    mappingKey: string
  ): string | null {
    if (sampleSpec === undefined) {
      warnMissing(mappingKey);
      return null;
    }
    return pickSampleId(sampleSpec, init.random ?? Math.random);
  }

  return {
    resolveWeaponFire(weaponArchetypeId): string | null {
      return resolveSampleSpec(
        WEAPON_AUDIO_MAPPINGS[weaponArchetypeId]?.fire,
        `weapons.${weaponArchetypeId}.fire`
      );
    },
    resolveEnemySample(kind, enemyArchetypeId): string | null {
      return resolveSampleSpec(
        ENEMY_AUDIO_MAPPINGS[enemyArchetypeId]?.[kind],
        `enemies.${enemyArchetypeId}.${kind}`
      );
    },
    resolveEnemyVoice(enemyArchetypeId): ResolvedVoiceSampleSpec | null {
      const voiceSpec = ENEMY_AUDIO_MAPPINGS[enemyArchetypeId]?.voice;
      if (voiceSpec === undefined) {
        warnMissing(`enemies.${enemyArchetypeId}.voice`);
        return null;
      }

      return {
        sampleIds: normalizeSampleSpec(voiceSpec.sample),
        intervalMinMs: voiceSpec.intervalMinMs,
        intervalMaxMs: voiceSpec.intervalMaxMs
      };
    },
    resolveBossSample(kind, bossArchetypeId): string | null {
      return resolveSampleSpec(
        BOSS_AUDIO_MAPPINGS[bossArchetypeId]?.[kind],
        `bosses.${bossArchetypeId}.${kind}`
      );
    },
    resolveEventSample(kind): string | null {
      return resolveSampleSpec(EVENT_AUDIO_MAPPINGS[kind], `events.${kind}`);
    },
    resolveUiSample(eventId): string | null {
      switch (eventId) {
        case 'overlayShow':
          return resolveSampleSpec(EVENT_AUDIO_MAPPINGS.uiOverlayShow, 'events.uiOverlayShow');
        case 'buttonClick':
          return resolveSampleSpec(EVENT_AUDIO_MAPPINGS.uiButtonClick, 'events.uiButtonClick');
        default:
          return eventId satisfies never;
      }
    }
  };
}

function validateMappings(sampleRegistry: Pick<SampleRegistry, 'require'>): void {
  for (const mapping of Object.values(WEAPON_AUDIO_MAPPINGS)) {
    validateSampleSpec(mapping.fire, sampleRegistry);
  }

  for (const mapping of Object.values(ENEMY_AUDIO_MAPPINGS)) {
    validateOptionalSampleSpec(mapping.hit, sampleRegistry);
    validateOptionalSampleSpec(mapping.death, sampleRegistry);
    if (mapping.voice !== undefined) {
      validateSampleSpec(mapping.voice.sample, sampleRegistry);
    }
  }

  for (const mapping of Object.values(BOSS_AUDIO_MAPPINGS)) {
    validateOptionalSampleSpec(mapping.fire, sampleRegistry);
    validateOptionalSampleSpec(mapping.hit, sampleRegistry);
    validateOptionalSampleSpec(mapping.death, sampleRegistry);
    validateOptionalSampleSpec(mapping.phaseChange, sampleRegistry);
  }

  validateOptionalSampleSpec(EVENT_AUDIO_MAPPINGS.dropPickup, sampleRegistry);
  validateOptionalSampleSpec(EVENT_AUDIO_MAPPINGS.dropSpawn, sampleRegistry);
  validateOptionalSampleSpec(EVENT_AUDIO_MAPPINGS.dropExpire, sampleRegistry);
  validateOptionalSampleSpec(EVENT_AUDIO_MAPPINGS.uiOverlayShow, sampleRegistry);
  validateOptionalSampleSpec(EVENT_AUDIO_MAPPINGS.uiButtonClick, sampleRegistry);
}

function validateOptionalSampleSpec(
  sampleSpec: SampleSpec | undefined,
  sampleRegistry: Pick<SampleRegistry, 'require'>
): void {
  if (sampleSpec === undefined) {
    return;
  }
  validateSampleSpec(sampleSpec, sampleRegistry);
}

function validateSampleSpec(
  sampleSpec: SampleSpec,
  sampleRegistry: Pick<SampleRegistry, 'require'>
): void {
  for (const sampleId of normalizeSampleSpec(sampleSpec)) {
    sampleRegistry.require(sampleId);
  }
}

function pickSampleId(sampleSpec: SampleSpec, random: () => number): string {
  const sampleIds = normalizeSampleSpec(sampleSpec);
  if (sampleIds.length === 1) {
    const sampleId = sampleIds[0];
    if (sampleId === undefined) {
      throw new Error('audio mapping resolved an empty sample list');
    }
    return sampleId;
  }

  const clampedRandom = Math.min(0.999999, Math.max(0, random()));
  const index = Math.floor(clampedRandom * sampleIds.length);
  const sampleId = sampleIds[index];
  if (sampleId === undefined) {
    throw new Error('audio mapping selected an out-of-range sample index');
  }
  return sampleId;
}

function normalizeSampleSpec(sampleSpec: SampleSpec): ReadonlyArray<string> {
  return typeof sampleSpec === 'string' ? [sampleSpec] : sampleSpec;
}
