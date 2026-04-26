import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import type { TextureMap } from '../render/spritePreload';

import { STARTUP_SPRITE_SPECS, STARTUP_UI_IMAGE_URLS } from './startupAssets';
import { preloadStartupAssets } from './startupPreload';

function createDeferred<T>() {
  let resolvePromise: ((value: T) => void) | null = null;
  let rejectPromise: ((error: unknown) => void) | null = null;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return {
    promise,
    resolve(value: T): void {
      resolvePromise?.(value);
    },
    reject(error: unknown): void {
      rejectPromise?.(error);
    }
  };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function requireProgressCallback(
  callback: ((loaded: number, total: number) => void) | null
): (loaded: number, total: number) => void {
  if (callback === null) {
    throw new Error('expected preload progress callback to be captured');
  }
  return callback;
}

describe('preloadStartupAssets', () => {
  it('combines gameplay texture and first-screen UI image progress without time-gating', async () => {
    const progressCalls: Array<Readonly<{ loaded: number; total: number }>> = [];
    const spriteDeferred = createDeferred<TextureMap>();
    const uiDeferred = createDeferred<void>();
    let spriteProgress: ((loaded: number, total: number) => void) | null = null;
    let uiProgress: ((loaded: number, total: number) => void) | null = null;
    const texture = new THREE.Texture();
    const textures = Object.freeze({ slime: texture }) satisfies TextureMap;
    const spriteTotal = new Set(STARTUP_SPRITE_SPECS.map((spec) => spec.image)).size;
    const uiTotal = STARTUP_UI_IMAGE_URLS.length;
    const expectedTotal = spriteTotal + uiTotal;

    const preloadPromise = preloadStartupAssets(
      (loaded, total) => {
        progressCalls.push({ loaded, total });
      },
      {
        preloadSprites(specs, onProgress) {
          expect(specs).toBe(STARTUP_SPRITE_SPECS);
          spriteProgress = onProgress;
          onProgress(0, spriteTotal);
          return spriteDeferred.promise;
        },
        preloadUiImages(imageUrls, onProgress) {
          expect(imageUrls).toBe(STARTUP_UI_IMAGE_URLS);
          uiProgress = onProgress;
          onProgress(0, uiTotal);
          return uiDeferred.promise;
        }
      }
    );

    expect(progressCalls.at(-1)).toEqual({ loaded: 0, total: expectedTotal });

    requireProgressCallback(spriteProgress)(spriteTotal, spriteTotal);
    expect(progressCalls.at(-1)).toEqual({ loaded: spriteTotal, total: expectedTotal });

    spriteDeferred.resolve(textures);
    await flushPromises();
    expect(progressCalls.at(-1)).toEqual({ loaded: spriteTotal, total: expectedTotal });

    requireProgressCallback(uiProgress)(1, uiTotal);
    expect(progressCalls.at(-1)).toEqual({
      loaded: spriteTotal + 1,
      total: expectedTotal
    });

    requireProgressCallback(uiProgress)(uiTotal, uiTotal);
    expect(progressCalls.at(-1)).toEqual({ loaded: expectedTotal, total: expectedTotal });

    uiDeferred.resolve();

    await expect(preloadPromise).resolves.toBe(textures);
  });

  it('rejects when any required UI image fails and disposes preloaded sprite textures', async () => {
    const texture = new THREE.Texture();
    const dispose = vi.spyOn(texture, 'dispose');
    const preloadPromise = preloadStartupAssets(() => {}, {
      preloadSprites(_specs, onProgress) {
        onProgress(0, 1);
        onProgress(1, 1);
        return Promise.resolve(Object.freeze({ slime: texture }) satisfies TextureMap);
      },
      preloadUiImages(_imageUrls, onProgress) {
        onProgress(0, 1);
        return Promise.reject(new Error('Failed to decode UI image "/images/bg/bg-main.jpg"'));
      }
    });

    await expect(preloadPromise).rejects.toThrow(
      'Failed to decode UI image "/images/bg/bg-main.jpg"'
    );
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
