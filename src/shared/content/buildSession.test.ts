import { describe, expect, it } from 'vitest';

import { SANDBOX_ARENA } from './arenas';
import { buildSessionDefinition } from './buildSession';
import { BOSS_ARCHETYPES } from './bosses';
import {
  ENEMY_ARCHETYPES,
  SLIME_BUG,
  SLIME_CANDLE,
  SLIME_CLAMPER,
  SLIME_DOOR,
  SLIME_FLAME,
  SLIME_FORTRESS,
  SLIME_IDOL,
  SLIME_KINGLING,
  SLIME_LIFTER,
  SLIME_MECH,
  SLIME_MECH_CRAB,
  SLIME_OBELISK,
  SLIME_ONE_EYE,
  SLIME_SHELL,
  SLIME_STAR,
  SLIME_STONEHEAD
} from './enemies';
import { HEAL_ORB } from './drops';
import type { SessionDefinition, SpawnOverride } from '../session';
import {
  CAMPAIGN_PRESET,
  DUNGEON_PRESET,
  resolveModePreset,
  SESSION_PRESET_TEMPLATES,
  SANDBOX_PRESET,
  SANDBOX_WITH_COMBAT_PRESET,
  TRAINING_PRESET,
  type ModePresetId
} from './sessions';
import {
  BOMB_PLACER,
  FIREBALL_STAFF,
  GRENADE_LAUNCHER,
  PISTOL,
  ROCK_THROWER,
  SHOTGUN,
  SMG,
  SNIPER
} from './weapons';

const ACCEPTANCE_PRESET_IDS = Object.keys(SESSION_PRESET_TEMPLATES) as ModePresetId[];
const ACCEPTANCE_SEEDS = [0, 1, 42] as const;
const CAMPAIGN_SET_BOSSES = [
  'boss-gargoyle',
  'boss-saw-cyclops',
  'boss-scrap-king',
  'boss-tower-sentinel',
  'boss-bubble-hog'
] as const;

describe('buildSessionDefinition acceptance snapshots', () => {
  for (const presetId of ACCEPTANCE_PRESET_IDS) {
    for (const seed of ACCEPTANCE_SEEDS) {
      it(`matches accepted ${presetId} session for seed ${seed}`, () => {
        const session = buildSessionDefinition(resolveModePreset(presetId), { seed });

        expect(session).toMatchSnapshot();
      });
    }
  }
});

describe('buildSessionDefinition (sandbox)', () => {
  it('produces a sandbox session with none win/loss conditions', () => {
    const session = buildSessionDefinition(SANDBOX_PRESET, { seed: 42 });

    expect(session.winCondition.kind).toBe('none');
    expect(session.lossCondition.kind).toBe('none');
  });

  it('contains exactly one sandbox encounter that never auto-ends', () => {
    const session = buildSessionDefinition(SANDBOX_PRESET, { seed: 42 });

    expect(session.encounters).toHaveLength(1);
    const encounter = session.encounters[0];
    expect(encounter?.type).toBe('sandbox');
    expect(encounter?.transitionRules.kind).toBe('never');
    expect(encounter?.spawnPlan.kind).toBe('empty');
    expect(encounter?.zoneBehavior.kind).toBe('disabled');
  });

  it('passes through seed and uses default id when not provided', () => {
    const session = buildSessionDefinition(SANDBOX_PRESET, { seed: 1234 });

    expect(session.seed).toBe(1234);
    expect(session.id).toBe('sandbox-session');
  });

  it('uses caller-provided id when given', () => {
    const session = buildSessionDefinition(SANDBOX_PRESET, { seed: 1, id: 'custom' });

    expect(session.id).toBe('custom');
  });

  it('exposes a positive arena and a player at the centre', () => {
    const session = buildSessionDefinition(SANDBOX_PRESET, { seed: 0 });

    expect(session.arena.width).toBeGreaterThan(0);
    expect(session.arena.height).toBeGreaterThan(0);
    expect(session.player.position).toEqual({ x: 0, y: 0 });
    expect(session.player.contactBox.width).toBeGreaterThan(0);
    expect(session.player.contactBox.height).toBeGreaterThan(0);
    expect(session.player.maxSpeed).toBeGreaterThan(0);
  });

  it('sandbox keeps loadout null and an empty spawn plan', () => {
    const session = buildSessionDefinition(SANDBOX_PRESET, { seed: 0 });

    expect(session.loadout).toBeNull();
    expect(session.encounters[0]?.spawnPlan.kind).toBe('empty');
  });
});

describe('buildSessionDefinition (sandbox-with-combat)', () => {
  it('produces a sandbox-with-combat session with none win/loss conditions', () => {
    const session = buildSessionDefinition(SANDBOX_WITH_COMBAT_PRESET, { seed: 7 });

    expect(session.winCondition.kind).toBe('none');
    expect(session.lossCondition.kind).toBe('none');
  });

  it('exposes an ordered Loadout with the first slot selected', () => {
    const session = buildSessionDefinition(SANDBOX_WITH_COMBAT_PRESET, { seed: 7 });

    expect(session.loadout).toEqual({
      weapons: [PISTOL.id, ROCK_THROWER.id, GRENADE_LAUNCHER.id, BOMB_PLACER.id, FIREBALL_STAFF.id],
      selectedIndex: 0
    });
    expect(session.rules.damage.slimeFriendlyFire).toBe(false);
  });

  it('uses a static spawn plan with slime-bug inside the arena', () => {
    const session = buildSessionDefinition(SANDBOX_WITH_COMBAT_PRESET, { seed: 7 });
    const encounter = session.encounters[0];

    expect(encounter?.type).toBe('sandbox');
    expect(encounter?.transitionRules.kind).toBe('never');

    const plan = encounter?.spawnPlan;
    if (plan?.kind !== 'static') throw new Error('expected static spawn plan');
    expect(plan.spawns).toHaveLength(1);
    expect(plan.spawns[0]?.archetypeId).toBe(SLIME_BUG.id);
    expect(SLIME_BUG.contactBox.width).toBeGreaterThan(0);
    expect(SLIME_BUG.contactBox.height).toBeGreaterThan(0);

    const halfW = session.arena.width / 2;
    const halfH = session.arena.height / 2;
    const pos = plan.spawns[0]!.position;
    expect(pos.x - SLIME_BUG.contactBox.width / 2).toBeGreaterThanOrEqual(-halfW);
    expect(pos.x + SLIME_BUG.contactBox.width / 2).toBeLessThanOrEqual(halfW);
    expect(pos.y - SLIME_BUG.contactBox.height / 2).toBeGreaterThanOrEqual(-halfH);
    expect(pos.y + SLIME_BUG.contactBox.height / 2).toBeLessThanOrEqual(halfH);
  });
});

describe('buildSessionDefinition (training)', () => {
  it('uses allEncountersComplete and playerDeath as run-end conditions', () => {
    const session = buildSessionDefinition(TRAINING_PRESET, { seed: 1 });

    expect(session.winCondition.kind).toBe('allEncountersComplete');
    expect(session.lossCondition.kind).toBe('playerDeath');
  });

  it('produces staged lessons separated by narrated breaks', () => {
    const session = buildSessionDefinition(TRAINING_PRESET, { seed: 1 });

    expect(session.encounters.map((encounter) => encounter.type)).toEqual([
      'break',
      'wave',
      'break',
      'wave',
      'break',
      'wave',
      'break',
      'wave',
      'break',
      'wave',
      'break'
    ]);
    expect(session.encounters.filter((encounter) => encounter.type === 'wave').map((encounter) => encounter.name)).toEqual([
      'Footwork',
      'Pickups',
      'Darkness Clock',
      'Weapon Rhythm',
      'Return Fire'
    ]);
    expect(session.encounters.filter((encounter) => encounter.type === 'break').every((encounter) => encounter.text !== null)).toBe(true);
  });

  it('every wave is a wave-spawn-plan composed only of known archetypes', () => {
    const session = buildSessionDefinition(TRAINING_PRESET, { seed: 1 });
    const knownIds = new Set(Object.keys(ENEMY_ARCHETYPES));
    let guaranteedDropOverrideCount = 0;
    let loadoutOverrideCount = 0;

    for (const encounter of session.encounters) {
      if (encounter.type !== 'wave') continue;
      const plan = encounter.spawnPlan;
      if (plan.kind !== 'wave') throw new Error('expected wave spawn plan in a wave encounter');
      expect(plan.spawnIntervalMs).toBeGreaterThan(0);
      expect(plan.maxAlive).toBeGreaterThan(0);
      for (const spawn of plan.spawns) {
        expect(knownIds.has(spawn.archetypeId)).toBe(true);
        if ((spawn.override?.guaranteedDrops?.length ?? 0) > 0) {
          guaranteedDropOverrideCount += 1;
        }
        if (spawn.override?.loadout !== undefined) {
          loadoutOverrideCount += 1;
        }
      }
    }

    expect(guaranteedDropOverrideCount).toBeGreaterThan(0);
    expect(loadoutOverrideCount).toBeGreaterThan(0);
  });

  it('starts without darkness, then teaches shrink and reset rhythm', () => {
    const session = buildSessionDefinition(TRAINING_PRESET, { seed: 1 });
    const waves = session.encounters.filter((encounter) => encounter.type === 'wave');
    const breaks = session.encounters.filter((encounter) => encounter.type === 'break');

    expect(waves[0]?.zoneBehavior).toEqual({ kind: 'disabled' });
    const shrinkingWaves = waves.slice(1);
    expect(shrinkingWaves.map((encounter) => encounter.zoneBehavior.kind)).toEqual([
      'shrinkLinear',
      'shrinkLinear',
      'shrinkLinear',
      'shrinkLinear'
    ]);

    for (const encounter of shrinkingWaves) {
      if (encounter.zoneBehavior.kind !== 'shrinkLinear') {
        throw new Error('expected shrinkLinear zone behavior');
      }
      expect(encounter.zoneBehavior.fromMargin).toBe(0);
      expect(encounter.zoneBehavior.toMargin).toBeGreaterThan(0);
    }

    const expandingBreaks = breaks.filter((encounter) => encounter.zoneBehavior.kind === 'expandLinear');
    expect(expandingBreaks).toHaveLength(4);
    expect(expandingBreaks.map((encounter) => encounter.zoneBehavior)).toEqual([
      { kind: 'expandLinear', fromMargin: 1.4, toMargin: 0, durationMs: 2600 },
      { kind: 'expandLinear', fromMargin: 2.6, toMargin: 0, durationMs: 2800 },
      { kind: 'expandLinear', fromMargin: 2.8, toMargin: 0, durationMs: 3000 },
      { kind: 'expandLinear', fromMargin: 3.2, toMargin: 0, durationMs: 3200 }
    ]);
  });

  it('ramps darkness pressure across later lessons', () => {
    const session = buildSessionDefinition(TRAINING_PRESET, { seed: 1 });
    const shrinkMargins = session.encounters
      .filter((encounter) => encounter.type === 'wave' && encounter.zoneBehavior.kind === 'shrinkLinear')
      .map((encounter) => {
        if (encounter.zoneBehavior.kind !== 'shrinkLinear') {
          throw new Error('expected shrinkLinear zone behavior');
        }
        return encounter.zoneBehavior.toMargin;
      });

    expect(shrinkMargins).toEqual([1.4, 2.6, 2.8, 3.2]);
  });

  it('breaks use timer transition rules', () => {
    const session = buildSessionDefinition(TRAINING_PRESET, { seed: 1 });

    for (const encounter of session.encounters) {
      if (encounter.type !== 'break') continue;
      expect(encounter.transitionRules.kind).toBe('timer');
      if (encounter.transitionRules.kind !== 'timer') {
        throw new Error('expected timer transition rule');
      }
      expect(encounter.transitionRules.durationMs).toBeGreaterThan(0);
      expect(encounter.transitionRules.next).toBe('sequential');
    }
  });

  it('waves use allEnemiesCleared as transition rule', () => {
    const session = buildSessionDefinition(TRAINING_PRESET, { seed: 1 });
    for (const encounter of session.encounters) {
      if (encounter.type !== 'wave') continue;
      expect(encounter.transitionRules.kind).toBe('allEnemiesCleared');
      expect(encounter.transitionRules.next).toBe('sequential');
    }
  });

  it('exposes ordered loadout and a damageable training player', () => {
    const session = buildSessionDefinition(TRAINING_PRESET, { seed: 1 });

    expect(session.loadout).toEqual({ weapons: [PISTOL.id, SHOTGUN.id, SMG.id], selectedIndex: 0 });
    expect(session.rules.damage.slimeFriendlyFire).toBe(true);
    expect(session.rules.aimAssist.enabled).toBe(true);
    expect(session.player.maxHp).toBeGreaterThan(0);
  });
});

describe('buildSessionDefinition (campaign)', () => {
  it('campaign: five acts, each followed by its own boss', () => {
    const session = buildSessionDefinition(CAMPAIGN_PRESET, { seed: 2 });

    expect(session.winCondition).toEqual({ kind: 'allEncountersComplete' });
    expect(session.lossCondition).toEqual({ kind: 'playerDeath' });
    expect(session.encounters).toHaveLength(29);

    const bossIds: string[] = [];
    const waveCountBySet = new Map<number, number>();

    for (const encounter of session.encounters) {
      if (encounter.spawnPlan.kind === 'wave') {
        const setIndex = campaignSetIndex(encounter.id);
        waveCountBySet.set(setIndex, (waveCountBySet.get(setIndex) ?? 0) + 1);
        continue;
      }

      if (encounter.spawnPlan.kind === 'boss') {
        bossIds.push(encounter.spawnPlan.bossArchetypeId);
        expect(encounter.zoneBehavior).toEqual({ kind: 'disabled' });
        expect(encounter.transitionRules.kind).toBe('allEnemiesCleared');
        assertBossSpawnInsideArena(encounter.spawnPlan.bossArchetypeId, encounter.spawnPlan.position);
      }
    }

    expect([...waveCountBySet.entries()]).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
      [4, 3],
      [5, 3]
    ]);
    expect(bossIds).toEqual([...CAMPAIGN_SET_BOSSES]);
  });

  it('campaign: pre-boss breaks finish zone expansion with the timer', () => {
    const session = buildSessionDefinition(CAMPAIGN_PRESET, { seed: 2 });
    let preBossBreaks = 0;

    for (const encounter of session.encounters) {
      if (!/^campaign-set-\d-pre-boss-break$/.test(encounter.id)) continue;
      if (
        encounter.zoneBehavior.kind !== 'expandLinear' ||
        encounter.transitionRules.kind !== 'timer'
      ) {
        throw new Error(`expected timer expand pre-boss break, got ${encounter.id}`);
      }

      preBossBreaks += 1;
      expect(encounter.zoneBehavior.toMargin).toBe(0);
      expect(encounter.transitionRules.durationMs).toBe(encounter.zoneBehavior.durationMs);
    }

    expect(preBossBreaks).toBe(5);
  });
});

describe('buildSessionDefinition (dungeon)', () => {
  it('uses dungeon win condition and player-death loss condition', () => {
    const session = buildSessionDefinition(DUNGEON_PRESET, { seed: 28 });

    expect(session.winCondition).toEqual({ kind: 'dungeon' });
    expect(session.lossCondition).toEqual({ kind: 'playerDeath' });
  });

  it('builds an authored encounter loop with waves and reset breaks', () => {
    const session = buildSessionDefinition(DUNGEON_PRESET, { seed: 28 });

    expect(session.encounters.length).toBeGreaterThan(0);
    expect(session.encounters.filter((encounter) => encounter.type === 'wave')).toHaveLength(3);
    expect(session.encounters.at(-1)?.type).toBe('break');

    for (const encounter of session.encounters) {
      if (encounter.type !== 'wave') continue;
      expect(encounter.spawnPlan.kind).toBe('wave');
      expect(encounter.transitionRules.kind).toBe('allEnemiesCleared');
    }
  });
});

describe('buildSessionDefinition (portal)', () => {
  it('uses normal completion with a transparent opening portal', () => {
    const session = buildSessionDefinition(resolveModePreset('portal'), { seed: 26 });
    const openingEncounter = session.encounters.at(0);
    const firstWave = session.encounters.at(1);
    const finalEncounter = session.encounters.at(-1);

    expect(session.winCondition).toEqual({ kind: 'allEncountersComplete' });
    expect(session.lossCondition).toEqual({ kind: 'playerDeath' });
    expect(openingEncounter).toMatchObject({
      id: 'portal-opening',
      type: 'portal',
      backgroundId: 'portal',
      introDurationMs: 0,
      name: null,
      text: null,
      spawnPlan: { kind: 'empty' },
      zoneBehavior: { kind: 'disabled' },
      transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' }
    });
    expect(firstWave?.id).toBe('portal-wave-1');
    expect(finalEncounter?.id).toBe('portal-boss');
    expect(finalEncounter?.type).toBe('boss');
    expect(finalEncounter?.spawnPlan.kind).toBe('boss');
    if (finalEncounter?.spawnPlan.kind !== 'boss') {
      throw new Error('expected portal-boss to keep a boss spawn plan');
    }
    expect(finalEncounter.spawnPlan.bossArchetypeId).toBe('boss-gargoyle');
    expect(session.encounters.some((encounter) => encounter.id === 'portal-exit')).toBe(false);
  });
});

describe('buildSessionDefinition shooting slime difficulty pillars', () => {
  it('campaign-easy keeps enemy loadouts to late readable rock throwers and guarantees heal carriers', () => {
    const session = buildSessionDefinition(resolveModePreset('campaign-easy'), { seed: 2 });
    const entries = spawnEntries(session);
    const waveCount = session.encounters.filter((encounter) => encounter.spawnPlan.kind === 'wave')
      .length;
    const healCarrierCount = entries.filter((entry) =>
      entry.override?.guaranteedDrops?.includes(HEAL_ORB.id)
    ).length;
    const hazardEntries = entries.filter((entry) => entry.override?.loadout !== undefined);
    const allowedEasyHazards = new Set([ROCK_THROWER.id]);

    expect(session.rules.damage.slimeFriendlyFire).toBe(true);
    expect(session.rules.aimAssist.enabled).toBe(true);
    expect(session.rules.aimAssist.maxAngleRadians).toBeGreaterThanOrEqual(0.3);
    expect(session.rules.aimAssist.strength).toBeGreaterThan(0);
    expect(session.loadout?.weapons).toEqual([
      PISTOL.id,
      SHOTGUN.id,
      SMG.id,
      SNIPER.id,
      ROCK_THROWER.id,
      GRENADE_LAUNCHER.id,
      BOMB_PLACER.id,
      FIREBALL_STAFF.id
    ]);
    expect(session.loadout?.selectedIndex).toBe(1);
    expect(hazardEntries.some((entry) => entry.setIndex === 1)).toBe(false);
    expect(hazardEntries.map((entry) => entry.archetypeId)).toEqual([
      SLIME_STAR.id,
      SLIME_CANDLE.id,
      SLIME_MECH.id,
      SLIME_CANDLE.id
    ]);
    expect(
      hazardEntries.every(
        (entry) =>
          entry.override?.loadout?.weapons.every((weaponId) => allowedEasyHazards.has(weaponId)) ??
          false
      )
    ).toBe(true);
    expect(
      hazardEntries.some((entry) => hasWeapon(entry.override!.loadout!, ROCK_THROWER.id))
    ).toBe(true);
    expect(hazardEntries.some((entry) => hasWeapon(entry.override!.loadout!, SMG.id))).toBe(false);
    expect(healCarrierCount).toBeGreaterThanOrEqual(Math.floor(waveCount / 2));
  });

  it('campaign-normal uses shared explosive enemy hazards without demo weapons', () => {
    const session = buildSessionDefinition(resolveModePreset('campaign-normal'), { seed: 2 });
    const entries = spawnEntries(session);
    const normalEnemyHazards = new Set([
      ROCK_THROWER.id,
      GRENADE_LAUNCHER.id,
      BOMB_PLACER.id
    ]);
    const enemyLoadouts = entries.flatMap((entry) =>
      entry.override?.loadout === undefined ? [] : [entry.override.loadout]
    );

    expect(session.rules.damage.slimeFriendlyFire).toBe(true);
    expect(session.rules.aimAssist.enabled).toBe(false);
    expect(session.loadout).toEqual({
      weapons: [
        PISTOL.id,
        SHOTGUN.id,
        SMG.id,
        SNIPER.id,
        GRENADE_LAUNCHER.id,
        BOMB_PLACER.id
      ],
      selectedIndex: 0
    });
    expect(
      enemyLoadouts.every((loadout) =>
        loadout.weapons.every((weaponId) => normalEnemyHazards.has(weaponId))
      )
    ).toBe(true);
    expect(hasSpawnWeapon(entries, SLIME_STONEHEAD.id, ROCK_THROWER.id)).toBe(true);
    expect(hasSpawnWeapon(entries, SLIME_SHELL.id, ROCK_THROWER.id)).toBe(true);
    expect(hasSpawnWeapon(entries, SLIME_LIFTER.id, ROCK_THROWER.id)).toBe(true);
    expect(hasSpawnWeapon(entries, SLIME_FORTRESS.id, ROCK_THROWER.id)).toBe(true);
    expect(hasSpawnWeapon(entries, SLIME_FLAME.id, GRENADE_LAUNCHER.id)).toBe(true);
    expect(hasSpawnWeapon(entries, SLIME_CANDLE.id, GRENADE_LAUNCHER.id)).toBe(true);
    expect(hasSpawnWeapon(entries, SLIME_OBELISK.id, GRENADE_LAUNCHER.id)).toBe(true);
    expect(hasSpawnWeapon(entries, SLIME_MECH_CRAB.id, BOMB_PLACER.id)).toBe(true);
    expect(hasSpawnWeapon(entries, SLIME_MECH.id, BOMB_PLACER.id)).toBe(true);
    expect(hasSpawnWeapon(entries, SLIME_CLAMPER.id, BOMB_PLACER.id)).toBe(true);
  });

  it('campaign-hard encodes the per-set shooter progression structurally', () => {
    const session = buildSessionDefinition(resolveModePreset('campaign-hard'), { seed: 2 });
    const entries = spawnEntries(session);

    expect(session.rules.damage.slimeFriendlyFire).toBe(false);
    expect(session.rules.aimAssist.enabled).toBe(false);
    expect(session.loadout).toEqual({
      weapons: [PISTOL.id, SMG.id, ROCK_THROWER.id],
      selectedIndex: 0
    });
    expect(loadoutsForSet(entries, 1).some((loadout) => hasWeapon(loadout, PISTOL.id, SMG.id))).toBe(
      true
    );
    expect(
      loadoutsForSet(entries, 2).some((loadout) =>
        hasWeapon(loadout, ROCK_THROWER.id, GRENADE_LAUNCHER.id)
      )
    ).toBe(true);
    expect(
      loadoutsForSet(entries, 3).some((loadout) =>
        hasWeapon(loadout, ROCK_THROWER.id, GRENADE_LAUNCHER.id)
      )
    ).toBe(true);
    expect(loadoutsForSet(entries, 4).some((loadout) => hasWeapon(loadout, PISTOL.id))).toBe(true);
    expect(
      loadoutsForSet(entries, 5).some((loadout) => hasWeapon(loadout, FIREBALL_STAFF.id))
    ).toBe(true);
    expect(entries.some((entry) => entry.setIndex === 3 && entry.archetypeId === SLIME_IDOL.id)).toBe(
      true
    );
    expect(entries.some((entry) => entry.setIndex === 4 && entry.archetypeId === SLIME_IDOL.id)).toBe(
      true
    );
    expect(
      entries.some((entry) => entry.setIndex === 4 && entry.override?.retaliation?.enabled === true)
    ).toBe(true);
  });

  it('campaign-hard keeps heal drops off ordinary spawns', () => {
    const session = buildSessionDefinition(resolveModePreset('campaign-hard'), { seed: 2 });
    const allowedHealCarrierIds = new Set([
      SLIME_FORTRESS.id,
      SLIME_DOOR.id,
      SLIME_KINGLING.id,
      SLIME_SHELL.id
    ]);

    for (const entry of spawnEntries(session)) {
      const archetype = ENEMY_ARCHETYPES[entry.archetypeId];
      if (archetype === undefined) throw new Error(`unknown enemy archetype ${entry.archetypeId}`);
      const effectiveDropTable = entry.override?.dropTable ?? archetype.dropTable;
      const hasHealDrop =
        effectiveDropTable.some((drop) => drop.archetypeId === HEAL_ORB.id) ||
        (entry.override?.guaranteedDrops?.includes(HEAL_ORB.id) ?? false);

      if (hasHealDrop) {
        expect(allowedHealCarrierIds.has(entry.archetypeId)).toBe(true);
      }
    }
  });
});

function campaignSetIndex(encounterId: string): number {
  const match = /^campaign(?:-easy)?-set-(\d)-/.exec(encounterId);
  if (match === null) {
    throw new Error(`expected campaign set encounter id, got ${encounterId}`);
  }
  return Number(match[1]);
}

function assertBossSpawnInsideArena(bossArchetypeId: string, position: { x: number; y: number }): void {
  const boss = BOSS_ARCHETYPES[bossArchetypeId];
  if (boss === undefined) {
    throw new Error(`unknown boss archetype in campaign: ${bossArchetypeId}`);
  }
  expect(position.x).toBe(0);
  const expectedY = SANDBOX_ARENA.height / 2 - 0.5 - boss.contactBox.height / 2;
  expect(position.y).toBeCloseTo(expectedY, 5);
  expect(position.x - boss.contactBox.width / 2).toBeGreaterThanOrEqual(-SANDBOX_ARENA.width / 2);
  expect(position.x + boss.contactBox.width / 2).toBeLessThanOrEqual(SANDBOX_ARENA.width / 2);
  expect(position.y - boss.contactBox.height / 2).toBeGreaterThanOrEqual(-SANDBOX_ARENA.height / 2);
  expect(position.y + boss.contactBox.height / 2).toBeLessThanOrEqual(SANDBOX_ARENA.height / 2);
}

type SpawnEntry = Readonly<{
  encounterId: string;
  setIndex: number;
  archetypeId: string;
  override: SpawnOverride | undefined;
}>;

function spawnEntries(session: SessionDefinition): SpawnEntry[] {
  const entries: SpawnEntry[] = [];
  for (const encounter of session.encounters) {
    const setIndex = campaignSetIndex(encounter.id);
    const plan = encounter.spawnPlan;
    if (plan.kind === 'wave') {
      for (const spawn of plan.spawns) {
        entries.push({
          encounterId: encounter.id,
          setIndex,
          archetypeId: spawn.archetypeId,
          override: spawn.override
        });
      }
    }
    if (plan.kind === 'static') {
      for (const spawn of plan.spawns) {
        entries.push({
          encounterId: encounter.id,
          setIndex,
          archetypeId: spawn.archetypeId,
          override: spawn.override
        });
      }
    }
  }
  return entries;
}

function loadoutsForSet(
  entries: ReadonlyArray<SpawnEntry>,
  setIndex: number
): ReadonlyArray<NonNullable<SpawnOverride['loadout']>> {
  return entries.flatMap((entry) => {
    if (entry.setIndex !== setIndex || entry.override?.loadout === undefined) return [];
    return [entry.override.loadout];
  });
}

function hasWeapon(
  loadout: NonNullable<SpawnOverride['loadout']>,
  ...weaponArchetypeIds: string[]
): boolean {
  return weaponArchetypeIds.some((weaponArchetypeId) =>
    loadout.weapons.includes(weaponArchetypeId)
  );
}

function hasSpawnWeapon(
  entries: ReadonlyArray<SpawnEntry>,
  archetypeId: string,
  weaponArchetypeId: string
): boolean {
  return entries.some(
    (entry) =>
      entry.archetypeId === archetypeId &&
      entry.override?.loadout?.weapons.includes(weaponArchetypeId) === true
  );
}
