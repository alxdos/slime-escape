export type PlayerSnapshot = Readonly<{
  id: number;
  kind: 'player';
  x: number;
  y: number;
}>;

export type EnemySnapshot = Readonly<{
  id: number;
  kind: 'enemy';
  archetypeId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}>;

export type ProjectileSnapshot = Readonly<{
  id: number;
  kind: 'projectile';
  weaponArchetypeId: string;
  ownerKind: 'player' | 'enemy';
  x: number;
  y: number;
}>;

export type EntitySnapshot = PlayerSnapshot | EnemySnapshot | ProjectileSnapshot;

export type EntityKind = EntitySnapshot['kind'];

export type Snapshot = Readonly<{
  simTimeMs: number;
  entities: ReadonlyArray<EntitySnapshot>;
}>;
