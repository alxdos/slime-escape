export type EntitySnapshot = Readonly<{
  id: number;
  x: number;
  y: number;
}>;

export type Snapshot = Readonly<{
  simTimeMs: number;
  entities: ReadonlyArray<EntitySnapshot>;
}>;
