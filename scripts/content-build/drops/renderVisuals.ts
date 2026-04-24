import type { ParsedDrop, ParsedDropsArea } from './parse';
import { escapeString, formatNumber, renderHeader, toConstName } from '../util/render';

export function renderDropVisuals(area: ParsedDropsArea): string {
  return `${renderHeader(area.sourcePath)}${renderImport()}${area.drops
    .map(renderDropVisual)
    .join('\n\n')}\n\n${renderDropVisualSpecs(area.drops)}\n`;
}

function renderImport(): string {
  return "import type { SpriteVisualSpec } from './SpriteVisualSpec';\n\n";
}

function renderDropVisual(drop: ParsedDrop): string {
  const visual = drop.spriteVisual;
  return `export const ${toConstName(drop.id)}_DROP_VISUAL: SpriteVisualSpec = {
  archetypeId: '${escapeString(drop.id)}',
  image: '${escapeString(visual.image)}',
  sourceSizePx: { width: ${formatNumber(visual.sourceSizePx.width)}, height: ${formatNumber(visual.sourceSizePx.height)} },
  worldSize: { width: ${formatNumber(visual.worldSize.width)}, height: ${formatNumber(visual.worldSize.height)} },
  anchor: { x: 0.5, y: 0.5 }
};`;
}

function renderDropVisualSpecs(drops: ReadonlyArray<ParsedDrop>): string {
  const constNames = drops.map((drop) => `${toConstName(drop.id)}_DROP_VISUAL`);
  return `export const DROP_VISUAL_SPECS = [${constNames.join(', ')}] as const satisfies ReadonlyArray<SpriteVisualSpec>;`;
}
