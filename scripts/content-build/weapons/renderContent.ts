import type { ParsedWeapon, ParsedWeaponsArea } from './parse';
import {
  escapeString,
  formatHexColor,
  formatNumber,
  renderHeader,
  toConstName
} from '../util/render';

export function renderWeaponContent(area: ParsedWeaponsArea): string {
  return `${renderHeader('content/weapons.md')}${renderImport()}${area.weapons.map(renderWeapon).join('\n\n')}\n`;
}

function renderImport(): string {
  return "import type { WeaponArchetype } from './weapons';\n\n";
}

function renderWeapon(weapon: ParsedWeapon): string {
  return `export const ${toConstName(weapon.id)}: WeaponArchetype = {
  id: '${escapeString(weapon.id)}',
  displayName: '${escapeString(weapon.displayName)}',
  cooldownMs: ${formatNumber(weapon.cooldownMs)},
  projectileSpeed: ${formatNumber(weapon.projectileSpeed)},
  projectileRadius: ${formatNumber(weapon.projectileRadius)},
  projectileTtlMs: ${formatNumber(weapon.projectileTtlMs)},
  damage: ${formatNumber(weapon.damage)},
  color: ${formatHexColor(weapon.color)}
};`;
}
