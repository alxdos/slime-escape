import type { StatusEffectSpec } from '../content/weapons.js';

import type { DamageIntent } from './CombatSystem.js';
import type { ActorEffectIntent, ActorEffectSource } from './FieldEffectSystem.js';
import type { ActorStatusEffect, Boss, Enemy, EntityId, EntityStore, Player } from './EntityStore.js';

type StatusCarrier = Player | Enemy | Boss;

export type StatusEffectSystem = Readonly<{
  apply(intents: ReadonlyArray<ActorEffectIntent>, simTimeMs: number, store: EntityStore): void;
  tick(simTimeMs: number, store: EntityStore): ReadonlyArray<DamageIntent>;
  clear(): void;
}>;

export function createStatusEffectSystem(): StatusEffectSystem {
  return {
    apply(intents, simTimeMs, store): void {
      for (const intent of intents) {
        if (intent.application.kind !== 'status') continue;
        const target = resolveTarget(intent.targetId, store);
        if (target === null) continue;
        target.statusEffects.push(makeStatusEffect(intent.application.status, intent.source, simTimeMs));
      }
    },
    tick(simTimeMs, store): ReadonlyArray<DamageIntent> {
      const intents: DamageIntent[] = [];
      for (const player of store.players()) tickCarrier(player, simTimeMs, intents);
      for (const enemy of store.enemies()) tickCarrier(enemy, simTimeMs, intents);
      for (const boss of store.bosses()) tickCarrier(boss, simTimeMs, intents);
      return intents;
    },
    clear(): void {}
  };
}

export function resolveMovementSpeedMultiplier(actor: StatusCarrier): number {
  let multiplier = 1;
  for (const effect of actor.statusEffects) {
    if (effect.kind !== 'slow') continue;
    multiplier = Math.min(multiplier, effect.speedMultiplier);
  }
  return multiplier;
}

function makeStatusEffect(
  status: StatusEffectSpec,
  sourceIntent: ActorEffectSource,
  simTimeMs: number
): ActorStatusEffect {
  const source =
    sourceIntent.kind === 'fieldEffect'
      ? {
          kind: 'fieldEffect' as const,
          fieldEffectId: sourceIntent.fieldEffectId,
          archetypeId: sourceIntent.archetypeId
        }
      : {
          kind: 'explosion' as const,
          projectileId: sourceIntent.projectileId,
          weaponArchetypeId: sourceIntent.weaponArchetypeId
        };
  switch (status.kind) {
    case 'burn':
    case 'poison':
      return {
        kind: status.kind,
        damagePerTick: status.damagePerTick,
        tickEveryMs: status.tickEveryMs,
        nextTickSimMs: simTimeMs + status.tickEveryMs,
        expireAtSimMs: simTimeMs + status.durationMs,
        source
      };
    case 'slow':
      return {
        kind: 'slow',
        speedMultiplier: status.speedMultiplier,
        expireAtSimMs: simTimeMs + status.durationMs,
        source
      };
    default:
      return assertNever(status);
  }
}

function tickCarrier(
  carrier: StatusCarrier | null,
  simTimeMs: number,
  intents: DamageIntent[]
): void {
  if (carrier === null) return;
  const active: ActorStatusEffect[] = [];
  for (const effect of carrier.statusEffects) {
    if (simTimeMs >= effect.expireAtSimMs) continue;
    tickEffect(carrier, effect, simTimeMs, intents);
    active.push(effect);
  }
  carrier.statusEffects = active;
}

function tickEffect(
  carrier: StatusCarrier,
  effect: ActorStatusEffect,
  simTimeMs: number,
  intents: DamageIntent[]
): void {
  switch (effect.kind) {
    case 'slow':
      return;
    case 'burn':
    case 'poison':
      if (simTimeMs < effect.nextTickSimMs) return;
      intents.push({
        targetId: carrier.id,
        amount: effect.damagePerTick,
        source: {
          kind: 'statusEffect',
          statusKind: effect.kind,
          sourceEntityId:
            effect.source.kind === 'fieldEffect'
              ? effect.source.fieldEffectId
              : effect.source.projectileId
        },
        hitPosition: { x: carrier.position.x, y: carrier.position.y }
      });
      effect.nextTickSimMs += effect.tickEveryMs;
      return;
    default:
      assertNever(effect);
  }
}

function resolveTarget(id: EntityId, store: EntityStore): StatusCarrier | null {
  const player = store.playerById(id);
  if (player !== null) return player;
  const enemy = store.enemyById(id);
  if (enemy !== null) return enemy;
  return store.bossById(id);
}

function assertNever(value: never): never {
  throw new Error(`unhandled status effect value: ${String(value)}`);
}
