import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PX_PER_WU } from './spriteScale';

describe('PX_PER_WU', () => {
  it('uses the design sprite scale value', () => {
    expect(PX_PER_WU).toBe(70);
  });

  it('has a single initialization across runtime and content-build sources', async () => {
    const matches = await findScaleInitializations(['src', 'scripts']);

    expect(matches).toEqual(['src/main/render/spriteScale.ts']);
  });
});

async function findScaleInitializations(roots: ReadonlyArray<string>): Promise<ReadonlyArray<string>> {
  const assignmentPattern = new RegExp(String.raw`\bPX_PER_WU\s*=\s*${PX_PER_WU}\b`, 'g');
  const matches: string[] = [];

  for (const root of roots) {
    const files = await collectTypeScriptFiles(root);
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      if (assignmentPattern.test(source)) {
        matches.push(file);
      }
      assignmentPattern.lastIndex = 0;
    }
  }

  return matches.sort();
}

async function collectTypeScriptFiles(directory: string): Promise<ReadonlyArray<string>> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTypeScriptFiles(path)));
      continue;
    }
    if (entry.isFile() && path.endsWith('.ts')) {
      files.push(path);
    }
  }

  return files;
}
