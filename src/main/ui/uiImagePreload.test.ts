import { describe, expect, it } from 'vitest';

import { preloadUiImages } from './uiImagePreload';

class FakeImage {
  readonly listeners = new Map<string, Set<() => void>>();
  complete = false;
  decoding = 'auto';
  naturalWidth = 128;
  src = '';
  private readonly decodeResult: () => Promise<void>;

  constructor(decodeResult: () => Promise<void> = () => Promise.resolve()) {
    this.decodeResult = decodeResult;
  }

  addEventListener(type: string, listener: () => void): void {
    const bucket = this.listeners.get(type) ?? new Set<() => void>();
    bucket.add(listener);
    this.listeners.set(type, bucket);
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  decode(): Promise<void> {
    return this.decodeResult();
  }
}

describe('preloadUiImages', () => {
  it('deduplicates image URLs, decodes them, and reports honest progress', async () => {
    const createdImages: FakeImage[] = [];
    const progressCalls: Array<Readonly<{ loaded: number; total: number }>> = [];

    await preloadUiImages(
      ['/images/a.png', '/images/b.png', '/images/a.png'],
      (loaded, total) => {
        progressCalls.push({ loaded, total });
      },
      {
        createImage() {
          const image = new FakeImage();
          createdImages.push(image);
          return image as unknown as HTMLImageElement;
        }
      }
    );

    expect(createdImages.map((image) => image.src)).toEqual([
      '/images/a.png',
      '/images/b.png'
    ]);
    expect(createdImages.every((image) => image.decoding === 'async')).toBe(true);
    expect(progressCalls).toEqual([
      { loaded: 0, total: 2 },
      { loaded: 1, total: 2 },
      { loaded: 2, total: 2 }
    ]);
  });

  it('rejects decode failures and cancels pending image loads', async () => {
    const createdImages: FakeImage[] = [];

    await expect(
      preloadUiImages(
        ['/images/broken.png', '/images/slow.png'],
        () => {},
        {
          createImage() {
            const image =
              createdImages.length === 0
                ? new FakeImage(() => Promise.reject(new Error('bad bitmap')))
                : new FakeImage();
            createdImages.push(image);
            return image as unknown as HTMLImageElement;
          }
        }
      )
    ).rejects.toThrow('Failed to decode UI image "/images/broken.png": bad bitmap');

    expect(createdImages[1]?.src).toBe('');
  });
});
