import type { ParsedEnemiesArea, ParsedEnemy } from './parse';
import { readSpriteAssetMetrics } from '../util/spriteMetrics';
import {
  escapeString,
  formatNumber,
  renderHeader,
  toConstName
} from '../util/render';

export function renderEnemyVisuals(area: ParsedEnemiesArea): string {
  const constants = area.enemies.map((enemy) => renderEnemyVisual(area, enemy));
  const constantNames = area.enemies.map((enemy) => `${toConstName(enemy.id)}_VISUAL`);
  return `${renderHeader(area.sourcePath)}${renderImport()}${constants.join(
    '\n\n'
  )}\n\nexport const ENEMY_VISUAL_SPECS = [${constantNames.join(
    ', '
  )}] as const satisfies ReadonlyArray<SpriteVisualSpec>;\n`;
}

function renderImport(): string {
  return "import type { SpriteVisualSpec } from './SpriteVisualSpec';\n\n";
}

function renderEnemyVisual(area: ParsedEnemiesArea, enemy: ParsedEnemy): string {
  const { sourceSizePx, worldSize } = readSpriteAssetMetrics({
    sourcePath: area.sourcePath,
    rowId: enemy.id,
    imagePath: enemy.visual.image
  });
  return `export const ${toConstName(enemy.id)}_VISUAL: SpriteVisualSpec = {
  archetypeId: '${escapeString(enemy.id)}',
  image: '${escapeString(enemy.visual.image)}',
  sourceSizePx: { width: ${formatNumber(sourceSizePx.width)}, height: ${formatNumber(sourceSizePx.height)} },
  worldSize: { width: ${formatNumber(worldSize.width)}, height: ${formatNumber(worldSize.height)} },
  anchor: { x: 0.5, y: 0.5 }
};`;
}
