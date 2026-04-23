import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';

import { ContentBuildError } from './require';

export type PngSize = Readonly<{
  width: number;
  height: number;
}>;

export type PngRowContext = Readonly<{
  sourcePath: string;
  rowId: string;
  imagePath: string;
}>;

export class PngSizeError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PngSizeError';
  }
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const PNG_CHUNK_PREFIX_BYTES = 16;
const PNG_CHUNK_LENGTH_OFFSET = 8;
const PNG_CHUNK_TYPE_OFFSET = 12;
const PNG_CHUNK_DATA_OFFSET = 16;
const PNG_CHUNK_CRC_BYTES = 4;
const PNG_IHDR_LENGTH = 13;
const PNG_IHDR_TYPE = 'IHDR';

export function readPngSize(absPath: string): PngSize {
  if (!isAbsolute(absPath)) {
    throw new PngSizeError(`expected absolute path, got "${absPath}"`);
  }

  const bytes = readPngBytes(absPath);
  return parsePngSize(bytes);
}

export function formatPngSizeContentError(
  context: PngRowContext,
  error: unknown
): ContentBuildError {
  return new ContentBuildError(
    `${context.sourcePath} row "${context.rowId}": cannot read PNG ${context.imagePath}: ${pngSizeErrorReason(error)}`
  );
}

export function pngSizeErrorReason(error: unknown): string {
  if (error instanceof PngSizeError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function readPngBytes(absPath: string): Buffer {
  try {
    return readFileSync(absPath);
  } catch (error) {
    throw new PngSizeError(`cannot read file: ${pngSizeErrorReason(error)}`, {
      cause: error
    });
  }
}

function parsePngSize(bytes: Buffer): PngSize {
  if (bytes.byteLength < PNG_CHUNK_PREFIX_BYTES) {
    throw new PngSizeError('file is too small to contain a PNG header');
  }

  for (let index = 0; index < PNG_SIGNATURE.length; index += 1) {
    if (bytes[index] !== PNG_SIGNATURE[index]) {
      throw new PngSizeError('expected PNG signature');
    }
  }

  const ihdrLength = bytes.readUInt32BE(PNG_CHUNK_LENGTH_OFFSET);
  if (ihdrLength !== PNG_IHDR_LENGTH) {
    throw new PngSizeError(`expected IHDR length ${PNG_IHDR_LENGTH}, got ${ihdrLength}`);
  }

  const expectedHeaderBytes = PNG_CHUNK_DATA_OFFSET + ihdrLength + PNG_CHUNK_CRC_BYTES;
  if (bytes.byteLength < expectedHeaderBytes) {
    throw new PngSizeError('file is too small to contain a complete IHDR chunk');
  }

  const chunkType = bytes.toString(
    'ascii',
    PNG_CHUNK_TYPE_OFFSET,
    PNG_CHUNK_TYPE_OFFSET + PNG_IHDR_TYPE.length
  );
  if (chunkType !== PNG_IHDR_TYPE) {
    throw new PngSizeError(`expected first PNG chunk IHDR, got "${chunkType}"`);
  }

  const width = bytes.readUInt32BE(PNG_CHUNK_DATA_OFFSET);
  const height = bytes.readUInt32BE(PNG_CHUNK_DATA_OFFSET + 4);
  if (width <= 0 || height <= 0) {
    throw new PngSizeError(`expected positive PNG dimensions, got ${width}x${height}`);
  }

  return { width, height };
}
