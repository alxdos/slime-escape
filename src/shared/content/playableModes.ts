import { buildSessionDefinition } from './buildSession';
import { resolveModePreset, type ModePresetId } from './presets';
import { getPlayableModeCatalog, type PlayableModeEntry } from './sessions';

export type { PlayableModeEntry } from './sessions';

export const PLAYABLE_MODE_CATALOG: ReadonlyArray<PlayableModeEntry> = getPlayableModeCatalog();

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
