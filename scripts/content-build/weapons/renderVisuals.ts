import type { ParsedWeapon, ParsedWeaponsArea } from './parse';
import { escapeString, formatNumber, renderHeader, toConstName } from '../util/render';

export function renderProjectileVisuals(area: ParsedWeaponsArea): string {
  return `${renderHeader(area.sourcePath)}${renderImport()}${area.weapons
    .map(renderProjectileVisual)
    .join('\n\n')}\n\n${renderProjectileVisualSpecs(area.weapons)}\n`;
}

function renderImport(): string {
  return "import type { SpriteVisualSpec } from './SpriteVisualSpec';\n\n";
}

function renderProjectileVisual(weapon: ParsedWeapon): string {
  const visual = weapon.projectileSpriteVisual;
  return `export const ${toConstName(weapon.id)}_PROJECTILE_VISUAL: SpriteVisualSpec = {
  archetypeId: '${escapeString(weapon.id)}',
  image: '${escapeString(visual.image)}',
  sourceSizePx: { width: ${formatNumber(visual.sourceSizePx.width)}, height: ${formatNumber(visual.sourceSizePx.height)} },
  worldSize: { width: ${formatNumber(visual.worldSize.width)}, height: ${formatNumber(visual.worldSize.height)} },
  anchor: { x: 0.5, y: 0.5 }
};`;
}

function renderProjectileVisualSpecs(weapons: ReadonlyArray<ParsedWeapon>): string {
  const constNames = weapons.map((weapon) => `${toConstName(weapon.id)}_PROJECTILE_VISUAL`);
  return `export const PROJECTILE_VISUAL_SPECS = [${constNames.join(', ')}] as const satisfies ReadonlyArray<SpriteVisualSpec>;`;
}
