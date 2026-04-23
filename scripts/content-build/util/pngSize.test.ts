import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  formatPngSizeContentError,
  PngSizeError,
  readPngSize
} from './pngSize';

describe('readPngSize', () => {
  it('reads width and height from a valid PNG IHDR header', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-build-png-size-valid-'));
    const imagePath = join(directory, 'sprite.png');
    await writeFile(imagePath, makePngHeader({ width: 294, height: 550 }));

    expect(readPngSize(imagePath)).toEqual({ width: 294, height: 550 });
  });

  it('rejects a truncated PNG header', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-build-png-size-broken-'));
    const imagePath = join(directory, 'broken.png');
    await writeFile(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    expect(() => readPngSize(imagePath)).toThrow(PngSizeError);
    expect(() => readPngSize(imagePath)).toThrow(/too small/);
  });

  it('rejects a PNG that is missing complete IHDR data', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-build-png-size-incomplete-'));
    const imagePath = join(directory, 'incomplete.png');
    await writeFile(imagePath, makePngHeader({ width: 294, height: 550 }).subarray(0, 24));

    expect(() => readPngSize(imagePath)).toThrow(/complete IHDR chunk/);
  });

  it('rejects a non-PNG file', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'content-build-png-size-not-png-'));
    const imagePath = join(directory, 'sprite.txt');
    await writeFile(imagePath, 'this is long enough to reach the signature check', 'utf8');

    expect(() => readPngSize(imagePath)).toThrow(/expected PNG signature/);
  });

  it('formats area row context for content-build errors', async () => {
    const error = formatPngSizeContentError(
      {
        sourcePath: 'content/enemies.md',
        rowId: 'slime-one-eye',
        imagePath: '/assets/slime-01.png'
      },
      new PngSizeError('expected PNG signature')
    );

    expect(error.message).toBe(
      'content/enemies.md row "slime-one-eye": cannot read PNG /assets/slime-01.png: expected PNG signature'
    );
  });
});

function makePngHeader(size: Readonly<{ width: number; height: number }>): Buffer {
  const bytes = Buffer.alloc(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write('IHDR', 12, 'ascii');
  bytes.writeUInt32BE(size.width, 16);
  bytes.writeUInt32BE(size.height, 20);
  bytes[24] = 8;
  bytes[25] = 6;
  return bytes;
}
