export type Vec2 = Readonly<{ x: number; y: number }>;

export type ArenaConfig = Readonly<{
  width: number;
  height: number;
}>;

export type PlayerSpawn = Readonly<{
  position: Vec2;
  radius: number;
  maxSpeed: number;
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

export type SpawnPlan = EmptySpawnPlan | StaticSpawnPlan;

export type Loadout = Readonly<{
  primaryWeaponArchetypeId: string;
}>;

export type ZoneBehavior = { kind: 'disabled' };

export type Objective = never;

export type TransitionRules = { kind: 'never' };

export type EncounterDefinition = Readonly<{
  id: string;
  type: EncounterType;
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
  modifiers: ReadonlyArray<Modifier>;
  rules: null;
  encounters: ReadonlyArray<EncounterDefinition>;
  winCondition: WinCondition;
  lossCondition: LossCondition;
  uiMeta: null;
}>;
