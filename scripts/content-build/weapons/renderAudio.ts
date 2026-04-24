import type { ParsedWeapon, ParsedWeaponsArea } from './parse';
import { renderHeader, renderObjectKey, renderSampleSpec } from '../util/render';

export function renderWeaponAudio(area: ParsedWeaponsArea): string {
  return `${renderHeader(area.sourcePath)}${renderImport()}${renderMappings(area.weapons)}\n`;
}

function renderImport(): string {
  return "import type { WeaponAudioMapping } from './AudioMappings';\n\n";
}

function renderMappings(weapons: ReadonlyArray<ParsedWeapon>): string {
  return `export const WEAPON_AUDIO_MAPPINGS: Readonly<Record<string, WeaponAudioMapping>> = Object.freeze({
${weapons.map(renderMapping).join(',\n')}
});`;
}

function renderMapping(weapon: ParsedWeapon): string {
  return `  ${renderObjectKey(weapon.id)}: Object.freeze({ fire: ${renderSampleSpec(weapon.audio.fire)} })`;
}
