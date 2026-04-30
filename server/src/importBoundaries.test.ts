import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SERVER_SRC_DIR = dirname(fileURLToPath(import.meta.url));

function collectSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...collectSourceFiles(path));
      continue;
    }
    if (path.endsWith('.ts')) {
      files.push(path);
    }
  }
  return files;
}

describe('server import boundaries', () => {
  it('does not import browser main-thread or local simulation runtime code', () => {
    const forbiddenImports = [
      /from\s+['"][^'"]*src\/main\//,
      /from\s+['"][^'"]*src\/sim\//,
      /import\s*\(\s*['"][^'"]*src\/main\//,
      /import\s*\(\s*['"][^'"]*src\/sim\//
    ];

    const violations = collectSourceFiles(SERVER_SRC_DIR).flatMap((path) => {
      const source = readFileSync(path, 'utf8');
      return forbiddenImports.some((pattern) => pattern.test(source)) ? [path] : [];
    });

    expect(violations).toEqual([]);
  });
});
