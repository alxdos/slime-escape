import { parseWeaponsArea, type ParsedWeaponsArea } from './parse';
import { renderWeaponAudio } from './renderAudio';
import { renderWeaponContent } from './renderContent';
import { renderProjectileVisuals } from './renderVisuals';

import type { GeneratedFile } from '../util/atomicWrite';
import { ContentBuildError } from '../util/require';

const SOURCE_PATH = 'content/weapons.md';
const CONTENT_TARGET_PATH = 'src/shared/content/weapons.generated.ts';
const AUDIO_TARGET_PATH = 'src/main/audio/weaponAudio.generated.ts';
const PROJECTILE_VISUALS_TARGET_PATH = 'src/main/render/projectileVisuals.generated.ts';

export const WEAPONS_AREA = {
  name: 'weapons',
  async render(): Promise<ReadonlyArray<GeneratedFile>> {
    const weaponsArea = await parseWeaponsArea(SOURCE_PATH);
    assertProjectileVisualSizeConsistency(weaponsArea);
    return [
      {
        path: CONTENT_TARGET_PATH,
        contents: renderWeaponContent(weaponsArea)
      },
      {
        path: AUDIO_TARGET_PATH,
        contents: renderWeaponAudio(weaponsArea)
      },
      {
        path: PROJECTILE_VISUALS_TARGET_PATH,
        contents: renderProjectileVisuals(weaponsArea)
      }
    ];
  }
};

function assertProjectileVisualSizeConsistency(area: ParsedWeaponsArea): void {
  for (const weapon of area.weapons) {
    const worldSize = weapon.projectileSpriteVisual.worldSize;
    const projectileSize = weapon.projectile.size;
    if (
      !nearlyEqual(worldSize.width, projectileSize.width) ||
      !nearlyEqual(worldSize.height, projectileSize.height)
    ) {
      throw new ContentBuildError(
        `${area.sourcePath}: weapon "${weapon.id}" projectile.size must derive from projectile visual worldSize`
      );
    }
  }
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-9;
}
