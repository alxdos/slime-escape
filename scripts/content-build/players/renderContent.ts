import type { ParsedPlayer, ParsedPlayersArea } from './parse';
import { ContentBuildError } from '../util/require';
import {
  escapeString,
  formatNumber,
  renderHeader,
  toConstName
} from '../util/render';

export function renderPlayerContent(area: ParsedPlayersArea): string {
  const hero = requireHero(area);
  return `${renderHeader(area.sourcePath)}${renderImport()}${area.players
    .map(renderPlayer)
    .join('\n\n')}\n\n${renderPlayerSpawn('SANDBOX_PLAYER', hero)}\n\n${renderPlayerSpawn(
    'TRAINING_PLAYER',
    hero
  )}\n`;
}

function renderImport(): string {
  return "import type { PlayerSpawn } from '../session';\nimport type { PlayerArchetype } from './players';\n\n";
}

function renderPlayer(player: ParsedPlayer): string {
  return `export const ${toConstName(player.id)}: PlayerArchetype = {
  id: '${escapeString(player.id)}',
  displayName: '${escapeString(player.displayName)}',
  radius: ${formatNumber(player.radius)},
  maxSpeed: ${formatNumber(player.maxSpeed)},
  maxHp: ${formatNumber(player.maxHp)}
};`;
}

function renderPlayerSpawn(constName: string, player: ParsedPlayer): string {
  const sourceConstName = toConstName(player.id);
  return `export const ${constName}: PlayerSpawn = {
  position: { x: 0, y: 0 },
  radius: ${sourceConstName}.radius,
  maxSpeed: ${sourceConstName}.maxSpeed,
  maxHp: ${sourceConstName}.maxHp
};`;
}

function requireHero(area: ParsedPlayersArea): ParsedPlayer {
  const hero = area.players.find((player) => player.id === 'hero');
  if (hero === undefined) {
    throw new ContentBuildError(`${area.sourcePath}: player "hero" is required`);
  }
  return hero;
}
