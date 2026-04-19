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
