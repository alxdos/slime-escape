import { assertNever } from '../protocol';
import type {
  ArenaConfig,
  EncounterDefinition,
  SessionDefinition,
  StaticSpawn,
  Vec2
} from '../session';

import { SANDBOX_ARENA } from './arenas';
import { TRAINING_TARGET } from './enemies';
import { SANDBOX_PLAYER } from './players';
import type { ModePreset } from './presets';
import { PISTOL } from './weapons';

export type BuildOptions = Readonly<{
  seed: number;
  id?: string;
}>;

export function buildSessionDefinition(
  preset: ModePreset,
  options: BuildOptions
): SessionDefinition {
  switch (preset.id) {
    case 'sandbox':
      return buildSandboxSession(options);
    case 'sandbox-with-combat':
      return buildSandboxWithCombatSession(options);
    case 'campaign':
    case 'training':
    case 'pistolOnly':
      throw new Error(`ModePreset '${preset.id}' is not implemented yet`);
    default:
      return assertNever(preset.id);
  }
}

function buildSandboxSession(options: BuildOptions): SessionDefinition {
  const encounter: EncounterDefinition = {
    id: 'sandbox-encounter',
    type: 'sandbox',
    spawnPlan: { kind: 'empty' },
    zoneBehavior: { kind: 'disabled' },
    objectives: [],
    rewardRules: null,
    transitionRules: { kind: 'never' },
    tuning: null
  };

  return {
    id: options.id ?? 'sandbox-session',
    seed: options.seed,
    arena: SANDBOX_ARENA,
    player: SANDBOX_PLAYER,
    loadout: null,
    modifiers: [],
    rules: null,
    encounters: [encounter],
    winCondition: { kind: 'none' },
    lossCondition: { kind: 'none' },
    uiMeta: null
  };
}

function buildSandboxWithCombatSession(options: BuildOptions): SessionDefinition {
  const targetSpawn: StaticSpawn = {
    archetypeId: TRAINING_TARGET.id,
    position: { x: 5, y: 0 }
  };
  assertSpawnInsideArena(targetSpawn.position, TRAINING_TARGET.radius, SANDBOX_ARENA);

  const encounter: EncounterDefinition = {
    id: 'sandbox-with-combat-encounter',
    type: 'sandbox',
    spawnPlan: { kind: 'static', spawns: [targetSpawn] },
    zoneBehavior: { kind: 'disabled' },
    objectives: [],
    rewardRules: null,
    transitionRules: { kind: 'never' },
    tuning: null
  };

  return {
    id: options.id ?? 'sandbox-with-combat-session',
    seed: options.seed,
    arena: SANDBOX_ARENA,
    player: SANDBOX_PLAYER,
    loadout: { primaryWeaponArchetypeId: PISTOL.id },
    modifiers: [],
    rules: null,
    encounters: [encounter],
    winCondition: { kind: 'none' },
    lossCondition: { kind: 'none' },
    uiMeta: null
  };
}

function assertSpawnInsideArena(position: Vec2, radius: number, arena: ArenaConfig): void {
  const halfW = arena.width / 2;
  const halfH = arena.height / 2;
  const insideX = position.x - radius >= -halfW && position.x + radius <= halfW;
  const insideY = position.y - radius >= -halfH && position.y + radius <= halfH;
  if (!insideX || !insideY) {
    throw new Error(
      `static spawn at (${position.x}, ${position.y}) with radius ${radius} ` +
        `does not fit into arena ${arena.width}x${arena.height}`
    );
  }
}
