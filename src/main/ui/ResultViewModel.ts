import type { BossArchetype } from '../../shared/content/bosses';
import { BOSS_ARCHETYPES } from '../../shared/content/bosses';
import type { EnemyArchetype } from '../../shared/content/enemies';
import { ENEMY_ARCHETYPES } from '../../shared/content/enemies';
import { assertNever } from '../../shared/protocol';
import type { SessionDefinition } from '../../shared/session';
import type {
  ResultDefeatCause,
  ResultKillByArchetypeSummary,
  SessionResultOutcome,
  SessionResultSummary
} from '../../shared/sessionResult';
import { BOSS_VISUALS } from '../render/bossVisuals';
import { ENEMY_VISUALS } from '../render/enemyVisuals';
import type { SpriteVisualSpec } from '../render/SpriteVisualSpec';

import {
  deriveResultEscapeProgressPathViewModel,
  type EscapeProgressPathViewModel
} from './EscapeProgressPathViewModel';

export type ResultStatViewModel = Readonly<{
  id: string;
  label: string;
  value: string;
}>;

export type ResultKillRowViewModel = Readonly<{
  id: string;
  entityKind: 'enemy' | 'boss';
  archetypeId: string;
  label: string;
  count: number;
  iconUrl: string;
}>;

export type ResultBossViewModel = Readonly<{
  archetypeId: string;
  label: string;
  iconUrl: string;
  text: string;
  defeated: boolean;
  hpPercent: number;
}>;

export type ResultEscapePathViewModel = Readonly<{
  path: Extract<EscapeProgressPathViewModel, { kind: 'path' }>;
  title: string;
  summaryText: string;
  detailText: string | null;
}>;

export type ResultViewModel = Readonly<{
  outcome: SessionResultOutcome;
  title: string;
  subtitle: string;
  primaryStats: ReadonlyArray<ResultStatViewModel>;
  killRows: ReadonlyArray<ResultKillRowViewModel>;
  escapePath: ResultEscapePathViewModel | null;
  boss: ResultBossViewModel | null;
  defeatCause: string | null;
}>;

export type ResultViewModelRegistries = Readonly<{
  enemies?: Readonly<Record<string, EnemyArchetype>>;
  bosses?: Readonly<Record<string, BossArchetype>>;
  enemyVisuals?: Readonly<Record<string, SpriteVisualSpec>>;
  bossVisuals?: Readonly<Record<string, SpriteVisualSpec>>;
}>;

export function buildResultViewModel(
  session: SessionDefinition,
  summary: SessionResultSummary,
  registries: ResultViewModelRegistries = {}
): ResultViewModel {
  const enemies = registries.enemies ?? ENEMY_ARCHETYPES;
  const bosses = registries.bosses ?? BOSS_ARCHETYPES;
  const enemyVisuals = registries.enemyVisuals ?? ENEMY_VISUALS;
  const bossVisuals = registries.bossVisuals ?? BOSS_VISUALS;
  const outcome = summary.outcome;
  const killRows = summary.kills.byArchetype
    .filter((entry) => entry.count > 0)
    .map((entry) => buildKillRow(entry, enemies, bosses, enemyVisuals, bossVisuals));

  return {
    outcome,
    title: outcome === 'win' ? 'Победа!' : 'Забег окончен',
    subtitle:
      outcome === 'win'
        ? 'Ты выбрался из мира слаймов'
        : defeatSubtitle(summary.progress.percent),
    primaryStats: buildPrimaryStats(session, summary),
    killRows,
    escapePath: buildEscapePathViewModel(session, summary),
    boss: buildBossViewModel(summary, bosses, bossVisuals),
    defeatCause:
      outcome === 'loss' && summary.defeat !== null
        ? describeDefeatCause(summary.defeat.cause, enemies, bosses)
        : null
  };
}

function buildEscapePathViewModel(
  session: SessionDefinition,
  summary: SessionResultSummary
): ResultEscapePathViewModel | null {
  const path = deriveResultEscapeProgressPathViewModel(session, summary);
  if (path.kind === 'hidden') {
    return null;
  }

  if (summary.outcome === 'win') {
    return {
      path,
      title: 'Карта Побега',
      summaryText: 'Путь до флага пройден',
      detailText: null
    };
  }

  const reachedWave = path.activeWaveIndex ?? path.completedWaves;
  const remainingWaves = Math.max(0, path.totalWaves - reachedWave);
  return {
    path,
    title: 'Карта Побега',
    summaryText: `Ты добрался до волны ${reachedWave} из ${path.totalWaves}`,
    detailText:
      path.stop.kind === 'loss' && path.stop.anchor === 'beforeFlag'
        ? 'Флаг был уже рядом'
        : `До выхода оставалось ${formatWaveCount(remainingWaves)}`
  };
}

function buildPrimaryStats(
  session: SessionDefinition,
  summary: SessionResultSummary
): ReadonlyArray<ResultStatViewModel> {
  const stats: ResultStatViewModel[] = [
    {
      id: 'progress',
      label: 'Прогресс',
      value:
        summary.progress.percent === null
          ? progressFallback(session)
          : `${summary.progress.percent}%`
    },
    {
      id: 'duration',
      label: 'Время',
      value: formatDuration(summary.durationMs)
    },
    {
      id: 'total-kills',
      label: 'Убито слаймов',
      value: String(summary.kills.total)
    }
  ];

  if (summary.progress.totalWaves > 0) {
    stats.push({
      id: 'waves',
      label: 'Волна',
      value: `${summary.progress.completedWaves} / ${summary.progress.totalWaves}`
    });
  }

  if (summary.drops.pickedUpTotal > 0) {
    stats.push({
      id: 'drops',
      label: 'Собрано усилений',
      value: String(summary.drops.pickedUpTotal)
    });
  }

  return stats;
}

function buildKillRow(
  entry: ResultKillByArchetypeSummary,
  enemies: Readonly<Record<string, EnemyArchetype>>,
  bosses: Readonly<Record<string, BossArchetype>>,
  enemyVisuals: Readonly<Record<string, SpriteVisualSpec>>,
  bossVisuals: Readonly<Record<string, SpriteVisualSpec>>
): ResultKillRowViewModel {
  switch (entry.entityKind) {
    case 'enemy': {
      const archetype = requireRegistryEntry(enemies, entry.archetypeId, 'enemy archetype');
      const visual = requireRegistryEntry(enemyVisuals, entry.archetypeId, 'enemy visual');
      return {
        id: `enemy:${entry.archetypeId}`,
        entityKind: 'enemy',
        archetypeId: entry.archetypeId,
        label: archetype.displayName,
        count: entry.count,
        iconUrl: visual.image
      };
    }
    case 'boss': {
      const archetype = requireRegistryEntry(bosses, entry.archetypeId, 'boss archetype');
      const visual = requireRegistryEntry(bossVisuals, entry.archetypeId, 'boss visual');
      return {
        id: `boss:${entry.archetypeId}`,
        entityKind: 'boss',
        archetypeId: entry.archetypeId,
        label: archetype.displayName,
        count: entry.count,
        iconUrl: visual.image
      };
    }
    default:
      return assertNever(entry.entityKind);
  }
}

function buildBossViewModel(
  summary: SessionResultSummary,
  bosses: Readonly<Record<string, BossArchetype>>,
  bossVisuals: Readonly<Record<string, SpriteVisualSpec>>
): ResultBossViewModel | null {
  if (summary.boss === null || !summary.boss.encountered) return null;
  const archetype = requireRegistryEntry(bosses, summary.boss.archetypeId, 'boss archetype');
  const visual = requireRegistryEntry(bossVisuals, summary.boss.archetypeId, 'boss visual');
  const defeated = summary.boss.defeated;
  return {
    archetypeId: summary.boss.archetypeId,
    label: archetype.displayName,
    iconUrl: visual.image,
    text: defeated ? 'Босс повержен' : `Босс: осталось ${summary.boss.hpPercent}% HP`,
    defeated,
    hpPercent: summary.boss.hpPercent
  };
}

function describeDefeatCause(
  cause: ResultDefeatCause,
  enemies: Readonly<Record<string, EnemyArchetype>>,
  bosses: Readonly<Record<string, BossArchetype>>
): string {
  switch (cause.kind) {
    case 'enemyContact':
      if (cause.sourceEntityKind === 'enemy' && cause.archetypeId !== null) {
        return `Добил: ${requireRegistryEntry(enemies, cause.archetypeId, 'enemy archetype').displayName}`;
      }
      if (cause.sourceEntityKind === 'boss' && cause.archetypeId !== null) {
        return `Добил: ${requireRegistryEntry(bosses, cause.archetypeId, 'boss archetype').displayName}`;
      }
      return 'Причина: контактный урон';
    case 'projectile':
    case 'explosion':
      return 'Причина: снаряд';
    case 'boss':
      if (cause.bossArchetypeId !== null) {
        return `Добил: ${requireRegistryEntry(bosses, cause.bossArchetypeId, 'boss archetype').displayName}`;
      }
      return 'Причина: атака босса';
    case 'fieldEffect':
      return 'Причина: опасная зона';
    case 'statusEffect':
      return 'Причина: эффект статуса';
    case 'environment':
      return 'Причина: окружение';
    default:
      return assertNever(cause);
  }
}

function defeatSubtitle(progressPercent: number | null): string {
  if (progressPercent !== null && progressPercent >= 80) {
    return 'Побег почти удался';
  }
  return 'Слизни снова сомкнули ловушку';
}

function progressFallback(session: SessionDefinition): string {
  if (session.winCondition.kind === 'none' && session.lossCondition.kind === 'none') {
    return 'Свободный режим';
  }
  return 'Без процента';
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatWaveCount(count: number): string {
  const remainder10 = count % 10;
  const remainder100 = count % 100;
  const noun =
    remainder10 === 1 && remainder100 !== 11
      ? 'волна'
      : remainder10 >= 2 && remainder10 <= 4 && (remainder100 < 12 || remainder100 > 14)
        ? 'волны'
        : 'волн';
  return `${count} ${noun}`;
}

function requireRegistryEntry<T>(
  registry: Readonly<Record<string, T>>,
  id: string,
  label: string
): T {
  const entry = registry[id];
  if (entry === undefined) {
    throw new Error(`result view model missing ${label}: ${id}`);
  }
  return entry;
}
