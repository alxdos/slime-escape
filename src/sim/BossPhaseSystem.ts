import { BOSS_ARCHETYPES, type BossArchetype } from '../shared/content/bosses';
import { PISTOL } from '../shared/content/weapons';
import type { RuntimeEvent } from '../shared/events';
import type { ArenaConfig } from '../shared/session';

import type { DamageIntent } from './CombatSystem';
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
      const dx = player.position.x - boss.position.x;
      const dy = player.position.y - boss.position.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) continue;
      const dirX = dx / len;
      const dirY = dy / len;
      const w = PISTOL;
      if (w.projectile.motion.kind !== 'linear') continue;
      store.spawnProjectile({
        weaponArchetypeId: w.id,
        ownerId: boss.id,
        ownerKind: 'boss',
        motionKind: w.projectile.motion.kind,
        position: { x: boss.position.x, y: boss.position.y },
        velocity: {
          vx: dirX * w.projectile.motion.speed,
          vy: dirY * w.projectile.motion.speed
        },
        size: w.projectile.size,
        hitRadius: w.projectile.hitRadius,
        impactDamage: Math.max(1, spec.damage),
        knockbackImpulse: w.projectile.knockbackImpulse,
        pierceRemaining: w.projectile.pierceCount,
        groundOnImpact: w.projectile.groundOnImpact,
        groundedLifetimeMs: w.projectile.groundedLifetimeMs,
        explosion: w.projectile.explosion,
        groundAtSimMs: null,
        expireAtSimMs: simTimeMs + w.projectile.ttlMs
      });
      boss.attackNextSimMs.set(attackId, simTimeMs + spec.cooldownMs);
      emit({
        kind: 'fire',
        simTime: simTimeMs,
        shooterId: boss.id,
        ownerKind: 'boss',
        weaponArchetypeId: w.id,
        originX: boss.position.x,
        originY: boss.position.y,
        dirX,
        dirY
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
