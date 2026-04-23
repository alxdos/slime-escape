import type { ParsedEnemiesArea, ParsedEnemy, ParsedDropTableEntry } from './parse';

export function renderEnemyContent(area: ParsedEnemiesArea): string {
  return `${renderHeader()}${renderImport()}${area.enemies.map(renderEnemy).join('\n\n')}\n`;
}

function renderHeader(): string {
  return [
    '// AUTO-GENERATED from content/enemies.md by `npm run content:build`.',
    '// Do not edit by hand.',
    ''
  ].join('\n');
}

function renderImport(): string {
  return "import type { EnemyArchetype } from './enemies';\n\n";
}

function renderEnemy(enemy: ParsedEnemy): string {
  return `export const ${toConstName(enemy.id)}: EnemyArchetype = {
  id: '${enemy.id}',
  displayName: '${escapeString(enemy.displayName)}',
  radius: ${formatNumber(enemy.radius)},
  maxHp: ${formatNumber(enemy.maxHp)},
  behavior: '${enemy.behavior}',
  maxSpeed: ${formatNumber(enemy.maxSpeed)},
  contactDamage: ${formatNumber(enemy.contactDamage)},
  contactCooldownMs: ${formatNumber(enemy.contactCooldownMs)},
  knockbackBaseImpulse: ${formatNumber(enemy.knockbackBaseImpulse)},
  knockbackVelocityScale: ${formatNumber(enemy.knockbackVelocityScale)},
  knockbackDurationMs: ${formatNumber(enemy.knockbackDurationMs)},
  color: ${formatHexColor(enemy.color)},
  dropTable: ${renderDropTable(enemy.dropTable)}
};`;
}

function renderDropTable(dropTable: ReadonlyArray<ParsedDropTableEntry>): string {
  if (dropTable.length === 0) {
    return '[]';
  }
  const entries = dropTable.map(
    (entry) =>
      `{ archetypeId: '${escapeString(entry.archetypeId)}', chance: ${formatNumber(entry.chance)} }`
  );
  return `[${entries.join(', ')}]`;
}

function toConstName(id: string): string {
  return id.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toUpperCase();
}

function formatHexColor(value: number): string {
  return `0x${value.toString(16).padStart(6, '0')}`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : String(value);
}

function escapeString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
