import type { ModePreset, ModePresetId } from './sessions';

export type { ModePreset, ModePresetId } from './sessions';

export const SANDBOX_PRESET: ModePreset = { id: 'sandbox' };
export const SANDBOX_WITH_COMBAT_PRESET: ModePreset = { id: 'sandbox-with-combat' };
export const TRAINING_PRESET: ModePreset = { id: 'training' };
export const CAMPAIGN_PRESET: ModePreset = { id: 'campaign' };

export const MODE_PRESET_REGISTRY: Readonly<Record<ModePresetId, ModePreset>> = {
  campaign: CAMPAIGN_PRESET,
  training: TRAINING_PRESET,
  sandbox: SANDBOX_PRESET,
  'sandbox-with-combat': SANDBOX_WITH_COMBAT_PRESET
};

export function resolveModePreset(presetId: ModePresetId): ModePreset {
  return MODE_PRESET_REGISTRY[presetId];
}
