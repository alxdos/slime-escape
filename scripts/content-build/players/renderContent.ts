import type { ParsedPlayer, ParsedPlayersArea } from './parse';
import { ContentBuildError } from '../util/require';
import { readSpriteAssetMetrics } from '../util/spriteMetrics';
import {
  escapeString,
  formatNumber,
  renderHeader,
  toConstName
} from '../util/render';

export function renderPlayerContent(area: ParsedPlayersArea): string {
  const sandboxHero = requirePlayer(area, 'hero-sandbox');
  const trainingHero = requirePlayer(area, 'hero-training');
  return `${renderHeader(area.sourcePath)}${renderImport()}${area.players
    .map((player) => renderPlayer(area, player))
    .join('\n\n')}\n\n${renderPlayerArchetypeSpecs(area.players)}\n\n${renderPlayerSpawn(
    'SANDBOX_PLAYER',
    sandboxHero
  )}\n\n${renderPlayerSpawn('TRAINING_PLAYER', trainingHero)}\n`;
}

function renderImport(): string {
  return "import type { PlayerSpawn } from '../session';\nimport type { PlayerArchetype } from './players';\n\n";
}

function renderPlayer(area: ParsedPlayersArea, player: ParsedPlayer): string {
  const { worldSize } = readSpriteAssetMetrics({
    sourcePath: area.sourcePath,
    rowId: player.id,
    imagePath: player.visual.image
  });
  return `export const ${toConstName(player.id)}: PlayerArchetype = {
  id: '${escapeString(player.id)}',
  displayName: '${escapeString(player.displayName)}',
  radius: ${formatNumber(player.radius)},
  contactBox: { width: ${formatNumber(worldSize.width)}, height: ${formatNumber(worldSize.height)} },
  maxSpeed: ${formatNumber(player.maxSpeed)},
  maxHp: ${formatNumber(player.maxHp)}
};`;
}

function renderPlayerArchetypeSpecs(players: ReadonlyArray<ParsedPlayer>): string {
  const constNames = players.map((player) => toConstName(player.id));
  return `export const PLAYER_ARCHETYPE_SPECS = [${constNames.join(', ')}] as const satisfies ReadonlyArray<PlayerArchetype>;`;
}

function renderPlayerSpawn(constName: string, player: ParsedPlayer): string {
  const sourceConstName = toConstName(player.id);
  return `export const ${constName}: PlayerSpawn = {
  position: { x: 0, y: 0 },
  radius: ${sourceConstName}.radius,
  contactBox: ${sourceConstName}.contactBox,
  maxSpeed: ${sourceConstName}.maxSpeed,
  maxHp: ${sourceConstName}.maxHp
};`;
}

function requirePlayer(area: ParsedPlayersArea, playerId: string): ParsedPlayer {
  const player = area.players.find((entry) => entry.id === playerId);
  if (player === undefined) {
    throw new ContentBuildError(`${area.sourcePath}: player "${playerId}" is required`);
  }
  return player;
}
