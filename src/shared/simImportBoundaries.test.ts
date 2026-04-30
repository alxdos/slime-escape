/// <reference types="node" />

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SHARED_SRC_DIR = dirname(fileURLToPath(import.meta.url));
const SHARED_SIM_DIR = join(SHARED_SRC_DIR, 'sim');

type BoundaryRule = Readonly<{
  name: string;
  pattern: RegExp;
}>;

type BoundaryViolation = Readonly<{
  file: string;
  rule: string;
}>;

const FORBIDDEN_REFERENCES: readonly BoundaryRule[] = [
  { name: 'self.', pattern: /\bself\./ },
  { name: 'postMessage', pattern: /\bpostMessage\b/ },
  { name: 'Worker', pattern: /\bWorker\b/ },
  { name: 'setInterval', pattern: /\bsetInterval\b/ },
  { name: 'setTimeout', pattern: /\bsetTimeout\b/ },
  { name: 'performance.now', pattern: /\bperformance\.now\b/ },
  { name: 'performance.timeOrigin', pattern: /\bperformance\.timeOrigin\b/ },
  { name: 'Date.now', pattern: /\bDate\.now\b/ },
  { name: 'Date.UTC', pattern: /\bDate\.UTC\b/ },
  { name: 'addEventListener', pattern: /\baddEventListener\b/ },
  { name: 'globalThis', pattern: /\bglobalThis\b/ },
  { name: 'window.', pattern: /\bwindow\./ },
  { name: 'document.', pattern: /\bdocument\./ }
];

const FORBIDDEN_IMPORTS: readonly BoundaryRule[] = [
  { name: 'node:* import', pattern: /(?:from|import)\s*(?:\(\s*)?['"]node:/ },
  {
    name: 'socket.io import',
    pattern: /(?:from|import)\s*(?:\(\s*)?['"]socket\.io(?:\/[^'"]*)?['"]/
  },
  {
    name: 'socket.io-client import',
    pattern: /(?:from|import)\s*(?:\(\s*)?['"]socket\.io-client(?:\/[^'"]*)?['"]/
  },
  {
    name: 'browser-only module import',
    pattern: /(?:from|import)\s*(?:\(\s*)?['"](?:three|vite|@vitejs\/[^'"]*)['"]/
  }
];

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

function findViolations(path: string): BoundaryViolation[] {
  const source = readFileSync(path, 'utf8');
  return [...FORBIDDEN_REFERENCES, ...FORBIDDEN_IMPORTS].flatMap((rule) =>
    rule.pattern.test(source)
      ? [{ file: relative(SHARED_SRC_DIR, path), rule: rule.name }]
      : []
  );
}

describe('shared sim import boundaries', () => {
  it('does not reference host globals or host-specific packages', () => {
    const violations = collectSourceFiles(SHARED_SIM_DIR).flatMap(findViolations);

    expect(violations).toEqual([]);
  });
});
