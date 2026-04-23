import type { ParsedPlayer, ParsedPlayersArea } from './parse';
import { readSpriteAssetMetrics } from '../util/spriteMetrics';
import {
  escapeString,
  formatNumber,
  renderHeader,
  toConstName
} from '../util/render';

export function renderPlayerVisuals(area: ParsedPlayersArea): string {
  return `${renderHeader(area.sourcePath)}${renderImport()}${area.players
    .map((player) => renderPlayerVisual(area, player))
    .join('\n\n')}\n`;
}

function renderImport(): string {
  return "import type { SpriteVisualSpec } from './SpriteVisualSpec';\n\n";
}

function renderPlayerVisual(area: ParsedPlayersArea, player: ParsedPlayer): string {
  const { sourceSizePx, worldSize } = readSpriteAssetMetrics({
    sourcePath: area.sourcePath,
    rowId: player.id,
    imagePath: player.visual.image
  });
  return `export const ${toConstName(player.id)}_VISUAL: SpriteVisualSpec = {
  archetypeId: '${escapeString(player.id)}',
  image: '${escapeString(player.visual.image)}',
  sourceSizePx: { width: ${formatNumber(sourceSizePx.width)}, height: ${formatNumber(sourceSizePx.height)} },
  worldSize: { width: ${formatNumber(worldSize.width)}, height: ${formatNumber(worldSize.height)} },
  anchor: { x: 0.5, y: 0.5 }
};`;
}
