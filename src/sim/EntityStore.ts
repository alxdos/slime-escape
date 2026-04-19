import type { EnemyBehavior } from '../shared/content/enemies';
import type { PlayerSpawn, Vec2 } from '../shared/session';

export type EntityId = number & { readonly __brand: 'EntityId' };

export type Player = {
  readonly id: EntityId;
  readonly kind: 'player';
  readonly radius: number;
  readonly maxSpeed: number;
  readonly maxHp: number;
  position: { x: number; y: number };
  velocity: { vx: number; vy: number };
  hp: number;
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
  readonly behavior: EnemyBehavior;
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
};

export type Projectile = {
  readonly id: EntityId;
  readonly kind: 'projectile';
  readonly weaponArchetypeId: string;
  readonly ownerKind: 'player' | 'enemy';
  readonly radius: number;
  readonly damage: number;
  readonly expireAtSimMs: number;
  position: { x: number; y: number };
  velocity: { vx: number; vy: number };
};

export type EnemySpawnSpec = Readonly<{
  archetypeId: string;
  position: Vec2;
  radius: number;
  behavior: EnemyBehavior;
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
  ownerKind: 'player' | 'enemy';
  position: Vec2;
  velocity: { vx: number; vy: number };
  radius: number;
  damage: number;
  expireAtSimMs: number;
}>;

export type EntityStore = Readonly<{
  spawnPlayer(spec: PlayerSpawn): Player;
  spawnEnemy(spec: EnemySpawnSpec): Enemy;
  spawnProjectile(spec: ProjectileSpawnSpec): Projectile;
  player(): Player | null;
  enemyById(id: EntityId): Enemy | null;
  projectileById(id: EntityId): Projectile | null;
  enemies(): IterableIterator<Enemy>;
  projectiles(): IterableIterator<Projectile>;
  enemyCount(): number;
  projectileCount(): number;
  removeEnemy(id: EntityId): boolean;
  removeProjectile(id: EntityId): boolean;
  clear(): void;
}>;

export function createEntityStore(): EntityStore {
  let nextId = 1;
  let player: Player | null = null;
  const enemies = new Map<EntityId, Enemy>();
  const projectiles = new Map<EntityId, Projectile>();

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
        maxSpeed: spec.maxSpeed,
        maxHp: spec.maxHp,
        position: { x: spec.position.x, y: spec.position.y },
        velocity: { vx: 0, vy: 0 },
        hp: spec.maxHp
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
        behavior: spec.behavior,
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
        knockback: null
      };
      enemies.set(next.id, next);
      return next;
    },
    spawnProjectile(spec): Projectile {
      const next: Projectile = {
        id: makeId(),
        kind: 'projectile',
        weaponArchetypeId: spec.weaponArchetypeId,
        ownerKind: spec.ownerKind,
        radius: spec.radius,
        damage: spec.damage,
        expireAtSimMs: spec.expireAtSimMs,
        position: { x: spec.position.x, y: spec.position.y },
        velocity: { vx: spec.velocity.vx, vy: spec.velocity.vy }
      };
      projectiles.set(next.id, next);
      return next;
    },
    player(): Player | null {
      return player;
    },
    enemyById(id): Enemy | null {
      return enemies.get(id) ?? null;
    },
    projectileById(id): Projectile | null {
      return projectiles.get(id) ?? null;
    },
    enemies(): IterableIterator<Enemy> {
      return enemies.values();
    },
    projectiles(): IterableIterator<Projectile> {
      return projectiles.values();
    },
    enemyCount(): number {
      return enemies.size;
    },
    projectileCount(): number {
      return projectiles.size;
    },
    removeEnemy(id): boolean {
      return enemies.delete(id);
    },
    removeProjectile(id): boolean {
      return projectiles.delete(id);
    },
    clear(): void {
      player = null;
      enemies.clear();
      projectiles.clear();
      nextId = 1;
    }
  };
}
