import { resolve } from 'node:path';

import { PX_PER_WU } from '../../../src/main/render/spriteScale';
import type { ParsedEnemiesArea, ParsedEnemy } from './parse';
import { formatPngSizeContentError, readPngSize } from '../util/pngSize';
import {
  escapeString,
  formatNumber,
  renderHeader,
  toConstName
} from '../util/render';
import { ContentBuildError } from '../util/require';

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
  const sourceSizePx = readVisualSourceSize(area, enemy);
  return `export const ${toConstName(enemy.id)}_VISUAL: SpriteVisualSpec = {
  archetypeId: '${escapeString(enemy.id)}',
  image: '${escapeString(enemy.visual.image)}',
  sourceSizePx: { width: ${formatNumber(sourceSizePx.width)}, height: ${formatNumber(sourceSizePx.height)} },
  worldSize: { width: ${formatNumber(sourceSizePx.width / PX_PER_WU)}, height: ${formatNumber(sourceSizePx.height / PX_PER_WU)} },
  anchor: { x: 0.5, y: 0.5 }
};`;
}

function readVisualSourceSize(
  area: ParsedEnemiesArea,
  enemy: ParsedEnemy
): Readonly<{ width: number; height: number }> {
  try {
    return readPngSize(publicAssetAbsPath(enemy.visual.image));
  } catch (error) {
    throw formatPngSizeContentError(
      {
        sourcePath: area.sourcePath,
        rowId: enemy.id,
        imagePath: enemy.visual.image
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
