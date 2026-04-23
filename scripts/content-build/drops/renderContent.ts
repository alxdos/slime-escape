import type { ParsedDrop, ParsedDropsArea } from './parse';
import {
  escapeString,
  formatHexColor,
  formatNumber,
  renderHeader,
  toConstName
} from '../util/render';

export function renderDropContent(area: ParsedDropsArea): string {
  return `${renderHeader('content/drops.md')}${renderImport()}${area.drops.map(renderDrop).join('\n\n')}\n`;
}

function renderImport(): string {
  return "import type { DropArchetype } from './drops';\n\n";
}

function renderDrop(drop: ParsedDrop): string {
  return `export const ${toConstName(drop.id)}: DropArchetype = {
  id: '${escapeString(drop.id)}',
  displayName: '${escapeString(drop.displayName)}',
  radius: ${formatNumber(drop.radius)},
  ttlMs: ${formatNumber(drop.ttlMs)},
  effect: { kind: '${drop.effect.kind}', amount: ${formatNumber(drop.effect.amount)} },
  color: ${formatHexColor(drop.color)}
};`;
}
