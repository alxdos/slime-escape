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
