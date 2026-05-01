import type { RuntimeEvent } from '../events.js';
import type { InputCommand } from '../input.js';
import { log } from '../log.js';
import { assertNever } from '../protocol.js';
import { createRng, type Rng } from '../rng.js';
import type {
  EncounterDefinition,
  SessionDefinition,
  TransitionNext,
  TransitionRules
} from '../session.js';
import type { SessionResultOutcome, SessionResultSummary } from '../sessionResult.js';
import type { SimulationClock } from './SimulationClock.js';
import type { WaveProgressSnapshot } from '../snapshot.js';

import {
  createRuntimeInputState,
  resetRuntimeInputState,
  runtimeInputForPlayer,
  type RuntimeActorInputState,
  type RuntimeInputState
} from './RuntimeInputState.js';
import type { EntityId } from './EntityStore.js';

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
  handleInput(playerId: string, command: InputCommand): void;
  checkTransitions(simTimeMs: number): void;
  onPlayerDeath(entityId: EntityId): void;
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
  livePlayerCount?: () => number;
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
    if (!isValidRoster(next)) {
      return;
    }
    sessionRng = createRng(next.seed);
    resetRuntimeInputState(input, next.players);
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
    deps.onSessionStart?.(next, sessionRng);
    const firstEncounter = next.encounters[0];
    if (firstEncounter !== undefined) {
      activateEncounter(0, simTime);
    }
  }

  function isValidRoster(session: SessionDefinition): boolean {
    if (!session.dynamicRoster && session.players.length === 0) {
      log.warn('startSession ignored: fixed roster session has no players', {
        sessionId: session.id
      });
      return false;
    }
    const seen = new Set<string>();
    for (const player of session.players) {
      if (seen.has(player.id)) {
        log.warn('startSession ignored: duplicate playerId in session roster', {
          sessionId: session.id,
          playerId: player.id
        });
        return false;
      }
      seen.add(player.id);
    }
    return true;
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

  function handleInput(playerId: string, command: InputCommand): void {
    if (active === null) {
      log.warn('input command ignored: no active session');
      return;
    }
    const playerInput = runtimeInputForPlayer(input, playerId);
    if (playerInput === null) {
      log.warn('input command ignored: unknown playerId', { playerId });
      return;
    }
    switch (command.kind) {
      case 'move':
        playerInput.moveDir.dx = command.dx;
        playerInput.moveDir.dy = command.dy;
        return;
      case 'aim':
        playerInput.aimWorld.x = command.x;
        playerInput.aimWorld.y = command.y;
        return;
      case 'fire':
        playerInput.firing = command.phase === 'start';
        return;
      case 'selectWeaponSlot':
        selectWeaponSlot(playerInput, command.slotIndex);
        return;
      case 'holsterWeapon':
        holsterWeapon(playerInput);
        return;
      default:
        assertNever(command);
    }
  }

  function selectWeaponSlot(playerInput: RuntimeActorInputState, slotIndex: number): void {
    if (playerInput.loadout === null) {
      log.warn('selectWeaponSlot ignored: no active player loadout', { slotIndex });
      return;
    }
    if (
      !Number.isInteger(slotIndex) ||
      slotIndex < 0 ||
      slotIndex >= playerInput.loadout.weapons.length
    ) {
      log.warn('selectWeaponSlot ignored: slot index outside player loadout', {
        slotIndex,
        weaponCount: playerInput.loadout.weapons.length
      });
      return;
    }
    playerInput.loadout.selectedIndex = slotIndex;
  }

  function holsterWeapon(playerInput: RuntimeActorInputState): void {
    if (playerInput.loadout === null) return;
    playerInput.loadout.selectedIndex = null;
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

  function onPlayerDeath(_entityId: EntityId): void {
    if (active === null) return;
    if (active.def.lossCondition.kind === 'allPlayersDead') {
      if ((deps.livePlayerCount?.() ?? 1) > 0) return;
      finalizeLoss(clock.simTimeMs());
      return;
    }
    if (active.def.lossCondition.kind !== 'playerDeath') return;
    finalizeLoss(clock.simTimeMs());
  }

  function finalizeLoss(simTime: number): void {
    if (active === null) return;
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
    resetRuntimeInputState(input, []);
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
