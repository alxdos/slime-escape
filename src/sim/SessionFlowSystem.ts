import type { RuntimeEvent } from '../shared/events';
import type { InputCommand } from '../shared/input';
import { log } from '../shared/log';
import { assertNever } from '../shared/protocol';
import { createRng, type Rng } from '../shared/rng';
import type {
  EncounterDefinition,
  SessionDefinition,
  TransitionNext,
  TransitionRules
} from '../shared/session';
import type { WaveProgressSnapshot } from '../shared/snapshot';

import {
  createRuntimeInputState,
  resetRuntimeInputState,
  type RuntimeInputState
} from './RuntimeInputState';
import type { SimulationClock } from './SimulationClock';

export type EncounterContext = Readonly<{
  encounter: EncounterDefinition;
  index: number;
  startSimMs: number;
}>;

export type SessionFlowSystem = Readonly<{
  start(session: SessionDefinition): void;
  stop(): void;
  pause(): void;
  resume(): void;
  handleInput(command: InputCommand): void;
  checkTransitions(simTimeMs: number): void;
  onPlayerDeath(): void;
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
}>;

type ActiveSession = {
  def: SessionDefinition;
  encounterIndex: number;
  encounterStartSimMs: number;
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
    resetRuntimeInputState(input, next.player.position.x, next.player.position.y);
    deps.onSessionStart?.(next, sessionRng);
    clock.toRunning();
    const simTime = clock.simTimeMs();
    active = { def: next, encounterIndex: 0, encounterStartSimMs: simTime };
    emitEvent({ kind: 'sessionStart', simTime });
    const firstEncounter = next.encounters[0];
    if (firstEncounter !== undefined) {
      deps.onEncounterStart?.(firstEncounter);
      emitEvent({ kind: 'encounterStart', simTime });
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
      default:
        assertNever(command);
    }
  }

  function checkTransitions(simTimeMs: number): void {
    if (active === null) return;
    const encounter = active.def.encounters[active.encounterIndex];
    if (encounter === undefined) return;
    const elapsedMs = simTimeMs - active.encounterStartSimMs;
    if (!shouldTransition(encounter.transitionRules, elapsedMs, encounter, deps)) return;

    deps.onEncounterEnd?.(encounter);
    emitEvent({ kind: 'encounterEnd', simTime: simTimeMs });

    const nextIndex = resolveNextIndex(
      active.def.encounters,
      active.encounterIndex,
      encounter.transitionRules.next
    );

    if (nextIndex === null) {
      finalizeRun(simTimeMs);
      return;
    }

    active.encounterIndex = nextIndex;
    active.encounterStartSimMs = simTimeMs;
    const nextEncounter = active.def.encounters[nextIndex]!;
    deps.onEncounterStart?.(nextEncounter);
    emitEvent({ kind: 'encounterStart', simTime: simTimeMs });
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
    emitEvent({ kind: 'loss', simTime });
    emitEvent({ kind: 'sessionStop', simTime });
    tearDown();
  }

  function finalizeRun(simTimeMs: number): void {
    if (active === null) return;
    const winKind = active.def.winCondition.kind;
    if (winKind === 'allEncountersComplete' || winKind === 'bossDefeated') {
      emitEvent({ kind: 'win', simTime: simTimeMs });
    }
    emitEvent({ kind: 'sessionStop', simTime: simTimeMs });
    tearDown();
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
    isActive: () => active !== null,
    activeSession: () => active?.def ?? null,
    activeEncounter: () => {
      if (active === null) return null;
      const encounter = active.def.encounters[active.encounterIndex];
      if (encounter === undefined) return null;
      return {
        encounter,
        index: active.encounterIndex,
        startSimMs: active.encounterStartSimMs
      };
    },
    inputState: () => input,
    rng: () => sessionRng
  };
}

function shouldTransition(
  rules: TransitionRules,
  elapsedMs: number,
  encounter: EncounterDefinition,
  deps: SessionFlowDeps
): boolean {
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
