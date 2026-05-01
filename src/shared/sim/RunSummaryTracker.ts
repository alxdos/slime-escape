import type {
  ResultBossSummary,
  ResultDefeatCause,
  ResultDefeatSummary,
  ResultKillByArchetypeSummary,
  SessionResultOutcome,
  SessionResultSummary
} from '../sessionResult.js';
import { assertNever } from '../protocol.js';
import type { EncounterDefinition, SessionDefinition } from '../session.js';
import type { WaveProgressSnapshot } from '../snapshot.js';

import type { DamageSource } from './CombatSystem.js';
import type { DropPickupFact } from './DropSystem.js';
import type { Boss, EntityId, EntityStore } from './EntityStore.js';
import type { DeathContext } from './HealthDeathSystem.js';
import type { EncounterContext } from './SessionFlowSystem.js';

export type ResultBuildContext = Readonly<{
  session: SessionDefinition | null;
  activeEncounter: EncounterContext | null;
  waveProgress: WaveProgressSnapshot | null;
  store: EntityStore;
}>;

export type RunSummaryTracker = Readonly<{
  reset(): void;
  onDeath(ctx: DeathContext, store: EntityStore): void;
  onDropPickup(fact: DropPickupFact): void;
  onEncounterComplete(session: SessionDefinition | null, encounter: EncounterDefinition): void;
  buildSummary(
    outcome: SessionResultOutcome,
    simTimeMs: number,
    context: ResultBuildContext
  ): SessionResultSummary;
}>;

type KillKey = `${'enemy' | 'boss'}:${string}`;

export function createRunSummaryTracker(): RunSummaryTracker {
  const killsByKey = new Map<KillKey, ResultKillByArchetypeSummary>();
  let pickedUpTotal = 0;
  let rememberedBoss: ResultBossSummary | null = null;
  let defeat: ResultDefeatSummary | null = null;
  let dungeonWavesCleared = 0;

  function reset(): void {
    killsByKey.clear();
    pickedUpTotal = 0;
    rememberedBoss = null;
    defeat = null;
    dungeonWavesCleared = 0;
  }

  function onDeath(ctx: DeathContext, store: EntityStore): void {
    if ((ctx.entityKind === 'enemy' || ctx.entityKind === 'boss') && ctx.archetypeId !== null) {
      recordKill(ctx.entityKind, ctx.archetypeId);
    }
    if (ctx.entityKind === 'boss') {
      rememberedBoss = summarizeBossDeath(ctx, store);
    }
    if (ctx.entityKind === 'player' && defeat === null) {
      defeat = { cause: serializeDefeatCause(ctx.cause, store) };
    }
  }

  function onDropPickup(_fact: DropPickupFact): void {
    pickedUpTotal += 1;
  }

  function onEncounterComplete(
    session: SessionDefinition | null,
    encounter: EncounterDefinition
  ): void {
    if (session?.winCondition.kind !== 'dungeon') return;
    if (encounter.type !== 'wave') return;
    dungeonWavesCleared += 1;
  }

  function buildSummary(
    outcome: SessionResultOutcome,
    simTimeMs: number,
    context: ResultBuildContext
  ): SessionResultSummary {
    return {
      outcome,
      durationMs: simTimeMs,
      progress: buildProgressSummary(outcome, context),
      kills: {
        total: totalKills(),
        byArchetype: sortedKills()
      },
      drops: {
        pickedUpTotal
      },
      boss: currentBossSummary(context.store) ?? rememberedBoss,
      defeat: outcome === 'loss' ? defeat : null,
      dungeon:
        context.session?.winCondition.kind === 'dungeon'
          ? { wavesCleared: dungeonWavesCleared }
          : null
    };
  }

  function recordKill(entityKind: 'enemy' | 'boss', archetypeId: string): void {
    const key: KillKey = `${entityKind}:${archetypeId}`;
    const current = killsByKey.get(key);
    if (current === undefined) {
      killsByKey.set(key, { entityKind, archetypeId, count: 1 });
      return;
    }
    killsByKey.set(key, {
      entityKind,
      archetypeId,
      count: current.count + 1
    });
  }

  function totalKills(): number {
    let total = 0;
    for (const kill of killsByKey.values()) {
      total += kill.count;
    }
    return total;
  }

  function sortedKills(): ReadonlyArray<ResultKillByArchetypeSummary> {
    return [...killsByKey.values()].sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      if (a.entityKind !== b.entityKind) return a.entityKind < b.entityKind ? -1 : 1;
      if (a.archetypeId === b.archetypeId) return 0;
      return a.archetypeId < b.archetypeId ? -1 : 1;
    });
  }

  return {
    reset,
    onDeath,
    onDropPickup,
    onEncounterComplete,
    buildSummary
  };
}

function buildProgressSummary(
  outcome: SessionResultOutcome,
  context: ResultBuildContext
): SessionResultSummary['progress'] {
  const session = context.session;
  const activeEncounter = context.activeEncounter;
  if (session === null) {
    return emptyProgress(null);
  }

  const objectives = objectiveEncounters(session.encounters);
  const totalObjectiveEncounters = objectives.length;
  const totalWaves = session.encounters.filter((encounter) => encounter.type === 'wave').length;
  const activeIndex = activeEncounter?.index ?? null;
  const isDungeon = session.winCondition.kind === 'dungeon';
  const completedWaves = isDungeon
    ? 0
    : outcome === 'win'
      ? totalWaves
      : session.encounters.filter((encounter, index) => {
          return encounter.type === 'wave' && activeIndex !== null && index < activeIndex;
        }).length;

  if (
    isDungeon ||
    totalObjectiveEncounters === 0 ||
    (session.winCondition.kind === 'none' && session.lossCondition.kind === 'none')
  ) {
    return {
      percent: null,
      completedObjectiveEncounters: 0,
      totalObjectiveEncounters,
      completedWaves,
      totalWaves,
      activeEncounterId: activeEncounter?.encounter.id ?? null,
      activeEncounterIndex: activeIndex
    };
  }

  if (outcome === 'win') {
    return {
      percent: 100,
      completedObjectiveEncounters: totalObjectiveEncounters,
      totalObjectiveEncounters,
      completedWaves: totalWaves,
      totalWaves,
      activeEncounterId: activeEncounter?.encounter.id ?? null,
      activeEncounterIndex: activeIndex
    };
  }

  const completedObjectiveEncounters = countCompletedObjectiveEncounters(
    session.encounters,
    activeIndex
  );
  const activePartial = activeEncounterPartial(activeEncounter, context);
  const rawPercent = Math.round(
    ((completedObjectiveEncounters + activePartial) / totalObjectiveEncounters) * 100
  );

  return {
    percent: clampInt(rawPercent, 0, 99),
    completedObjectiveEncounters,
    totalObjectiveEncounters,
    completedWaves,
    totalWaves,
    activeEncounterId: activeEncounter?.encounter.id ?? null,
    activeEncounterIndex: activeIndex
  };
}

function emptyProgress(percent: number | null): SessionResultSummary['progress'] {
  return {
    percent,
    completedObjectiveEncounters: 0,
    totalObjectiveEncounters: 0,
    completedWaves: 0,
    totalWaves: 0,
    activeEncounterId: null,
    activeEncounterIndex: null
  };
}

function objectiveEncounters(
  encounters: ReadonlyArray<EncounterDefinition>
): ReadonlyArray<EncounterDefinition> {
  return encounters.filter((encounter) => encounter.type === 'wave' || encounter.type === 'boss');
}

function countCompletedObjectiveEncounters(
  encounters: ReadonlyArray<EncounterDefinition>,
  activeIndex: number | null
): number {
  if (activeIndex === null) return 0;
  return encounters.filter((encounter, index) => {
    return index < activeIndex && (encounter.type === 'wave' || encounter.type === 'boss');
  }).length;
}

function activeEncounterPartial(
  activeEncounter: EncounterContext | null,
  context: ResultBuildContext
): number {
  if (activeEncounter === null) return 0;
  switch (activeEncounter.encounter.type) {
    case 'wave':
      return wavePartial(context.waveProgress);
    case 'boss': {
      const boss = currentBossSummary(context.store);
      if (boss === null || boss.maxHp <= 0) return 0;
      return clamp(1 - boss.hp / boss.maxHp, 0, 1);
    }
    case 'break':
    case 'survivalTimer':
    case 'sandbox':
    case 'portal':
      return 0;
    default:
      return assertNever(activeEncounter.encounter.type);
  }
}

function wavePartial(progress: WaveProgressSnapshot | null): number {
  if (progress === null) return 0;
  if (progress.total === 0) return 1;
  return clamp((progress.dispatched - progress.alive) / progress.total, 0, 1);
}

function summarizeBossDeath(ctx: DeathContext, store: EntityStore): ResultBossSummary | null {
  const boss = store.bossById(ctx.entityId);
  if (boss === null) return null;
  return bossSummaryFromBoss(boss, true);
}

function currentBossSummary(store: EntityStore): ResultBossSummary | null {
  const boss = store.bosses().next().value;
  return boss === undefined ? null : bossSummaryFromBoss(boss, boss.hp <= 0);
}

function bossSummaryFromBoss(boss: Boss, defeated: boolean): ResultBossSummary {
  return {
    archetypeId: boss.archetypeId,
    encountered: true,
    defeated,
    hp: boss.hp,
    maxHp: boss.maxHp,
    hpPercent: hpPercent(boss.hp, boss.maxHp)
  };
}

function hpPercent(hp: number, maxHp: number): number {
  if (maxHp <= 0) return 0;
  return clampInt(Math.round((hp / maxHp) * 100), 0, 100);
}

function serializeDefeatCause(cause: DamageSource, store: EntityStore): ResultDefeatCause {
  switch (cause.kind) {
    case 'projectile':
      return {
        kind: 'projectile',
        ownerKind: cause.ownerKind,
        weaponArchetypeId: cause.weaponArchetypeId
      };
    case 'explosion':
      return {
        kind: 'explosion',
        ownerKind: cause.ownerKind,
        weaponArchetypeId: cause.weaponArchetypeId
      };
    case 'enemyContact': {
      const enemy = store.enemyById(cause.enemyId);
      if (enemy !== null) {
        return {
          kind: 'enemyContact',
          sourceEntityId: cause.enemyId,
          sourceEntityKind: 'enemy',
          archetypeId: enemy.archetypeId
        };
      }
      const boss = store.bossById(cause.enemyId);
      return {
        kind: 'enemyContact',
        sourceEntityId: cause.enemyId,
        sourceEntityKind: boss === null ? null : 'boss',
        archetypeId: boss?.archetypeId ?? null
      };
    }
    case 'boss': {
      const boss = store.bossById(cause.bossId);
      return {
        kind: 'boss',
        bossId: cause.bossId,
        bossArchetypeId: boss?.archetypeId ?? null,
        attackId: cause.attackId
      };
    }
    case 'fieldEffect':
      return {
        kind: 'fieldEffect',
        fieldEffectId: cause.fieldEffectId,
        archetypeId: cause.archetypeId
      };
    case 'statusEffect':
      return {
        kind: 'statusEffect',
        statusKind: cause.statusKind,
        sourceEntityId: cause.sourceEntityId
      };
    case 'environment':
      return {
        kind: 'environment',
        tag: cause.tag
      };
    default:
      return assertNever(cause);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampInt(value: number, min: number, max: number): number {
  return Math.trunc(clamp(value, min, max));
}
