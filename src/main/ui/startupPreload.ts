import type { SpriteVisualSpec } from '../render/SpriteVisualSpec';
import { preloadSprites, type TextureMap } from '../render/spritePreload';

import { STARTUP_SPRITE_SPECS, STARTUP_UI_IMAGE_URLS } from './startupAssets';
import { preloadUiImages } from './uiImagePreload';

type PreloadSpritesFn = (
  specs: Iterable<SpriteVisualSpec>,
  onProgress: (loaded: number, total: number) => void
) => Promise<TextureMap>;

type PreloadUiImagesFn = (
  imageUrls: Iterable<string>,
  onProgress: (loaded: number, total: number) => void
) => Promise<void>;

export type StartupPreloadDependencies = Readonly<{
  preloadSprites: PreloadSpritesFn;
  preloadUiImages: PreloadUiImagesFn;
}>;

export async function preloadStartupAssets(
  onProgress: (loaded: number, total: number) => void,
  dependencies: StartupPreloadDependencies = {
    preloadSprites,
    preloadUiImages
  }
): Promise<TextureMap> {
  let spriteLoaded = 0;
  let spriteTotal = countUniqueSpriteImages(STARTUP_SPRITE_SPECS);
  let uiLoaded = 0;
  let uiTotal = STARTUP_UI_IMAGE_URLS.length;

  const reportProgress = (): void => {
    onProgress(spriteLoaded + uiLoaded, spriteTotal + uiTotal);
  };

  reportProgress();

  let textures: TextureMap | null = null;
  try {
    textures = await dependencies.preloadSprites(STARTUP_SPRITE_SPECS, (loaded, total) => {
      spriteLoaded = loaded;
      spriteTotal = total;
      reportProgress();
    });

    await dependencies.preloadUiImages(STARTUP_UI_IMAGE_URLS, (loaded, total) => {
      uiLoaded = loaded;
      uiTotal = total;
      reportProgress();
    });

    return textures;
  } catch (error: unknown) {
    if (textures !== null) {
      disposeTextureMap(textures);
    }
    throw error;
  }
}

function countUniqueSpriteImages(specs: Iterable<SpriteVisualSpec>): number {
  const imageUrls = new Set<string>();
  for (const spec of specs) {
    imageUrls.add(spec.image);
  }
  return imageUrls.size;
}

function disposeTextureMap(textures: TextureMap): void {
  for (const texture of new Set(Object.values(textures))) {
    texture.dispose();
  }
}
