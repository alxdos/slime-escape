import type { ParsedPlayer, ParsedPlayersArea } from './parse';
import {
  escapeString,
  formatNumber,
  renderHeader,
  toConstName
} from '../util/render';

export function renderPlayerVisuals(area: ParsedPlayersArea): string {
  return `${renderHeader(area.sourcePath)}${renderImport()}${area.players
    .map(renderPlayerVisual)
    .join('\n\n')}\n\n${renderPlayerVisualSpecs(area.players)}\n`;
}

function renderImport(): string {
  return "import type { SpriteVisualSpec } from './SpriteVisualSpec';\n\n";
}

function renderPlayerVisual(player: ParsedPlayer): string {
  const { sourceSizePx, worldSize } = player.visual.metrics;
  return `export const ${toConstName(player.id)}_VISUAL: SpriteVisualSpec = {
  archetypeId: '${escapeString(player.id)}',
  image: '${escapeString(player.visual.image)}',
  sourceSizePx: { width: ${formatNumber(sourceSizePx.width)}, height: ${formatNumber(sourceSizePx.height)} },
  worldSize: { width: ${formatNumber(worldSize.width)}, height: ${formatNumber(worldSize.height)} },
  anchor: { x: 0.5, y: 0.5 }
};`;
}

function renderPlayerVisualSpecs(players: ReadonlyArray<ParsedPlayer>): string {
  const constNames = players.map((player) => `${toConstName(player.id)}_VISUAL`);
  return `export const PLAYER_VISUAL_SPECS = [${constNames.join(', ')}] as const satisfies ReadonlyArray<SpriteVisualSpec>;`;
}
