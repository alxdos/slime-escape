import { resolve } from 'node:path';

import { PX_PER_WU } from '../../../src/main/render/spriteScale';

import { formatPngSizeContentError, readPngSize, type PngRowContext } from './pngSize';
import { ContentBuildError } from './require';

export type SpriteWorldSize = Readonly<{
  width: number;
  height: number;
}>;

export type SpriteAssetMetrics = Readonly<{
  sourceSizePx: Readonly<{
    width: number;
    height: number;
  }>;
  worldSize: SpriteWorldSize;
}>;

export function readSpriteAssetMetrics(context: PngRowContext): SpriteAssetMetrics {
  try {
    const sourceSizePx = readPngSize(resolvePublicAssetAbsPath(context.imagePath));
    return {
      sourceSizePx,
      worldSize: {
        width: sourceSizePx.width / PX_PER_WU,
        height: sourceSizePx.height / PX_PER_WU
      }
    };
  } catch (error) {
    throw formatPngSizeContentError(context, error);
  }
}

function resolvePublicAssetAbsPath(imagePath: string): string {
  if (!imagePath.startsWith('/')) {
    throw new ContentBuildError(`expected public asset path starting with "/", got "${imagePath}"`);
  }

  const relativePath = imagePath.slice(1);
  if (relativePath.split('/').includes('..')) {
    throw new ContentBuildError(`expected public asset path to stay inside public/, got "${imagePath}"`);
  }

  return resolve('public', relativePath);
}
