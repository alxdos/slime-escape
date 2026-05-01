import type { DropEffect } from '../../../src/shared/content/drops';
import type { WeaponModifier } from '../../../src/shared/content/weapons';

import type { ParsedDrop, ParsedDropsArea } from './parse';
import {
  escapeString,
  formatHexColor,
  formatNumber,
  renderHeader,
  toConstName
} from '../util/render';

export function renderDropContent(area: ParsedDropsArea): string {
  return `${renderHeader(area.sourcePath)}${renderImport()}${area.drops.map(renderDrop).join('\n\n')}\n`;
}

function renderImport(): string {
  return "import type { DropArchetype } from './drops.js';\n\n";
}

function renderDrop(drop: ParsedDrop): string {
  return `export const ${toConstName(drop.id)}: DropArchetype = {
  id: '${escapeString(drop.id)}',
  displayName: '${escapeString(drop.displayName)}',
  radius: ${formatNumber(drop.radius)},
  ttlMs: ${formatNumber(drop.ttlMs)},
  effect: ${renderDropEffect(drop.effect)},
  color: ${formatHexColor(drop.color)}
};`;
}

function renderDropEffect(effect: DropEffect): string {
  switch (effect.kind) {
    case 'heal':
      return `{ kind: 'heal', amount: ${formatNumber(effect.amount)} }`;
    case 'addWeaponModifier':
      return `{ kind: 'addWeaponModifier', modifier: ${renderWeaponModifier(effect.modifier)}, target: 'selectedWeapon' }`;
    case 'temporaryOverdrive':
      return `{ kind: 'temporaryOverdrive', cooldownMultiplier: ${formatNumber(effect.cooldownMultiplier)}, durationMs: ${formatNumber(effect.durationMs)}, target: 'selectedWeapon' }`;
    case 'pickupModifier':
      return `{ kind: 'pickupModifier', modifier: { kind: 'dropMagnet', pickupRadiusMultiplier: ${formatNumber(effect.modifier.pickupRadiusMultiplier)}, attractSpeed: ${formatNumber(effect.modifier.attractSpeed)} } }`;
    default:
      return assertNever(effect);
  }
}

function renderWeaponModifier(modifier: WeaponModifier): string {
  switch (modifier.kind) {
    case 'projectileSizeMultiplier':
    case 'projectileSpeedMultiplier':
    case 'symmetricProjectileMultiplier':
      return `{ kind: '${modifier.kind}', multiplier: ${formatNumber(modifier.multiplier)} }`;
    case 'pierceBonus':
      return `{ kind: 'pierceBonus', amount: ${formatNumber(modifier.amount)} }`;
    case 'fragmentExplosion':
      return `{ kind: 'fragmentExplosion', fragmentWeaponArchetypeId: '${escapeString(modifier.fragmentWeaponArchetypeId)}', count: ${formatNumber(modifier.count)}, spreadRadians: ${formatNumber(modifier.spreadRadians)} }`;
    default:
      return assertNever(modifier);
  }
}

function assertNever(value: never): never {
  throw new Error(`unhandled drop render value: ${String(value)}`);
}
