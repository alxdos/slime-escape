import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type { SpriteVisualSpec } from './SpriteVisualSpec';
import { preloadSprites } from './spritePreload';

function makeSpec(archetypeId: string, image: string): SpriteVisualSpec {
  return {
    archetypeId,
    image,
    sourceSizePx: { width: 70, height: 70 },
    worldSize: { width: 1, height: 1 },
    anchor: { x: 0.5, y: 0.5 }
  };
}

describe('preloadSprites', () => {
  it('deduplicates shared images, reports progress, and returns textures by archetype id', async () => {
    const fetchCalls: string[] = [];
    const progressCalls: Array<Readonly<{ loaded: number; total: number }>> = [];
    const specs = [
      makeSpec('enemy-b', '/sprites/b.png'),
      makeSpec('enemy-a', '/sprites/a.png'),
      makeSpec('enemy-a-variant', '/sprites/a.png')
    ];

    const textures = await preloadSprites(specs, (loaded, total) => {
      progressCalls.push({ loaded, total });
    }, {
      fetch: async (imageUrl) => {
        fetchCalls.push(imageUrl);
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          blob: async () => new Blob([imageUrl], { type: 'image/png' })
        };
      },
      decodeBitmap: async (_blob, options) => {
        expect(options).toEqual({ imageOrientation: 'flipY' });
        return {} as ImageBitmap;
      },
      createTexture: (_bitmap, imageUrl) => {
        const texture = new THREE.Texture();
        texture.name = imageUrl;
        return texture;
      }
    });

    expect(fetchCalls).toEqual(['/sprites/a.png', '/sprites/b.png']);
    expect(progressCalls).toEqual([
      { loaded: 0, total: 2 },
      { loaded: 1, total: 2 },
      { loaded: 2, total: 2 }
    ]);
    expect(textures['enemy-a']).toBe(textures['enemy-a-variant']);
    expect(textures['enemy-a']?.name).toBe('/sprites/a.png');
    expect(textures['enemy-b']?.name).toBe('/sprites/b.png');
  });

  it('rejects with the first diagnostic and aborts pending sprite fetches', async () => {
    let abortedSlowFetch = false;

    await expect(
      preloadSprites(
        [makeSpec('broken', '/sprites/broken.png'), makeSpec('slow', '/sprites/slow.png')],
        () => {},
        {
          fetch(imageUrl, init) {
            if (imageUrl === '/sprites/broken.png') {
              return Promise.resolve({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                blob: async () => new Blob([], { type: 'image/png' })
              });
            }

            return new Promise((_resolve, reject) => {
              init.signal.addEventListener('abort', () => {
                abortedSlowFetch = true;
                reject(new Error('aborted'));
              });
            });
          },
          decodeBitmap: async (_blob, options) => {
            expect(options).toEqual({ imageOrientation: 'flipY' });
            return {} as ImageBitmap;
          },
          createTexture: () => new THREE.Texture()
        }
      )
    ).rejects.toThrow('Failed to fetch sprite "/sprites/broken.png": HTTP 404 Not Found');

    expect(abortedSlowFetch).toBe(true);
  });
});
