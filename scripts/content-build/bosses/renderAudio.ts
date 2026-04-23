import type { ParsedBoss, ParsedBossesArea } from './parse';
import { escapeString, renderHeader, renderSampleSpec } from '../util/render';

export function renderBossAudio(area: ParsedBossesArea): string {
  return `${renderHeader('content/bosses.md')}${renderImport()}${renderMappings(area.bosses)}\n`;
}

function renderImport(): string {
  return "import type { BossAudioMapping } from './AudioMappings';\n\n";
}

function renderMappings(bosses: ReadonlyArray<ParsedBoss>): string {
  return `export const BOSS_AUDIO_MAPPINGS: Readonly<Record<string, BossAudioMapping>> = Object.freeze({
${bosses.map(renderMapping).join(',\n')}
});`;
}

function renderMapping(boss: ParsedBoss): string {
  const properties: string[] = [];
  if (boss.audio.fire.length > 0) {
    properties.push(`    fire: ${renderSampleSpec(boss.audio.fire)}`);
  }
  if (boss.audio.phaseChange.length > 0) {
    properties.push(`    phaseChange: ${renderSampleSpec(boss.audio.phaseChange)}`);
  }

  if (properties.length === 0) {
    return `  '${escapeString(boss.id)}': Object.freeze({})`;
  }

  return `  '${escapeString(boss.id)}': Object.freeze({
${properties.join(',\n')}
  })`;
}
