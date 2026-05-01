import type { RuntimeEvent } from '../../../src/shared/events.js';
import type { PlayerConfig } from '../../../src/shared/session.js';
import type { PlayerFormUpdate } from '../../../src/shared/sim/SimulationCore.js';

export type ArenaHostLevelUpEvent = Readonly<{
  kind: 'host:levelUp';
  simTime: number;
  actorId: string;
  level: number;
  formArchetypeId: string;
}>;

export type ArenaHostEvent = RuntimeEvent | ArenaHostLevelUpEvent;

export type ArenaActorProgressionState = Readonly<{
  actorId: string;
  entityId: number | null;
  level: number;
}>;

export type ArenaFormContent = Readonly<{
  formArchetypeId: string;
  radius: number;
  contactBox: PlayerFormUpdate['contactBox'];
  maxSpeed: number;
  maxHp: number;
  loadout: PlayerFormUpdate['loadout'];
}>;

export type ArenaProgressionContent = Readonly<{
  basePlayer: Omit<PlayerConfig, 'id' | 'position'>;
  respawnPosition: PlayerConfig['position'];
  spawnInvulnerabilityMs: number;
  bossLevel: number;
  formsByLevel: ReadonlyMap<number, ArenaFormContent>;
}>;

export type ArenaCoreOp =
  | Readonly<{
      kind: 'addPlayer';
      playerConfig: PlayerConfig;
      invulnerableUntilSimMs: number;
    }>
  | Readonly<{
      kind: 'setPlayerForm';
      actorId: string;
      formUpdate: PlayerFormUpdate;
      refillHp: boolean;
      level: number;
    }>
  | Readonly<{
      kind: 'emitHostEvent';
      event: ArenaHostLevelUpEvent;
    }>;

export function pvpKillToLevelOps(
  death: Extract<RuntimeEvent, { kind: 'death' }>,
  stateByActorId: ReadonlyMap<string, ArenaActorProgressionState>,
  content: ArenaProgressionContent
): ReadonlyArray<ArenaCoreOp> {
  if (death.entityKind !== 'player') return [];
  const deadActor = actorByEntityId(stateByActorId, death.entityId);
  if (deadActor === null) return [];

  const ops: ArenaCoreOp[] = [
    {
      kind: 'addPlayer',
      playerConfig: {
        id: deadActor.actorId,
        position: content.respawnPosition,
        ...content.basePlayer
      },
      invulnerableUntilSimMs: death.simTime + content.spawnInvulnerabilityMs
    }
  ];
  const baseForm = requireForm(content, 1);
  ops.push({
    kind: 'setPlayerForm',
    actorId: deadActor.actorId,
    level: 1,
    formUpdate: {
      formArchetypeId: baseForm.formArchetypeId,
      radius: baseForm.radius,
      contactBox: baseForm.contactBox,
      maxSpeed: baseForm.maxSpeed,
      maxHp: baseForm.maxHp,
      loadout: baseForm.loadout
    },
    refillHp: true
  });

  const killerActor = attributedKiller(death, stateByActorId);
  if (killerActor === null) return ops;

  const nextLevel = Math.min(killerActor.level + 1, content.bossLevel);
  if (killerActor.level < content.bossLevel) {
    const form = content.formsByLevel.get(nextLevel);
    if (form === undefined) {
      throw new Error(`public arena missing form content for level ${nextLevel}`);
    }
    ops.push({
      kind: 'setPlayerForm',
      actorId: killerActor.actorId,
      level: nextLevel,
      formUpdate: {
        formArchetypeId: form.formArchetypeId,
        radius: form.radius,
        contactBox: form.contactBox,
        maxSpeed: form.maxSpeed,
        maxHp: form.maxHp,
        loadout: form.loadout
      },
      refillHp: true
    });
  }

  ops.push({
    kind: 'emitHostEvent',
    event: {
      kind: 'host:levelUp',
      simTime: death.simTime,
      actorId: killerActor.actorId,
      level: nextLevel,
      formArchetypeId: requireForm(content, nextLevel).formArchetypeId
    }
  });

  return ops;
}

function attributedKiller(
  death: Extract<RuntimeEvent, { kind: 'death' }>,
  stateByActorId: ReadonlyMap<string, ArenaActorProgressionState>
): ArenaActorProgressionState | null {
  if (death.killerId === null || death.killerId === death.entityId) return null;
  return actorByEntityId(stateByActorId, death.killerId);
}

function actorByEntityId(
  stateByActorId: ReadonlyMap<string, ArenaActorProgressionState>,
  entityId: number
): ArenaActorProgressionState | null {
  for (const actor of stateByActorId.values()) {
    if (actor.entityId === entityId) return actor;
  }
  return null;
}

function requireForm(
  content: ArenaProgressionContent,
  level: number
): ArenaFormContent {
  const form = content.formsByLevel.get(level);
  if (form === undefined) {
    throw new Error(`public arena missing form content for level ${level}`);
  }
  return form;
}
