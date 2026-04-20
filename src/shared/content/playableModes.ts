import { buildSessionDefinition } from './buildSession';
import { resolveModePreset, type ModePresetId } from './presets';

export type PlayableModeEntry = Readonly<{
  presetId: ModePresetId;
  displayName: string;
  description: string;
  order: number;
}>;

const PLAYABLE_MODE_CATALOG_UNSORTED: ReadonlyArray<PlayableModeEntry> = [
  {
    presetId: 'campaign',
    displayName: 'Побег',
    description: 'Основной забег: три волны, передышки и финальный босс.',
    order: 0
  },
  {
    presetId: 'training',
    displayName: 'Тренировка',
    description: 'Короткая сессия без босса, чтобы размяться и проверить сборку.',
    order: 1
  }
];

export const PLAYABLE_MODE_CATALOG: ReadonlyArray<PlayableModeEntry> = [
  ...PLAYABLE_MODE_CATALOG_UNSORTED
].sort((left, right) => left.order - right.order);

validatePlayableModeCatalog(PLAYABLE_MODE_CATALOG);

function validatePlayableModeCatalog(catalog: ReadonlyArray<PlayableModeEntry>): void {
  const seenPresetIds = new Set<ModePresetId>();

  for (const entry of catalog) {
    if (seenPresetIds.has(entry.presetId)) {
      throw new Error(`duplicate playable mode presetId: ${entry.presetId}`);
    }
    seenPresetIds.add(entry.presetId);

    const preset = resolveModePreset(entry.presetId);
    buildSessionDefinition(preset, {
      seed: 0,
      id: `playable-mode-validation:${entry.presetId}`
    });
  }
}
