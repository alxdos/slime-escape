import { SANDBOX_ARENA } from '../../../src/shared/content/arenas';
import * as generatedBosses from '../../../src/shared/content/bosses.generated';
import * as generatedDrops from '../../../src/shared/content/drops.generated';
import * as generatedEnemies from '../../../src/shared/content/enemies.generated';
import {
  HERO_SANDBOX,
  HERO_TRAINING,
  SANDBOX_PLAYER,
  TRAINING_PLAYER
} from '../../../src/shared/content/players.generated';
import * as generatedWeapons from '../../../src/shared/content/weapons.generated';
import type { MarkdownSection, SourcePosition } from '../parse';
import { ContentBuildError } from '../util/require';

export type ResolvedContentRef = Readonly<{
  id: string;
  constName: string;
}>;

export const ARENA_CONST_NAMES = new Map<string, string>([
  refEntry('sandbox', 'SANDBOX_ARENA', SANDBOX_ARENA)
]);

export const PLAYER_CONST_NAMES = new Map<string, string>([
  refEntry(HERO_SANDBOX.id, 'SANDBOX_PLAYER', SANDBOX_PLAYER),
  refEntry(HERO_TRAINING.id, 'TRAINING_PLAYER', TRAINING_PLAYER)
]);

export const WEAPON_CONST_NAMES = collectConstNames(generatedWeapons);
export const BOSS_CONST_NAMES = collectConstNames(generatedBosses);
export const ENEMY_CONST_NAMES = collectConstNames(generatedEnemies);
export const DROP_CONST_NAMES = collectConstNames(generatedDrops);

export const ARENA_IDS = new Set(ARENA_CONST_NAMES.keys());
export const PLAYER_IDS = new Set(PLAYER_CONST_NAMES.keys());
export const WEAPON_IDS = new Set(WEAPON_CONST_NAMES.keys());
export const BOSS_IDS = new Set(BOSS_CONST_NAMES.keys());
export const ENEMY_IDS = new Set(ENEMY_CONST_NAMES.keys());
export const DROP_IDS = new Set(DROP_CONST_NAMES.keys());

export function requireArenaRef(
  section: MarkdownSection,
  position: SourcePosition,
  fieldName: string,
  id: string
): ResolvedContentRef {
  return requireKnownRef(section, position, fieldName, id, ARENA_CONST_NAMES);
}

export function requirePlayerRef(
  section: MarkdownSection,
  position: SourcePosition,
  fieldName: string,
  id: string
): ResolvedContentRef {
  return requireKnownRef(section, position, fieldName, id, PLAYER_CONST_NAMES);
}

export function requireWeaponRef(
  section: MarkdownSection,
  position: SourcePosition,
  fieldName: string,
  id: string
): ResolvedContentRef {
  return requireKnownRef(section, position, fieldName, id, WEAPON_CONST_NAMES);
}

export function requireBossRef(
  section: MarkdownSection,
  position: SourcePosition,
  fieldName: string,
  id: string
): ResolvedContentRef {
  return requireKnownRef(section, position, fieldName, id, BOSS_CONST_NAMES);
}

export function requireEnemyRef(
  section: MarkdownSection,
  position: SourcePosition,
  fieldName: string,
  id: string
): ResolvedContentRef {
  return requireKnownRef(section, position, fieldName, id, ENEMY_CONST_NAMES);
}

export function requireDropRef(
  section: MarkdownSection,
  position: SourcePosition,
  fieldName: string,
  id: string
): ResolvedContentRef {
  return requireKnownRef(section, position, fieldName, id, DROP_CONST_NAMES);
}

function requireKnownRef(
  section: MarkdownSection,
  position: SourcePosition,
  fieldName: string,
  id: string,
  constNames: ReadonlyMap<string, string>
): ResolvedContentRef {
  const constName = constNames.get(id);
  if (constName === undefined) {
    throw new ContentBuildError(
      `${section.filePath}:${position.line}:${position.column}: section "${sectionLabel(
        section
      )}": unknown ${fieldName} "${id}"`
    );
  }
  return { id, constName };
}

function collectConstNames(moduleExports: Record<string, unknown>): ReadonlyMap<string, string> {
  const entries: Array<readonly [string, string]> = [];
  for (const [constName, value] of Object.entries(moduleExports)) {
    if (hasStringId(value)) {
      entries.push([value.id, constName]);
    }
  }
  return new Map(entries.sort(([left], [right]) => left.localeCompare(right)));
}

function refEntry(id: string, constName: string, _value: unknown): readonly [string, string] {
  return [id, constName];
}

function hasStringId(value: unknown): value is Readonly<{ id: string }> {
  return typeof value === 'object' && value !== null && 'id' in value && typeof value.id === 'string';
}

function sectionLabel(section: MarkdownSection): string {
  return `${'#'.repeat(section.depth)} ${section.title}`;
}
