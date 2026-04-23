import type { ParsedBoss, ParsedBossAttack, ParsedBossPhase, ParsedBossesArea } from './parse';
import { readSpriteAssetMetrics } from '../util/spriteMetrics';
import {
  escapeString,
  formatHexColor,
  formatNumber,
  renderHeader,
  renderObjectKey,
  renderStringArray,
  toConstName
} from '../util/render';

export function renderBossContent(area: ParsedBossesArea): string {
  return `${renderHeader('content/bosses.md')}${renderImport()}${area.bosses
    .map((boss) => renderBoss(area, boss))
    .join('\n\n')}\n`;
}

function renderImport(): string {
  return "import type { BossArchetype } from './bosses';\n\n";
}

function renderBoss(area: ParsedBossesArea, boss: ParsedBoss): string {
  const { worldSize } = readSpriteAssetMetrics({
    sourcePath: area.sourcePath,
    rowId: boss.id,
    imagePath: boss.visual.image
  });
  return `export const ${toConstName(boss.id)}: BossArchetype = {
  id: '${escapeString(boss.id)}',
  displayName: '${escapeString(boss.displayName)}',
  radius: ${formatNumber(boss.radius)},
  contactBox: { width: ${formatNumber(worldSize.width)}, height: ${formatNumber(worldSize.height)} },
  maxHp: ${formatNumber(boss.maxHp)},
  maxSpeed: ${formatNumber(boss.maxSpeed)},
  color: ${formatHexColor(boss.color)},
  contactDamage: ${formatNumber(boss.contactDamage)},
  contactCooldownMs: ${formatNumber(boss.contactCooldownMs)},
  knockbackBaseImpulse: ${formatNumber(boss.knockbackBaseImpulse)},
  knockbackVelocityScale: ${formatNumber(boss.knockbackVelocityScale)},
  knockbackDurationMs: ${formatNumber(boss.knockbackDurationMs)},
  phases: [
${boss.phases.map(renderPhase).join(',\n')}
  ],
  attacks: {
${boss.attacks.map(renderAttack).join(',\n')}
  }
};`;
}

function renderPhase(phase: ParsedBossPhase): string {
  return `    {
      id: '${escapeString(phase.id)}',
      allowedAttackIds: ${renderStringArray(phase.allowedAttackIds)},
      exitWhenHpFractionAtOrBelow: ${formatNumber(phase.exitWhenHpFractionAtOrBelow)}
    }`;
}

function renderAttack(attack: ParsedBossAttack): string {
  return `    ${renderObjectKey(attack.key)}: { pattern: '${escapeString(attack.pattern)}', cooldownMs: ${formatNumber(
    attack.cooldownMs
  )}, damage: ${formatNumber(attack.damage)} }`;
}
