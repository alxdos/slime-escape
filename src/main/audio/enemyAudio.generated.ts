// AUTO-GENERATED from content/enemies.md by `npm run content:build`.
// Do not edit by hand.
import type { EnemyAudioMapping } from './AudioMappings';

const SLIME_HIT_VARIANTS = Object.freeze([
  'slimes/hit-1',
  'slimes/hit-2',
  'slimes/hit-3',
  'slimes/hit-4'
]);

const SLIME_DEATH_VARIANTS = Object.freeze([
  'slimes/death-1',
  'slimes/death-2',
  'slimes/death-3',
  'slimes/death-4'
]);

const SLIME_VOICE_VARIANTS = Object.freeze([
  'slimes/voice-1',
  'slimes/voice-2',
  'slimes/voice-3',
  'slimes/voice-4'
]);

export const ENEMY_AUDIO_MAPPINGS: Readonly<Record<string, EnemyAudioMapping>> = Object.freeze({
  'training-target': Object.freeze({}),
  'slime-fast': Object.freeze({
    hit: SLIME_HIT_VARIANTS,
    death: SLIME_DEATH_VARIANTS,
    voice: Object.freeze({
      sample: SLIME_VOICE_VARIANTS,
      intervalMinMs: 3000,
      intervalMaxMs: 6000
    })
  }),
  'slime-tank': Object.freeze({
    hit: SLIME_HIT_VARIANTS,
    death: SLIME_DEATH_VARIANTS,
    voice: Object.freeze({
      sample: SLIME_VOICE_VARIANTS,
      intervalMinMs: 3500,
      intervalMaxMs: 7000
    })
  })
});
