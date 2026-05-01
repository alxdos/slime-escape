import type { RuntimeEvent } from '../events.js';
import type { Vec2 } from '../session.js';

import type { DamageIntent, DamageSource } from './CombatSystem.js';
import type { Boss, Companion, Enemy, EntityId, EntityStore, Player } from './EntityStore.js';

export type DeathContext = Readonly<{
  entityId: EntityId;
  entityKind: 'enemy' | 'player' | 'boss';
  archetypeId: string | null;
  position: Vec2;
  cause: DamageSource;
  simTime: number;
}>;

export type DeathHook = (ctx: DeathContext) => void;

export type DamageContext = Readonly<{
  targetId: EntityId;
  targetKind: 'enemy' | 'player' | 'companion' | 'boss';
  targetArchetypeId: string | null;
  amount: number;
  source: DamageSource;
  hitPosition: Vec2;
  simTime: number;
}>;

export type DamageHook = (ctx: DamageContext) => void;

type CompanionDownedContext = Readonly<{
  companionId: EntityId;
  petArchetypeId: string;
  position: Vec2;
  cause: DamageSource;
  simTime: number;
}>;

type PlayerDownedContext = Readonly<{
  entityId: EntityId;
  playerId: string;
  position: Vec2;
  cause: DamageSource;
  simTime: number;
}>;

type PlayerDeathMode = 'remove' | 'ghost';

export type HealthDeathSystem = Readonly<{
  registerHook(hook: DeathHook): void;
  registerDamageHook(hook: DamageHook): void;
  setPlayerDeathMode(mode: PlayerDeathMode): void;
  clear(): void;
  tick(
    intents: ReadonlyArray<DamageIntent>,
    store: EntityStore,
    simTimeMs: number,
    emit: (event: RuntimeEvent) => void
  ): void;
}>;

export function createHealthDeathSystem(): HealthDeathSystem {
  const hooks: DeathHook[] = [];
  const damageHooks: DamageHook[] = [];
  let playerDeathMode: PlayerDeathMode = 'remove';

  return {
    registerHook(hook): void {
      hooks.push(hook);
    },
    registerDamageHook(hook): void {
      damageHooks.push(hook);
    },
    setPlayerDeathMode(mode): void {
      playerDeathMode = mode;
    },
    clear(): void {
      playerDeathMode = 'remove';
    },
    tick(intents, store, simTimeMs, emit): void {
      const { deaths, damages, companionDowned, playerDowned } = applyDamage(
        intents,
        store,
        simTimeMs,
        playerDeathMode
      );
      for (const damage of damages) {
        for (const hook of damageHooks) hook(damage);
      }
      for (const downed of companionDowned) {
        emit({
          kind: 'companionDowned',
          simTime: downed.simTime,
          companionId: downed.companionId,
          petArchetypeId: downed.petArchetypeId,
          weaponArchetypeId: weaponArchetypeIdForDamageSource(downed.cause),
          impactDirX: downed.cause.kind === 'projectile' ? downed.cause.impactDirX : null,
          impactDirY: downed.cause.kind === 'projectile' ? downed.cause.impactDirY : null,
          x: downed.position.x,
          y: downed.position.y
        });
      }
      for (const downed of playerDowned) {
        emit({
          kind: 'playerDowned',
          simTime: downed.simTime,
          entityId: downed.entityId,
          playerId: downed.playerId,
          weaponArchetypeId: weaponArchetypeIdForDamageSource(downed.cause),
          impactDirX: downed.cause.kind === 'projectile' ? downed.cause.impactDirX : null,
          impactDirY: downed.cause.kind === 'projectile' ? downed.cause.impactDirY : null,
          x: downed.position.x,
          y: downed.position.y
        });
      }
      for (const death of deaths) {
        emit({
          kind: 'death',
          simTime: death.simTime,
          entityId: death.entityId,
          entityKind: death.entityKind,
          archetypeId: death.archetypeId,
          weaponArchetypeId: weaponArchetypeIdForDamageSource(death.cause),
          impactDirX: death.cause.kind === 'projectile' ? death.cause.impactDirX : null,
          impactDirY: death.cause.kind === 'projectile' ? death.cause.impactDirY : null,
          killerId: killerIdForDamageSource(death.cause, death.entityId),
          x: death.position.x,
          y: death.position.y
        });
      }
      for (const death of deaths) {
        for (const hook of hooks) {
          hook(death);
        }
      }
      for (const death of deaths) {
        if (death.entityKind === 'enemy') store.removeEnemy(death.entityId);
        if (death.entityKind === 'boss') store.removeBoss(death.entityId);
        if (death.entityKind === 'player') {
          const player = store.playerById(death.entityId);
          if (player?.state !== 'ghost') {
            store.removePlayer(death.entityId);
          }
        }
      }
    }
  };
}

function applyDamage(
  intents: ReadonlyArray<DamageIntent>,
  store: EntityStore,
  simTimeMs: number,
  playerDeathMode: PlayerDeathMode
): Readonly<{
  deaths: DeathContext[];
  damages: DamageContext[];
  companionDowned: CompanionDownedContext[];
  playerDowned: PlayerDownedContext[];
}> {
  const deaths: DeathContext[] = [];
  const damages: DamageContext[] = [];
  const companionDowned: CompanionDownedContext[] = [];
  const playerDowned: PlayerDownedContext[] = [];
  for (const intent of intents) {
    if (intent.amount <= 0) continue;
    const target = resolveTarget(intent.targetId, store);
    if (target === null) continue;
    if (isInvulnerable(target, simTimeMs)) continue;
    if (target.hp === 0) continue;
    target.hp = Math.max(0, target.hp - intent.amount);
    damages.push(makeDamageContext(target, intent, simTimeMs));
    if (target.kind === 'companion') {
      if (target.hp === 0) {
        target.state = 'ghost';
        target.mode = 'ghost';
        target.targetId = null;
        target.rescueProgressMs = 0;
        companionDowned.push(makeCompanionDownedContext(target, intent.source, simTimeMs));
      }
      continue;
    }
    if (target.kind === 'player' && target.hp === 0 && playerDeathMode === 'ghost') {
      target.state = 'ghost';
      playerDowned.push(makePlayerDownedContext(target, intent.source, simTimeMs));
      deaths.push(makeDeathContext(target, intent.source, simTimeMs));
      continue;
    }
    if (target.hp === 0) {
      deaths.push(makeDeathContext(target, intent.source, simTimeMs));
    }
  }
  return { deaths, damages, companionDowned, playerDowned };
}

function resolveTarget(id: EntityId, store: EntityStore): Enemy | Boss | Player | Companion | null {
  const player = store.playerById(id);
  if (player !== null) return player;
  const companion = store.companionById(id);
  if (companion !== null) return companion;
  const enemy = store.enemyById(id);
  if (enemy !== null) return enemy;
  return store.bossById(id);
}

function makeDeathContext(
  target: Enemy | Boss | Player,
  cause: DamageSource,
  simTimeMs: number
): DeathContext {
  const archetypeId =
    target.kind === 'enemy' || target.kind === 'boss' ? target.archetypeId : null;
  return {
    entityId: target.id,
    entityKind: target.kind,
    archetypeId,
    position: { x: target.position.x, y: target.position.y },
    cause,
    simTime: simTimeMs
  };
}

function makeDamageContext(
  target: Enemy | Boss | Player | Companion,
  intent: DamageIntent,
  simTimeMs: number
): DamageContext {
  const archetypeId =
    target.kind === 'enemy' || target.kind === 'boss'
      ? target.archetypeId
      : target.kind === 'companion'
        ? target.petArchetypeId
        : null;
  return {
    targetId: target.id,
    targetKind: target.kind,
    targetArchetypeId: archetypeId,
    amount: intent.amount,
    source: intent.source,
    hitPosition: { x: intent.hitPosition.x, y: intent.hitPosition.y },
    simTime: simTimeMs
  };
}

function makeCompanionDownedContext(
  companion: Companion,
  cause: DamageSource,
  simTimeMs: number
): CompanionDownedContext {
  return {
    companionId: companion.id,
    petArchetypeId: companion.petArchetypeId,
    position: { x: companion.position.x, y: companion.position.y },
    cause,
    simTime: simTimeMs
  };
}

function makePlayerDownedContext(
  player: Player,
  cause: DamageSource,
  simTimeMs: number
): PlayerDownedContext {
  return {
    entityId: player.id,
    playerId: player.playerId,
    position: { x: player.position.x, y: player.position.y },
    cause,
    simTime: simTimeMs
  };
}

function weaponArchetypeIdForDamageSource(source: DamageSource): string | null {
  return source.kind === 'projectile' || source.kind === 'explosion'
    ? source.weaponArchetypeId
    : null;
}

function isInvulnerable(target: Enemy | Boss | Player | Companion, simTimeMs: number): boolean {
  if (target.kind === 'player' && target.state !== 'alive') return true;
  if (target.kind === 'companion' && target.state !== 'alive') return true;
  return (
    target.kind === 'player' &&
    target.invulnerableUntilSimMs !== null &&
    target.invulnerableUntilSimMs > simTimeMs
  );
}

function killerIdForDamageSource(source: DamageSource, targetId: EntityId): EntityId | null {
  const candidate = killerCandidateForDamageSource(source);
  if (candidate === null || candidate === targetId) return null;
  return candidate;
}

function killerCandidateForDamageSource(source: DamageSource): EntityId | null {
  switch (source.kind) {
    case 'projectile':
    case 'explosion':
      return source.ownerId ?? null;
    case 'enemyContact':
      return source.enemyId;
    case 'boss':
      return source.bossId;
    case 'fieldEffect':
    case 'statusEffect':
    case 'environment':
      return null;
    default:
      return assertNever(source);
  }
}

function assertNever(value: never): never {
  throw new Error(`unhandled damage source: ${String(value)}`);
}
