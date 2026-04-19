export type EntityKind = 'player';

export type EntitySnapshot = Readonly<{
  id: number;
  kind: EntityKind;
  x: number;
  y: number;
}>;

export type Snapshot = Readonly<{
  simTimeMs: number;
  entities: ReadonlyArray<EntitySnapshot>;
}>;
