import type { SessionResultOutcome, SessionResultSummary } from '../sessionResult';

export function makeTestResultSummary(
  outcome: SessionResultOutcome,
  durationMs: number,
  options: Readonly<{ totalKills?: number }> = {}
): SessionResultSummary {
  return {
    outcome,
    durationMs,
    progress: {
      percent: outcome === 'win' ? 100 : null,
      completedObjectiveEncounters: 0,
      totalObjectiveEncounters: 0,
      completedWaves: 0,
      totalWaves: 0,
      activeEncounterId: null,
      activeEncounterIndex: null
    },
    kills: {
      total: options.totalKills ?? 0,
      byArchetype: []
    },
    drops: {
      pickedUpTotal: 0
    },
    boss: null,
    defeat: null,
    dungeon: null
  };
}
