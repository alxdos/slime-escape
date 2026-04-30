import { BOSS_ARCHETYPES, type BossArchetype } from '../content/bosses';
import { FIREBALL_STAFF } from '../content/weapons';
import type { RuntimeEvent } from '../events';
import type { ArenaConfig } from '../session';

import { fireWeaponProjectiles, type DamageIntent } from './CombatSystem';
import type { Boss, EntityStore } from './EntityStore';

export type BossPhaseSystem = Readonly<{
  tick(
    store: EntityStore,
    arena: ArenaConfig,
    simTimeMs: number,
    emit: (event: RuntimeEvent) => void
  ): ReadonlyArray<DamageIntent>;
}>;

export function createBossPhaseSystem(): BossPhaseSystem {
  return {
    tick(store, arena, simTimeMs, emit): ReadonlyArray<DamageIntent> {
      const intents: DamageIntent[] = [];
      for (const boss of store.bosses()) {
        const archetype = BOSS_ARCHETYPES[boss.archetypeId];
        if (archetype === undefined) continue;
        maybeAdvancePhase(boss, archetype, simTimeMs, emit);
        intents.push(...runBossAttacks(boss, archetype, store, arena, simTimeMs, emit));
      }
      return intents;
    }
  };
}

function maybeAdvancePhase(
  boss: Boss,
  archetype: BossArchetype,
  simTimeMs: number,
  emit: (event: RuntimeEvent) => void
): void {
  while (boss.phaseIndex < archetype.phases.length - 1) {
    const current = archetype.phases[boss.phaseIndex];
    if (current === undefined) return;
    const frac = boss.hp / boss.maxHp;
    if (frac > current.exitWhenHpFractionAtOrBelow) return;
    boss.phaseIndex += 1;
    const next = archetype.phases[boss.phaseIndex];
    if (next === undefined) return;
    boss.phaseId = next.id;
    boss.activeAttackIds = [...next.allowedAttackIds];
    emit({
      kind: 'bossPhaseChange',
      simTime: simTimeMs,
      bossId: boss.id,
      phaseIndex: boss.phaseIndex,
      phaseId: boss.phaseId
    });
  }
}

function runBossAttacks(
  boss: Boss,
  archetype: BossArchetype,
  store: EntityStore,
  _arena: ArenaConfig,
  simTimeMs: number,
  emit: (event: RuntimeEvent) => void
): DamageIntent[] {
  const intents: DamageIntent[] = [];
  const player = store.player();
  for (const attackId of boss.activeAttackIds) {
    const spec = archetype.attacks[attackId];
    if (spec === undefined) continue;
    const nextAt = boss.attackNextSimMs.get(attackId) ?? 0;
    if (simTimeMs < nextAt) continue;

    if (attackId === 'coneBurst') {
      if (player === null) continue;
      const w = FIREBALL_STAFF;
      const result = fireWeaponProjectiles(
        store,
        w,
        [],
        boss.id,
        'boss',
        boss.position,
        player.position,
        simTimeMs
      );
      if (result === null) continue;
      boss.attackNextSimMs.set(attackId, simTimeMs + spec.cooldownMs);
      emit({
        kind: 'fire',
        simTime: simTimeMs,
        shooterId: boss.id,
        ownerKind: 'boss',
        weaponArchetypeId: w.id,
        originX: boss.position.x,
        originY: boss.position.y,
        dirX: result.eventDirection.x,
        dirY: result.eventDirection.y
      });
      return intents;
    }

    if (attackId === 'dashSlam') {
      if (player === null) continue;
      const dx = player.position.x - boss.position.x;
      const dy = player.position.y - boss.position.y;
      const dist = Math.hypot(dx, dy);
      if (dist > boss.radius + player.radius + 0.5) {
        boss.attackNextSimMs.set(attackId, simTimeMs + spec.cooldownMs);
        continue;
      }
      intents.push({
        targetId: player.id,
        amount: Math.max(1, spec.damage),
        source: { kind: 'boss', bossId: boss.id, attackId },
        hitPosition: { x: player.position.x, y: player.position.y }
      });
      boss.attackNextSimMs.set(attackId, simTimeMs + spec.cooldownMs);
      return intents;
    }

    if (attackId === 'spawnAdds') {
      boss.attackNextSimMs.set(attackId, simTimeMs + spec.cooldownMs);
      continue;
    }
  }
  return intents;
}
