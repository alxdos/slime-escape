import type { EncounterType } from './session';

export type PlayerSnapshot = Readonly<{
  id: number;
  kind: 'player';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  statusEffects?: ReadonlyArray<StatusEffectSnapshot>;
}>;

export type EnemySnapshot = Readonly<{
  id: number;
  kind: 'enemy';
  archetypeId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  statusEffects?: ReadonlyArray<StatusEffectSnapshot>;
}>;

export type ProjectileSnapshot = Readonly<{
  id: number;
  kind: 'projectile';
  weaponArchetypeId: string;
  ownerKind: 'player' | 'enemy' | 'boss';
  x: number;
  y: number;
  state: 'flying' | 'grounded';
  visualState: Readonly<{
    angleRadians: number;
    spinRadians: number;
    pulsePhase: number;
  }>;
  explosionRadius: number | null;
  detonateAtSimMs: number | null;
}>;

export type DropSnapshot = Readonly<{
  id: number;
  kind: 'drop';
  archetypeId: string;
  x: number;
  y: number;
}>;

export type BossSnapshot = Readonly<{
  id: number;
  kind: 'boss';
  archetypeId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  phaseIndex: number;
  phaseId: string;
  activeAttackIds: ReadonlyArray<string>;
  statusEffects?: ReadonlyArray<StatusEffectSnapshot>;
}>;

export type StatusEffectSnapshot = Readonly<{
  kind: 'burn' | 'slow' | 'poison';
  expiresAtSimMs: number;
}>;

export type FieldEffectSnapshot = Readonly<{
  id: number;
  kind: 'fieldEffect';
  archetypeId: string;
  x: number;
  y: number;
  radius: number;
  expiresAtSimMs: number;
}>;

export type EntitySnapshot =
  | PlayerSnapshot
  | EnemySnapshot
  | ProjectileSnapshot
  | DropSnapshot
  | BossSnapshot
  | FieldEffectSnapshot;

export type EntityKind = EntitySnapshot['kind'];

export type EncounterSnapshot = Readonly<{
  id: string;
  type: EncounterType;
  index: number;
  elapsedMs: number;
}>;

export type ZoneMode = 'disabled' | 'shrink' | 'expand';

export type ZoneSnapshot = Readonly<{
  mode: ZoneMode;
  margin: number;
}>;

export type WaveProgressSnapshot = Readonly<{
  dispatched: number;
  total: number;
  alive: number;
}>;

export type BossHudSnapshot = Readonly<{
  entityId: number;
  phaseIndex: number;
  phaseId: string;
  hp: number;
  maxHp: number;
  activeAttackIds: ReadonlyArray<string>;
}>;

export type WeaponHudSnapshot = Readonly<{
  selectedIndex: number | null;
  weapons: ReadonlyArray<
    Readonly<{
      index: number;
      weaponArchetypeId: string;
      cooldownReadyAtSimMs: number;
      overdriveUntilSimMs: number | null;
    }>
  >;
}>;

export type Snapshot = Readonly<{
  simTimeMs: number;
  entities: ReadonlyArray<EntitySnapshot>;
  encounter: EncounterSnapshot | null;
  zone: ZoneSnapshot;
  waveProgress: WaveProgressSnapshot | null;
  bossHud: BossHudSnapshot | null;
  weaponHud: WeaponHudSnapshot | null;
}>;
