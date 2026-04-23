import { log } from '../log';
import { assertNever } from '../protocol';
import type {
  ArenaConfig,
  ContactBox,
  EncounterDefinition,
  SessionDefinition,
  SpawnPlan,
  Vec2
} from '../session';
import { SIM_STEP_MS } from '../timing';

import { BOSS_ARCHETYPES } from './bosses';
import { ENEMY_ARCHETYPES, validateEnemyRegistry } from './enemies';
import type { ModePreset } from './presets';
import { SESSION_PRESET_TEMPLATES } from './sessions.generated';
import type {
  BossSpawnPlanTemplate,
  BossSpawnPositionTemplate,
  SessionPresetEncounterTemplate,
  SessionPresetTemplate
} from './sessions';
import { WEAPON_ARCHETYPES } from './weapons';

export type BuildOptions = Readonly<{
  seed: number;
  id?: string;
}>;

export function buildSessionDefinition(
  preset: ModePreset,
  options: BuildOptions
): SessionDefinition {
  const template = SESSION_PRESET_TEMPLATES[preset.id];
  validateEnemyRegistry(ENEMY_ARCHETYPES, template.player.contactBox);
  if (template.loadout !== null) {
    warnIfWeaponMayTunnel(template.loadout.primaryWeaponArchetypeId);
  }
  return {
    id: options.id ?? `${template.presetId}-session`,
    seed: options.seed,
    arena: template.arena,
    player: template.player,
    loadout: template.loadout,
    modifiers: [],
    rules: null,
    encounters: resolveEncounterTemplates(template),
    winCondition: template.winCondition,
    lossCondition: template.lossCondition,
    uiMeta: null
  };
}

function resolveEncounterTemplates(
  template: SessionPresetTemplate
): ReadonlyArray<EncounterDefinition> {
  return template.encounters.map((encounter) => ({
    ...encounter,
    spawnPlan: resolveSpawnPlanTemplate(encounter, template)
  }));
}

function resolveSpawnPlanTemplate(
  encounter: SessionPresetEncounterTemplate,
  template: SessionPresetTemplate
): SpawnPlan {
  const { spawnPlan } = encounter;
  switch (spawnPlan.kind) {
    case 'empty':
      return spawnPlan;
    case 'wave':
      return spawnPlan;
    case 'static':
      for (const spawn of spawnPlan.spawns) {
        const archetype = ENEMY_ARCHETYPES[spawn.archetypeId];
        if (archetype === undefined) {
          throw new Error(`unknown enemy archetype: ${spawn.archetypeId}`);
        }
        assertSpawnInsideArena(spawn.position, archetype.contactBox, template.arena);
      }
      return spawnPlan;
    case 'boss':
      return resolveBossSpawnPlan(spawnPlan, template);
    default:
      return assertNever(spawnPlan);
  }
}

function resolveBossSpawnPlan(
  spawnPlan: BossSpawnPlanTemplate,
  template: SessionPresetTemplate
): SpawnPlan {
  const boss = BOSS_ARCHETYPES[spawnPlan.bossArchetypeId];
  if (boss === undefined) {
    throw new Error(`unknown boss archetype: ${spawnPlan.bossArchetypeId}`);
  }
  const position = resolveBossSpawnPosition(
    spawnPlan.position,
    template.arena,
    boss.contactBox,
    spawnPlan.bossEdgeMargin
  );
  assertSpawnInsideArena(position, boss.contactBox, template.arena);
  return {
    kind: 'boss',
    bossArchetypeId: spawnPlan.bossArchetypeId,
    position
  };
}

function resolveBossSpawnPosition(
  position: BossSpawnPositionTemplate,
  arena: ArenaConfig,
  bossContactBox: ContactBox,
  edgeMargin: number
): Vec2 {
  if (position === 'top-center') {
    return bossTopCenterSpawnInArena(arena, bossContactBox, edgeMargin);
  }
  return position;
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
