export type SessionResultOutcome = 'win' | 'loss';

export type SessionResultSummary = Readonly<{
  outcome: SessionResultOutcome;
  durationMs: number;
  progress: ResultProgressSummary;
  kills: ResultKillSummary;
  drops: ResultDropSummary;
  boss: ResultBossSummary | null;
  defeat: ResultDefeatSummary | null;
}>;

export type ResultProgressSummary = Readonly<{
  percent: number | null;
  completedObjectiveEncounters: number;
  totalObjectiveEncounters: number;
  completedWaves: number;
  totalWaves: number;
  activeEncounterId: string | null;
  activeEncounterIndex: number | null;
}>;

export type ResultKillSummary = Readonly<{
  total: number;
  byArchetype: ReadonlyArray<ResultKillByArchetypeSummary>;
}>;

export type ResultKillByArchetypeSummary = Readonly<{
  entityKind: 'enemy' | 'boss';
  archetypeId: string;
  count: number;
}>;

export type ResultDropSummary = Readonly<{
  pickedUpTotal: number;
}>;

export type ResultBossSummary = Readonly<{
  archetypeId: string;
  encountered: boolean;
  defeated: boolean;
  hp: number;
  maxHp: number;
  hpPercent: number;
}>;

export type ResultDefeatSummary = Readonly<{
  cause: ResultDefeatCause;
}>;

export type ResultDefeatCause =
  | Readonly<{
      kind: 'projectile';
      ownerKind: 'player' | 'enemy' | 'boss';
      weaponArchetypeId: string;
    }>
  | Readonly<{
      kind: 'explosion';
      ownerKind: 'player' | 'enemy' | 'boss';
      weaponArchetypeId: string;
    }>
  | Readonly<{
      kind: 'enemyContact';
      sourceEntityId: number;
      sourceEntityKind: 'enemy' | 'boss' | null;
      archetypeId: string | null;
    }>
  | Readonly<{
      kind: 'boss';
      bossId: number;
      bossArchetypeId: string | null;
      attackId: string;
    }>
  | Readonly<{
      kind: 'fieldEffect';
      fieldEffectId: number;
      archetypeId: string;
    }>
  | Readonly<{
      kind: 'statusEffect';
      statusKind: string;
      sourceEntityId: number | null;
    }>
  | Readonly<{
      kind: 'environment';
      tag: string;
    }>;
