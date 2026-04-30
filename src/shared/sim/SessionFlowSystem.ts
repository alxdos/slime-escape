import type { RuntimeEvent } from '../events';
import type { InputCommand } from '../input';
import { log } from '../log';
import { assertNever } from '../protocol';
import { createRng, type Rng } from '../rng';
import type {
  EncounterDefinition,
  SessionDefinition,
  TransitionNext,
  TransitionRules
} from '../session';
import type { SessionResultOutcome, SessionResultSummary } from '../sessionResult';
import type { SimulationClock } from './SimulationClock';
import type { WaveProgressSnapshot } from '../snapshot';

import {
  createRuntimeInputState,
  resetRuntimeInputState,
  type RuntimeInputState
} from './RuntimeInputState';
import type { EntityId } from './EntityStore';

export type EncounterContext = Readonly<{
  encounter: EncounterDefinition;
  index: number;
  startSimMs: number;
  waveOrdinal: number | null;
}>;

export type SessionFlowSystem = Readonly<{
  start(session: SessionDefinition): void;
  stop(): void;
  pause(): void;
  resume(): void;
  handleInput(command: InputCommand): void;
  checkTransitions(simTimeMs: number): void;
  onPlayerDeath(): void;
  onBossDeath(entityId: EntityId): void;
  isActive(): boolean;
  activeSession(): SessionDefinition | null;
  activeEncounter(): EncounterContext | null;
  inputState(): RuntimeInputState;
  rng(): Rng | null;
}>;

export type SessionFlowDeps = Readonly<{
  clock: SimulationClock;
  emitEvent(event: RuntimeEvent): void;
  waveProgress?: () => WaveProgressSnapshot | null;
  onSessionStart?(session: SessionDefinition, rng: Rng): void;
  onSessionStop?(): void;
  onEncounterStart?(encounter: EncounterDefinition): void;
  onEncounterEnd?(encounter: EncounterDefinition): void;
  onEncounterComplete?(encounter: EncounterDefinition): void;
  buildResultSummary(outcome: SessionResultOutcome, simTimeMs: number): SessionResultSummary;
}>;

type ActiveSession = {
  def: SessionDefinition;
  encounterIndex: number;
  encounterStartSimMs: number;
  activeWaveOrdinal: number | null;
  dungeonWaveOrdinal: number;
};

export function createSessionFlowSystem(deps: SessionFlowDeps): SessionFlowSystem {
  const { clock, emitEvent } = deps;
  let active: ActiveSession | null = null;
  let sessionRng: Rng | null = null;
  const input = createRuntimeInputState();

  function start(next: SessionDefinition): void {
    if (active !== null) {
      log.warn('startSession ignored: a session is already active', {
        activeId: active.def.id,
        attemptedId: next.id
      });
      return;
    }
    sessionRng = createRng(next.seed);
    resetRuntimeInputState(input, next.player.position.x, next.player.position.y, next.loadout);
    deps.onSessionStart?.(next, sessionRng);
    clock.toRunning();
    const simTime = clock.simTimeMs();
    active = {
      def: next,
      encounterIndex: 0,
      encounterStartSimMs: simTime,
      activeWaveOrdinal: null,
      dungeonWaveOrdinal: 0
    };
    emitEvent({ kind: 'sessionStart', simTime });
    const firstEncounter = next.encounters[0];
    if (firstEncounter !== undefined) {
      activateEncounter(0, simTime);
    }
  }

  function stop(): void {
    if (active === null) {
      log.warn('stopSession ignored: no active session');
      return;
    }
    const simTime = clock.simTimeMs();
    const currentEncounter = active.def.encounters[active.encounterIndex];
    if (currentEncounter !== undefined) {
      emitEvent({ kind: 'encounterEnd', simTime });
      deps.onEncounterEnd?.(currentEncounter);
    }
    emitEvent({ kind: 'sessionStop', simTime });
    tearDown();
  }

  function pause(): void {
    if (active === null) {
      log.warn('pause ignored: no active session');
      return;
    }
    if (clock.isPaused()) return;
    clock.pause();
    emitEvent({ kind: 'pause', simTime: clock.simTimeMs() });
  }

  function resume(): void {
    if (active === null) {
      log.warn('resume ignored: no active session');
      return;
    }
    if (!clock.isPaused()) return;
    clock.resume();
    emitEvent({ kind: 'resume', simTime: clock.simTimeMs() });
  }

  function handleInput(command: InputCommand): void {
    if (active === null) {
      log.warn('input command ignored: no active session');
      return;
    }
    switch (command.kind) {
      case 'move':
        input.moveDir.dx = command.dx;
        input.moveDir.dy = command.dy;
        return;
      case 'aim':
        input.aimWorld.x = command.x;
        input.aimWorld.y = command.y;
        return;
      case 'fire':
        input.firing = command.phase === 'start';
        return;
      case 'selectWeaponSlot':
        selectWeaponSlot(command.slotIndex);
        return;
      case 'holsterWeapon':
        holsterWeapon();
        return;
      default:
        assertNever(command);
    }
  }

  function selectWeaponSlot(slotIndex: number): void {
    if (input.loadout === null) {
      log.warn('selectWeaponSlot ignored: no active player loadout', { slotIndex });
      return;
    }
    if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= input.loadout.weapons.length) {
      log.warn('selectWeaponSlot ignored: slot index outside player loadout', {
        slotIndex,
        weaponCount: input.loadout.weapons.length
      });
      return;
    }
    input.loadout.selectedIndex = slotIndex;
  }

  function holsterWeapon(): void {
    if (input.loadout === null) return;
    input.loadout.selectedIndex = null;
  }

  function checkTransitions(simTimeMs: number): void {
    if (active === null) return;
    const encounter = active.def.encounters[active.encounterIndex];
    if (encounter === undefined) return;
    const elapsedMs = simTimeMs - active.encounterStartSimMs;
    if (!shouldTransition(encounter.transitionRules, elapsedMs, encounter, deps)) return;

    deps.onEncounterEnd?.(encounter);
    emitEvent({ kind: 'encounterEnd', simTime: simTimeMs });
    deps.onEncounterComplete?.(encounter);

    const nextIndex = resolveNextIndex(
      active.def.encounters,
      active.encounterIndex,
      encounter.transitionRules.next
    );

    if (nextIndex === null) {
      if (active.def.winCondition.kind === 'dungeon') {
        activateEncounter(0, simTimeMs);
        return;
      }
      finalizeRunAfterLastEncounter(simTimeMs);
      return;
    }

    activateEncounter(nextIndex, simTimeMs);
  }

  function onPlayerDeath(): void {
    if (active === null) return;
    if (active.def.lossCondition.kind !== 'playerDeath') return;
    const simTime = clock.simTimeMs();
    const currentEncounter = active.def.encounters[active.encounterIndex];
    if (currentEncounter !== undefined) {
      emitEvent({ kind: 'encounterEnd', simTime });
      deps.onEncounterEnd?.(currentEncounter);
    }
    emitTerminalEvent('loss', simTime);
    emitEvent({ kind: 'sessionStop', simTime });
    tearDown();
  }

  function finalizeRunAfterLastEncounter(simTimeMs: number): void {
    if (active === null) return;
    const winKind = active.def.winCondition.kind;
    if (winKind === 'allEncountersComplete') {
      emitTerminalEvent('win', simTimeMs);
    }
    // bossDefeated: win только через onBossDeath (design/session-definition.md, boss-encounter.md)
    emitEvent({ kind: 'sessionStop', simTime: simTimeMs });
    tearDown();
  }

  function onBossDeath(_entityId: EntityId): void {
    if (active === null) return;
    if (active.def.winCondition.kind !== 'bossDefeated') return;
    const enc = active.def.encounters[active.encounterIndex];
    if (enc === undefined || enc.spawnPlan.kind !== 'boss') return;
    const simTime = clock.simTimeMs();
    emitEvent({ kind: 'encounterEnd', simTime });
    deps.onEncounterEnd?.(enc);
    emitTerminalEvent('win', simTime);
    emitEvent({ kind: 'sessionStop', simTime });
    tearDown();
  }

  function activateEncounter(index: number, simTimeMs: number): void {
    if (active === null) return;
    const encounter = active.def.encounters[index];
    if (encounter === undefined) return;
    active.encounterIndex = index;
    active.encounterStartSimMs = simTimeMs;
    active.activeWaveOrdinal = resolveWaveOrdinal(active, encounter, index);
    deps.onEncounterStart?.(encounter);
    emitEvent({ kind: 'encounterStart', simTime: simTimeMs });
  }

  function emitTerminalEvent(outcome: SessionResultOutcome, simTimeMs: number): void {
    const summary = deps.buildResultSummary(outcome, simTimeMs);
    if (summary.outcome !== outcome) {
      throw new Error(
        `result summary outcome mismatch: event=${outcome}, summary=${summary.outcome}`
      );
    }
    if (summary.durationMs !== simTimeMs) {
      throw new Error(
        `result summary duration mismatch: event=${simTimeMs}, summary=${summary.durationMs}`
      );
    }
    emitEvent({ kind: outcome, simTime: simTimeMs, summary });
  }

  function tearDown(): void {
    clock.toIdle();
    deps.onSessionStop?.();
    resetRuntimeInputState(input, 0, 0);
    active = null;
    sessionRng = null;
  }

  return {
    start,
    stop,
    pause,
    resume,
    handleInput,
    checkTransitions,
    onPlayerDeath,
    onBossDeath,
    isActive: () => active !== null,
    activeSession: () => active?.def ?? null,
    activeEncounter: () => {
      if (active === null) return null;
      const encounter = active.def.encounters[active.encounterIndex];
      if (encounter === undefined) return null;
      return {
        encounter,
        index: active.encounterIndex,
        startSimMs: active.encounterStartSimMs,
        waveOrdinal: active.activeWaveOrdinal
      };
    },
    inputState: () => input,
    rng: () => sessionRng
  };
}

function resolveWaveOrdinal(
  active: ActiveSession,
  encounter: EncounterDefinition,
  index: number
): number | null {
  if (encounter.type !== 'wave') return null;
  if (active.def.winCondition.kind === 'dungeon') {
    active.dungeonWaveOrdinal += 1;
    return active.dungeonWaveOrdinal;
  }
  return countWavesThrough(active.def.encounters, index);
}

function countWavesThrough(
  encounters: ReadonlyArray<EncounterDefinition>,
  encounterIndex: number
): number {
  let ordinal = 0;
  for (let index = 0; index <= encounterIndex; index += 1) {
    if (encounters[index]?.type === 'wave') {
      ordinal += 1;
    }
  }
  return ordinal;
}

function shouldTransition(
  rules: TransitionRules,
  elapsedMs: number,
  encounter: EncounterDefinition,
  deps: SessionFlowDeps
): boolean {
  if (elapsedMs < encounter.introDurationMs) {
    return false;
  }

  switch (rules.kind) {
    case 'never':
      return false;
    case 'timer':
      return elapsedMs >= rules.durationMs;
    case 'allEnemiesCleared': {
      const plan = encounter.spawnPlan;
      if (plan.kind === 'empty') return true;
      if (plan.kind === 'wave' || plan.kind === 'boss') {
        const progress = deps.waveProgress?.() ?? null;
        if (progress === null) return false;
        return progress.dispatched === progress.total && progress.alive === 0;
      }
      return false;
    }
    default:
      return assertNever(rules);
  }
}

function resolveNextIndex(
  encounters: ReadonlyArray<EncounterDefinition>,
  currentIndex: number,
  next: TransitionNext
): number | null {
  if (next === 'sequential') {
    const candidate = currentIndex + 1;
    return candidate < encounters.length ? candidate : null;
  }
  const targetIndex = encounters.findIndex((e) => e.id === next.id);
  if (targetIndex < 0) {
    throw new Error(`transitionRules.next.byId points to unknown encounter id: ${next.id}`);
  }
  return targetIndex;
}
