import * as THREE from 'three';

import type { SpriteVisualSpec } from './SpriteVisualSpec';

type SpriteFetchResponse = Readonly<{
  ok: boolean;
  status: number;
  statusText: string;
  blob(): Promise<Blob>;
}>;

type SpriteFetchFn = (
  imageUrl: string,
  init: Readonly<{ signal: AbortSignal }>
) => Promise<SpriteFetchResponse>;

type DecodeBitmapFn = (blob: Blob, options: ImageBitmapOptions) => Promise<ImageBitmap>;
type CreateTextureFn = (bitmap: ImageBitmap, imageUrl: string) => THREE.Texture;

export type TextureMap = Readonly<Record<string, THREE.Texture>>;

type SpritePreloadDependencies = Readonly<{
  fetch: SpriteFetchFn;
  decodeBitmap: DecodeBitmapFn;
  createTexture: CreateTextureFn;
}>;

type UniqueImageEntry = Readonly<{
  image: string;
  archetypeIds: ReadonlyArray<string>;
}>;
const SPRITE_BITMAP_OPTIONS: ImageBitmapOptions = {
  imageOrientation: 'flipY'
};

export async function preloadSprites(
  specs: Iterable<SpriteVisualSpec>,
  onProgress: (loaded: number, total: number) => void,
  dependencies: SpritePreloadDependencies = createDefaultDependencies()
): Promise<TextureMap> {
  const uniqueImages = collectUniqueImages(specs);
  const total = uniqueImages.length;
  onProgress(0, total);

  if (total === 0) {
    return {};
  }

  const controller = new AbortController();
  const texturesByImage = new Map<string, THREE.Texture>();
  let loaded = 0;
  let firstFailure: unknown = null;

  await Promise.allSettled(
    uniqueImages.map(async (entry) => {
      try {
        const texture = await loadTexture(entry.image, dependencies, controller.signal);
        if (firstFailure !== null) {
          texture.dispose();
          return;
        }
        texturesByImage.set(entry.image, texture);
        loaded += 1;
        onProgress(loaded, total);
      } catch (error: unknown) {
        if (firstFailure !== null) {
          return;
        }
        firstFailure = error;
        controller.abort();
      }
    })
  );

  if (firstFailure !== null) {
    disposeTextures(texturesByImage.values());
    throw firstFailure;
  }

  const texturesByArchetypeId: Record<string, THREE.Texture> = {};
  for (const entry of uniqueImages) {
    const texture = texturesByImage.get(entry.image);
    if (texture === undefined) {
      disposeTextures(texturesByImage.values());
      throw new Error(`sprite texture missing after preload for "${entry.image}"`);
    }
    for (const archetypeId of entry.archetypeIds) {
      texturesByArchetypeId[archetypeId] = texture;
    }
  }
  return texturesByArchetypeId;
}

function collectUniqueImages(specs: Iterable<SpriteVisualSpec>): ReadonlyArray<UniqueImageEntry> {
  const archetypesByImage = new Map<string, string[]>();
  for (const spec of specs) {
    const archetypeIds = archetypesByImage.get(spec.image) ?? [];
    archetypeIds.push(spec.archetypeId);
    archetypesByImage.set(spec.image, archetypeIds);
  }

  return [...archetypesByImage.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([image, archetypeIds]) => ({
      image,
      archetypeIds
    }));
}

async function loadTexture(
  imageUrl: string,
  dependencies: SpritePreloadDependencies,
  signal: AbortSignal
): Promise<THREE.Texture> {
  const response = await fetchSpriteResponse(imageUrl, dependencies.fetch, signal);
  const bitmap = await decodeSpriteBitmap(imageUrl, response, dependencies.decodeBitmap);
  return createSpriteTexture(imageUrl, bitmap, dependencies.createTexture);
}

async function fetchSpriteResponse(
  imageUrl: string,
  fetchSprite: SpriteFetchFn,
  signal: AbortSignal
): Promise<SpriteFetchResponse> {
  let response: SpriteFetchResponse;
  try {
    response = await fetchSprite(imageUrl, { signal });
  } catch (error: unknown) {
    throw new Error(`Failed to fetch sprite "${imageUrl}": ${formatError(error)}`);
  }

  if (response.ok) {
    return response;
  }

  const statusText = response.statusText.trim();
  const httpStatus = statusText.length > 0 ? `${response.status} ${statusText}` : `${response.status}`;
  throw new Error(`Failed to fetch sprite "${imageUrl}": HTTP ${httpStatus}`);
}

async function decodeSpriteBitmap(
  imageUrl: string,
  response: SpriteFetchResponse,
  decodeBitmap: DecodeBitmapFn
): Promise<ImageBitmap> {
  let blob: Blob;
  try {
    blob = await response.blob();
  } catch (error: unknown) {
    throw new Error(`Failed to read sprite "${imageUrl}": ${formatError(error)}`);
  }

  try {
    return await decodeBitmap(blob, SPRITE_BITMAP_OPTIONS);
  } catch (error: unknown) {
    throw new Error(`Failed to decode sprite "${imageUrl}": ${formatError(error)}`);
  }
}

function createSpriteTexture(
  imageUrl: string,
  bitmap: ImageBitmap,
  createTexture: CreateTextureFn
): THREE.Texture {
  try {
    return createTexture(bitmap, imageUrl);
  } catch (error: unknown) {
    throw new Error(`Failed to create texture for sprite "${imageUrl}": ${formatError(error)}`);
  }
}

function createDefaultDependencies(): SpritePreloadDependencies {
  const fetchSprite = globalThis.fetch;
  if (typeof fetchSprite !== 'function') {
    throw new Error('Sprite preload requires global fetch');
  }

  const decodeBitmap = globalThis.createImageBitmap;
  if (typeof decodeBitmap !== 'function') {
    throw new Error('Sprite preload requires createImageBitmap');
  }

  return {
    fetch(imageUrl, init) {
      return fetchSprite(imageUrl, init);
    },
    decodeBitmap(blob, options) {
      return decodeBitmap(blob, options);
    },
    createTexture(bitmap, imageUrl) {
      const texture = new THREE.Texture(bitmap);
      texture.name = imageUrl;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      return texture;
    }
  };
}

function disposeTextures(textures: Iterable<THREE.Texture>): void {
  for (const texture of new Set(textures)) {
    texture.dispose();
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}
