import type { DropEffect } from '../shared/content/drops';
import type { EnemyBehavior, RetaliationPolicy } from '../shared/content/enemies';
import type {
  ActorEffectApplication,
  DetonationTrigger,
  ExplosionSpec
} from '../shared/content/weapons';
import type { ContactBox, PlayerSpawn, Vec2 } from '../shared/session';

export type EntityId = number & { readonly __brand: 'EntityId' };

export type Player = {
  readonly id: EntityId;
  readonly kind: 'player';
  readonly radius: number;
  readonly contactBox: ContactBox;
  readonly maxSpeed: number;
  readonly maxHp: number;
  position: { x: number; y: number };
  velocity: { vx: number; vy: number };
  hp: number;
  statusEffects: ActorStatusEffect[];
};

export type KnockbackState = {
  vx: number;
  vy: number;
  startSimMs: number;
  endSimMs: number;
};

export type Enemy = {
  readonly id: EntityId;
  readonly kind: 'enemy';
  readonly archetypeId: string;
  readonly radius: number;
  readonly contactBox: ContactBox;
  readonly behavior: EnemyBehavior;
  readonly carrierDropMarker: 'reward' | null;
  readonly retaliation: RetaliationPolicy;
  readonly maxHp: number;
  readonly maxSpeed: number;
  readonly contactDamage: number;
  readonly contactCooldownMs: number;
  readonly knockbackBaseImpulse: number;
  readonly knockbackVelocityScale: number;
  readonly knockbackDurationMs: number;
  readonly color: number;
  position: { x: number; y: number };
  velocity: { vx: number; vy: number };
  hp: number;
  nextContactSimMs: number;
  knockback: KnockbackState | null;
  aggroMemory: AggroMemory | null;
  statusEffects: ActorStatusEffect[];
};

export type AggroMemory = {
  targetId: EntityId;
  reason: 'friendlyFire' | 'playerDamage' | 'scripted';
  expireAtSimMs: number;
};

export type Boss = {
  readonly id: EntityId;
  readonly kind: 'boss';
  readonly archetypeId: string;
  readonly radius: number;
  readonly contactBox: ContactBox;
  readonly maxHp: number;
  readonly maxSpeed: number;
  readonly color: number;
  readonly contactDamage: number;
  readonly contactCooldownMs: number;
  readonly knockbackBaseImpulse: number;
  readonly knockbackVelocityScale: number;
  readonly knockbackDurationMs: number;
  position: { x: number; y: number };
  velocity: { vx: number; vy: number };
  hp: number;
  nextContactSimMs: number;
  knockback: KnockbackState | null;
  phaseIndex: number;
  phaseId: string;
  activeAttackIds: string[];
  attackNextSimMs: Map<string, number>;
  statusEffects: ActorStatusEffect[];
};

export type ActorStatusEffect =
  | {
      kind: 'burn';
      damagePerTick: number;
      tickEveryMs: number;
      nextTickSimMs: number;
      expireAtSimMs: number;
      source: StatusEffectSource;
    }
  | {
      kind: 'slow';
      speedMultiplier: number;
      expireAtSimMs: number;
      source: StatusEffectSource;
    }
  | {
      kind: 'poison';
      damagePerTick: number;
      tickEveryMs: number;
      nextTickSimMs: number;
      expireAtSimMs: number;
      source: StatusEffectSource;
    };

export type StatusEffectSource =
  | Readonly<{
      kind: 'fieldEffect';
      fieldEffectId: EntityId;
      archetypeId: string;
    }>
  | Readonly<{
      kind: 'explosion';
      projectileId: EntityId;
      weaponArchetypeId: string;
    }>;

export type Projectile = {
  readonly id: EntityId;
  readonly kind: 'projectile';
  readonly weaponArchetypeId: string;
  readonly ownerId: EntityId;
  readonly ownerKind: 'player' | 'enemy' | 'boss';
  readonly motionKind: 'linear' | 'arc' | 'placed';
  readonly arcStart: Vec2 | null;
  readonly arcEnd: Vec2 | null;
  readonly arcStartSimMs: number | null;
  readonly arcEndSimMs: number | null;
  readonly origin: Vec2;
  readonly size: { width: number; height: number };
  readonly hitRadius: number;
  readonly impactDamage: number;
  readonly knockbackImpulse: number;
  pierceRemaining: number;
  readonly groundOnImpact: boolean;
  readonly groundedLifetimeMs: number | null;
  readonly detonationTrigger: DetonationTrigger | null;
  readonly explosion: ExplosionSpec | null;
  state: 'flying' | 'grounded';
  readonly hitEntityIds: Set<EntityId>;
  groundAtSimMs: number | null;
  detonateAtSimMs: number | null;
  expireAtSimMs: number;
  position: { x: number; y: number };
  velocity: { vx: number; vy: number };
};

export type Drop = {
  readonly id: EntityId;
  readonly kind: 'drop';
  readonly archetypeId: string;
  readonly radius: number;
  readonly effect: DropEffect;
  readonly color: number;
  readonly expireAtSimMs: number;
  position: { x: number; y: number };
};

export type FieldEffect = {
  readonly id: EntityId;
  readonly kind: 'fieldEffect';
  readonly archetypeId: string;
  readonly ownerId: EntityId | null;
  readonly ownerKind: 'player' | 'enemy' | 'boss' | null;
  readonly position: { x: number; y: number };
  readonly radius: number;
  readonly applyEveryMs: number;
  nextApplySimMs: number;
  readonly expireAtSimMs: number;
  readonly effects: ReadonlyArray<ActorEffectApplication>;
};

export type EnemySpawnSpec = Readonly<{
  archetypeId: string;
  position: Vec2;
  radius: number;
  contactBox: ContactBox;
  behavior: EnemyBehavior;
  carrierDropMarker?: 'reward' | null;
  retaliation?: RetaliationPolicy;
  maxHp: number;
  maxSpeed: number;
  contactDamage: number;
  contactCooldownMs: number;
  knockbackBaseImpulse: number;
  knockbackVelocityScale: number;
  knockbackDurationMs: number;
  color: number;
}>;

export type ProjectileSpawnSpec = Readonly<{
  weaponArchetypeId: string;
  ownerId: EntityId;
  ownerKind: 'player' | 'enemy' | 'boss';
  motionKind: 'linear' | 'arc' | 'placed';
  arcStart?: Vec2 | null;
  arcEnd?: Vec2 | null;
  arcStartSimMs?: number | null;
  arcEndSimMs?: number | null;
  origin?: Vec2;
  position: Vec2;
  velocity: { vx: number; vy: number };
  size: Readonly<{ width: number; height: number }>;
  hitRadius: number;
  impactDamage: number;
  knockbackImpulse: number;
  pierceRemaining: number;
  groundOnImpact: boolean;
  groundedLifetimeMs: number | null;
  detonationTrigger?: DetonationTrigger | null;
  explosion: ExplosionSpec | null;
  state?: 'flying' | 'grounded';
  hitEntityIds?: ReadonlySet<EntityId>;
  groundAtSimMs: number | null;
  detonateAtSimMs?: number | null;
  expireAtSimMs: number;
}>;

export type DropSpawnSpec = Readonly<{
  archetypeId: string;
  position: Vec2;
  radius: number;
  effect: DropEffect;
  color: number;
  expireAtSimMs: number;
}>;

export type FieldEffectSpawnSpec = Readonly<{
  archetypeId: string;
  ownerId: EntityId | null;
  ownerKind: 'player' | 'enemy' | 'boss' | null;
  position: Vec2;
  radius: number;
  applyEveryMs: number;
  nextApplySimMs: number;
  expireAtSimMs: number;
  effects: ReadonlyArray<ActorEffectApplication>;
}>;

export type BossSpawnSpec = Readonly<{
  archetypeId: string;
  position: Vec2;
  radius: number;
  contactBox: ContactBox;
  maxHp: number;
  maxSpeed: number;
  color: number;
  contactDamage: number;
  contactCooldownMs: number;
  knockbackBaseImpulse: number;
  knockbackVelocityScale: number;
  knockbackDurationMs: number;
  phaseIndex: number;
  phaseId: string;
  activeAttackIds: ReadonlyArray<string>;
  attackIdsFromArchetype: ReadonlyArray<string>;
}>;

export type EntityStore = Readonly<{
  spawnPlayer(spec: PlayerSpawn): Player;
  spawnEnemy(spec: EnemySpawnSpec): Enemy;
  spawnBoss(spec: BossSpawnSpec): Boss;
  spawnProjectile(spec: ProjectileSpawnSpec): Projectile;
  spawnDrop(spec: DropSpawnSpec): Drop;
  spawnFieldEffect(spec: FieldEffectSpawnSpec): FieldEffect;
  player(): Player | null;
  enemyById(id: EntityId): Enemy | null;
  bossById(id: EntityId): Boss | null;
  projectileById(id: EntityId): Projectile | null;
  dropById(id: EntityId): Drop | null;
  fieldEffectById(id: EntityId): FieldEffect | null;
  enemies(): IterableIterator<Enemy>;
  bosses(): IterableIterator<Boss>;
  projectiles(): IterableIterator<Projectile>;
  drops(): IterableIterator<Drop>;
  fieldEffects(): IterableIterator<FieldEffect>;
  enemyCount(): number;
  bossCount(): number;
  projectileCount(): number;
  dropCount(): number;
  fieldEffectCount(): number;
  removeEnemy(id: EntityId): boolean;
  removeBoss(id: EntityId): boolean;
  removeProjectile(id: EntityId): boolean;
  removeDrop(id: EntityId): boolean;
  removeFieldEffect(id: EntityId): boolean;
  removePlayer(): boolean;
  clear(): void;
}>;

export function createEntityStore(): EntityStore {
  let nextId = 1;
  let player: Player | null = null;
  const enemies = new Map<EntityId, Enemy>();
  const bosses = new Map<EntityId, Boss>();
  const projectiles = new Map<EntityId, Projectile>();
  const drops = new Map<EntityId, Drop>();
  const fieldEffects = new Map<EntityId, FieldEffect>();

  function makeId(): EntityId {
    const id = nextId as EntityId;
    nextId += 1;
    return id;
  }

  return {
    spawnPlayer(spec): Player {
      if (player !== null) {
        throw new Error('player already spawned');
      }
      const next: Player = {
        id: makeId(),
        kind: 'player',
        radius: spec.radius,
        contactBox: { width: spec.contactBox.width, height: spec.contactBox.height },
        maxSpeed: spec.maxSpeed,
        maxHp: spec.maxHp,
        position: { x: spec.position.x, y: spec.position.y },
        velocity: { vx: 0, vy: 0 },
        hp: spec.maxHp,
        statusEffects: []
      };
      player = next;
      return next;
    },
    spawnEnemy(spec): Enemy {
      const next: Enemy = {
        id: makeId(),
        kind: 'enemy',
        archetypeId: spec.archetypeId,
        radius: spec.radius,
        contactBox: { width: spec.contactBox.width, height: spec.contactBox.height },
        behavior: spec.behavior,
        carrierDropMarker: spec.carrierDropMarker ?? null,
        retaliation: spec.retaliation ?? { enabled: false, durationMs: 0 },
        maxHp: spec.maxHp,
        maxSpeed: spec.maxSpeed,
        contactDamage: spec.contactDamage,
        contactCooldownMs: spec.contactCooldownMs,
        knockbackBaseImpulse: spec.knockbackBaseImpulse,
        knockbackVelocityScale: spec.knockbackVelocityScale,
        knockbackDurationMs: spec.knockbackDurationMs,
        color: spec.color,
        position: { x: spec.position.x, y: spec.position.y },
        velocity: { vx: 0, vy: 0 },
        hp: spec.maxHp,
        nextContactSimMs: 0,
        knockback: null,
        aggroMemory: null,
        statusEffects: []
      };
      enemies.set(next.id, next);
      return next;
    },
    spawnBoss(spec): Boss {
      const attackNextSimMs = new Map<string, number>();
      for (const aid of spec.attackIdsFromArchetype) {
        attackNextSimMs.set(aid, 0);
      }
      const next: Boss = {
        id: makeId(),
        kind: 'boss',
        archetypeId: spec.archetypeId,
        radius: spec.radius,
        contactBox: { width: spec.contactBox.width, height: spec.contactBox.height },
        maxHp: spec.maxHp,
        maxSpeed: spec.maxSpeed,
        color: spec.color,
        contactDamage: spec.contactDamage,
        contactCooldownMs: spec.contactCooldownMs,
        knockbackBaseImpulse: spec.knockbackBaseImpulse,
        knockbackVelocityScale: spec.knockbackVelocityScale,
        knockbackDurationMs: spec.knockbackDurationMs,
        position: { x: spec.position.x, y: spec.position.y },
        velocity: { vx: 0, vy: 0 },
        hp: spec.maxHp,
        nextContactSimMs: 0,
        knockback: null,
        phaseIndex: spec.phaseIndex,
        phaseId: spec.phaseId,
        activeAttackIds: [...spec.activeAttackIds],
        attackNextSimMs,
        statusEffects: []
      };
      bosses.set(next.id, next);
      return next;
    },
    spawnProjectile(spec): Projectile {
      const next: Projectile = {
        id: makeId(),
        kind: 'projectile',
        weaponArchetypeId: spec.weaponArchetypeId,
        ownerId: spec.ownerId,
        ownerKind: spec.ownerKind,
        motionKind: spec.motionKind,
        arcStart:
          spec.arcStart === undefined || spec.arcStart === null
            ? null
            : { x: spec.arcStart.x, y: spec.arcStart.y },
        arcEnd:
          spec.arcEnd === undefined || spec.arcEnd === null
            ? null
            : { x: spec.arcEnd.x, y: spec.arcEnd.y },
        arcStartSimMs: spec.arcStartSimMs ?? null,
        arcEndSimMs: spec.arcEndSimMs ?? null,
        origin:
          spec.origin === undefined
            ? { x: spec.position.x, y: spec.position.y }
            : { x: spec.origin.x, y: spec.origin.y },
        size: { width: spec.size.width, height: spec.size.height },
        hitRadius: spec.hitRadius,
        impactDamage: spec.impactDamage,
        knockbackImpulse: spec.knockbackImpulse,
        pierceRemaining: spec.pierceRemaining,
        groundOnImpact: spec.groundOnImpact,
        groundedLifetimeMs: spec.groundedLifetimeMs,
        detonationTrigger:
          spec.detonationTrigger === undefined || spec.detonationTrigger === null
            ? null
            : structuredClone(spec.detonationTrigger),
        explosion: spec.explosion === null ? null : structuredClone(spec.explosion),
        state:
          spec.state ??
          (spec.motionKind === 'placed' || spec.groundAtSimMs !== null ? 'grounded' : 'flying'),
        hitEntityIds: new Set(spec.hitEntityIds ?? []),
        groundAtSimMs: spec.groundAtSimMs,
        detonateAtSimMs: spec.detonateAtSimMs ?? null,
        expireAtSimMs: spec.expireAtSimMs,
        position: { x: spec.position.x, y: spec.position.y },
        velocity: { vx: spec.velocity.vx, vy: spec.velocity.vy }
      };
      projectiles.set(next.id, next);
      return next;
    },
    spawnDrop(spec): Drop {
      const next: Drop = {
        id: makeId(),
        kind: 'drop',
        archetypeId: spec.archetypeId,
        radius: spec.radius,
        // design/drops.md: effect is copied at spawn so a live drop is
        // independent from later mutations of the source archetype.
        effect: structuredClone(spec.effect),
        color: spec.color,
        expireAtSimMs: spec.expireAtSimMs,
        position: { x: spec.position.x, y: spec.position.y }
      };
      drops.set(next.id, next);
      return next;
    },
    spawnFieldEffect(spec): FieldEffect {
      const next: FieldEffect = {
        id: makeId(),
        kind: 'fieldEffect',
        archetypeId: spec.archetypeId,
        ownerId: spec.ownerId,
        ownerKind: spec.ownerKind,
        position: { x: spec.position.x, y: spec.position.y },
        radius: spec.radius,
        applyEveryMs: spec.applyEveryMs,
        nextApplySimMs: spec.nextApplySimMs,
        expireAtSimMs: spec.expireAtSimMs,
        effects: spec.effects.map(copyActorEffect)
      };
      fieldEffects.set(next.id, next);
      return next;
    },
    player(): Player | null {
      return player;
    },
    enemyById(id): Enemy | null {
      return enemies.get(id) ?? null;
    },
    bossById(id): Boss | null {
      return bosses.get(id) ?? null;
    },
    projectileById(id): Projectile | null {
      return projectiles.get(id) ?? null;
    },
    dropById(id): Drop | null {
      return drops.get(id) ?? null;
    },
    fieldEffectById(id): FieldEffect | null {
      return fieldEffects.get(id) ?? null;
    },
    enemies(): IterableIterator<Enemy> {
      return enemies.values();
    },
    bosses(): IterableIterator<Boss> {
      return bosses.values();
    },
    projectiles(): IterableIterator<Projectile> {
      return projectiles.values();
    },
    drops(): IterableIterator<Drop> {
      return drops.values();
    },
    fieldEffects(): IterableIterator<FieldEffect> {
      return fieldEffects.values();
    },
    enemyCount(): number {
      return enemies.size;
    },
    bossCount(): number {
      return bosses.size;
    },
    projectileCount(): number {
      return projectiles.size;
    },
    dropCount(): number {
      return drops.size;
    },
    fieldEffectCount(): number {
      return fieldEffects.size;
    },
    removeEnemy(id): boolean {
      return enemies.delete(id);
    },
    removeBoss(id): boolean {
      return bosses.delete(id);
    },
    removeProjectile(id): boolean {
      return projectiles.delete(id);
    },
    removeDrop(id): boolean {
      return drops.delete(id);
    },
    removeFieldEffect(id): boolean {
      return fieldEffects.delete(id);
    },
    removePlayer(): boolean {
      if (player === null) return false;
      player = null;
      return true;
    },
    clear(): void {
      player = null;
      enemies.clear();
      bosses.clear();
      projectiles.clear();
      drops.clear();
      fieldEffects.clear();
      nextId = 1;
    }
  };
}

function copyActorEffect(effect: ActorEffectApplication): ActorEffectApplication {
  switch (effect.kind) {
    case 'damage':
      return { kind: 'damage', amount: effect.amount };
    case 'status':
      switch (effect.status.kind) {
        case 'burn':
        case 'poison':
          return {
            kind: 'status',
            status: {
              kind: effect.status.kind,
              damagePerTick: effect.status.damagePerTick,
              tickEveryMs: effect.status.tickEveryMs,
              durationMs: effect.status.durationMs
            }
          };
        case 'slow':
          return {
            kind: 'status',
            status: {
              kind: 'slow',
              speedMultiplier: effect.status.speedMultiplier,
              durationMs: effect.status.durationMs
            }
          };
        default:
          return assertNever(effect.status);
      }
    default:
      return assertNever(effect);
  }
}

function assertNever(value: never): never {
  throw new Error(`unhandled entity-store value: ${String(value)}`);
}
