import type { DropEffect } from '../content/drops.js';
import type { DropTableEntry, EnemyBehavior, RetaliationPolicy } from '../content/enemies.js';
import type {
  ActorEffectApplication,
  DetonationTrigger,
  ExplosionSpec
} from '../content/weapons.js';
import type {
  CompanionBoopConfig,
  CompanionMovementConfig,
  CompanionRescueConfig,
  CompanionThreatConfig,
  ContactBox,
  Loadout,
  PlayerSpawn,
  Vec2
} from '../session.js';
import type { RuntimeEvent } from '../events.js';

export type EntityId = number & { readonly __brand: 'EntityId' };
export type CombatOwnerKind = 'player' | 'companion' | 'enemy' | 'boss';

export type Player = {
  readonly id: EntityId;
  readonly playerId: string;
  readonly kind: 'player';
  state: 'alive' | 'ghost' | 'reviving';
  radius: number;
  contactBox: ContactBox;
  maxSpeed: number;
  maxHp: number;
  formArchetypeId: string | null;
  invulnerableUntilSimMs: number | null;
  position: { x: number; y: number };
  velocity: { vx: number; vy: number };
  hp: number;
  statusEffects: ActorStatusEffect[];
};

export type CompanionState = 'alive' | 'ghost';
export type CompanionMode = 'rest' | 'guard' | 'alert' | 'engage' | 'rescue' | 'ghost';

export type Companion = {
  readonly id: EntityId;
  readonly kind: 'companion';
  readonly ownerPlayerId: string;
  readonly petArchetypeId: string;
  readonly contactBox: ContactBox;
  readonly maxHp: number;
  readonly movement: CompanionMovementConfig;
  readonly threat: CompanionThreatConfig;
  readonly weaponLoadout: Loadout | null;
  readonly boop: CompanionBoopConfig;
  readonly rescue: CompanionRescueConfig;
  position: { x: number; y: number };
  velocity: { vx: number; vy: number };
  hp: number;
  state: CompanionState;
  mode: CompanionMode;
  targetId: EntityId | null;
  rescueProgressMs: number;
  boopReadyAtSimMs: number;
  alertUntilSimMs: number;
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
  readonly guaranteedDrops: ReadonlyArray<string>;
  readonly dropTable: ReadonlyArray<DropTableEntry>;
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
  readonly ownerKind: CombatOwnerKind;
  readonly ownerTeamPlayerId: string | null;
  readonly spawnInputSequence: number | null;
  spawnedAtPredictorSimMs: number | null;
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
  readonly ownerKind: CombatOwnerKind | null;
  readonly ownerTeamPlayerId: string | null;
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
  guaranteedDrops?: ReadonlyArray<string>;
  dropTable?: ReadonlyArray<DropTableEntry>;
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
  ownerKind: CombatOwnerKind;
  ownerTeamPlayerId?: string | null;
  spawnInputSequence?: number | null;
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
  ownerKind: CombatOwnerKind | null;
  ownerTeamPlayerId?: string | null;
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

export type CompanionSpawnSpec = Readonly<{
  ownerPlayerId: string;
  petArchetypeId: string;
  position: Vec2;
  contactBox: ContactBox;
  maxHp: number;
  movement: CompanionMovementConfig;
  threat: CompanionThreatConfig;
  weaponLoadout: Loadout | null;
  boop: CompanionBoopConfig;
  rescue: CompanionRescueConfig;
}>;

export type PlayerEntitySpawnSpec = PlayerSpawn &
  Readonly<{
    id: string;
    formArchetypeId?: string | null;
    invulnerableUntilSimMs?: number | null;
  }>;

export type PlayerSpawnEventSink = Readonly<{
  simTimeMs: number;
  emit(event: RuntimeEvent): void;
}>;

export type EntityStore = Readonly<{
  spawnPlayer(spec: PlayerEntitySpawnSpec, eventSink?: PlayerSpawnEventSink): Player;
  spawnCompanion(spec: CompanionSpawnSpec): Companion;
  spawnEnemy(spec: EnemySpawnSpec): Enemy;
  spawnBoss(spec: BossSpawnSpec): Boss;
  spawnProjectile(spec: ProjectileSpawnSpec): Projectile;
  spawnDrop(spec: DropSpawnSpec): Drop;
  spawnFieldEffect(spec: FieldEffectSpawnSpec): FieldEffect;
  player(): Player | null;
  playerById(id: EntityId): Player | null;
  companion(): Companion | null;
  companionById(id: EntityId): Companion | null;
  companionByOwnerPlayerId(playerId: string): Companion | null;
  enemyById(id: EntityId): Enemy | null;
  bossById(id: EntityId): Boss | null;
  projectileById(id: EntityId): Projectile | null;
  dropById(id: EntityId): Drop | null;
  fieldEffectById(id: EntityId): FieldEffect | null;
  enemies(): IterableIterator<Enemy>;
  players(): IterableIterator<Player>;
  companions(): IterableIterator<Companion>;
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
  removePlayer(id: EntityId): boolean;
  removeCompanion(id?: EntityId): boolean;
  removeCompanionByOwnerPlayerId(playerId: string): boolean;
  clear(): void;
}>;

export function createEntityStore(): EntityStore {
  let nextId = 1;
  const players = new Map<EntityId, Player>();
  const companions = new Map<EntityId, Companion>();
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
    spawnPlayer(spec, eventSink): Player {
      const id = makeId();
      const next: Player = {
        id,
        playerId: spec.id,
        kind: 'player',
        state: 'alive',
        radius: spec.radius,
        contactBox: { width: spec.contactBox.width, height: spec.contactBox.height },
        maxSpeed: spec.maxSpeed,
        maxHp: spec.maxHp,
        formArchetypeId: spec.formArchetypeId ?? null,
        invulnerableUntilSimMs: spec.invulnerableUntilSimMs ?? null,
        position: { x: spec.position.x, y: spec.position.y },
        velocity: { vx: 0, vy: 0 },
        hp: spec.maxHp,
        statusEffects: []
      };
      players.set(next.id, next);
      eventSink?.emit({
        kind: 'playerSpawn',
        simTime: eventSink.simTimeMs,
        entityId: next.id,
        playerId: next.playerId,
        x: next.position.x,
        y: next.position.y,
        formArchetypeId: next.formArchetypeId
      });
      return next;
    },
    spawnCompanion(spec): Companion {
      if (companionByOwnerPlayerId(companions, spec.ownerPlayerId) !== null) {
        throw new Error(`companion already spawned for owner "${spec.ownerPlayerId}"`);
      }
      const next: Companion = {
        id: makeId(),
        kind: 'companion',
        ownerPlayerId: spec.ownerPlayerId,
        petArchetypeId: spec.petArchetypeId,
        contactBox: { width: spec.contactBox.width, height: spec.contactBox.height },
        maxHp: spec.maxHp,
        movement: {
          maxSpeed: spec.movement.maxSpeed,
          acceleration: spec.movement.acceleration,
          orbitRadius: spec.movement.orbitRadius
        },
        threat: {
          acquireRadius: spec.threat.acquireRadius,
          releaseRadius: spec.threat.releaseRadius
        },
        weaponLoadout:
          spec.weaponLoadout === null
            ? null
            : {
                weapons: [...spec.weaponLoadout.weapons],
                selectedIndex: spec.weaponLoadout.selectedIndex
              },
        boop: {
          radius: spec.boop.radius,
          impulse: spec.boop.impulse,
          durationMs: spec.boop.durationMs,
          cooldownMs: spec.boop.cooldownMs
        },
        rescue: {
          radius: spec.rescue.radius,
          durationMs: spec.rescue.durationMs,
          reviveHpFraction: spec.rescue.reviveHpFraction
        },
        position: { x: spec.position.x, y: spec.position.y },
        velocity: { vx: 0, vy: 0 },
        hp: spec.maxHp,
        state: 'alive',
        mode: 'rest',
        targetId: null,
        rescueProgressMs: 0,
        boopReadyAtSimMs: 0,
        alertUntilSimMs: 0
      };
      companions.set(next.id, next);
      return next;
    },
    spawnEnemy(spec): Enemy {
      const guaranteedDrops = [...(spec.guaranteedDrops ?? [])];
      const next: Enemy = {
        id: makeId(),
        kind: 'enemy',
        archetypeId: spec.archetypeId,
        radius: spec.radius,
        contactBox: { width: spec.contactBox.width, height: spec.contactBox.height },
        behavior: spec.behavior,
        guaranteedDrops,
        dropTable: [...(spec.dropTable ?? [])],
        carrierDropMarker: guaranteedDrops.length > 0 ? 'reward' : null,
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
        ownerTeamPlayerId: spec.ownerTeamPlayerId ?? null,
        spawnInputSequence: spec.spawnInputSequence ?? null,
        spawnedAtPredictorSimMs: null,
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
        ownerTeamPlayerId: spec.ownerTeamPlayerId ?? null,
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
      return players.values().next().value ?? null;
    },
    playerById(id): Player | null {
      return players.get(id) ?? null;
    },
    companion(): Companion | null {
      return companions.values().next().value ?? null;
    },
    companionById(id): Companion | null {
      return companions.get(id) ?? null;
    },
    companionByOwnerPlayerId(playerId): Companion | null {
      return companionByOwnerPlayerId(companions, playerId);
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
    players(): IterableIterator<Player> {
      return players.values();
    },
    companions(): IterableIterator<Companion> {
      return companions.values();
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
    removePlayer(id): boolean {
      return players.delete(id);
    },
    removeCompanion(id): boolean {
      if (id !== undefined) return companions.delete(id);
      const first = companions.keys().next().value;
      if (first === undefined) return false;
      return companions.delete(first);
    },
    removeCompanionByOwnerPlayerId(playerId): boolean {
      const companion = companionByOwnerPlayerId(companions, playerId);
      if (companion === null) return false;
      return companions.delete(companion.id);
    },
    clear(): void {
      players.clear();
      companions.clear();
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

function companionByOwnerPlayerId(
  companions: ReadonlyMap<EntityId, Companion>,
  playerId: string
): Companion | null {
  for (const companion of companions.values()) {
    if (companion.ownerPlayerId === playerId) return companion;
  }
  return null;
}

function assertNever(value: never): never {
  throw new Error(`unhandled entity-store value: ${String(value)}`);
}
