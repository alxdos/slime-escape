/// <reference types="vite/client" />

import { describe, expect, it } from 'vitest';

import { PX_PER_WU } from './spriteScale';

describe('PX_PER_WU', () => {
  it('uses the design sprite scale value', () => {
    expect(PX_PER_WU).toBe(200);
  });

  it('has a single initialization across runtime and content-build sources', () => {
    const matches = findScaleInitializations();

    expect(matches).toEqual(['src/shared/sprite/spriteScale.ts']);
  });
});

function findScaleInitializations(): ReadonlyArray<string> {
  const assignmentPattern = new RegExp(String.raw`\bPX_PER_WU\s*=\s*${PX_PER_WU}\b`);
  const sources = import.meta.glob(['/src/**/*.ts', '/scripts/**/*.ts'], {
    eager: true,
    import: 'default',
    query: '?raw'
  }) as Record<string, string>;

  return Object.entries(sources)
    .filter(([, source]) => assignmentPattern.test(source))
    .map(([path]) => path.replace(/^\//, ''))
    .sort();
}
