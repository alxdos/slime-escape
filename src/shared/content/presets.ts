export type ModePresetId =
  | 'campaign'
  | 'training'
  | 'pistolOnly'
  | 'sandbox'
  | 'sandbox-with-combat';

export type ModePreset = Readonly<{
  id: ModePresetId;
}>;

export const SANDBOX_PRESET: ModePreset = { id: 'sandbox' };
export const SANDBOX_WITH_COMBAT_PRESET: ModePreset = { id: 'sandbox-with-combat' };
export const TRAINING_PRESET: ModePreset = { id: 'training' };
export const CAMPAIGN_PRESET: ModePreset = { id: 'campaign' };
export const PISTOL_ONLY_PRESET: ModePreset = { id: 'pistolOnly' };

export const MODE_PRESET_REGISTRY: Readonly<Record<ModePresetId, ModePreset>> = {
  campaign: CAMPAIGN_PRESET,
  training: TRAINING_PRESET,
  pistolOnly: PISTOL_ONLY_PRESET,
  sandbox: SANDBOX_PRESET,
  'sandbox-with-combat': SANDBOX_WITH_COMBAT_PRESET
};

export function resolveModePreset(presetId: ModePresetId): ModePreset {
  return MODE_PRESET_REGISTRY[presetId];
}
