import type { ParsedBoss, ParsedBossesArea } from './parse';
import { readSpriteAssetMetrics } from '../util/spriteMetrics';
import {
  escapeString,
  formatNumber,
  renderHeader,
  toConstName
} from '../util/render';

export function renderBossVisuals(area: ParsedBossesArea): string {
  const constants = area.bosses.map((boss) => renderBossVisual(area, boss));
  const constantNames = area.bosses.map((boss) => `${toConstName(boss.id)}_VISUAL`);
  return `${renderHeader(area.sourcePath)}${renderImport()}${constants.join(
    '\n\n'
  )}\n\nexport const BOSS_VISUAL_SPECS = [${constantNames.join(
    ', '
  )}] as const satisfies ReadonlyArray<SpriteVisualSpec>;\n`;
}

function renderImport(): string {
  return "import type { SpriteVisualSpec } from './SpriteVisualSpec';\n\n";
}

function renderBossVisual(area: ParsedBossesArea, boss: ParsedBoss): string {
  const { sourceSizePx, worldSize } = readSpriteAssetMetrics({
    sourcePath: area.sourcePath,
    rowId: boss.id,
    imagePath: boss.visual.image
  });
  return `export const ${toConstName(boss.id)}_VISUAL: SpriteVisualSpec = {
  archetypeId: '${escapeString(boss.id)}',
  image: '${escapeString(boss.visual.image)}',
  sourceSizePx: { width: ${formatNumber(sourceSizePx.width)}, height: ${formatNumber(sourceSizePx.height)} },
  worldSize: { width: ${formatNumber(worldSize.width)}, height: ${formatNumber(worldSize.height)} },
  anchor: { x: 0.5, y: 0.5 }
};`;
}
