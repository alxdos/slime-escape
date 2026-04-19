export type ModePresetId = 'campaign' | 'training' | 'pistolOnly' | 'sandbox';

export type ModePreset = Readonly<{
  id: ModePresetId;
}>;

export const SANDBOX_PRESET: ModePreset = { id: 'sandbox' };
