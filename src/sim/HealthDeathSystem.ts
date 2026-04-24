import type { RuntimeEvent } from '../shared/events';
import type { Vec2 } from '../shared/session';

import type { DamageIntent, DamageSource } from './CombatSystem';
import type { Boss, Enemy, EntityId, EntityStore, Player } from './EntityStore';

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
  targetKind: 'enemy' | 'player' | 'boss';
  targetArchetypeId: string | null;
  amount: number;
  source: DamageSource;
  hitPosition: Vec2;
  simTime: number;
}>;

export type DamageHook = (ctx: DamageContext) => void;

export type HealthDeathSystem = Readonly<{
  registerHook(hook: DeathHook): void;
  registerDamageHook(hook: DamageHook): void;
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

  return {
    registerHook(hook): void {
      hooks.push(hook);
    },
    registerDamageHook(hook): void {
      damageHooks.push(hook);
    },
    tick(intents, store, simTimeMs, emit): void {
      const { deaths, damages } = applyDamage(intents, store, simTimeMs);
      for (const damage of damages) {
        for (const hook of damageHooks) hook(damage);
      }
      for (const death of deaths) {
        emit({
          kind: 'death',
          simTime: death.simTime,
          entityId: death.entityId,
          entityKind: death.entityKind,
          archetypeId: death.archetypeId,
          weaponArchetypeId:
            death.cause.kind === 'projectile' || death.cause.kind === 'explosion'
              ? death.cause.weaponArchetypeId
              : null,
          impactDirX: death.cause.kind === 'projectile' ? death.cause.impactDirX : null,
          impactDirY: death.cause.kind === 'projectile' ? death.cause.impactDirY : null,
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
        if (death.entityKind === 'player') store.removePlayer();
      }
    }
  };
}

function applyDamage(
  intents: ReadonlyArray<DamageIntent>,
  store: EntityStore,
  simTimeMs: number
): Readonly<{ deaths: DeathContext[]; damages: DamageContext[] }> {
  const deaths: DeathContext[] = [];
  const damages: DamageContext[] = [];
  for (const intent of intents) {
    if (intent.amount <= 0) continue;
    const target = resolveTarget(intent.targetId, store);
    if (target === null) continue;
    if (target.hp === 0) continue;
    target.hp = Math.max(0, target.hp - intent.amount);
    damages.push(makeDamageContext(target, intent, simTimeMs));
    if (target.hp === 0) {
      deaths.push(makeDeathContext(target, intent.source, simTimeMs));
    }
  }
  return { deaths, damages };
}

function resolveTarget(id: EntityId, store: EntityStore): Enemy | Boss | Player | null {
  const player = store.player();
  if (player !== null && player.id === id) return player;
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
  target: Enemy | Boss | Player,
  intent: DamageIntent,
  simTimeMs: number
): DamageContext {
  const archetypeId =
    target.kind === 'enemy' || target.kind === 'boss' ? target.archetypeId : null;
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
