import { log } from '../log';
import { assertNever } from '../protocol';
import type {
  ArenaConfig,
  ContactBox,
  EncounterDefinition,
  SessionDefinition,
  StaticSpawn,
  Vec2
} from '../session';
import { SIM_STEP_MS } from '../timing';

import { SANDBOX_ARENA } from './arenas';
import { BOSS_ARCHETYPES, BOSS_SCRAP_KING } from './bosses';
import {
  ENEMY_ARCHETYPES,
  SLIME_BUG,
  SLIME_ONE_EYE,
  SLIME_SHELL,
  validateEnemyRegistry
} from './enemies';
import { SANDBOX_PLAYER, TRAINING_PLAYER } from './players';
import type { ModePreset } from './presets';
import { PISTOL, WEAPON_ARCHETYPES } from './weapons';

// Story 013 content migration: training-target -> slime-bug,
// slime-fast -> slime-one-eye, slime-tank -> slime-shell, slime-king -> boss-scrap-king.
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
  validateEnemyRegistry(ENEMY_ARCHETYPES, SANDBOX_PLAYER.contactBox);

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
  validateEnemyRegistry(ENEMY_ARCHETYPES, SANDBOX_PLAYER.contactBox);

  const targetSpawn: StaticSpawn = {
    archetypeId: SLIME_BUG.id,
    position: { x: 5, y: 0 }
  };
  assertSpawnInsideArena(targetSpawn.position, SLIME_BUG.contactBox, SANDBOX_ARENA);
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
        { archetypeId: SLIME_ONE_EYE.id },
        { archetypeId: SLIME_ONE_EYE.id },
        { archetypeId: SLIME_SHELL.id },
        { archetypeId: SLIME_ONE_EYE.id },
        { archetypeId: SLIME_ONE_EYE.id },
        { archetypeId: SLIME_SHELL.id }
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
        { archetypeId: SLIME_ONE_EYE.id },
        { archetypeId: SLIME_ONE_EYE.id },
        { archetypeId: SLIME_ONE_EYE.id },
        { archetypeId: SLIME_SHELL.id },
        { archetypeId: SLIME_ONE_EYE.id },
        { archetypeId: SLIME_ONE_EYE.id },
        { archetypeId: SLIME_SHELL.id },
        { archetypeId: SLIME_ONE_EYE.id },
        { archetypeId: SLIME_SHELL.id },
        { archetypeId: SLIME_ONE_EYE.id }
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

/** Три волны и передышки между ними — `design/session-definition.md` (preset `campaign`). */
function makeCampaignRunEncounters(): ReadonlyArray<EncounterDefinition> {
  const wave1: EncounterDefinition = {
    id: 'campaign-wave-1',
    type: 'wave',
    spawnPlan: {
      kind: 'wave',
      spawns: [
        { archetypeId: SLIME_ONE_EYE.id },
        { archetypeId: SLIME_ONE_EYE.id },
        { archetypeId: SLIME_SHELL.id },
        { archetypeId: SLIME_ONE_EYE.id },
        { archetypeId: SLIME_ONE_EYE.id },
        { archetypeId: SLIME_SHELL.id }
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

  const breakAfterWave1: EncounterDefinition = {
    id: 'campaign-break-after-wave-1',
    type: 'break',
    spawnPlan: { kind: 'empty' },
    zoneBehavior: { kind: 'expandLinear', fromMargin: 4, toMargin: 0, durationMs: 2500 },
    objectives: [],
    rewardRules: null,
    transitionRules: { kind: 'timer', durationMs: 3000, next: 'sequential' },
    tuning: null
  };

  const wave2: EncounterDefinition = {
    id: 'campaign-wave-2',
    type: 'wave',
    spawnPlan: {
      kind: 'wave',
      spawns: [
        { archetypeId: SLIME_ONE_EYE.id },
        { archetypeId: SLIME_ONE_EYE.id },
        { archetypeId: SLIME_ONE_EYE.id },
        { archetypeId: SLIME_SHELL.id },
        { archetypeId: SLIME_ONE_EYE.id },
        { archetypeId: SLIME_ONE_EYE.id },
        { archetypeId: SLIME_SHELL.id },
        { archetypeId: SLIME_ONE_EYE.id },
        { archetypeId: SLIME_SHELL.id },
        { archetypeId: SLIME_ONE_EYE.id }
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

  const breakAfterWave2: EncounterDefinition = {
    id: 'campaign-break-after-wave-2',
    type: 'break',
    spawnPlan: { kind: 'empty' },
    zoneBehavior: { kind: 'expandLinear', fromMargin: 5, toMargin: 0, durationMs: 2500 },
    objectives: [],
    rewardRules: null,
    transitionRules: { kind: 'timer', durationMs: 3000, next: 'sequential' },
    tuning: null
  };

  const wave3: EncounterDefinition = {
    id: 'campaign-wave-3',
    type: 'wave',
    spawnPlan: {
      kind: 'wave',
      spawns: [
        { archetypeId: SLIME_ONE_EYE.id },
        { archetypeId: SLIME_ONE_EYE.id },
        { archetypeId: SLIME_ONE_EYE.id },
        { archetypeId: SLIME_ONE_EYE.id },
        { archetypeId: SLIME_SHELL.id },
        { archetypeId: SLIME_ONE_EYE.id },
        { archetypeId: SLIME_SHELL.id },
        { archetypeId: SLIME_ONE_EYE.id },
        { archetypeId: SLIME_SHELL.id },
        { archetypeId: SLIME_ONE_EYE.id },
        { archetypeId: SLIME_ONE_EYE.id },
        { archetypeId: SLIME_SHELL.id }
      ],
      spawnIntervalMs: 1000,
      maxAlive: 6,
      edgeMargin: 0.5
    },
    zoneBehavior: { kind: 'shrinkLinear', fromMargin: 0, toMargin: 5, durationMs: 12000 },
    objectives: [],
    rewardRules: null,
    transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
    tuning: null
  };

  return [wave1, breakAfterWave1, wave2, breakAfterWave2, wave3];
}

function buildTrainingSession(options: BuildOptions): SessionDefinition {
  validateEnemyRegistry(ENEMY_ARCHETYPES, TRAINING_PLAYER.contactBox);
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
  validateEnemyRegistry(ENEMY_ARCHETYPES, TRAINING_PLAYER.contactBox);
  warnIfWeaponMayTunnel(PISTOL.id);

  /** Matches wave spawn `edgeMargin` — boss enters from top center like edge-spawned slimes. */
  const bossEdgeMargin = 0.5;
  const bossSpawnPos = bossTopCenterSpawnInArena(
    SANDBOX_ARENA,
    BOSS_SCRAP_KING.contactBox,
    bossEdgeMargin
  );
  assertSpawnInsideArena(bossSpawnPos, BOSS_SCRAP_KING.contactBox, SANDBOX_ARENA);

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
      bossArchetypeId: BOSS_SCRAP_KING.id,
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
    encounters: [...makeCampaignRunEncounters(), campaignPreBossBreak, bossEncounter],
    winCondition: { kind: 'bossDefeated' },
    lossCondition: { kind: 'playerDeath' },
    uiMeta: null
  };
}

/** Boss spawn: horizontally centered, as high as allowed inside arena (same inset as wave edge margin). */
function bossTopCenterSpawnInArena(
  arena: ArenaConfig,
  bossContactBox: ContactBox,
  edgeMargin: number
): Vec2 {
  const halfH = arena.height / 2;
  return { x: 0, y: halfH - edgeMargin - bossContactBox.height / 2 };
}

function assertSpawnInsideArena(position: Vec2, contactBox: ContactBox, arena: ArenaConfig): void {
  const halfW = arena.width / 2;
  const halfH = arena.height / 2;
  const halfContactW = contactBox.width / 2;
  const halfContactH = contactBox.height / 2;
  const insideX = position.x - halfContactW >= -halfW && position.x + halfContactW <= halfW;
  const insideY = position.y - halfContactH >= -halfH && position.y + halfContactH <= halfH;
  if (!insideX || !insideY) {
    throw new Error(
      `static spawn at (${position.x}, ${position.y}) with contactBox ` +
        `${contactBox.width}x${contactBox.height} does not fit into arena ${arena.width}x${arena.height}`
    );
  }
}

function warnIfWeaponMayTunnel(weaponId: string): void {
  const weapon = WEAPON_ARCHETYPES[weaponId];
  if (weapon === undefined) {
    throw new Error(`unknown weapon archetype: ${weaponId}`);
  }
  let minTargetInsetRadius = Number.POSITIVE_INFINITY;
  for (const archetype of Object.values(ENEMY_ARCHETYPES)) {
    minTargetInsetRadius = Math.min(
      minTargetInsetRadius,
      Math.min(archetype.contactBox.width, archetype.contactBox.height) / 2
    );
  }
  for (const archetype of Object.values(BOSS_ARCHETYPES)) {
    minTargetInsetRadius = Math.min(
      minTargetInsetRadius,
      Math.min(archetype.contactBox.width, archetype.contactBox.height) / 2
    );
  }
  if (!Number.isFinite(minTargetInsetRadius)) return;

  const stepDistance = weapon.projectileSpeed * (SIM_STEP_MS / 1000);
  const reach = weapon.projectileRadius + minTargetInsetRadius;
  if (stepDistance > reach) {
    log.warn('weapon may tunnel through smallest target per design/projectiles-and-combat.md', {
      weaponId: weapon.id,
      stepDistance,
      reach,
      minTargetInsetRadius
    });
  }
}
