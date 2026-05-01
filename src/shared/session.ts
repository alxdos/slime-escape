import type { DropTableEntry, RetaliationPolicy } from './content/enemies.js';

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

export type Loadout = Readonly<{
  weapons: ReadonlyArray<string>;
  selectedIndex: number | null;
}>;

export type PlayerConfig = PlayerSpawn &
  Readonly<{
    id: string;
    loadout: Loadout | null;
    companion: CompanionSessionConfig | null;
  }>;

export type NonEmptyReadonlyArray<T> = readonly [T, ...T[]];

export type EncounterType = 'wave' | 'break' | 'boss' | 'survivalTimer' | 'sandbox' | 'portal';

export type EmptySpawnPlan = Readonly<{ kind: 'empty' }>;

export type SpawnOverride = Readonly<{
  guaranteedDrops?: ReadonlyArray<string>;
  dropTable?: ReadonlyArray<DropTableEntry>;
  retaliation?: RetaliationPolicy;
  loadout?: Loadout;
}>;

export type StaticSpawn = Readonly<{
  archetypeId: string;
  position: Vec2;
  override?: SpawnOverride;
}>;

export type StaticSpawnPlan = Readonly<{
  kind: 'static';
  spawns: ReadonlyArray<StaticSpawn>;
}>;

export type WaveSpawn = Readonly<{
  archetypeId: string;
  override?: SpawnOverride;
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

export type CompanionMovementConfig = Readonly<{
  maxSpeed: number;
  acceleration: number;
  orbitRadius: number;
}>;

export type CompanionThreatConfig = Readonly<{
  acquireRadius: number;
  releaseRadius: number;
}>;

export type CompanionBoopConfig = Readonly<{
  radius: number;
  impulse: number;
  durationMs: number;
  cooldownMs: number;
}>;

export type CompanionRescueConfig = Readonly<{
  radius: number;
  durationMs: number;
  reviveHpFraction: number;
}>;

export type CompanionSessionConfig = Readonly<{
  petArchetypeId: string;
  maxHp: number;
  contactBox: ContactBox;
  movement: CompanionMovementConfig;
  threat: CompanionThreatConfig;
  weaponLoadout: Loadout | null;
  boop: CompanionBoopConfig;
  rescue: CompanionRescueConfig;
}>;

export type PlayerCoopReviveConfig = Readonly<{
  radius: number;
  durationMs: number;
  reviveHpFraction: number;
}>;

export type DamageRules = Readonly<{
  slimeFriendlyFire: boolean;
  playerVsPlayerDamage: boolean;
}>;

export type AimAssistRule = Readonly<{
  enabled: boolean;
  maxAngleRadians: number;
  maxDistance: number;
  strength: number;
}>;

export type SessionRules = Readonly<{
  damage: DamageRules;
  aimAssist: AimAssistRule;
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
  introDurationMs: number;
  name: string | null;
  text: string | null;
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
  | { kind: 'dungeon' }
  | { kind: 'scenarioCondition' };

export type LossCondition =
  | { kind: 'none' }
  | { kind: 'playerDeath' }
  | { kind: 'allPlayersDead' }
  | { kind: 'respawnOnDeath' }
  | { kind: 'timerOrScenarioFail' }
  | { kind: 'forced' };

export type Modifier = never;

export type BaseSessionDefinition = Readonly<{
  id: string;
  seed: number;
  arena: ArenaConfig;
  backgrounds: ReadonlyArray<SessionBackground>;
  musicSampleId: string | null;
  modifiers: ReadonlyArray<Modifier>;
  rules: SessionRules;
  encounters: ReadonlyArray<EncounterDefinition>;
  winCondition: WinCondition;
  lossCondition: LossCondition;
  playerCoopRevive: PlayerCoopReviveConfig | null;
  uiMeta: null;
}>;

export type StaticSessionDefinition = BaseSessionDefinition &
  Readonly<{
    players: NonEmptyReadonlyArray<PlayerConfig>;
    dynamicRoster: false;
  }>;

export type DynamicSessionDefinition = BaseSessionDefinition &
  Readonly<{
    players: ReadonlyArray<PlayerConfig>;
    dynamicRoster: true;
  }>;

export type SessionDefinition = StaticSessionDefinition | DynamicSessionDefinition;
