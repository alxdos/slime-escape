export function renderHeader(sourcePath: string): string {
  return [`// AUTO-GENERATED from ${sourcePath} by \`npm run content:build\`.`, '// Do not edit by hand.', ''].join(
    '\n'
  );
}

export function toConstName(id: string): string {
  return id.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toUpperCase();
}

export function formatHexColor(value: number): string {
  return `0x${value.toString(16).padStart(6, '0')}`;
}

export function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : String(value);
}

export function renderObjectKey(key: string): string {
  return /^[a-z_$][a-z0-9_$]*$/i.test(key) ? key : `'${escapeString(key)}'`;
}

export function renderStringArray(values: ReadonlyArray<string>): string {
  return `[${values.map((value) => `'${escapeString(value)}'`).join(', ')}]`;
}

export function renderSampleSpec(sampleIds: ReadonlyArray<string>): string {
  if (sampleIds.length === 1) {
    const sampleId = sampleIds[0];
    if (sampleId === undefined) {
      throw new Error('sample spec invariant failed');
    }
    return `'${escapeString(sampleId)}'`;
  }
  return `Object.freeze(${renderStringArray(sampleIds)})`;
}

export function escapeString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
