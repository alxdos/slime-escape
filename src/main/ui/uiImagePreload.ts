type UiImageLike = Pick<
  HTMLImageElement,
  | 'addEventListener'
  | 'complete'
  | 'decoding'
  | 'decode'
  | 'naturalWidth'
  | 'removeEventListener'
  | 'src'
>;

export type UiImagePreloadDependencies = Readonly<{
  createImage(): UiImageLike;
}>;

export async function preloadUiImages(
  imageUrls: Iterable<string>,
  onProgress: (loaded: number, total: number) => void,
  dependencies: UiImagePreloadDependencies = createDefaultDependencies()
): Promise<void> {
  const uniqueUrls = collectUniqueUrls(imageUrls);
  const total = uniqueUrls.length;
  onProgress(0, total);

  if (total === 0) {
    return;
  }

  const pendingImages = new Set<UiImageLike>();
  let loaded = 0;
  let firstFailure: unknown = null;

  await Promise.allSettled(
    uniqueUrls.map(async (imageUrl) => {
      const image = dependencies.createImage();
      pendingImages.add(image);

      try {
        await loadDecodedImage(imageUrl, image);
        if (firstFailure !== null) {
          return;
        }
        loaded += 1;
        onProgress(loaded, total);
      } catch (error: unknown) {
        if (firstFailure === null) {
          firstFailure = error;
          cancelPendingImages(pendingImages);
        }
      } finally {
        pendingImages.delete(image);
      }
    })
  );

  if (firstFailure !== null) {
    throw firstFailure;
  }
}

function collectUniqueUrls(imageUrls: Iterable<string>): ReadonlyArray<string> {
  const uniqueUrls: string[] = [];
  const seen = new Set<string>();
  for (const imageUrl of imageUrls) {
    if (seen.has(imageUrl)) {
      continue;
    }
    seen.add(imageUrl);
    uniqueUrls.push(imageUrl);
  }
  return uniqueUrls;
}

async function loadDecodedImage(imageUrl: string, image: UiImageLike): Promise<void> {
  image.decoding = 'async';
  image.src = imageUrl;

  if (typeof image.decode === 'function') {
    try {
      await image.decode();
    } catch (error: unknown) {
      throw new Error(`Failed to decode UI image "${imageUrl}": ${formatError(error)}`);
    }
    assertDecodedImage(imageUrl, image);
    return;
  }

  await loadImageWithEvents(imageUrl, image);
  assertDecodedImage(imageUrl, image);
}

function loadImageWithEvents(imageUrl: string, image: UiImageLike): Promise<void> {
  if (image.complete) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const onLoad = (): void => {
      cleanup();
      resolve();
    };
    const onError = (): void => {
      cleanup();
      reject(new Error(`Failed to load UI image "${imageUrl}"`));
    };
    const cleanup = (): void => {
      image.removeEventListener('load', onLoad);
      image.removeEventListener('error', onError);
    };

    image.addEventListener('load', onLoad);
    image.addEventListener('error', onError);
  });
}

function assertDecodedImage(imageUrl: string, image: UiImageLike): void {
  if (image.naturalWidth > 0) {
    return;
  }
  throw new Error(`Failed to decode UI image "${imageUrl}": decoded image is empty`);
}

function cancelPendingImages(images: Iterable<UiImageLike>): void {
  for (const image of images) {
    image.src = '';
  }
}

function createDefaultDependencies(): UiImagePreloadDependencies {
  const ImageCtor = globalThis.Image;
  if (typeof ImageCtor !== 'function') {
    throw new Error('UI image preload requires global Image');
  }

  return {
    createImage() {
      return new ImageCtor();
    }
  };
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
