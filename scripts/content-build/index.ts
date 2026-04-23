import { readFile } from 'node:fs/promises';

import { ENEMIES_AREA } from './enemies';
import { atomicWrite, type GeneratedFile } from './util/atomicWrite';
import { ContentBuildError } from './util/require';

type ContentBuildMode = 'build' | 'check';

type ContentArea = Readonly<{
  name: string;
  render(): Promise<ReadonlyArray<GeneratedFile>>;
}>;

const AREAS: ReadonlyArray<ContentArea> = [ENEMIES_AREA];

async function main(argv: ReadonlyArray<string>): Promise<void> {
  const mode = parseMode(argv);
  const files = await renderAllAreas();

  if (mode === 'check') {
    await checkGeneratedFiles(files);
    return;
  }

  await atomicWrite(files);
}

function parseMode(argv: ReadonlyArray<string>): ContentBuildMode {
  if (argv.length === 0) {
    return 'build';
  }
  if (argv.length === 1 && argv[0] === '--check') {
    return 'check';
  }
  throw new ContentBuildError('usage: tsx scripts/content-build/index.ts [--check]');
}

async function renderAllAreas(): Promise<ReadonlyArray<GeneratedFile>> {
  const files: GeneratedFile[] = [];
  for (const area of AREAS) {
    const renderedFiles = await area.render();
    files.push(...renderedFiles);
  }
  return files;
}

async function checkGeneratedFiles(files: ReadonlyArray<GeneratedFile>): Promise<void> {
  const stalePaths: string[] = [];

  for (const file of files) {
    const current = await readExistingFile(file.path);
    if (current !== file.contents) {
      stalePaths.push(file.path);
    }
  }

  if (stalePaths.length > 0) {
    throw new ContentBuildError(
      ['generated content is out of date; run `npm run content:build`', ...stalePaths].join('\n')
    );
  }
}

async function readExistingFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
