import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { InlineMediaSampleRegistry } from './inlineMedia';

type SampleEntrySnapshot = Readonly<{
  id: string;
  url: string;
}>;

const DEFAULT_SAMPLE_ENTRIES = readDefaultSampleEntries();

const ENTRIES_BY_ID = new Map(
  DEFAULT_SAMPLE_ENTRIES.map((entry) => [entry.id, { url: entry.url }] as const)
);

export const BUILD_SAMPLE_REGISTRY: InlineMediaSampleRegistry = Object.freeze({
  get(sampleId: string): Readonly<{ url: string }> | null {
    return ENTRIES_BY_ID.get(sampleId) ?? null;
  }
});

function readDefaultSampleEntries(): ReadonlyArray<SampleEntrySnapshot> {
  const source = readFileSync(resolve(process.cwd(), 'src/main/audio/SampleRegistry.ts'), 'utf8');
  const match = /export const DEFAULT_SAMPLE_ENTRIES[\s\S]*?Object\.freeze\(\[([\s\S]*?)\]\);/.exec(
    source
  );
  if (match?.[1] === undefined) {
    throw new Error('cannot find DEFAULT_SAMPLE_ENTRIES in src/main/audio/SampleRegistry.ts');
  }

  const entries: SampleEntrySnapshot[] = [];
  const entryPattern = /id:\s*'(?<id>[^']+)'\s*,\s*url:\s*'(?<url>[^']+)'/g;
  for (const entry of match[1].matchAll(entryPattern)) {
    const id = entry.groups?.id;
    const url = entry.groups?.url;
    if (id === undefined || url === undefined) {
      throw new Error('cannot parse DEFAULT_SAMPLE_ENTRIES id/url pair');
    }
    entries.push({ id, url });
  }

  if (entries.length === 0) {
    throw new Error('DEFAULT_SAMPLE_ENTRIES did not contain any id/url pairs');
  }
  return entries;
}
