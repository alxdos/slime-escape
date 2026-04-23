import { resolve } from 'node:path';

import { PX_PER_WU } from '../../../src/main/render/spriteScale';
import type { ParsedPlayer, ParsedPlayersArea } from './parse';
import { formatPngSizeContentError, readPngSize } from '../util/pngSize';
import {
  escapeString,
  formatNumber,
  renderHeader,
  toConstName
} from '../util/render';
import { ContentBuildError } from '../util/require';

export function renderPlayerVisuals(area: ParsedPlayersArea): string {
  return `${renderHeader(area.sourcePath)}${renderImport()}${area.players
    .map((player) => renderPlayerVisual(area, player))
    .join('\n\n')}\n`;
}

function renderImport(): string {
  return "import type { SpriteVisualSpec } from './SpriteVisualSpec';\n\n";
}

function renderPlayerVisual(area: ParsedPlayersArea, player: ParsedPlayer): string {
  const sourceSizePx = readVisualSourceSize(area, player);
  return `export const ${toConstName(player.id)}_VISUAL: SpriteVisualSpec = {
  archetypeId: '${escapeString(player.id)}',
  image: '${escapeString(player.visual.image)}',
  sourceSizePx: { width: ${formatNumber(sourceSizePx.width)}, height: ${formatNumber(sourceSizePx.height)} },
  worldSize: { width: ${formatNumber(sourceSizePx.width / PX_PER_WU)}, height: ${formatNumber(sourceSizePx.height / PX_PER_WU)} },
  anchor: { x: 0.5, y: 0.5 }
};`;
}

function readVisualSourceSize(
  area: ParsedPlayersArea,
  player: ParsedPlayer
): Readonly<{ width: number; height: number }> {
  try {
    return readPngSize(publicAssetAbsPath(player.visual.image));
  } catch (error) {
    throw formatPngSizeContentError(
      {
        sourcePath: area.sourcePath,
        rowId: player.id,
        imagePath: player.visual.image
      },
      error
    );
  }
}

function publicAssetAbsPath(imagePath: string): string {
  if (!imagePath.startsWith('/')) {
    throw new ContentBuildError(`expected public asset path starting with "/", got "${imagePath}"`);
  }

  const relativePath = imagePath.slice(1);
  if (relativePath.split('/').includes('..')) {
    throw new ContentBuildError(`expected public asset path to stay inside public/, got "${imagePath}"`);
  }

  return resolve('public', relativePath);
}
