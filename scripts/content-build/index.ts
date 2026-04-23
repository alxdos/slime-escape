import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BOSSES_AREA } from './bosses';
import { DROPS_AREA } from './drops';
import { ENEMIES_AREA } from './enemies';
import { PLAYERS_AREA } from './players';
import { SESSIONS_AREA } from './sessions';
import { WEAPONS_AREA } from './weapons';
import { atomicWrite, type GeneratedFile } from './util/atomicWrite';
import { ContentBuildError } from './util/require';

export type ContentBuildMode = 'build' | 'check';

export type ContentArea = Readonly<{
  name: string;
  render(): Promise<ReadonlyArray<GeneratedFile>>;
}>;

const AREAS: ReadonlyArray<ContentArea> = [
  ENEMIES_AREA,
  WEAPONS_AREA,
  DROPS_AREA,
  BOSSES_AREA,
  PLAYERS_AREA,
  SESSIONS_AREA
];
const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export async function runContentBuild(
  mode: ContentBuildMode,
  areas: ReadonlyArray<ContentArea> = AREAS
): Promise<void> {
  const files = await renderAllAreas(areas);

  if (mode === 'check') {
    await checkGeneratedFiles(files);
    return;
  }

  await atomicWrite(files);
}

async function main(argv: ReadonlyArray<string>): Promise<void> {
  process.chdir(REPOSITORY_ROOT);
  const mode = parseMode(argv);
  await runContentBuild(mode);
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

async function renderAllAreas(areas: ReadonlyArray<ContentArea>): Promise<ReadonlyArray<GeneratedFile>> {
  const files: GeneratedFile[] = [];
  for (const area of areas) {
    const renderedFiles = await area.render();
    files.push(...renderedFiles);
  }
  return files;
}

async function checkGeneratedFiles(files: ReadonlyArray<GeneratedFile>): Promise<void> {
  const diffs: string[] = [];

  for (const file of files) {
    const current = await readExistingFile(file.path);
    if (current !== file.contents) {
      diffs.push(formatFirstDifference(file.path, current, file.contents));
    }
  }

  if (diffs.length > 0) {
    throw new ContentBuildError(
      ['generated content is out of date; run `npm run content:build`', ...diffs].join('\n')
    );
  }
}

function formatFirstDifference(path: string, current: string | null, expected: string): string {
  if (current === null) {
    return `${path}: missing file\n+ ${firstLine(expected)}`;
  }

  const currentLines = current.split(/\r?\n/);
  const expectedLines = expected.split(/\r?\n/);
  const maxLength = Math.max(currentLines.length, expectedLines.length);

  for (let index = 0; index < maxLength; index += 1) {
    const currentLine = currentLines[index];
    const expectedLine = expectedLines[index];
    if (currentLine !== expectedLine) {
      return [
        `${path}:${index + 1}`,
        `- ${currentLine ?? '<no line>'}`,
        `+ ${expectedLine ?? '<no line>'}`
      ].join('\n');
    }
  }

  return `${path}: content differs`;
}

function firstLine(value: string): string {
  return value.split(/\r?\n/, 1)[0] ?? '';
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
