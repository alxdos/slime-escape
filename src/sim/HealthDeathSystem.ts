import type { RuntimeEvent } from '../shared/events';
import type { Vec2 } from '../shared/session';

import type { DamageIntent, DamageSource } from './CombatSystem';
import type { EntityId, EntityStore } from './EntityStore';

export type DeathContext = Readonly<{
  entityId: EntityId;
  entityKind: 'enemy' | 'player';
  archetypeId: string | null;
  position: Vec2;
  cause: DamageSource;
  simTime: number;
}>;

export type DeathHook = (ctx: DeathContext) => void;

export type HealthDeathSystem = Readonly<{
  registerHook(hook: DeathHook): void;
  tick(
    intents: ReadonlyArray<DamageIntent>,
    store: EntityStore,
    simTimeMs: number,
    emit: (event: RuntimeEvent) => void
  ): void;
}>;

export function createHealthDeathSystem(): HealthDeathSystem {
  const hooks: DeathHook[] = [];

  return {
    registerHook(hook): void {
      hooks.push(hook);
    },
    tick(intents, store, simTimeMs, emit): void {
      const deaths = applyDamage(intents, store, simTimeMs);
      for (const death of deaths) {
        emit({
          kind: 'death',
          simTime: death.simTime,
          entityId: death.entityId,
          entityKind: death.entityKind,
          archetypeId: death.archetypeId,
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
        store.removeEnemy(death.entityId);
      }
    }
  };
}

function applyDamage(
  intents: ReadonlyArray<DamageIntent>,
  store: EntityStore,
  simTimeMs: number
): DeathContext[] {
  const deaths: DeathContext[] = [];
  for (const intent of intents) {
    const target = store.enemyById(intent.targetId);
    if (target === null) continue;
    if (target.hp === 0) continue;
    target.hp = Math.max(0, target.hp - intent.amount);
    if (target.hp === 0) {
      deaths.push({
        entityId: target.id,
        entityKind: 'enemy',
        archetypeId: target.archetypeId,
        position: { x: target.position.x, y: target.position.y },
        cause: intent.source,
        simTime: simTimeMs
      });
    }
  }
  return deaths;
}
