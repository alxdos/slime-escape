import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { InlineMediaSampleRegistry } from './inlineMedia';

type SampleEntrySnapshot = Readonly<{
  id: string;
  url: string;
  category: string;
  loop: boolean | undefined;
}>;

const DEFAULT_SAMPLE_ENTRIES = readDefaultSampleEntries();

const ENTRIES_BY_ID = new Map(
  DEFAULT_SAMPLE_ENTRIES.map((entry) => [entry.id, entry] as const)
);

export const BUILD_SAMPLE_REGISTRY: InlineMediaSampleRegistry = Object.freeze({
  get(sampleId: string): Readonly<{ url: string }> | null {
    return ENTRIES_BY_ID.get(sampleId) ?? null;
  }
});

export function getBuildSampleEntry(sampleId: string): SampleEntrySnapshot | null {
  return ENTRIES_BY_ID.get(sampleId) ?? null;
}

function readDefaultSampleEntries(): ReadonlyArray<SampleEntrySnapshot> {
  const source = readFileSync(resolve(process.cwd(), 'src/main/audio/SampleRegistry.ts'), 'utf8');
  const match = /export const DEFAULT_SAMPLE_ENTRIES[\s\S]*?Object\.freeze\(\[([\s\S]*?)\]\);/.exec(
    source
  );
  if (match?.[1] === undefined) {
    throw new Error('cannot find DEFAULT_SAMPLE_ENTRIES in src/main/audio/SampleRegistry.ts');
  }

  const entries: SampleEntrySnapshot[] = [];
  const entryPattern = /\{(?<body>[\s\S]*?)\}/g;
  for (const entry of match[1].matchAll(entryPattern)) {
    const body = entry.groups?.body;
    if (body === undefined) {
      throw new Error('cannot parse DEFAULT_SAMPLE_ENTRIES entry');
    }
    const id = matchStringProperty(body, 'id');
    const url = matchStringProperty(body, 'url');
    const category = matchStringProperty(body, 'category');
    if (id === null || url === null || category === null) {
      throw new Error('cannot parse DEFAULT_SAMPLE_ENTRIES id/url/category fields');
    }
    entries.push({ id, url, category, loop: matchBooleanProperty(body, 'loop') });
  }

  if (entries.length === 0) {
    throw new Error('DEFAULT_SAMPLE_ENTRIES did not contain any id/url pairs');
  }
  return entries;
}

function matchStringProperty(body: string, propertyName: string): string | null {
  const match = new RegExp(`${propertyName}:\\s*'(?<value>[^']+)'`).exec(body);
  return match?.groups?.value ?? null;
}

function matchBooleanProperty(body: string, propertyName: string): boolean | undefined {
  const match = new RegExp(`${propertyName}:\\s*(?<value>true|false)`).exec(body);
  if (match?.groups?.value === undefined) return undefined;
  return match.groups.value === 'true';
}
