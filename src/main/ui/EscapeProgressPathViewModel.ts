import type { SessionDefinition } from '../../shared/session';
import type { SessionResultSummary } from '../../shared/sessionResult';
import type { EncounterSnapshot, Snapshot } from '../../shared/snapshot';

export type EscapeProgressPathPresentationMode = 'compact' | 'expandedBreak' | 'result';

export type EscapeProgressPathPointState = 'completed' | 'active' | 'upcoming' | 'stopped';

export type EscapeProgressPathPointViewModel = Readonly<{
  index: number;
  state: EscapeProgressPathPointState;
  label: string;
}>;

export type EscapeProgressPathStop =
  | Readonly<{ kind: 'none' }>
  | Readonly<{ kind: 'loss'; anchor: 'activeWave' | 'afterCompletedWaves' | 'beforeFlag' }>;

export type EscapeProgressPathViewModel =
  | Readonly<{ kind: 'hidden' }>
  | Readonly<{
      kind: 'path';
      presentation: EscapeProgressPathPresentationMode;
      totalWaves: number;
      completedWaves: number;
      activeWaveIndex: number | null;
      points: ReadonlyArray<EscapeProgressPathPointViewModel>;
      stop: EscapeProgressPathStop;
      flagState: 'pending' | 'reached';
    }>;

const HIDDEN_ESCAPE_PROGRESS_PATH_VIEW_MODEL: EscapeProgressPathViewModel = Object.freeze({
  kind: 'hidden'
});

export function deriveLiveEscapeProgressPathViewModel(
  session: SessionDefinition,
  snapshot: Snapshot | null
): EscapeProgressPathViewModel {
  if (session.winCondition.kind === 'dungeon') {
    return HIDDEN_ESCAPE_PROGRESS_PATH_VIEW_MODEL;
  }

  const totalWaves = countWaves(session);
  if (totalWaves === 0) {
    return HIDDEN_ESCAPE_PROGRESS_PATH_VIEW_MODEL;
  }

  const encounter = snapshot?.encounter ?? null;
  if (encounter === null) {
    return HIDDEN_ESCAPE_PROGRESS_PATH_VIEW_MODEL;
  }

  const resolved = resolveEncounterDefinition(session, encounter);
  if (resolved === null) {
    return HIDDEN_ESCAPE_PROGRESS_PATH_VIEW_MODEL;
  }

  const completedWaves = countWavesBefore(session, resolved.index);
  const activeWaveIndex =
    resolved.definition.type === 'wave' ? completedWaves + 1 : null;
  return buildPathViewModel({
    presentation: resolved.definition.type === 'break' ? 'expandedBreak' : 'compact',
    totalWaves,
    completedWaves,
    activeWaveIndex,
    stop: { kind: 'none' },
    flagState: 'pending'
  });
}

export function deriveResultEscapeProgressPathViewModel(
  session: SessionDefinition,
  summary: SessionResultSummary
): EscapeProgressPathViewModel {
  if (session.winCondition.kind === 'dungeon' || summary.dungeon !== null) {
    return HIDDEN_ESCAPE_PROGRESS_PATH_VIEW_MODEL;
  }

  const totalWaves = summary.progress.totalWaves;
  if (totalWaves === 0) {
    return HIDDEN_ESCAPE_PROGRESS_PATH_VIEW_MODEL;
  }

  if (summary.outcome === 'win') {
    return buildPathViewModel({
      presentation: 'result',
      totalWaves,
      completedWaves: totalWaves,
      activeWaveIndex: null,
      stop: { kind: 'none' },
      flagState: 'reached'
    });
  }

  const completedWaves = clampWholeNumber(summary.progress.completedWaves, 0, totalWaves);
  const activeEncounter = resolveResultEncounter(session, summary);
  const activeWaveIndex =
    activeEncounter?.definition.type === 'wave'
      ? countWavesBefore(session, activeEncounter.index) + 1
      : null;
  const stop = deriveLossStop(totalWaves, completedWaves, activeWaveIndex);

  return buildPathViewModel({
    presentation: 'result',
    totalWaves,
    completedWaves,
    activeWaveIndex,
    stop,
    flagState: 'pending'
  });
}

function buildPathViewModel(input: {
  presentation: EscapeProgressPathPresentationMode;
  totalWaves: number;
  completedWaves: number;
  activeWaveIndex: number | null;
  stop: EscapeProgressPathStop;
  flagState: 'pending' | 'reached';
}): EscapeProgressPathViewModel {
  const completedWaves = clampWholeNumber(input.completedWaves, 0, input.totalWaves);
  return {
    kind: 'path',
    presentation: input.presentation,
    totalWaves: input.totalWaves,
    completedWaves,
    activeWaveIndex: input.activeWaveIndex,
    points: buildPoints(input.totalWaves, completedWaves, input.activeWaveIndex, input.stop),
    stop: input.stop,
    flagState: input.flagState
  };
}

function buildPoints(
  totalWaves: number,
  completedWaves: number,
  activeWaveIndex: number | null,
  stop: EscapeProgressPathStop
): ReadonlyArray<EscapeProgressPathPointViewModel> {
  return Array.from({ length: totalWaves }, (_, offset) => {
    const index = offset + 1;
    const state = derivePointState(index, completedWaves, activeWaveIndex, stop);
    return {
      index,
      state,
      label: `Wave ${index}`
    };
  });
}

function derivePointState(
  index: number,
  completedWaves: number,
  activeWaveIndex: number | null,
  stop: EscapeProgressPathStop
): EscapeProgressPathPointState {
  if (stop.kind === 'loss' && stop.anchor === 'activeWave' && activeWaveIndex === index) {
    return 'stopped';
  }
  if (index <= completedWaves) {
    return 'completed';
  }
  if (activeWaveIndex === index) {
    return 'active';
  }
  return 'upcoming';
}

function deriveLossStop(
  totalWaves: number,
  completedWaves: number,
  activeWaveIndex: number | null
): EscapeProgressPathStop {
  if (activeWaveIndex !== null) {
    return { kind: 'loss', anchor: 'activeWave' };
  }
  if (completedWaves >= totalWaves) {
    return { kind: 'loss', anchor: 'beforeFlag' };
  }
  return { kind: 'loss', anchor: 'afterCompletedWaves' };
}

function resolveEncounterDefinition(
  session: SessionDefinition,
  encounter: EncounterSnapshot
): Readonly<{ definition: SessionDefinition['encounters'][number]; index: number }> | null {
  const fromIndex = session.encounters[encounter.index];
  if (fromIndex?.id === encounter.id) {
    return { definition: fromIndex, index: encounter.index };
  }

  const index = session.encounters.findIndex((definition) => definition.id === encounter.id);
  if (index < 0) {
    return null;
  }
  return { definition: session.encounters[index]!, index };
}

function resolveResultEncounter(
  session: SessionDefinition,
  summary: SessionResultSummary
): Readonly<{ definition: SessionDefinition['encounters'][number]; index: number }> | null {
  const activeIndex = summary.progress.activeEncounterIndex;
  if (activeIndex !== null) {
    const fromIndex = session.encounters[activeIndex];
    if (fromIndex !== undefined && fromIndex.id === summary.progress.activeEncounterId) {
      return { definition: fromIndex, index: activeIndex };
    }
  }

  const activeId = summary.progress.activeEncounterId;
  if (activeId === null) {
    return null;
  }

  const index = session.encounters.findIndex((definition) => definition.id === activeId);
  if (index < 0) {
    return null;
  }
  return { definition: session.encounters[index]!, index };
}

function countWaves(session: SessionDefinition): number {
  return session.encounters.filter((encounter) => encounter.type === 'wave').length;
}

function countWavesBefore(session: SessionDefinition, encounterIndex: number): number {
  return session.encounters
    .slice(0, Math.max(0, encounterIndex))
    .filter((encounter) => encounter.type === 'wave').length;
}

function clampWholeNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}
