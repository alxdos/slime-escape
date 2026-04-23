import { parseWeaponsArea } from './parse';
import { renderWeaponAudio } from './renderAudio';
import { renderWeaponContent } from './renderContent';

import type { GeneratedFile } from '../util/atomicWrite';

const SOURCE_PATH = 'content/weapons.md';
const CONTENT_TARGET_PATH = 'src/shared/content/weapons.generated.ts';
const AUDIO_TARGET_PATH = 'src/main/audio/weaponAudio.generated.ts';

export const WEAPONS_AREA = {
  name: 'weapons',
  async render(): Promise<ReadonlyArray<GeneratedFile>> {
    const weaponsArea = await parseWeaponsArea(SOURCE_PATH);
    return [
      {
        path: CONTENT_TARGET_PATH,
        contents: renderWeaponContent(weaponsArea)
      },
      {
        path: AUDIO_TARGET_PATH,
        contents: renderWeaponAudio(weaponsArea)
      }
    ];
  }
};
