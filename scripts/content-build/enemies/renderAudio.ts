import type { ParsedEnemiesArea, ParsedEnemy } from './parse';

type SampleListConstant = Readonly<{
  key: string;
  name: string;
  sampleIds: ReadonlyArray<string>;
}>;

export function renderEnemyAudio(area: ParsedEnemiesArea): string {
  const constants = collectSampleListConstants(area.enemies);
  return `${renderHeader()}${renderImport()}${renderConstants(constants)}${renderMappings(
    area.enemies,
    constants
  )}\n`;
}

function renderHeader(): string {
  return [
    '// AUTO-GENERATED from content/enemies.md by `npm run content:build`.',
    '// Do not edit by hand.',
    ''
  ].join('\n');
}

function renderImport(): string {
  return "import type { EnemyAudioMapping } from './AudioMappings';\n\n";
}

function renderConstants(constants: ReadonlyArray<SampleListConstant>): string {
  if (constants.length === 0) {
    return '';
  }
  return `${constants.map(renderSampleListConstant).join('\n\n')}\n\n`;
}

function renderSampleListConstant(constant: SampleListConstant): string {
  return `const ${constant.name} = Object.freeze([
${constant.sampleIds.map((sampleId) => `  '${escapeString(sampleId)}'`).join(',\n')}
]);`;
}

function renderMappings(
  enemies: ReadonlyArray<ParsedEnemy>,
  constants: ReadonlyArray<SampleListConstant>
): string {
  return `export const ENEMY_AUDIO_MAPPINGS: Readonly<Record<string, EnemyAudioMapping>> = Object.freeze({
${enemies.map((enemy) => renderMapping(enemy, constants)).join(',\n')}
});`;
}

function renderMapping(
  enemy: ParsedEnemy,
  constants: ReadonlyArray<SampleListConstant>
): string {
  const properties: string[] = [];
  if (enemy.audio.hit.length > 0) {
    properties.push(`    hit: ${renderSampleSpec(enemy.audio.hit, constants)}`);
  }
  if (enemy.audio.death.length > 0) {
    properties.push(`    death: ${renderSampleSpec(enemy.audio.death, constants)}`);
  }
  if (enemy.audio.voice !== null) {
    properties.push(`    voice: Object.freeze({
      sample: ${renderSampleSpec(enemy.audio.voice.sampleIds, constants)},
      intervalMinMs: ${formatNumber(enemy.audio.voice.intervalMinMs)},
      intervalMaxMs: ${formatNumber(enemy.audio.voice.intervalMaxMs)}
    })`);
  }

  if (properties.length === 0) {
    return `  '${escapeString(enemy.id)}': Object.freeze({})`;
  }

  return `  '${escapeString(enemy.id)}': Object.freeze({
${properties.join(',\n')}
  })`;
}

function renderSampleSpec(
  sampleIds: ReadonlyArray<string>,
  constants: ReadonlyArray<SampleListConstant>
): string {
  if (sampleIds.length === 1) {
    const sampleId = sampleIds[0];
    if (sampleId === undefined) {
      throw new Error('sample spec invariant failed');
    }
    return `'${escapeString(sampleId)}'`;
  }

  const key = sampleListKey(sampleIds);
  const constant = constants.find((candidate) => candidate.key === key);
  if (constant !== undefined) {
    return constant.name;
  }

  return `Object.freeze([${sampleIds.map((sampleId) => `'${escapeString(sampleId)}'`).join(', ')}])`;
}

function collectSampleListConstants(enemies: ReadonlyArray<ParsedEnemy>): ReadonlyArray<SampleListConstant> {
  const counts = new Map<string, { sampleIds: ReadonlyArray<string>; count: number }>();

  for (const enemy of enemies) {
    countSampleList(counts, enemy.audio.hit);
    countSampleList(counts, enemy.audio.death);
    if (enemy.audio.voice !== null) {
      countSampleList(counts, enemy.audio.voice.sampleIds);
    }
  }

  const constants: SampleListConstant[] = [];
  let nextIndex = 1;
  for (const [key, entry] of counts) {
    if (entry.count < 2 || entry.sampleIds.length <= 1) {
      continue;
    }
    constants.push({
      key,
      name: inferSampleListName(entry.sampleIds, nextIndex),
      sampleIds: entry.sampleIds
    });
    nextIndex += 1;
  }
  return constants;
}

function countSampleList(
  counts: Map<string, { sampleIds: ReadonlyArray<string>; count: number }>,
  sampleIds: ReadonlyArray<string>
): void {
  if (sampleIds.length <= 1) {
    return;
  }
  const key = sampleListKey(sampleIds);
  const current = counts.get(key);
  if (current === undefined) {
    counts.set(key, { sampleIds, count: 1 });
    return;
  }
  counts.set(key, { sampleIds: current.sampleIds, count: current.count + 1 });
}

function sampleListKey(sampleIds: ReadonlyArray<string>): string {
  return sampleIds.join('\u0000');
}

function inferSampleListName(sampleIds: ReadonlyArray<string>, fallbackIndex: number): string {
  if (sampleIds.every((sampleId) => sampleId.startsWith('slimes/hit-'))) {
    return 'SLIME_HIT_VARIANTS';
  }
  if (sampleIds.every((sampleId) => sampleId.startsWith('slimes/death-'))) {
    return 'SLIME_DEATH_VARIANTS';
  }
  if (sampleIds.every((sampleId) => sampleId.startsWith('slimes/voice-'))) {
    return 'SLIME_VOICE_VARIANTS';
  }
  return `SAMPLE_VARIANTS_${fallbackIndex}`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : String(value);
}

function escapeString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
