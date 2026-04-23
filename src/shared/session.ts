export type Vec2 = Readonly<{ x: number; y: number }>;

export type ArenaConfig = Readonly<{
  width: number;
  height: number;
}>;

export type ContactBox = Readonly<{
  width: number;
  height: number;
}>;

export type PlayerSpawn = Readonly<{
  position: Vec2;
  radius: number;
  contactBox: ContactBox;
  maxSpeed: number;
  maxHp: number;
}>;

export type EncounterType = 'wave' | 'break' | 'boss' | 'survivalTimer' | 'sandbox';

export type EmptySpawnPlan = Readonly<{ kind: 'empty' }>;

export type StaticSpawn = Readonly<{
  archetypeId: string;
  position: Vec2;
}>;

export type StaticSpawnPlan = Readonly<{
  kind: 'static';
  spawns: ReadonlyArray<StaticSpawn>;
}>;

export type WaveSpawn = Readonly<{
  archetypeId: string;
}>;

export type WaveSpawnPlan = Readonly<{
  kind: 'wave';
  spawns: ReadonlyArray<WaveSpawn>;
  spawnIntervalMs: number;
  maxAlive: number;
  edgeMargin?: number;
}>;

export type BossSpawnPlan = Readonly<{
  kind: 'boss';
  bossArchetypeId: string;
  position: Vec2;
}>;

export type SpawnPlan = EmptySpawnPlan | StaticSpawnPlan | WaveSpawnPlan | BossSpawnPlan;

export type Loadout = Readonly<{
  primaryWeaponArchetypeId: string;
}>;

export type SessionBackground = Readonly<{
  id: string;
  imageUrl: string;
}>;

export type ZoneBehavior =
  | Readonly<{ kind: 'disabled' }>
  | Readonly<{
      kind: 'shrinkLinear';
      fromMargin: number;
      toMargin: number;
      durationMs: number;
    }>
  | Readonly<{
      kind: 'expandLinear';
      fromMargin: number;
      toMargin: number;
      durationMs: number;
    }>;

export type Objective = never;

export type TransitionNext = 'sequential' | Readonly<{ kind: 'byId'; id: string }>;

export type TransitionRules =
  | Readonly<{ kind: 'never'; next: TransitionNext }>
  | Readonly<{ kind: 'allEnemiesCleared'; next: TransitionNext }>
  | Readonly<{ kind: 'timer'; durationMs: number; next: TransitionNext }>;

export type EncounterDefinition = Readonly<{
  id: string;
  type: EncounterType;
  backgroundId: string | null;
  spawnPlan: SpawnPlan;
  zoneBehavior: ZoneBehavior;
  objectives: ReadonlyArray<Objective>;
  rewardRules: null;
  transitionRules: TransitionRules;
  tuning: null;
}>;

export type WinCondition =
  | { kind: 'none' }
  | { kind: 'allEncountersComplete' }
  | { kind: 'bossDefeated' }
  | { kind: 'scenarioCondition' };

export type LossCondition =
  | { kind: 'none' }
  | { kind: 'playerDeath' }
  | { kind: 'timerOrScenarioFail' }
  | { kind: 'forced' };

export type Modifier = never;

export type SessionDefinition = Readonly<{
  id: string;
  seed: number;
  arena: ArenaConfig;
  player: PlayerSpawn;
  loadout: Loadout | null;
  backgrounds: ReadonlyArray<SessionBackground>;
  modifiers: ReadonlyArray<Modifier>;
  rules: null;
  encounters: ReadonlyArray<EncounterDefinition>;
  winCondition: WinCondition;
  lossCondition: LossCondition;
  uiMeta: null;
}>;
