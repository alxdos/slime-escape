import type {
  ArenaConfig,
  CompanionSessionConfig,
  EncounterDefinition,
  NonEmptyReadonlyArray,
  PlayerConfig,
  SessionBackground,
  SessionRules,
  StaticSpawnPlan,
  Vec2,
  WaveSpawnPlan,
  WinCondition,
  LossCondition,
  EmptySpawnPlan
} from '../session';

import { SESSION_PRESET_TEMPLATES } from './sessions.generated';

export { SESSION_PRESET_TEMPLATES };

export type BossSpawnPositionTemplate = Vec2 | 'top-center';

export type BossSpawnPlanTemplate = Readonly<{
  kind: 'boss';
  bossArchetypeId: string;
  position: BossSpawnPositionTemplate;
  bossEdgeMargin: number;
}>;

export type SessionPresetSpawnPlanTemplate =
  | EmptySpawnPlan
  | StaticSpawnPlan
  | WaveSpawnPlan
  | BossSpawnPlanTemplate;

export type SessionPresetEncounterTemplate = Omit<EncounterDefinition, 'spawnPlan'> &
  Readonly<{
    spawnPlan: SessionPresetSpawnPlanTemplate;
  }>;

export type SessionPresetCompanionTemplate = Omit<CompanionSessionConfig, 'petArchetypeId'>;

export type BaseSessionPresetTemplate = Readonly<{
  presetId: string;
  displayName: string;
  description: string;
  visibleInMenu: boolean;
  order: number;
  arena: ArenaConfig;
  companion: SessionPresetCompanionTemplate | null;
  backgrounds: ReadonlyArray<SessionBackground>;
  musicSampleId: string | null;
  rules: SessionRules;
  winCondition: WinCondition;
  lossCondition: LossCondition;
  encounters: ReadonlyArray<SessionPresetEncounterTemplate>;
}>;

export type StaticSessionPresetTemplate = BaseSessionPresetTemplate &
  Readonly<{
    players: NonEmptyReadonlyArray<PlayerConfig>;
    dynamicRoster: false;
  }>;

export type DynamicSessionPresetTemplate = BaseSessionPresetTemplate &
  Readonly<{
    players: ReadonlyArray<PlayerConfig>;
    dynamicRoster: true;
  }>;

export type SessionPresetTemplate = StaticSessionPresetTemplate | DynamicSessionPresetTemplate;

export type ModePresetId = keyof typeof SESSION_PRESET_TEMPLATES;

export type ModePreset = Readonly<{
  id: ModePresetId;
}>;

export function resolveModePreset(presetId: ModePresetId): ModePreset {
  return { id: presetId };
}

export const SANDBOX_PRESET = resolveModePreset('sandbox');
export const SANDBOX_WITH_COMBAT_PRESET = resolveModePreset('sandbox-with-combat');
export const TRAINING_PRESET = resolveModePreset('training');
export const CAMPAIGN_PRESET = resolveModePreset('campaign-normal');
export const DUNGEON_PRESET = resolveModePreset('dungeon');
export const PUBLIC_ARENA_PRESET = resolveModePreset('public-arena');

export type PlayableModeEntry = Readonly<{
  presetId: ModePresetId;
  displayName: string;
  description: string;
  order: number;
}>;

export function getPlayableModeCatalog(): ReadonlyArray<PlayableModeEntry> {
  return Object.values(SESSION_PRESET_TEMPLATES)
    .filter((preset) => preset.visibleInMenu)
    .sort((left, right) => left.order - right.order)
    .map((preset) => ({
      presetId: preset.presetId,
      displayName: preset.displayName,
      description: preset.description,
      order: preset.order
    }));
}
