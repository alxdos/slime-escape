import { log } from '../log';
import { assertNever } from '../protocol';
import type {
  ArenaConfig,
  EncounterDefinition,
  SessionDefinition,
  StaticSpawn,
  Vec2
} from '../session';
import { SIM_STEP_MS } from '../timing';

import { SANDBOX_ARENA } from './arenas';
import { SLIME_KING } from './bosses';
import {
  ENEMY_ARCHETYPES,
  SLIME_FAST,
  SLIME_TANK,
  TRAINING_TARGET,
  validateEnemyRegistry
} from './enemies';
import { SANDBOX_PLAYER, TRAINING_PLAYER } from './players';
import type { ModePreset } from './presets';
import { PISTOL, WEAPON_ARCHETYPES } from './weapons';

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
    case 'training':
      return buildTrainingSession(options);
    case 'campaign':
      return buildCampaignSession(options);
    case 'pistolOnly':
      throw new Error(`ModePreset '${preset.id}' is not implemented yet`);
    default:
      return assertNever(preset.id);
  }
}

function buildSandboxSession(options: BuildOptions): SessionDefinition {
  validateEnemyRegistry(ENEMY_ARCHETYPES, SANDBOX_PLAYER.radius);

  const encounter: EncounterDefinition = {
    id: 'sandbox-encounter',
    type: 'sandbox',
    spawnPlan: { kind: 'empty' },
    zoneBehavior: { kind: 'disabled' },
    objectives: [],
    rewardRules: null,
    transitionRules: { kind: 'never', next: 'sequential' },
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
  validateEnemyRegistry(ENEMY_ARCHETYPES, SANDBOX_PLAYER.radius);

  const targetSpawn: StaticSpawn = {
    archetypeId: TRAINING_TARGET.id,
    position: { x: 5, y: 0 }
  };
  assertSpawnInsideArena(targetSpawn.position, TRAINING_TARGET.radius, SANDBOX_ARENA);
  warnIfWeaponMayTunnel(PISTOL.id);

  const encounter: EncounterDefinition = {
    id: 'sandbox-with-combat-encounter',
    type: 'sandbox',
    spawnPlan: { kind: 'static', spawns: [targetSpawn] },
    zoneBehavior: { kind: 'disabled' },
    objectives: [],
    rewardRules: null,
    transitionRules: { kind: 'never', next: 'sequential' },
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

function makeTrainingRunEncounters(): ReadonlyArray<EncounterDefinition> {
  const wave1: EncounterDefinition = {
    id: 'training-wave-1',
    type: 'wave',
    spawnPlan: {
      kind: 'wave',
      spawns: [
        { archetypeId: SLIME_FAST.id },
        { archetypeId: SLIME_FAST.id },
        { archetypeId: SLIME_TANK.id },
        { archetypeId: SLIME_FAST.id },
        { archetypeId: SLIME_FAST.id },
        { archetypeId: SLIME_TANK.id }
      ],
      spawnIntervalMs: 1500,
      maxAlive: 4,
      edgeMargin: 0.5
    },
    zoneBehavior: { kind: 'shrinkLinear', fromMargin: 0, toMargin: 4, durationMs: 8000 },
    objectives: [],
    rewardRules: null,
    transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
    tuning: null
  };

  const breakEncounter: EncounterDefinition = {
    id: 'training-break',
    type: 'break',
    spawnPlan: { kind: 'empty' },
    zoneBehavior: { kind: 'expandLinear', fromMargin: 4, toMargin: 0, durationMs: 2500 },
    objectives: [],
    rewardRules: null,
    transitionRules: { kind: 'timer', durationMs: 3000, next: 'sequential' },
    tuning: null
  };

  const wave2: EncounterDefinition = {
    id: 'training-wave-2',
    type: 'wave',
    spawnPlan: {
      kind: 'wave',
      spawns: [
        { archetypeId: SLIME_FAST.id },
        { archetypeId: SLIME_FAST.id },
        { archetypeId: SLIME_FAST.id },
        { archetypeId: SLIME_TANK.id },
        { archetypeId: SLIME_FAST.id },
        { archetypeId: SLIME_FAST.id },
        { archetypeId: SLIME_TANK.id },
        { archetypeId: SLIME_FAST.id },
        { archetypeId: SLIME_TANK.id },
        { archetypeId: SLIME_FAST.id }
      ],
      spawnIntervalMs: 1200,
      maxAlive: 5,
      edgeMargin: 0.5
    },
    zoneBehavior: { kind: 'shrinkLinear', fromMargin: 0, toMargin: 5, durationMs: 10000 },
    objectives: [],
    rewardRules: null,
    transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
    tuning: null
  };

  return [wave1, breakEncounter, wave2];
}

function buildTrainingSession(options: BuildOptions): SessionDefinition {
  validateEnemyRegistry(ENEMY_ARCHETYPES, TRAINING_PLAYER.radius);
  warnIfWeaponMayTunnel(PISTOL.id);

  return {
    id: options.id ?? 'training-session',
    seed: options.seed,
    arena: SANDBOX_ARENA,
    player: TRAINING_PLAYER,
    loadout: { primaryWeaponArchetypeId: PISTOL.id },
    modifiers: [],
    rules: null,
    encounters: makeTrainingRunEncounters(),
    winCondition: { kind: 'allEncountersComplete' },
    lossCondition: { kind: 'playerDeath' },
    uiMeta: null
  };
}

function buildCampaignSession(options: BuildOptions): SessionDefinition {
  validateEnemyRegistry(ENEMY_ARCHETYPES, TRAINING_PLAYER.radius);
  warnIfWeaponMayTunnel(PISTOL.id);

  /** Matches wave spawn `edgeMargin` — boss enters from top center like edge-spawned slimes. */
  const bossEdgeMargin = 0.5;
  const bossSpawnPos = bossTopCenterSpawnInArena(SANDBOX_ARENA, SLIME_KING.radius, bossEdgeMargin);
  assertSpawnInsideArena(bossSpawnPos, SLIME_KING.radius, SANDBOX_ARENA);

  const campaignPreBossBreak: EncounterDefinition = {
    id: 'campaign-pre-boss-break',
    type: 'break',
    spawnPlan: { kind: 'empty' },
    zoneBehavior: {
      kind: 'expandLinear',
      fromMargin: 5,
      toMargin: 0,
      durationMs: 2500
    },
    objectives: [],
    rewardRules: null,
    transitionRules: { kind: 'timer', durationMs: 3000, next: 'sequential' },
    tuning: null
  };

  const bossEncounter: EncounterDefinition = {
    id: 'campaign-boss',
    type: 'boss',
    spawnPlan: {
      kind: 'boss',
      bossArchetypeId: SLIME_KING.id,
      position: bossSpawnPos
    },
    zoneBehavior: { kind: 'disabled' },
    objectives: [],
    rewardRules: null,
    transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
    tuning: null
  };

  return {
    id: options.id ?? 'campaign-session',
    seed: options.seed,
    arena: SANDBOX_ARENA,
    player: TRAINING_PLAYER,
    loadout: { primaryWeaponArchetypeId: PISTOL.id },
    modifiers: [],
    rules: null,
    encounters: [...makeTrainingRunEncounters(), campaignPreBossBreak, bossEncounter],
    winCondition: { kind: 'bossDefeated' },
    lossCondition: { kind: 'playerDeath' },
    uiMeta: null
  };
}

/** Boss spawn: horizontally centered, as high as allowed inside arena (same inset as wave edge margin). */
function bossTopCenterSpawnInArena(
  arena: ArenaConfig,
  bossRadius: number,
  edgeMargin: number
): Vec2 {
  const halfH = arena.height / 2;
  return { x: 0, y: halfH - edgeMargin - bossRadius };
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

function warnIfWeaponMayTunnel(weaponId: string): void {
  const weapon = WEAPON_ARCHETYPES[weaponId];
  if (weapon === undefined) {
    throw new Error(`unknown weapon archetype: ${weaponId}`);
  }
  let minEnemyRadius = Number.POSITIVE_INFINITY;
  for (const archetype of Object.values(ENEMY_ARCHETYPES)) {
    if (archetype.radius < minEnemyRadius) minEnemyRadius = archetype.radius;
  }
  if (!Number.isFinite(minEnemyRadius)) return;

  const stepDistance = weapon.projectileSpeed * (SIM_STEP_MS / 1000);
  const reach = weapon.projectileRadius + minEnemyRadius;
  if (stepDistance > reach) {
    log.warn('weapon may tunnel through smallest target per design/projectiles-and-combat.md', {
      weaponId: weapon.id,
      stepDistance,
      reach,
      minEnemyRadius
    });
  }
}
