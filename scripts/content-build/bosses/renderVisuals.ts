import { resolve } from 'node:path';

import { PX_PER_WU } from '../../../src/main/render/spriteScale';
import type { ParsedBoss, ParsedBossesArea } from './parse';
import { formatPngSizeContentError, readPngSize } from '../util/pngSize';
import {
  escapeString,
  formatNumber,
  renderHeader,
  toConstName
} from '../util/render';
import { ContentBuildError } from '../util/require';

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
  const sourceSizePx = readVisualSourceSize(area, boss);
  return `export const ${toConstName(boss.id)}_VISUAL: SpriteVisualSpec = {
  archetypeId: '${escapeString(boss.id)}',
  image: '${escapeString(boss.visual.image)}',
  sourceSizePx: { width: ${formatNumber(sourceSizePx.width)}, height: ${formatNumber(sourceSizePx.height)} },
  worldSize: { width: ${formatNumber(sourceSizePx.width / PX_PER_WU)}, height: ${formatNumber(sourceSizePx.height / PX_PER_WU)} },
  anchor: { x: 0.5, y: 0.5 }
};`;
}

function readVisualSourceSize(
  area: ParsedBossesArea,
  boss: ParsedBoss
): Readonly<{ width: number; height: number }> {
  try {
    return readPngSize(publicAssetAbsPath(boss.visual.image));
  } catch (error) {
    throw formatPngSizeContentError(
      {
        sourcePath: area.sourcePath,
        rowId: boss.id,
        imagePath: boss.visual.image
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
