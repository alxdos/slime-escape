import { describe, expect, it, vi } from 'vitest';

import type { BuildOptions } from '../../shared/content/buildSession';
import { PET_01 } from '../../shared/content/pets';
import {
  getPlayableModeCatalog,
  type ModePresetId
} from '../../shared/content/sessions';
import { PUBLIC_ARENA_WORLD_BOUNDS } from '../../shared/content/publicArena';
import { PUBLIC_ARENA_BOSS_LEVEL } from '../../shared/publicArenaProgression';
import type { RuntimeEvent } from '../../shared/events';
import type { InputCommand } from '../../shared/input';
import type {
  PublicArenaInputIntent,
  PublicArenaPresentationEvent,
  PublicArenaSnapshot
} from '../../shared/publicArenaProtocol';
import { PUBLIC_ARENA_PROTOCOL_VERSION } from '../../shared/publicArenaProtocol';
import type { SessionDefinition } from '../../shared/session';
import type { SessionResultOutcome, SessionResultSummary } from '../../shared/sessionResult';
import type { Audio, AudioUiEventId } from '../audio/Audio';
import type { InputController, InputControllerInit } from '../input/InputController';
import type { MobileInputControllerInit } from '../input/MobileInputController';
import type {
  PublicArenaClient,
  PublicArenaClientInit
} from '../online/PublicArenaClient';
import type {
  PublicArenaRenderer,
  PublicArenaRendererInit
} from '../online/PublicArenaRenderer';
import type {
  ClientProgression,
  ClientProgressionStore
} from '../progression/ClientProgressionStore';
import { createClientProgressionStore } from '../progression/ClientProgressionStore';
import { DROP_VISUALS } from '../render/dropVisuals';
import { PET_VISUALS } from '../render/petVisuals';
import { PROJECTILE_VISUALS } from '../render/projectileVisuals';
import type { Renderer, RendererInit } from '../render/Renderer';
import type { TextureMap } from '../render/spritePreload';
import {
  DEFAULT_CLIENT_SETTINGS,
  type ClientSettings,
  type ClientSettingsStore,
  type RenderScalePreset
} from '../settings/ClientSettingsStore';
import type {
  DungeonBestWaveRecordResult,
  DungeonBestWaveStore
} from '../settings/DungeonBestWaveStore';
import type { SimWorkerHost, SimWorkerHostOptions, SnapshotPair } from '../sim/SimWorkerHost';
import type {
  VibeJamPortalController,
  VibeJamPortalControllerInit
} from '../VibeJamPortalController';

import type { EscapeProgressPath, EscapeProgressPathInit } from './EscapeProgressPath';
import type { EscapeProgressPathViewModel } from './EscapeProgressPathViewModel';
import type { DungeonWaveCounter, DungeonWaveCounterInit } from './DungeonWaveCounter';
import type { Hud, HudInit } from './Hud';
import { createUiShell, STARTUP_SPRITE_SPECS, type UiShellInit } from './UiShell';
import type { MenuOverlay, MenuOverlayInit } from './MenuOverlay';
import type {
  MobileControlsOverlay,
  MobileControlsOverlayInit
} from './MobileControlsOverlay';
import type { MenuLabViewModel } from './MenuLabViewModel';
import type { MenuPetsViewModel } from './MenuPetsViewModel';
import type { MenuScreenId, MenuSubscreenId } from './MenuOverlayLayout';
import type { TeaserControlId } from './MenuOverlayState';
import type {
  PhaseTransitionCurtain,
  PhaseTransitionCurtainInit
} from './PhaseTransitionCurtain';
import type { PauseOverlay, PauseOverlayInit } from './PauseOverlay';
import type { PublicArenaHud, PublicArenaHudInit } from './PublicArenaHud';
import type {
  PublicArenaCombatAffordances,
  PublicArenaCombatAffordancesInit
} from './PublicArenaCombatAffordances';
import type {
  PublicArenaMenuOverlay,
  PublicArenaMenuOverlayInit
} from './PublicArenaMenuOverlay';
import type {
  PublicArenaStatusOverlay,
  PublicArenaStatusOverlayInit
} from './PublicArenaStatusOverlay';
import type { ResultOutcome, ResultOverlay, ResultOverlayInit } from './ResultOverlay';
import type { ResultViewModel } from './ResultViewModel';
import type { SettingsOverlay, SettingsOverlayInit } from './SettingsOverlay';
import type { StartupErrorOverlay, StartupErrorOverlayInit } from './StartupErrorOverlay';
import type { StartupOverlay, StartupOverlayInit } from './StartupOverlay';
import type { TitleOverlay, TitleOverlayInit } from './TitleOverlay';

class FakeEventTarget {
  private readonly listeners = new Map<string, Set<EventListener>>();

  addEventListener(type: string, listener: EventListener): void {
    const bucket = this.listeners.get(type) ?? new Set<EventListener>();
    bucket.add(listener);
    this.listeners.set(type, bucket);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string, event: Event): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

class FakeDomElement {
  readonly children: FakeDomElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly style: Record<string, string> = {};
  parent: FakeDomElement | null = null;

  appendChild(child: FakeDomElement): void {
    child.parent = this;
    this.children.push(child);
  }

  remove(): void {
    if (this.parent === null) {
      return;
    }
    this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }
}

function appendHarnessRoot(parent: HTMLElement, root: FakeDomElement): void {
  const maybeParent = parent as unknown as Partial<FakeDomElement>;
  maybeParent.appendChild?.(root);
}

function findHarnessRoot(parent: FakeDomElement, role: string): FakeDomElement | null {
  for (const child of parent.children) {
    if (child.dataset['role'] === role) {
      return child;
    }
  }
  return null;
}

function makeSession(
  id = 'test-session',
  overrides: Partial<SessionDefinition> = {}
): SessionDefinition {
  return {
    id,
    seed: 7,
    arena: { width: 16, height: 9 },
    player: {
      position: { x: 0, y: 0 },
      radius: 0.5,
      contactBox: { width: 1, height: 1 },
      maxSpeed: 5,
      maxHp: 5
    },
    loadout: { weapons: ['pistol'], selectedIndex: 0 },
    backgrounds: [],
    musicSampleId: null,
    modifiers: [],
    rules: {
      damage: { slimeFriendlyFire: false },
      aimAssist: { enabled: false, maxAngleRadians: 0, maxDistance: 0, strength: 0 }
    },
    encounters: [],
    winCondition: { kind: 'allEncountersComplete' },
    lossCondition: { kind: 'playerDeath' },
    uiMeta: null,
    ...overrides,
    companion: overrides.companion ?? null
  };
}

function makeResultSummary(
  outcome: SessionResultOutcome,
  durationMs: number
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
      total: 0,
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

function makeTerminalEvent(
  outcome: SessionResultOutcome,
  simTime: number
): Extract<RuntimeEvent, { kind: SessionResultOutcome }> {
  return {
    kind: outcome,
    simTime,
    summary: makeResultSummary(outcome, simTime)
  };
}

const EMPTY_TEXTURE_MAP = Object.freeze({}) satisfies TextureMap;

async function flushUiShellStartup(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function createDeferredPreload() {
  let resolvePromise: ((value: TextureMap) => void) | null = null;
  let rejectPromise: ((error: unknown) => void) | null = null;
  const promise = new Promise<TextureMap>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return {
    promise,
    resolve(): void {
      resolvePromise?.(EMPTY_TEXTURE_MAP);
    },
    reject(error: unknown): void {
      rejectPromise?.(error);
    }
  };
}

function createDeferredVoid() {
  let resolvePromise: (() => void) | null = null;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve(): void {
      resolvePromise?.();
    }
  };
}

function createUiShellForTest(init: UiShellInit) {
  const titleOverlay = createTitleOverlayHarness();
  const escapeProgressPath = createEscapeProgressPathHarness();
  const dungeonWaveCounter = createDungeonWaveCounterHarness();
  const phaseTransitionCurtain = createPhaseTransitionCurtainHarness();
  return createUiShell({
    runStartupPreload: () => Promise.resolve(EMPTY_TEXTURE_MAP),
    createEscapeProgressPath: escapeProgressPath.factory,
    createDungeonWaveCounter: dungeonWaveCounter.factory,
    createTitleOverlay: titleOverlay.factory,
    createPhaseTransitionCurtain: phaseTransitionCurtain.factory,
    ...init
  });
}

function createMenuHarness() {
  let visible = true;
  let onStart: ((presetId: ModePresetId) => void) | null = null;
  let onStartTraining: (() => void) | null = null;
  let onOpenSettings: (() => void) | null = null;
  let onToggleFullscreen: (() => void) | null = null;
  let onOpenScreen: ((screenId: MenuSubscreenId) => void) | null = null;
  let onBackToMainMenu: (() => void) | null = null;
  let onTeaser: ((controlId: TeaserControlId) => void) | null = null;
  let onStartPublicArena: (() => void) | null = null;
  let onStartDungeon: (() => void) | null = null;
  let onPurchasePet: MenuOverlayInit['onPurchasePet'] | null = null;
  let onSelectPet: MenuOverlayInit['onSelectPet'] | null = null;
  let onClearSelectedPet: MenuOverlayInit['onClearSelectedPet'] | null = null;
  let onButtonHover: (() => void) | null = null;
  let onModeSwitch: (() => void) | null = null;
  let modes: ReadonlyArray<{ presetId: ModePresetId }> = [];
  const labViewModels: MenuLabViewModel[] = [];
  const petsViewModels: MenuPetsViewModel[] = [];
  const feedbackMessages: string[] = [];
  let activeScreen: MenuScreenId = 'main';
  let dungeonBestWave = 0;
  let root: FakeDomElement | null = null;

  const overlay: MenuOverlay = {
    show(): void {
      visible = true;
      if (root !== null) {
        root.style.display = 'flex';
      }
    },
    hide(): void {
      visible = false;
      if (root !== null) {
        root.style.display = 'none';
      }
    },
    showScreen(screenId): void {
      activeScreen = screenId;
    },
    screen(): MenuScreenId {
      return activeScreen;
    },
    setDungeonBestWave(bestWave: number): void {
      dungeonBestWave = bestWave;
    },
    setLabViewModel(viewModel): void {
      labViewModels.push(viewModel);
    },
    setPetsViewModel(viewModel): void {
      petsViewModels.push(viewModel);
    },
    showFeedback(message): void {
      feedbackMessages.push(message);
    },
    isVisible(): boolean {
      return visible;
    },
    dispose(): void {}
  };

  return {
    factory(init: MenuOverlayInit): MenuOverlay {
      modes = init.modes;
      onStart = init.onStart;
      onStartTraining = init.onStartTraining;
      onOpenSettings = init.onOpenSettings;
      onToggleFullscreen = init.onToggleFullscreen;
      onOpenScreen = init.onOpenScreen;
      onBackToMainMenu = init.onBackToMainMenu;
      onTeaser = init.onTeaser;
      onStartPublicArena = init.onStartPublicArena;
      onStartDungeon = init.onStartDungeon;
      onPurchasePet = init.onPurchasePet;
      onSelectPet = init.onSelectPet;
      onClearSelectedPet = init.onClearSelectedPet;
      onButtonHover = init.onButtonHover;
      onModeSwitch = init.onModeSwitch;
      dungeonBestWave = init.dungeonBestWave;
      labViewModels.push(init.lab);
      petsViewModels.push(init.pets);
      root = new FakeDomElement();
      root.dataset['role'] = 'menu-overlay';
      root.style.zIndex = '100';
      root.style.display = visible ? 'flex' : 'none';
      appendHarnessRoot(init.parent, root);
      return overlay;
    },
    start(presetId: ModePresetId = 'campaign-normal'): void {
      onStart?.(presetId);
    },
    startTraining(): void {
      onStartTraining?.();
    },
    isVisible(): boolean {
      return visible;
    },
    modes(): ReadonlyArray<{ presetId: ModePresetId }> {
      return modes;
    },
    openSettings(): void {
      if (!visible) {
        return;
      }
      onOpenSettings?.();
    },
    toggleFullscreen(): void {
      if (!visible) {
        return;
      }
      onToggleFullscreen?.();
    },
    teaser(controlId: TeaserControlId): void {
      if (!visible) {
        return;
      }
      onTeaser?.(controlId);
    },
    startPublicArena(): void {
      if (!visible) {
        return;
      }
      onStartPublicArena?.();
    },
    startDungeon(): void {
      if (!visible) {
        return;
      }
      onStartDungeon?.();
    },
    purchasePet(quality: 'green' | 'purple') {
      return onPurchasePet?.(quality) ?? null;
    },
    selectPet(petId: string) {
      return onSelectPet?.(petId) ?? null;
    },
    clearSelectedPet(): void {
      onClearSelectedPet?.();
    },
    openScreen(screenId: MenuSubscreenId): void {
      if (!visible) {
        return;
      }
      onOpenScreen?.(screenId);
    },
    backToMainMenu(): void {
      if (!visible) {
        return;
      }
      onBackToMainMenu?.();
    },
    screen(): MenuScreenId {
      return activeScreen;
    },
    dungeonBestWave(): number {
      return dungeonBestWave;
    },
    labViewModels(): ReadonlyArray<MenuLabViewModel> {
      return labViewModels;
    },
    latestLabViewModel(): MenuLabViewModel | null {
      return labViewModels.at(-1) ?? null;
    },
    petsViewModels(): ReadonlyArray<MenuPetsViewModel> {
      return petsViewModels;
    },
    latestPetsViewModel(): MenuPetsViewModel | null {
      return petsViewModels.at(-1) ?? null;
    },
    latestFeedback(): string | null {
      return feedbackMessages.at(-1) ?? null;
    },
    hoverButton(): void {
      if (!visible) {
        return;
      }
      onButtonHover?.();
    },
    switchMode(): void {
      if (!visible) {
        return;
      }
      onModeSwitch?.();
    },
    root(): FakeDomElement | null {
      return root;
    }
  };
}

function createPhaseTransitionCurtainHarness() {
  let active = false;
  let gate: Promise<void> | null = null;
  let revealGate: Promise<void> | null = null;
  const calls = {
    create: 0,
    run: 0,
    dispose: 0
  };

  return {
    factory(_init: PhaseTransitionCurtainInit): PhaseTransitionCurtain {
      calls.create += 1;
      return {
        async run(commit, reveal): Promise<void> {
          if (active) {
            return;
          }
          active = true;
          calls.run += 1;
          const currentGate = gate;
          const currentRevealGate = revealGate;
          gate = null;
          revealGate = null;
          if (currentGate !== null) {
            await currentGate;
          }
          try {
            const commitResult = commit();
            if (commitResult instanceof Promise) {
              await commitResult;
            }
            if (currentRevealGate !== null) {
              await currentRevealGate;
            }
            const revealResult = reveal?.();
            if (revealResult instanceof Promise) {
              await revealResult;
            }
          } finally {
            active = false;
          }
        },
        isActive(): boolean {
          return active;
        },
        dispose(): void {
          calls.dispose += 1;
          active = false;
        }
      };
    },
    deferNextRun(nextGate: Promise<void>): void {
      gate = nextGate;
    },
    deferNextReveal(nextGate: Promise<void>): void {
      revealGate = nextGate;
    },
    isActive(): boolean {
      return active;
    },
    calls
  };
}

function createResultHarness() {
  let visible = false;
  let outcome: ResultOutcome | null = null;
  let viewModel: ResultViewModel | null = null;
  let onBackToMenu: (() => void) | null = null;
  let onRestart: (() => void) | null = null;
  let root: FakeDomElement | null = null;

  const overlay: ResultOverlay = {
    show(next): void {
      visible = true;
      viewModel = next;
      outcome = next.outcome;
      if (root !== null) {
        root.style.display = 'flex';
      }
    },
    hide(): void {
      visible = false;
      outcome = null;
      viewModel = null;
      if (root !== null) {
        root.style.display = 'none';
      }
    },
    isVisible(): boolean {
      return visible;
    },
    dispose(): void {}
  };

  return {
    factory(init: ResultOverlayInit): ResultOverlay {
      onBackToMenu = init.onBackToMenu;
      onRestart = init.onRestart;
      root = new FakeDomElement();
      root.dataset['role'] = 'result-overlay';
      root.style.zIndex = '110';
      root.style.display = 'none';
      appendHarnessRoot(init.parent, root);
      return overlay;
    },
    backToMenu(): void {
      onBackToMenu?.();
    },
    restart(): void {
      onRestart?.();
    },
    isVisible(): boolean {
      return visible;
    },
    outcome(): ResultOutcome | null {
      return outcome;
    },
    viewModel(): ResultViewModel | null {
      return viewModel;
    },
    root(): FakeDomElement | null {
      return root;
    }
  };
}

function createPauseHarness() {
  let visible = false;
  let onResume: (() => void) | null = null;
  let onExit: (() => void) | null = null;
  let onOpenSettings: (() => void) | null = null;
  const escapePaths: EscapeProgressPathViewModel[] = [];
  let root: FakeDomElement | null = null;

  const overlay: PauseOverlay = {
    setEscapePath(viewModel): void {
      escapePaths.push(viewModel);
    },
    show(): void {
      visible = true;
      if (root !== null) {
        root.style.display = 'flex';
      }
    },
    hide(): void {
      visible = false;
      if (root !== null) {
        root.style.display = 'none';
      }
    },
    isVisible(): boolean {
      return visible;
    },
    dispose(): void {}
  };

  return {
    factory(init: PauseOverlayInit): PauseOverlay {
      onResume = init.onResume;
      onExit = init.onExit;
      onOpenSettings = init.onOpenSettings;
      root = new FakeDomElement();
      root.dataset['role'] = 'pause-overlay';
      root.style.zIndex = '90';
      root.style.display = 'none';
      appendHarnessRoot(init.parent, root);
      return overlay;
    },
    resume(): void {
      onResume?.();
    },
    exit(): void {
      onExit?.();
    },
    openSettings(): void {
      if (!visible) {
        return;
      }
      onOpenSettings?.();
    },
    isVisible(): boolean {
      return visible;
    },
    root(): FakeDomElement | null {
      return root;
    },
    escapePaths(): ReadonlyArray<EscapeProgressPathViewModel> {
      return escapePaths;
    }
  };
}

function createPublicArenaStatusHarness() {
  let visible = false;
  let message = '';
  let onBack: (() => void) | null = null;
  let root: FakeDomElement | null = null;

  const overlay: PublicArenaStatusOverlay = {
    show(nextMessage): void {
      visible = true;
      message = nextMessage;
      if (root !== null) {
        root.style.display = 'flex';
      }
    },
    hide(): void {
      visible = false;
      if (root !== null) {
        root.style.display = 'none';
      }
    },
    isVisible(): boolean {
      return visible;
    },
    dispose(): void {
      root?.remove();
      root = null;
    }
  };

  return {
    factory(init: PublicArenaStatusOverlayInit): PublicArenaStatusOverlay {
      onBack = init.onBack;
      root = new FakeDomElement();
      root.dataset['role'] = 'public-arena-status-overlay';
      root.style.zIndex = '95';
      root.style.display = 'none';
      appendHarnessRoot(init.parent, root);
      return overlay;
    },
    back(): void {
      onBack?.();
    },
    isVisible(): boolean {
      return visible;
    },
    message(): string {
      return message;
    }
  };
}

function createPublicArenaMenuHarness() {
  let visible = false;
  let onResume: (() => void) | null = null;
  let onExit: (() => void) | null = null;
  let root: FakeDomElement | null = null;

  const overlay: PublicArenaMenuOverlay = {
    show(): void {
      visible = true;
      if (root !== null) {
        root.style.display = 'flex';
      }
    },
    hide(): void {
      visible = false;
      if (root !== null) {
        root.style.display = 'none';
      }
    },
    isVisible(): boolean {
      return visible;
    },
    dispose(): void {
      root?.remove();
      root = null;
    }
  };

  return {
    factory(init: PublicArenaMenuOverlayInit): PublicArenaMenuOverlay {
      onResume = init.onResume;
      onExit = init.onExit;
      root = new FakeDomElement();
      root.dataset['role'] = 'public-arena-menu-overlay';
      root.style.zIndex = '88';
      root.style.display = 'none';
      appendHarnessRoot(init.parent, root);
      return overlay;
    },
    resume(): void {
      onResume?.();
    },
    exit(): void {
      onExit?.();
    },
    isVisible(): boolean {
      return visible;
    }
  };
}

function createPublicArenaHudHarness() {
  let visible = false;
  let lastLevel = '';
  let lastPopulation = '';

  const hud: PublicArenaHud = {
    show(): void {
      visible = true;
    },
    update(snapshot, selfId, _playerCap): void {
      const self =
        selfId === null
          ? null
          : (snapshot?.players.find((player) => player.id === selfId) ?? null);
      lastLevel =
        self === null
          ? `Level --/${PUBLIC_ARENA_BOSS_LEVEL}`
          : `Level ${Math.min(self.level, PUBLIC_ARENA_BOSS_LEVEL)}/${PUBLIC_ARENA_BOSS_LEVEL}`;
      lastPopulation = snapshot === null ? 'Online --' : `Online ${snapshot.population}`;
    },
    hide(): void {
      visible = false;
    },
    isVisible(): boolean {
      return visible;
    },
    dispose(): void {}
  };

  return {
    factory(_init: PublicArenaHudInit): PublicArenaHud {
      return hud;
    },
    isVisible(): boolean {
      return visible;
    },
    level(): string {
      return lastLevel;
    },
    population(): string {
      return lastPopulation;
    }
  };
}

function createPublicArenaCombatAffordancesHarness() {
  let visible = false;
  let createCount = 0;
  let updateCount = 0;
  let lastSnapshot: PublicArenaSnapshot | null | undefined;
  let lastSelfId: string | null | undefined;

  const affordances: PublicArenaCombatAffordances = {
    show(): void {
      visible = true;
    },
    update(snapshot, selfId): void {
      updateCount += 1;
      lastSnapshot = snapshot;
      lastSelfId = selfId;
    },
    hide(): void {
      visible = false;
    },
    isVisible(): boolean {
      return visible;
    },
    dispose(): void {}
  };

  return {
    factory(_init: PublicArenaCombatAffordancesInit): PublicArenaCombatAffordances {
      createCount += 1;
      return affordances;
    },
    createCount(): number {
      return createCount;
    },
    updateCount(): number {
      return updateCount;
    },
    lastSnapshot(): PublicArenaSnapshot | null | undefined {
      return lastSnapshot;
    },
    lastSelfId(): string | null | undefined {
      return lastSelfId;
    },
    isVisible(): boolean {
      return visible;
    }
  };
}

function createPublicArenaRendererHarness() {
  let lastInit: PublicArenaRendererInit | null = null;
  const calls = {
    render: 0,
    fitToWindow: 0,
    applyScalePolicy: 0,
    dispose: 0
  };

  return {
    factory(init: PublicArenaRendererInit): PublicArenaRenderer {
      lastInit = init;
      return {
        render(): void {
          calls.render += 1;
        },
        fitToWindow(): void {
          calls.fitToWindow += 1;
        },
        applyScalePolicy(): void {
          calls.applyScalePolicy += 1;
        },
        dispose(): void {
          calls.dispose += 1;
        }
      };
    },
    lastInit(): PublicArenaRendererInit | null {
      return lastInit;
    },
    calls
  };
}

function createPublicArenaClientHarness() {
  let lastInit: PublicArenaClientInit | null = null;
  let disconnectCalls = 0;
  const sentInputs: PublicArenaInputIntent[] = [];

  return {
    factory(init: PublicArenaClientInit): PublicArenaClient {
      lastInit = init;
      return {
        sendInput(intent): void {
          sentInputs.push(intent);
        },
        disconnect(): void {
          disconnectCalls += 1;
        }
      };
    },
    accept(): void {
      lastInit?.onAccepted({
        protocolVersion: PUBLIC_ARENA_PROTOCOL_VERSION,
        playerId: 'socket-a',
        arena: PUBLIC_ARENA_WORLD_BOUNDS,
        playerCap: 200,
        population: 1,
        tickHz: 60,
        snapshotHz: 30
      });
    },
    reject(message: string): void {
      lastInit?.onRejected({
        protocolVersion: PUBLIC_ARENA_PROTOCOL_VERSION,
        reason: 'arenaFull',
        message,
        playerCap: 200,
        population: 200
      });
    },
    close(message: string): void {
      lastInit?.onClose({
        reason: 'serverError',
        message
      });
    },
    presentation(event: PublicArenaPresentationEvent): void {
      lastInit?.onPresentation(event);
    },
    snapshot(): void {
      lastInit?.onSnapshot(makePublicArenaSnapshot());
    },
    lastInit(): PublicArenaClientInit | null {
      return lastInit;
    },
    disconnectCalls(): number {
      return disconnectCalls;
    },
    sentInputs(): ReadonlyArray<PublicArenaInputIntent> {
      return sentInputs;
    }
  };
}

function makePublicArenaSnapshot(): PublicArenaSnapshot {
  return {
    simTimeMs: 120,
    population: 7,
    players: [
      {
        id: 'socket-a',
        x: 1,
        y: 2,
        hp: 20,
        maxHp: 20,
        level: 3,
        form: { kind: 'slime', archetypeId: 'slime-hornling' },
        selectedWeaponIndex: 0
      }
    ],
    projectiles: []
  };
}

function createSettingsOverlayHarness() {
  let visible = false;
  let onClose: (() => void) | null = null;
  let onButtonClick: (() => void) | null = null;
  let root: FakeDomElement | null = null;

  const overlay: SettingsOverlay = {
    show(): void {
      visible = true;
      if (root !== null) {
        root.style.display = 'flex';
      }
    },
    hide(): void {
      visible = false;
      if (root !== null) {
        root.style.display = 'none';
      }
    },
    isVisible(): boolean {
      return visible;
    },
    dispose(): void {
      root?.remove();
      root = null;
    }
  };

  return {
    factory(init: SettingsOverlayInit): SettingsOverlay {
      onClose = init.onClose;
      onButtonClick = init.onButtonClick ?? null;
      root = new FakeDomElement();
      root.dataset['role'] = 'settings-overlay';
      root.style.zIndex = '105';
      root.style.display = 'none';
      appendHarnessRoot(init.parent, root);
      return overlay;
    },
    close(): void {
      onButtonClick?.();
      onClose?.();
    },
    pressButton(): void {
      onButtonClick?.();
    },
    isVisible(): boolean {
      return visible;
    },
    root(): FakeDomElement | null {
      return root;
    }
  };
}

function createStartupOverlayHarness(
  options: Readonly<{ ritualPromise?: Promise<void> }> = {}
) {
  let visible = true;
  let progress = { loaded: 0, total: 0 };
  let ritualCalls = 0;
  let root: FakeDomElement | null = null;
  let lastInit: StartupOverlayInit | null = null;

  const overlay: StartupOverlay = {
    show(): void {
      visible = true;
      if (root !== null) {
        root.style.display = 'flex';
      }
    },
    hide(): void {
      visible = false;
      if (root !== null) {
        root.style.display = 'none';
      }
    },
    isVisible(): boolean {
      return visible;
    },
    setProgress(loaded: number, total: number): void {
      progress = { loaded, total };
    },
    playRitual(): Promise<void> {
      ritualCalls += 1;
      return options.ritualPromise ?? Promise.resolve();
    },
    dispose(): void {
      root?.remove();
      root = null;
    }
  };

  return {
    factory(init: StartupOverlayInit): StartupOverlay {
      lastInit = init;
      root = new FakeDomElement();
      root.dataset['role'] = 'startup-overlay';
      root.style.zIndex = '120';
      root.style.display = visible ? 'flex' : 'none';
      appendHarnessRoot(init.parent, root);
      return overlay;
    },
    isVisible(): boolean {
      return visible;
    },
    progress(): Readonly<{ loaded: number; total: number }> {
      return progress;
    },
    ritualCalls(): number {
      return ritualCalls;
    },
    lastInit(): StartupOverlayInit | null {
      return lastInit;
    },
    root(): FakeDomElement | null {
      return root;
    }
  };
}

function createStartupErrorOverlayHarness() {
  let visible = false;
  let message = '';
  let onReload: (() => void) | null = null;
  let root: FakeDomElement | null = null;

  const overlay: StartupErrorOverlay = {
    show(nextMessage: string): void {
      visible = true;
      message = nextMessage;
      if (root !== null) {
        root.style.display = 'flex';
      }
    },
    hide(): void {
      visible = false;
      message = '';
      if (root !== null) {
        root.style.display = 'none';
      }
    },
    isVisible(): boolean {
      return visible;
    },
    dispose(): void {
      root?.remove();
      root = null;
    }
  };

  return {
    factory(init: StartupErrorOverlayInit): StartupErrorOverlay {
      onReload = init.onReload;
      root = new FakeDomElement();
      root.dataset['role'] = 'startup-error-overlay';
      root.style.zIndex = '130';
      root.style.display = 'none';
      appendHarnessRoot(init.parent, root);
      return overlay;
    },
    isVisible(): boolean {
      return visible;
    },
    message(): string {
      return message;
    },
    reload(): void {
      onReload?.();
    },
    root(): FakeDomElement | null {
      return root;
    }
  };
}

function createRendererHarness() {
  const calls = {
    create: 0,
    render: 0,
    handleEvent: 0,
    fitToWindow: 0,
    applyScalePolicy: 0,
    dispose: 0
  };
  let lastInit: RendererInit | null = null;
  const appliedPresets: RenderScalePreset[] = [];
  const events: RuntimeEvent[] = [];

  return {
    factory(init: RendererInit): Renderer {
      calls.create += 1;
      lastInit = init;
      return {
        render(): void {
          calls.render += 1;
        },
        handleEvent(event: RuntimeEvent): void {
          calls.handleEvent += 1;
          events.push(event);
        },
        fitToWindow(): void {
          calls.fitToWindow += 1;
        },
        applyScalePolicy(preset: RenderScalePreset): void {
          calls.applyScalePolicy += 1;
          appliedPresets.push(preset);
        },
        dispose(): void {
          calls.dispose += 1;
        }
      };
    },
    calls,
    events,
    appliedPresets,
    lastInit(): RendererInit | null {
      return lastInit;
    }
  };
}

function createInputHarness() {
  const calls = {
    create: 0,
    start: 0,
    stop: 0,
    syncAim: 0,
    requestLock: 0
  };
  let lastInit: InputControllerInit | null = null;

  return {
    factory(init: InputControllerInit): InputController {
      calls.create += 1;
      lastInit = init;
      return {
        start(): void {
          calls.start += 1;
        },
        stop(): void {
          calls.stop += 1;
        },
        isActive(): boolean {
          return true;
        },
        currentAim() {
          return { x: 0, y: 0 };
        },
        syncAim(): void {
          calls.syncAim += 1;
        },
        requestLock(): void {
          calls.requestLock += 1;
        }
      };
    },
    calls,
    lastInit(): InputControllerInit | null {
      return lastInit;
    }
  };
}

function createMobileInputHarness() {
  const calls = {
    create: 0,
    start: 0,
    stop: 0,
    syncAim: 0,
    requestLock: 0
  };
  let lastInit: MobileInputControllerInit | null = null;

  return {
    factory(init: MobileInputControllerInit): InputController {
      calls.create += 1;
      lastInit = init;
      return {
        start(): void {
          calls.start += 1;
        },
        stop(): void {
          calls.stop += 1;
        },
        isActive(): boolean {
          return true;
        },
        currentAim() {
          return { x: 0, y: 0 };
        },
        syncAim(): void {
          calls.syncAim += 1;
        },
        requestLock(): void {
          calls.requestLock += 1;
        }
      };
    },
    calls,
    lastInit(): MobileInputControllerInit | null {
      return lastInit;
    }
  };
}

function createSimHarness() {
  const emptyPair: SnapshotPair = {
    prev: null,
    curr: null,
    currReceivedAtMs: 0,
    nowMs: 0
  };

  let paused = false;
  let onEvent: ((event: RuntimeEvent) => void) | undefined;
  const startSessions: SessionDefinition[] = [];
  const sentInputs: InputCommand[] = [];
  const calls = {
    stop: 0,
    pause: 0,
    resume: 0,
    dispose: 0
  };

  return {
    factory(options: SimWorkerHostOptions = {}): SimWorkerHost {
      onEvent = options.onEvent;
      return {
        startSession(session): void {
          startSessions.push(session);
          paused = false;
        },
        stopSession(): void {
          calls.stop += 1;
          paused = false;
        },
        pause(): void {
          calls.pause += 1;
          paused = true;
        },
        resume(): void {
          calls.resume += 1;
          paused = false;
        },
        sendInput(command): void {
          sentInputs.push(command);
        },
        snapshotPair(): SnapshotPair {
          return emptyPair;
        },
        isPaused(): boolean {
          return paused;
        },
        dispose(): void {
          calls.dispose += 1;
        }
      };
    },
    emit(event: RuntimeEvent): void {
      onEvent?.(event);
    },
    calls,
    startSessions,
    sentInputs,
    setPaused(next: boolean): void {
      paused = next;
    }
  };
}

function createHudHarness() {
  const calls = {
    attach: 0,
    update: 0,
    detach: 0,
    dispose: 0
  };

  return {
    factory(_init: HudInit): Hud {
      return {
        attach(): void {
          calls.attach += 1;
        },
        update(): void {
          calls.update += 1;
        },
        detach(): void {
          calls.detach += 1;
        },
        dispose(): void {
          calls.dispose += 1;
        }
      };
    },
    calls
  };
}

function createEscapeProgressPathHarness() {
  const calls = {
    attach: 0,
    update: 0,
    detach: 0,
    dispose: 0
  };

  return {
    factory(_init: EscapeProgressPathInit): EscapeProgressPath {
      return {
        attach(): void {
          calls.attach += 1;
        },
        update(): void {
          calls.update += 1;
        },
        detach(): void {
          calls.detach += 1;
        },
        dispose(): void {
          calls.dispose += 1;
        }
      };
    },
    calls
  };
}

function createDungeonWaveCounterHarness() {
  const calls = {
    attach: 0,
    update: 0,
    detach: 0,
    dispose: 0
  };

  return {
    factory(_init: DungeonWaveCounterInit): DungeonWaveCounter {
      return {
        attach(): void {
          calls.attach += 1;
        },
        update(): void {
          calls.update += 1;
        },
        detach(): void {
          calls.detach += 1;
        },
        dispose(): void {
          calls.dispose += 1;
        }
      };
    },
    calls
  };
}

function createTitleOverlayHarness() {
  const calls = {
    attach: 0,
    update: 0,
    detach: 0,
    dispose: 0
  };
  let lastInit: TitleOverlayInit | null = null;

  return {
    factory(init: TitleOverlayInit): TitleOverlay {
      lastInit = init;
      return {
        attach(): void {
          calls.attach += 1;
        },
        update(): void {
          calls.update += 1;
        },
        detach(): void {
          calls.detach += 1;
        },
        dispose(): void {
          calls.dispose += 1;
        }
      };
    },
    calls,
    lastInit(): TitleOverlayInit | null {
      return lastInit;
    }
  };
}

function createVibeJamPortalControllerHarness() {
  const calls = {
    create: 0,
    attachSession: 0,
    update: 0,
    attachPublicArena: 0,
    updatePublicArena: 0,
    detachSession: 0
  };
  let lastInit: VibeJamPortalControllerInit | null = null;

  return {
    factory(init: VibeJamPortalControllerInit): VibeJamPortalController {
      calls.create += 1;
      lastInit = init;
      return {
        attachSession(): void {
          calls.attachSession += 1;
        },
        update(): ReadonlyArray<never> {
          calls.update += 1;
          return [];
        },
        attachPublicArena(): void {
          calls.attachPublicArena += 1;
        },
        updatePublicArena(): ReadonlyArray<never> {
          calls.updatePublicArena += 1;
          return [];
        },
        detachSession(): void {
          calls.detachSession += 1;
        },
        portals(): ReadonlyArray<never> {
          return [];
        },
        hasActiveReturnContext(): boolean {
          return false;
        }
      };
    },
    calls,
    lastInit(): VibeJamPortalControllerInit | null {
      return lastInit;
    }
  };
}

function createMobileControlsHarness() {
  let visible = false;
  let pauseButton = new FakeDomElement();
  const calls = {
    create: 0,
    show: 0,
    hide: 0,
    dispose: 0
  };

  const overlay: MobileControlsOverlay = {
    show(): void {
      visible = true;
      calls.show += 1;
    },
    hide(): void {
      visible = false;
      calls.hide += 1;
    },
    isVisible(): boolean {
      return visible;
    },
    pauseButtonElement(): HTMLElement {
      return pauseButton as unknown as HTMLElement;
    },
    dispose(): void {
      calls.dispose += 1;
    }
  };

  return {
    factory(init: MobileControlsOverlayInit): MobileControlsOverlay {
      calls.create += 1;
      pauseButton = new FakeDomElement();
      pauseButton.dataset['role'] = 'mobile-pause-button';
      appendHarnessRoot(init.parent, pauseButton);
      return overlay;
    },
    isVisible(): boolean {
      return visible;
    },
    pauseButton(): FakeDomElement {
      return pauseButton;
    },
    calls
  };
}

function createAudioHarness() {
  const events: RuntimeEvent[] = [];
  const uiEvents: AudioUiEventId[] = [];
  const attachedSessions: SessionDefinition[] = [];
  const masterGainValues: number[] = [];
  const calls = {
    unlock: 0,
    update: 0,
    detach: 0,
    dispose: 0
  };

  return {
    factory(): Audio {
      return {
        unlock(): void {
          calls.unlock += 1;
        },
        handleEvent(event: RuntimeEvent): void {
          events.push(event);
        },
        update(): void {
          calls.update += 1;
        },
        attach(session: SessionDefinition): void {
          attachedSessions.push(session);
        },
        detach(): void {
          calls.detach += 1;
        },
        playUi(eventId: AudioUiEventId): void {
          uiEvents.push(eventId);
        },
        setMasterGain(value: number): void {
          masterGainValues.push(value);
        },
        dispose(): void {
          calls.dispose += 1;
        }
      };
    },
    events,
    uiEvents,
    attachedSessions,
    masterGainValues,
    calls
  };
}

function createClientSettingsStoreHarness(
  initial: Partial<ClientSettings> = {}
) {
  let settings: ClientSettings = {
    ...DEFAULT_CLIENT_SETTINGS,
    ...initial
  };
  let listeners: Array<(settings: ClientSettings) => void> = [];
  const calls = {
    dispose: 0,
    subscribe: 0
  };

  function notify(): void {
    for (const listener of listeners) {
      listener(settings);
    }
  }

  return {
    factory(): ClientSettingsStore {
      return {
        get(): ClientSettings {
          return settings;
        },
        setMasterVolume(value: number): void {
          settings = {
            ...settings,
            masterVolume: value
          };
          notify();
        },
        setRenderScalePreset(preset: RenderScalePreset): void {
          settings = {
            ...settings,
            renderScalePreset: preset
          };
          notify();
        },
        subscribe(listener): () => void {
          calls.subscribe += 1;
          listeners.push(listener);
          return () => {
            listeners = listeners.filter((entry) => entry !== listener);
          };
        },
        dispose(): void {
          calls.dispose += 1;
          listeners = [];
        }
      };
    },
    get(): ClientSettings {
      return settings;
    },
    setMasterVolume(value: number): void {
      settings = {
        ...settings,
        masterVolume: value
      };
      notify();
    },
    setRenderScalePreset(preset: RenderScalePreset): void {
      settings = {
        ...settings,
        renderScalePreset: preset
      };
      notify();
    },
    calls
  };
}

function createDungeonBestWaveStoreHarness(initialBestWave = 0) {
  let bestWave = initialBestWave;
  const recordResults: DungeonBestWaveRecordResult[] = [];
  const calls = {
    record: 0
  };

  return {
    factory(): DungeonBestWaveStore {
      return {
        get(): number {
          return bestWave;
        },
        record(wavesCleared: number): DungeonBestWaveRecordResult {
          calls.record += 1;
          const previousBestWave = bestWave;
          const normalizedWavesCleared = Math.max(0, Math.floor(wavesCleared));
          const isNewBest = normalizedWavesCleared > previousBestWave;
          if (isNewBest) {
            bestWave = normalizedWavesCleared;
          }
          const result = {
            previousBestWave,
            bestWave,
            isNewBest
          };
          recordResults.push(result);
          return result;
        }
      };
    },
    get(): number {
      return bestWave;
    },
    recordResults(): ReadonlyArray<DungeonBestWaveRecordResult> {
      return recordResults;
    },
    calls
  };
}

function createClientProgressionStoreHarness(
  initial: Partial<ClientProgression> = {}
) {
  let progression: ClientProgression = {
    schemaVersion: 1,
    totalXp: initial.totalXp ?? 0,
    ownedPetIds: initial.ownedPetIds ?? [],
    selectedPetId: initial.selectedPetId ?? null
  };
  let listeners: Array<(progression: ClientProgression) => void> = [];
  const awards: number[] = [];
  const calls = {
    awardXp: 0,
    dispose: 0
  };

  function notify(): void {
    for (const listener of listeners) {
      listener(progression);
    }
  }

  return {
    factory(): ClientProgressionStore {
      return {
        get(): ClientProgression {
          return progression;
        },
        awardXp(amount: number): ClientProgression {
          calls.awardXp += 1;
          const xpAwarded = Math.max(0, Math.floor(amount));
          awards.push(xpAwarded);
          if (xpAwarded > 0) {
            progression = {
              ...progression,
              totalXp: progression.totalXp + xpAwarded
            };
            notify();
          }
          return progression;
        },
        purchasePet(quality) {
          return {
            ok: false,
            reason: 'complete',
            quality,
            price: 0,
            totalXp: progression.totalXp
          };
        },
        selectPet(petId) {
          if (!progression.ownedPetIds.includes(petId)) {
            return {
              ok: false,
              reason: 'notOwned',
              selectedPetId: petId
            };
          }
          progression = {
            ...progression,
            selectedPetId: petId
          };
          notify();
          return {
            ok: true,
            selectedPetId: petId
          };
        },
        clearSelectedPet(): void {
          progression = {
            ...progression,
            selectedPetId: null
          };
          notify();
        },
        subscribe(listener): () => void {
          listeners.push(listener);
          return () => {
            listeners = listeners.filter((entry) => entry !== listener);
          };
        },
        dispose(): void {
          calls.dispose += 1;
          listeners = [];
        }
      };
    },
    get(): ClientProgression {
      return progression;
    },
    awards(): ReadonlyArray<number> {
      return awards;
    },
    calls
  };
}

describe('UiShell', () => {
  it('preloads projectile, drop, and pet sprite registries before showing the menu', () => {
    const preloadIds = new Set(STARTUP_SPRITE_SPECS.map((spec) => spec.archetypeId));

    for (const archetypeId of Object.keys(PROJECTILE_VISUALS)) {
      expect(preloadIds.has(archetypeId)).toBe(true);
    }
    for (const archetypeId of Object.keys(DROP_VISUALS)) {
      expect(preloadIds.has(archetypeId)).toBe(true);
    }
    for (const archetypeId of Object.keys(PET_VISUALS)) {
      expect(preloadIds.has(archetypeId)).toBe(true);
    }
  });

  it('shows startup loading before the menu and delays session client creation until preload finishes', async () => {
    const parent = new FakeDomElement();
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const startupOverlay = createStartupOverlayHarness();
    const startupErrorOverlay = createStartupErrorOverlayHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const titleOverlay = createTitleOverlayHarness();
    const audio = createAudioHarness();
    const deferredPreload = createDeferredPreload();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: parent as unknown as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createStartupOverlay: startupOverlay.factory,
      createStartupErrorOverlay: startupErrorOverlay.factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createHud: hud.factory,
      createTitleOverlay: titleOverlay.factory,
      createAudio: audio.factory,
      runStartupPreload(onProgress) {
        onProgress(1, 4);
        return deferredPreload.promise;
      },
      windowTarget,
      documentTarget
    });

    expect(shell.phase()).toEqual({ kind: 'loading' });
    expect(startupOverlay.isVisible()).toBe(true);
    expect(startupOverlay.progress()).toEqual({ loaded: 1, total: 4 });
    expect(startupErrorOverlay.isVisible()).toBe(false);
    expect(menu.isVisible()).toBe(false);
    expect(settingsOverlay.isVisible()).toBe(false);
    expect(renderer.calls.create).toBe(0);
    expect(input.calls.create).toBe(0);
    expect(Number(findHarnessRoot(parent, 'startup-overlay')?.style.zIndex ?? '0')).toBeGreaterThan(
      Number(findHarnessRoot(parent, 'menu-overlay')?.style.zIndex ?? '0')
    );

    windowTarget.dispatch('pointerdown', new Event('pointerdown'));
    expect(audio.calls.unlock).toBe(0);

    deferredPreload.resolve();
    await flushUiShellStartup();

    expect(shell.phase()).toEqual({ kind: 'menu' });
    expect(startupOverlay.isVisible()).toBe(false);
    expect(startupErrorOverlay.isVisible()).toBe(false);
    expect(menu.isVisible()).toBe(true);

    windowTarget.dispatch('pointerdown', new Event('pointerdown'));
    expect(audio.calls.unlock).toBe(1);
  });

  it('auto-starts a local requested preset after startup preload', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const startupOverlay = createStartupOverlayHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const escapeProgressPath = createEscapeProgressPathHarness();
    const dungeonWaveCounter = createDungeonWaveCounterHarness();
    const titleOverlay = createTitleOverlayHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });
    let builtPresetId: ModePresetId | null = null;
    const buildSession = vi.fn((preset, _options) => {
      builtPresetId = preset.id;
      return makeSession('autostart-session');
    });

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      autoStartPresetId: 'training',
      startupImageSrc: '/images/slime-escape-training.jpg',
      buildSessionDefinition: buildSession,
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createStartupOverlay: startupOverlay.factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createHud: hud.factory,
      createEscapeProgressPath: escapeProgressPath.factory,
      createDungeonWaveCounter: dungeonWaveCounter.factory,
      createTitleOverlay: titleOverlay.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    expect(buildSession).toHaveBeenCalledTimes(1);
    expect(builtPresetId).toBe('training');
    expect(startupOverlay.lastInit()?.imageSrc).toBe('/images/slime-escape-training.jpg');
    expect(sim.startSessions).toHaveLength(1);
    expect(renderer.calls.create).toBe(1);
    expect(input.calls.create).toBe(1);
    expect(input.calls.start).toBe(1);
    expect(hud.calls.attach).toBe(1);
    expect(escapeProgressPath.calls.attach).toBe(1);
    expect(dungeonWaveCounter.calls.attach).toBe(1);
    expect(titleOverlay.calls.attach).toBe(1);
    expect(menu.isVisible()).toBe(false);
    expect(pause.isVisible()).toBe(false);
    expect(result.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'running' });
  });

  it('auto-starts the portal page into Public Arena online flow after startup preload', async () => {
    const menu = createMenuHarness();
    const status = createPublicArenaStatusHarness();
    const publicArenaMenu = createPublicArenaMenuHarness();
    const publicArenaHud = createPublicArenaHudHarness();
    const publicArenaCombatAffordances = createPublicArenaCombatAffordancesHarness();
    const publicArenaClient = createPublicArenaClientHarness();
    const publicArenaRenderer = createPublicArenaRendererHarness();
    const startupOverlay = createStartupOverlayHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const buildSession = vi.fn(() => makeSession('should-not-start'));
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      autoStartPublicArena: true,
      startupImageSrc: '/images/slime-escape-portal.jpg',
      buildSessionDefinition: buildSession,
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: createPauseHarness().factory,
      createResultOverlay: createResultHarness().factory,
      createSettingsOverlay: createSettingsOverlayHarness().factory,
      createStartupOverlay: startupOverlay.factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createHud: hud.factory,
      createPublicArenaHud: publicArenaHud.factory,
      createPublicArenaCombatAffordances: publicArenaCombatAffordances.factory,
      createPublicArenaMenuOverlay: publicArenaMenu.factory,
      createPublicArenaStatusOverlay: status.factory,
      createPublicArenaClient: publicArenaClient.factory,
      createPublicArenaRenderer: publicArenaRenderer.factory,
      publicArenaConfig: {
        serverUrl: 'https://arena.example.test',
        fullArenaMessage: 'The online arena is full. Try again soon.'
      },
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    expect(startupOverlay.lastInit()?.imageSrc).toBe('/images/slime-escape-portal.jpg');
    expect(publicArenaClient.lastInit()?.serverUrl).toBe('https://arena.example.test');
    expect(shell.phase()).toEqual({ kind: 'onlineConnecting' });
    expect(status.message()).toBe('Joining Public Arena');
    expect(menu.isVisible()).toBe(false);
    expect(buildSession).not.toHaveBeenCalled();
    expect(sim.startSessions).toHaveLength(0);
    expect(renderer.calls.create).toBe(0);
    expect(input.calls.create).toBe(0);
    expect(hud.calls.attach).toBe(0);

    publicArenaClient.accept();

    expect(shell.phase()).toEqual({ kind: 'online' });
    expect(status.isVisible()).toBe(false);
    expect(publicArenaHud.isVisible()).toBe(true);
    expect(publicArenaCombatAffordances.isVisible()).toBe(true);
    expect(publicArenaRenderer.lastInit()).toBeNull();
    expect(buildSession).not.toHaveBeenCalled();
    expect(sim.startSessions).toHaveLength(0);
  });

  it('passes the effective game viewport to renderer fitting', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const mobileInput = createMobileInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });
    let viewport = { width: 844, height: 390 };
    let matchMediaReceiver: unknown = null;
    const gameViewport = {
      current: () => viewport,
      devicePixelRatio: () => 3,
      matchMedia(this: unknown, query: string): MediaQueryList {
        matchMediaReceiver = this;
        return { matches: query === '(test-query)' } as MediaQueryList;
      }
    };

    createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 390 } as HTMLCanvasElement,
      autoStartPresetId: 'training',
      buildSessionDefinition: () => makeSession('mobile-viewport-session'),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createMobileInputController: mobileInput.factory,
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget,
      gameViewport
    });

    await flushUiShellStartup();

    const rendererWindowTarget = renderer.lastInit()?.windowTarget;
    expect(rendererWindowTarget?.innerWidth).toBe(844);
    expect(rendererWindowTarget?.innerHeight).toBe(390);
    expect(rendererWindowTarget?.devicePixelRatio).toBe(3);

    viewport = { width: 932, height: 430 };
    expect(rendererWindowTarget?.innerWidth).toBe(932);
    expect(rendererWindowTarget?.innerHeight).toBe(430);
    expect(rendererWindowTarget?.matchMedia?.('(test-query)').matches).toBe(true);
    expect(matchMediaReceiver).toBe(gameViewport);

    viewport = { width: 960, height: 540 };
    windowTarget.dispatch('orientationchange', new Event('orientationchange'));
    expect(renderer.calls.fitToWindow).toBe(1);
    expect(rendererWindowTarget?.innerWidth).toBe(960);
    expect(rendererWindowTarget?.innerHeight).toBe(540);
  });

  it('derives fallback renderer viewport from the mobile profile when no provider is injected', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const mobileInput = createMobileInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = Object.assign(new FakeEventTarget(), {
      innerWidth: 390,
      innerHeight: 844,
      devicePixelRatio: 2
    });
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 390 } as HTMLCanvasElement,
      autoStartPresetId: 'training',
      buildSessionDefinition: () =>
        makeSession('mobile-fallback-viewport-session', {
          arena: { width: 32, height: 18 }
        }),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createMobileInputController: mobileInput.factory,
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget,
      mobileProfile: { isMobile: true }
    });

    await flushUiShellStartup();

    const rendererWindowTarget = renderer.lastInit()?.windowTarget;
    expect(rendererWindowTarget?.innerWidth).toBe(844);
    expect(rendererWindowTarget?.innerHeight).toBe(390);
    expect(rendererWindowTarget?.devicePixelRatio).toBe(2);
    expect(renderer.lastInit()?.visibleAreaCamera?.visibleArea().width).toBeCloseTo(
      (844 / 390) * 12,
      6
    );

    windowTarget.innerWidth = 430;
    windowTarget.innerHeight = 932;
    windowTarget.dispatch('orientationchange', new Event('orientationchange'));

    expect(renderer.calls.fitToWindow).toBe(1);
    expect(rendererWindowTarget?.innerWidth).toBe(932);
    expect(rendererWindowTarget?.innerHeight).toBe(430);
  });

  it('keeps mobile session building on the content-authored arena', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const mobileInput = createMobileInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const titleOverlay = createTitleOverlayHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });
    const buildOptions: BuildOptions[] = [];

    createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 390 } as HTMLCanvasElement,
      buildSessionDefinition: (preset, options) => {
        buildOptions.push(options);
        return makeSession(`${preset.id}-mobile-session`, {
          arena: { width: 16, height: 9 }
        });
      },
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createMobileInputController: mobileInput.factory,
      createHud: hud.factory,
      createTitleOverlay: titleOverlay.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget,
      mobileProfile: {
        isMobile: true
      }
    });

    await flushUiShellStartup();
    menu.start('training');
    await flushUiShellStartup();

    expect('arenaOverride' in (buildOptions[0] ?? {})).toBe(false);
    expect(sim.startSessions[0]?.arena).toEqual({ width: 16, height: 9 });
    expect(titleOverlay.lastInit()?.isMobile).toBe(true);
  });

  it('maps desktop pointer-lock aim deltas through the desktop visible-area height', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      buildSessionDefinition: () =>
        makeSession('desktop-visible-area-input-session', {
          arena: { width: 32, height: 18 }
        }),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();
    menu.start('training');
    await flushUiShellStartup();

    expect(input.lastInit()?.pixelsPerWorldUnit()).toBeCloseTo(900 / 18, 6);
  });

  it('maps mobile aim-stick deltas through the smaller mobile visible-area height', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const renderer = createRendererHarness();
    const desktopInput = createInputHarness();
    const mobileInput = createMobileInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 390 } as HTMLCanvasElement,
      buildSessionDefinition: () =>
        makeSession('mobile-visible-area-input-session', {
          arena: { width: 32, height: 18 }
        }),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: renderer.factory,
      createInputController: desktopInput.factory,
      createMobileInputController: mobileInput.factory,
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget,
      mobileProfile: {
        isMobile: true
      }
    });

    await flushUiShellStartup();
    menu.start('training');
    await flushUiShellStartup();

    expect(desktopInput.calls.create).toBe(0);
    expect(mobileInput.lastInit()?.pixelsPerWorldUnit()).toBeCloseTo(390 / 12, 6);
    expect(renderer.lastInit()?.visibleAreaCamera?.visibleArea().height).toBe(12);
  });

  it('uses the mobile input adapter in mobile mode and restarts it around overlay pause', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const desktopInput = createInputHarness();
    const mobileInput = createMobileInputHarness();
    const mobileControls = createMobileControlsHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, {
      pointerLockElement: null,
      exitPointerLock: vi.fn()
    });
    const preventDefault = vi.fn();
    const weaponSlotElement = {} as HTMLElement;
    const parent = {
      querySelectorAll: vi.fn(() => [weaponSlotElement])
    } as unknown as HTMLElement;

    const shell = createUiShellForTest({
      parent,
      canvas: { clientHeight: 390 } as HTMLCanvasElement,
      buildSessionDefinition: () => makeSession('mobile-input-session'),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: createRendererHarness().factory,
      createInputController: desktopInput.factory,
      createMobileInputController: mobileInput.factory,
      createMobileControlsOverlay: mobileControls.factory,
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget,
      mobileProfile: {
        isMobile: true
      }
    });

    await flushUiShellStartup();
    menu.start('training');
    await flushUiShellStartup();

    expect(desktopInput.calls.create).toBe(0);
    expect(mobileInput.calls.create).toBe(1);
    expect(mobileInput.calls.start).toBe(1);
    expect(mobileInput.lastInit()?.surface).toBeDefined();
    expect(mobileInput.lastInit()?.pauseElement?.()).toBe(mobileControls.pauseButton());
    expect(mobileInput.lastInit()?.weaponSlotElements?.()).toEqual([weaponSlotElement]);
    expect(mobileControls.isVisible()).toBe(true);

    windowTarget.dispatch(
      'keydown',
      {
        code: 'Space',
        preventDefault,
        repeat: false
      } as unknown as Event
    );

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(documentTarget.exitPointerLock).not.toHaveBeenCalled();
    expect(mobileInput.calls.stop).toBe(1);
    expect(sim.calls.pause).toBe(1);
    expect(mobileControls.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'paused' });

    pause.resume();

    expect(mobileInput.calls.start).toBe(2);
    expect(mobileInput.calls.requestLock).toBe(0);
    expect(sim.calls.resume).toBe(1);
    expect(mobileControls.isVisible()).toBe(true);
    expect(shell.phase()).toEqual({ kind: 'running' });
  });

  it('keeps the startup overlay visible while the post-load ritual runs', async () => {
    const parent = new FakeDomElement();
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const ritual = createDeferredVoid();
    const startupOverlay = createStartupOverlayHarness({ ritualPromise: ritual.promise });
    const startupErrorOverlay = createStartupErrorOverlayHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: parent as unknown as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: createSimHarness().factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createStartupOverlay: startupOverlay.factory,
      createStartupErrorOverlay: startupErrorOverlay.factory,
      createRenderer: createRendererHarness().factory,
      createInputController: createInputHarness().factory,
      createHud: createHudHarness().factory,
      createAudio: createAudioHarness().factory,
      runStartupPreload(onProgress) {
        onProgress(4, 4);
        return Promise.resolve(EMPTY_TEXTURE_MAP);
      },
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    expect(startupOverlay.ritualCalls()).toBe(1);
    expect(shell.phase()).toEqual({ kind: 'loading' });
    expect(startupOverlay.isVisible()).toBe(true);
    expect(menu.isVisible()).toBe(false);

    ritual.resolve();
    await flushUiShellStartup();

    expect(shell.phase()).toEqual({ kind: 'menu' });
    expect(startupOverlay.isVisible()).toBe(false);
    expect(menu.isVisible()).toBe(true);
  });

  it('uses the phase transition curtain when startup reveals the menu', async () => {
    const parent = new FakeDomElement();
    const menu = createMenuHarness();
    const transition = createPhaseTransitionCurtainHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: parent as unknown as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: createSimHarness().factory,
      createMenuOverlay: menu.factory,
      createPhaseTransitionCurtain: transition.factory,
      createPauseOverlay: createPauseHarness().factory,
      createResultOverlay: createResultHarness().factory,
      createSettingsOverlay: createSettingsOverlayHarness().factory,
      createStartupOverlay: createStartupOverlayHarness().factory,
      createStartupErrorOverlay: createStartupErrorOverlayHarness().factory,
      createRenderer: createRendererHarness().factory,
      createInputController: createInputHarness().factory,
      createHud: createHudHarness().factory,
      createAudio: createAudioHarness().factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    expect(transition.calls.run).toBe(1);
    expect(shell.phase()).toEqual({ kind: 'menu' });
    expect(menu.isVisible()).toBe(true);
  });

  it('transitions loading into preload error and exposes only reload', async () => {
    const parent = new FakeDomElement();
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const startupOverlay = createStartupOverlayHarness();
    const startupErrorOverlay = createStartupErrorOverlayHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });
    let reloadCalls = 0;

    const shell = createUiShellForTest({
      parent: parent as unknown as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: createSimHarness().factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createStartupOverlay: startupOverlay.factory,
      createStartupErrorOverlay: startupErrorOverlay.factory,
      createRenderer: createRendererHarness().factory,
      createInputController: createInputHarness().factory,
      createHud: createHudHarness().factory,
      createAudio: audio.factory,
      runStartupPreload() {
        return Promise.reject(new Error('failed to decode /assets/hero.png'));
      },
      reloadPage() {
        reloadCalls += 1;
      },
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    expect(shell.phase()).toEqual({
      kind: 'error',
      reason: 'preload',
      message: 'failed to decode /assets/hero.png'
    });
    expect(startupOverlay.isVisible()).toBe(false);
    expect(startupErrorOverlay.isVisible()).toBe(true);
    expect(startupErrorOverlay.message()).toBe('failed to decode /assets/hero.png');
    expect(menu.isVisible()).toBe(false);
    expect(pause.isVisible()).toBe(false);
    expect(result.isVisible()).toBe(false);
    expect(settingsOverlay.isVisible()).toBe(false);
    expect(Number(findHarnessRoot(parent, 'startup-error-overlay')?.style.zIndex ?? '0')).toBeGreaterThan(
      Number(findHarnessRoot(parent, 'startup-overlay')?.style.zIndex ?? '0')
    );

    windowTarget.dispatch('pointerdown', new Event('pointerdown'));
    expect(audio.calls.unlock).toBe(0);

    startupErrorOverlay.reload();
    expect(reloadCalls).toBe(1);
  });

  it('starts a session from the menu and hides overlays while running', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const escapeProgressPath = createEscapeProgressPathHarness();
    const dungeonWaveCounter = createDungeonWaveCounterHarness();
    const titleOverlay = createTitleOverlayHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });
    let builtPresetId: ModePresetId | null = null;
    const buildSession = vi.fn((preset, _options) => {
      builtPresetId = preset.id;
      return makeSession('running-session');
    });

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 123,
      buildSessionDefinition: buildSession,
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createHud: hud.factory,
      createEscapeProgressPath: escapeProgressPath.factory,
      createDungeonWaveCounter: dungeonWaveCounter.factory,
      createTitleOverlay: titleOverlay.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    expect(menu.modes().map((mode) => mode.presetId)).toEqual(
      getPlayableModeCatalog().map((mode) => mode.presetId)
    );
    expect(audio.calls.unlock).toBe(0);

    windowTarget.dispatch('pointerdown', new Event('pointerdown'));
    windowTarget.dispatch('keydown', new Event('keydown'));

    expect(audio.calls.unlock).toBe(1);

    menu.start('training');

    expect(buildSession).toHaveBeenCalledTimes(1);
    expect(builtPresetId).toBe('training');
    expect(renderer.lastInit()?.renderScalePreset).toBe('high');
    expect(sim.startSessions).toHaveLength(1);
    expect(audio.attachedSessions).toHaveLength(1);
    expect(audio.uiEvents).toContain('buttonClick');
    expect(renderer.calls.create).toBe(1);
    expect(input.calls.create).toBe(1);
    expect(input.calls.start).toBe(1);
    expect(hud.calls.attach).toBe(1);
    expect(escapeProgressPath.calls.attach).toBe(1);
    expect(dungeonWaveCounter.calls.attach).toBe(1);
    expect(titleOverlay.calls.attach).toBe(1);
    expect(menu.isVisible()).toBe(false);
    expect(pause.isVisible()).toBe(false);
    expect(result.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'running' });

    shell.onFrame();
    expect(hud.calls.update).toBe(1);
    expect(escapeProgressPath.calls.update).toBe(1);
    expect(dungeonWaveCounter.calls.update).toBe(1);
    expect(titleOverlay.calls.update).toBe(1);
    expect(audio.calls.update).toBe(1);
  });

  it('starts the public arena connection without starting a local session', async () => {
    const menu = createMenuHarness();
    const status = createPublicArenaStatusHarness();
    const publicArenaMenu = createPublicArenaMenuHarness();
    const publicArenaHud = createPublicArenaHudHarness();
    const publicArenaCombatAffordances = createPublicArenaCombatAffordancesHarness();
    const publicArenaClient = createPublicArenaClientHarness();
    const publicArenaRenderer = createPublicArenaRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: createPauseHarness().factory,
      createResultOverlay: createResultHarness().factory,
      createSettingsOverlay: createSettingsOverlayHarness().factory,
      createHud: hud.factory,
      createPublicArenaHud: publicArenaHud.factory,
      createPublicArenaCombatAffordances: publicArenaCombatAffordances.factory,
      createPublicArenaMenuOverlay: publicArenaMenu.factory,
      createPublicArenaStatusOverlay: status.factory,
      createPublicArenaClient: publicArenaClient.factory,
      createPublicArenaRenderer: publicArenaRenderer.factory,
      createInputController: input.factory,
      createAudio: audio.factory,
      publicArenaConfig: {
        serverUrl: 'https://arena.example.test',
        fullArenaMessage: 'The online arena is full. Try again soon.'
      },
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();
    menu.startPublicArena();

    expect(publicArenaClient.lastInit()?.serverUrl).toBe('https://arena.example.test');
    expect(shell.phase()).toEqual({ kind: 'onlineConnecting' });
    expect(status.message()).toBe('Joining Public Arena');
    expect(sim.startSessions).toHaveLength(0);

    publicArenaClient.accept();

    expect(shell.phase()).toEqual({ kind: 'online' });
    expect(status.isVisible()).toBe(false);
    expect(publicArenaHud.isVisible()).toBe(true);
    expect(publicArenaCombatAffordances.isVisible()).toBe(true);
    expect(publicArenaRenderer.lastInit()).toBeNull();

    publicArenaClient.snapshot();
    shell.onFrame();

    expect(input.calls.create).toBe(1);
    expect(input.calls.start).toBe(1);
    expect(input.lastInit()?.initialAim).toEqual({ x: 1, y: 2 });
    expect(input.lastInit()?.pixelsPerWorldUnit()).toBeCloseTo(900 / 18, 6);
    expect(publicArenaRenderer.lastInit()?.arena).toEqual(PUBLIC_ARENA_WORLD_BOUNDS);
    expect(publicArenaRenderer.lastInit()?.selfId).toBe('socket-a');
    expect(publicArenaRenderer.lastInit()?.visibleAreaCamera?.visibleArea().center).toEqual({
      x: 1,
      y: 2
    });
    expect(publicArenaRenderer.lastInit()?.getAim?.()).toEqual({ x: 0, y: 0 });
    expect(publicArenaHud.level()).toBe(`Level 3/${PUBLIC_ARENA_BOSS_LEVEL}`);
    expect(publicArenaHud.population()).toBe('Online 7');
    expect(publicArenaCombatAffordances.lastSelfId()).toBe('socket-a');
    expect(publicArenaRenderer.calls.render).toBe(1);

    publicArenaClient.presentation({
      kind: 'fire',
      simTimeMs: 140,
      shooterId: 'socket-a',
      ownerKind: 'player',
      weaponArchetypeId: 'rock-thrower',
      originX: 1,
      originY: 2,
      dirX: 1,
      dirY: 0
    });

    expect(audio.events.at(-1)).toMatchObject({
      kind: 'fire',
      weaponArchetypeId: 'rock-thrower',
      ownerKind: 'player'
    });

    publicArenaClient.presentation({
      kind: 'hit',
      simTimeMs: 150,
      projectileId: 'projectile-a',
      ownerId: 'socket-a',
      ownerKind: 'player',
      targetId: 'socket-b',
      targetForm: { kind: 'slime', archetypeId: 'slime-one-eye' },
      weaponArchetypeId: 'rock-thrower',
      damage: 3,
      x: 3,
      y: 2,
      impactDirX: 1,
      impactDirY: 0
    });

    expect(audio.events.at(-1)).toMatchObject({
      kind: 'hit',
      targetKind: 'enemy',
      targetArchetypeId: 'slime-one-eye',
      weaponArchetypeId: 'rock-thrower'
    });

    publicArenaClient.presentation({
      kind: 'hit',
      simTimeMs: 151,
      projectileId: 'projectile-b',
      ownerId: 'socket-b',
      ownerKind: 'player',
      targetId: 'socket-a',
      targetForm: { kind: 'slime', archetypeId: 'slime-hornling' },
      weaponArchetypeId: 'rock-thrower',
      damage: 3,
      x: 1,
      y: 2,
      impactDirX: -1,
      impactDirY: 0
    });

    expect(audio.events.at(-1)).toMatchObject({
      kind: 'hit',
      targetKind: 'enemy',
      targetArchetypeId: 'slime-hornling',
      weaponArchetypeId: 'rock-thrower'
    });

    publicArenaClient.presentation({
      kind: 'death',
      simTimeMs: 160,
      playerId: 'socket-b',
      killerId: 'socket-a',
      form: { kind: 'boss', archetypeId: 'boss-tower-sentinel' },
      weaponArchetypeId: 'rock-thrower',
      x: 3,
      y: 2
    });

    expect(audio.events.at(-1)).toMatchObject({
      kind: 'death',
      entityKind: 'boss',
      archetypeId: 'boss-tower-sentinel',
      weaponArchetypeId: 'rock-thrower'
    });

    input.lastInit()?.onCommand({ kind: 'move', dx: 1, dy: 0 });
    input.lastInit()?.onCommand({ kind: 'aim', x: 3, y: 4 });
    input.lastInit()?.onCommand({ kind: 'fire', phase: 'start' });
    input.lastInit()?.onCommand({ kind: 'selectWeaponSlot', slotIndex: 1 });
    input.lastInit()?.onCommand({ kind: 'holsterWeapon' });

    expect(publicArenaClient.sentInputs()).toEqual([
      { kind: 'move', dx: 1, dy: 0 },
      { kind: 'aim', x: 3, y: 4 },
      { kind: 'fire', phase: 'start' },
      { kind: 'selectWeaponSlot', slotIndex: 1 }
    ]);

    windowTarget.dispatch(
      'keydown',
      {
        code: 'Escape',
        preventDefault() {},
        repeat: false
      } as unknown as Event
    );

    expect(publicArenaMenu.isVisible()).toBe(true);
    expect(publicArenaClient.disconnectCalls()).toBe(0);
    expect(input.calls.stop).toBe(1);
    expect(publicArenaRenderer.calls.dispose).toBe(0);
    expect(publicArenaHud.isVisible()).toBe(true);
    expect(publicArenaCombatAffordances.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'online' });
    expect(publicArenaClient.sentInputs()).toEqual([
      { kind: 'move', dx: 1, dy: 0 },
      { kind: 'aim', x: 3, y: 4 },
      { kind: 'fire', phase: 'start' },
      { kind: 'selectWeaponSlot', slotIndex: 1 },
      { kind: 'move', dx: 0, dy: 0 },
      { kind: 'fire', phase: 'stop' }
    ]);

    publicArenaMenu.exit();

    expect(publicArenaClient.disconnectCalls()).toBe(1);
    expect(input.calls.stop).toBe(1);
    expect(publicArenaRenderer.calls.dispose).toBe(1);
    expect(publicArenaHud.isVisible()).toBe(false);
    expect(publicArenaCombatAffordances.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'menu' });

    publicArenaClient.close('Arena server is restarting.');

    expect(shell.phase()).toEqual({ kind: 'menu' });
    expect(menu.latestFeedback()).toBeNull();
  });

  it('wires Vibe Jam portal descriptors into Public Arena presentation without server state', async () => {
    const menu = createMenuHarness();
    const publicArenaClient = createPublicArenaClientHarness();
    const publicArenaRenderer = createPublicArenaRendererHarness();
    const portalController = createVibeJamPortalControllerHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      portalHref: 'https://slimeescape.com/portal?portal=true&ref=https%3A%2F%2Fprevious.example',
      portalStorage: null,
      createSimWorkerHost: createSimHarness().factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: createPauseHarness().factory,
      createResultOverlay: createResultHarness().factory,
      createSettingsOverlay: createSettingsOverlayHarness().factory,
      createHud: createHudHarness().factory,
      createPublicArenaHud: createPublicArenaHudHarness().factory,
      createPublicArenaCombatAffordances: createPublicArenaCombatAffordancesHarness().factory,
      createPublicArenaMenuOverlay: createPublicArenaMenuHarness().factory,
      createPublicArenaStatusOverlay: createPublicArenaStatusHarness().factory,
      createPublicArenaClient: publicArenaClient.factory,
      createPublicArenaRenderer: publicArenaRenderer.factory,
      createInputController: createInputHarness().factory,
      createVibeJamPortalController: portalController.factory,
      publicArenaConfig: {
        serverUrl: 'https://arena.example.test',
        fullArenaMessage: 'The online arena is full. Try again soon.'
      },
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();
    menu.startPublicArena();
    publicArenaClient.accept();
    publicArenaClient.snapshot();
    shell.onFrame();

    expect(portalController.calls.attachPublicArena).toBe(1);
    expect(portalController.calls.updatePublicArena).toBe(1);
    expect(publicArenaRenderer.lastInit()?.getPortalDescriptors?.()).toEqual([]);

    shell.dispose();

    expect(portalController.calls.detachSession).toBeGreaterThanOrEqual(1);
  });

  it.each(['Escape', 'Space'])(
    'opens the Public Arena menu for desktop %s without leaving or pausing local sim',
    async (code) => {
      const menu = createMenuHarness();
      const status = createPublicArenaStatusHarness();
      const publicArenaMenu = createPublicArenaMenuHarness();
      const publicArenaHud = createPublicArenaHudHarness();
      const publicArenaClient = createPublicArenaClientHarness();
      const publicArenaRenderer = createPublicArenaRendererHarness();
      const input = createInputHarness();
      const sim = createSimHarness();
      const hud = createHudHarness();
      const audio = createAudioHarness();
      const windowTarget = new FakeEventTarget();
      const documentEvents = new FakeEventTarget();
      const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });
      const preventDefault = vi.fn();

      const shell = createUiShellForTest({
        parent: {} as HTMLElement,
        canvas: { clientHeight: 900 } as HTMLCanvasElement,
        createSimWorkerHost: sim.factory,
        createMenuOverlay: menu.factory,
        createPauseOverlay: createPauseHarness().factory,
        createResultOverlay: createResultHarness().factory,
        createSettingsOverlay: createSettingsOverlayHarness().factory,
        createHud: hud.factory,
        createPublicArenaHud: publicArenaHud.factory,
        createPublicArenaMenuOverlay: publicArenaMenu.factory,
        createPublicArenaStatusOverlay: status.factory,
        createPublicArenaClient: publicArenaClient.factory,
        createPublicArenaRenderer: publicArenaRenderer.factory,
        createInputController: input.factory,
        createAudio: audio.factory,
        publicArenaConfig: {
          serverUrl: 'https://arena.example.test',
          fullArenaMessage: 'The online arena is full. Try again soon.'
        },
        windowTarget,
        documentTarget
      });

      await flushUiShellStartup();
      menu.startPublicArena();
      publicArenaClient.accept();
      publicArenaClient.snapshot();

      expect(shell.phase()).toEqual({ kind: 'online' });
      expect(input.calls.start).toBe(1);

      windowTarget.dispatch(
        'keydown',
        {
          code,
          preventDefault,
          repeat: false
        } as unknown as Event
      );

      expect(preventDefault).toHaveBeenCalledTimes(1);
      expect(publicArenaMenu.isVisible()).toBe(true);
      expect(publicArenaClient.disconnectCalls()).toBe(0);
      expect(input.calls.stop).toBe(1);
      expect(publicArenaRenderer.calls.dispose).toBe(0);
      expect(publicArenaHud.isVisible()).toBe(true);
      expect(publicArenaClient.sentInputs()).toEqual([
        { kind: 'move', dx: 0, dy: 0 },
        { kind: 'fire', phase: 'stop' }
      ]);
      expect(sim.calls.pause).toBe(0);
      expect(sim.calls.stop).toBe(0);
      expect(shell.phase()).toEqual({ kind: 'online' });

      publicArenaMenu.exit();

      expect(publicArenaClient.disconnectCalls()).toBe(1);
      expect(publicArenaRenderer.calls.dispose).toBe(1);
      expect(publicArenaHud.isVisible()).toBe(false);
      expect(shell.phase()).toEqual({ kind: 'menu' });
    }
  );

  it('resumes desktop public arena from the explicit menu without disconnecting', async () => {
    const menu = createMenuHarness();
    const status = createPublicArenaStatusHarness();
    const publicArenaMenu = createPublicArenaMenuHarness();
    const publicArenaHud = createPublicArenaHudHarness();
    const publicArenaCombatAffordances = createPublicArenaCombatAffordancesHarness();
    const publicArenaClient = createPublicArenaClientHarness();
    const publicArenaRenderer = createPublicArenaRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: createPauseHarness().factory,
      createResultOverlay: createResultHarness().factory,
      createSettingsOverlay: createSettingsOverlayHarness().factory,
      createHud: hud.factory,
      createPublicArenaHud: publicArenaHud.factory,
      createPublicArenaCombatAffordances: publicArenaCombatAffordances.factory,
      createPublicArenaMenuOverlay: publicArenaMenu.factory,
      createPublicArenaStatusOverlay: status.factory,
      createPublicArenaClient: publicArenaClient.factory,
      createPublicArenaRenderer: publicArenaRenderer.factory,
      createInputController: input.factory,
      createAudio: audio.factory,
      publicArenaConfig: {
        serverUrl: 'https://arena.example.test',
        fullArenaMessage: 'The online arena is full. Try again soon.'
      },
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();
    menu.startPublicArena();
    publicArenaClient.accept();
    publicArenaClient.snapshot();

    windowTarget.dispatch(
      'keydown',
      {
        code: 'Escape',
        preventDefault() {},
        repeat: false
      } as unknown as Event
    );

    expect(publicArenaMenu.isVisible()).toBe(true);
    expect(input.calls.stop).toBe(1);

    publicArenaMenu.resume();

    expect(publicArenaMenu.isVisible()).toBe(false);
    expect(publicArenaClient.disconnectCalls()).toBe(0);
    expect(input.calls.create).toBe(2);
    expect(input.calls.start).toBe(2);
    expect(publicArenaRenderer.calls.dispose).toBe(0);
    expect(publicArenaHud.isVisible()).toBe(true);
    expect(sim.calls.pause).toBe(0);
    expect(shell.phase()).toEqual({ kind: 'online' });

    input.lastInit()?.onCommand({ kind: 'move', dx: -1, dy: 0 });

    expect(publicArenaClient.sentInputs()).toEqual([
      { kind: 'move', dx: 0, dy: 0 },
      { kind: 'fire', phase: 'stop' },
      { kind: 'move', dx: -1, dy: 0 }
    ]);
  });

  it('opens the Public Arena menu on desktop Pointer Lock loss without leaving', async () => {
    const menu = createMenuHarness();
    const status = createPublicArenaStatusHarness();
    const publicArenaMenu = createPublicArenaMenuHarness();
    const publicArenaHud = createPublicArenaHudHarness();
    const publicArenaCombatAffordances = createPublicArenaCombatAffordancesHarness();
    const publicArenaClient = createPublicArenaClientHarness();
    const publicArenaRenderer = createPublicArenaRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: createPauseHarness().factory,
      createResultOverlay: createResultHarness().factory,
      createSettingsOverlay: createSettingsOverlayHarness().factory,
      createHud: hud.factory,
      createPublicArenaHud: publicArenaHud.factory,
      createPublicArenaCombatAffordances: publicArenaCombatAffordances.factory,
      createPublicArenaMenuOverlay: publicArenaMenu.factory,
      createPublicArenaStatusOverlay: status.factory,
      createPublicArenaClient: publicArenaClient.factory,
      createPublicArenaRenderer: publicArenaRenderer.factory,
      createInputController: input.factory,
      createAudio: audio.factory,
      publicArenaConfig: {
        serverUrl: 'https://arena.example.test',
        fullArenaMessage: 'The online arena is full. Try again soon.'
      },
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();
    menu.startPublicArena();
    publicArenaClient.accept();
    publicArenaClient.snapshot();

    expect(shell.phase()).toEqual({ kind: 'online' });
    expect(input.calls.start).toBe(1);

    documentEvents.dispatch('pointerlockchange', new Event('pointerlockchange'));

    expect(publicArenaMenu.isVisible()).toBe(true);
    expect(publicArenaClient.disconnectCalls()).toBe(0);
    expect(input.calls.stop).toBe(1);
    expect(publicArenaRenderer.calls.dispose).toBe(0);
    expect(publicArenaHud.isVisible()).toBe(true);
    expect(publicArenaClient.sentInputs()).toEqual([
      { kind: 'move', dx: 0, dy: 0 },
      { kind: 'fire', phase: 'stop' }
    ]);
    expect(sim.calls.pause).toBe(0);
    expect(sim.calls.stop).toBe(0);
    expect(shell.phase()).toEqual({ kind: 'online' });

    publicArenaMenu.exit();

    expect(publicArenaClient.disconnectCalls()).toBe(1);
    expect(publicArenaRenderer.calls.dispose).toBe(1);
    expect(publicArenaHud.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'menu' });
  });

  it('shows rejection feedback and leaves the player outside the public arena', async () => {
    const menu = createMenuHarness();
    const status = createPublicArenaStatusHarness();
    const publicArenaClient = createPublicArenaClientHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: createPauseHarness().factory,
      createResultOverlay: createResultHarness().factory,
      createSettingsOverlay: createSettingsOverlayHarness().factory,
      createHud: hud.factory,
      createPublicArenaStatusOverlay: status.factory,
      createPublicArenaClient: publicArenaClient.factory,
      createAudio: audio.factory,
      publicArenaConfig: {
        serverUrl: 'https://arena.example.test',
        fullArenaMessage: 'The online arena is full. Try again soon.'
      },
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();
    menu.startPublicArena();
    publicArenaClient.reject('The online arena is full. Try again soon.');

    expect(shell.phase()).toEqual({ kind: 'menu' });
    expect(status.isVisible()).toBe(false);
    expect(menu.latestFeedback()).toBe('The online arena is full. Try again soon.');
    expect(sim.startSessions).toHaveLength(0);
  });

  it('routes mobile public arena input through the online client', async () => {
    const menu = createMenuHarness();
    const status = createPublicArenaStatusHarness();
    const publicArenaMenu = createPublicArenaMenuHarness();
    const publicArenaHud = createPublicArenaHudHarness();
    const publicArenaCombatAffordances = createPublicArenaCombatAffordancesHarness();
    const publicArenaClient = createPublicArenaClientHarness();
    const publicArenaRenderer = createPublicArenaRendererHarness();
    const desktopInput = createInputHarness();
    const mobileInput = createMobileInputHarness();
    const mobileControls = createMobileControlsHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });
    const weaponSlotElement = {} as HTMLElement;
    const parent = {
      querySelectorAll: vi.fn(() => [weaponSlotElement])
    } as unknown as HTMLElement;

    const shell = createUiShellForTest({
      parent,
      canvas: { clientHeight: 390 } as HTMLCanvasElement,
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: createPauseHarness().factory,
      createResultOverlay: createResultHarness().factory,
      createSettingsOverlay: createSettingsOverlayHarness().factory,
      createHud: hud.factory,
      createPublicArenaHud: publicArenaHud.factory,
      createPublicArenaCombatAffordances: publicArenaCombatAffordances.factory,
      createPublicArenaMenuOverlay: publicArenaMenu.factory,
      createPublicArenaStatusOverlay: status.factory,
      createPublicArenaClient: publicArenaClient.factory,
      createPublicArenaRenderer: publicArenaRenderer.factory,
      createInputController: desktopInput.factory,
      createMobileInputController: mobileInput.factory,
      createMobileControlsOverlay: mobileControls.factory,
      createAudio: audio.factory,
      publicArenaConfig: {
        serverUrl: 'https://arena.example.test',
        fullArenaMessage: 'The online arena is full. Try again soon.'
      },
      windowTarget,
      documentTarget,
      mobileProfile: {
        isMobile: true
      }
    });

    await flushUiShellStartup();
    menu.startPublicArena();
    publicArenaClient.accept();

    expect(shell.phase()).toEqual({ kind: 'online' });
    expect(mobileControls.isVisible()).toBe(true);
    expect(publicArenaCombatAffordances.createCount()).toBe(0);
    expect(publicArenaCombatAffordances.isVisible()).toBe(false);
    expect(mobileInput.calls.create).toBe(0);

    publicArenaClient.snapshot();

    expect(desktopInput.calls.create).toBe(0);
    expect(mobileInput.calls.create).toBe(1);
    expect(mobileInput.calls.start).toBe(1);
    expect(mobileInput.lastInit()?.surface).toBe(parent);
    expect(mobileInput.lastInit()?.pauseElement?.()).toBe(mobileControls.pauseButton());
    expect(mobileInput.lastInit()?.weaponSlotElements?.()).toEqual([weaponSlotElement]);
    expect(mobileInput.lastInit()?.initialAim).toEqual({ x: 1, y: 2 });
    expect(mobileInput.lastInit()?.pixelsPerWorldUnit()).toBeCloseTo(390 / 12, 6);

    mobileInput.lastInit()?.onCommand({ kind: 'move', dx: 0, dy: -1 });
    mobileInput.lastInit()?.onCommand({ kind: 'aim', x: 5, y: 6 });
    mobileInput.lastInit()?.onCommand({ kind: 'fire', phase: 'stop' });
    mobileInput.lastInit()?.onCommand({ kind: 'selectWeaponSlot', slotIndex: 0 });

    expect(publicArenaClient.sentInputs()).toEqual([
      { kind: 'move', dx: 0, dy: -1 },
      { kind: 'aim', x: 5, y: 6 },
      { kind: 'fire', phase: 'stop' },
      { kind: 'selectWeaponSlot', slotIndex: 0 }
    ]);

    mobileInput.lastInit()?.onPause();

    expect(publicArenaMenu.isVisible()).toBe(true);
    expect(publicArenaClient.disconnectCalls()).toBe(0);
    expect(mobileInput.calls.stop).toBe(1);
    expect(publicArenaRenderer.calls.dispose).toBe(0);
    expect(publicArenaHud.isVisible()).toBe(true);
    expect(mobileControls.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'online' });
    expect(publicArenaClient.sentInputs()).toEqual([
      { kind: 'move', dx: 0, dy: -1 },
      { kind: 'aim', x: 5, y: 6 },
      { kind: 'fire', phase: 'stop' },
      { kind: 'selectWeaponSlot', slotIndex: 0 },
      { kind: 'move', dx: 0, dy: 0 },
      { kind: 'fire', phase: 'stop' }
    ]);
    expect(sim.startSessions).toHaveLength(0);

    publicArenaMenu.exit();

    expect(publicArenaClient.disconnectCalls()).toBe(1);
    expect(publicArenaRenderer.calls.dispose).toBe(1);
    expect(mobileControls.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'menu' });
  });

  it('keeps the public arena entry visible when no server URL is configured', async () => {
    const menu = createMenuHarness();
    const publicArenaClient = createPublicArenaClientHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: createPauseHarness().factory,
      createResultOverlay: createResultHarness().factory,
      createSettingsOverlay: createSettingsOverlayHarness().factory,
      createHud: hud.factory,
      createPublicArenaClient: publicArenaClient.factory,
      createAudio: audio.factory,
      publicArenaConfig: {
        serverUrl: null,
        fullArenaMessage: 'The online arena is full. Try again soon.'
      },
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();
    menu.startPublicArena();

    expect(shell.phase()).toEqual({ kind: 'menu' });
    expect(publicArenaClient.lastInit()).toBeNull();
    expect(menu.latestFeedback()).toBe('Public arena server is not configured.');
  });

  it('wires the Vibe Jam portal controller to session attach, frames, and teardown', async () => {
    const menu = createMenuHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const portalController = createVibeJamPortalControllerHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      portalHref: 'https://slimeescape.com/portal?portal=true&ref=https%3A%2F%2Fprevious.example',
      portalStorage: null,
      buildSessionDefinition: () => makeSession('portal-controller-session'),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: createPauseHarness().factory,
      createResultOverlay: createResultHarness().factory,
      createSettingsOverlay: createSettingsOverlayHarness().factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createHud: hud.factory,
      createVibeJamPortalController: portalController.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    expect(portalController.calls.create).toBe(1);
    expect(portalController.lastInit()?.href).toBe(
      'https://slimeescape.com/portal?portal=true&ref=https%3A%2F%2Fprevious.example'
    );

    menu.start('training');
    shell.onFrame();

    expect(portalController.calls.attachSession).toBe(1);
    expect(portalController.calls.update).toBe(1);

    windowTarget.dispatch(
      'keydown',
      {
        code: 'Escape',
        preventDefault() {},
        repeat: false
      } as unknown as Event
    );
    shell.dispose();

    expect(portalController.calls.detachSession).toBe(1);
  });

  it('ignores repeated start clicks while the menu-to-running curtain is active', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const transition = createPhaseTransitionCurtainHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });
    const gate = createDeferredVoid();

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 321,
      buildSessionDefinition: () => makeSession('guarded-session'),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPhaseTransitionCurtain: transition.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();
    expect(transition.calls.run).toBe(1);

    transition.deferNextRun(gate.promise);
    menu.start('campaign-normal');
    await flushUiShellStartup();

    expect(transition.isActive()).toBe(true);
    expect(shell.phase()).toEqual({ kind: 'menu' });
    expect(sim.startSessions).toHaveLength(0);
    expect(audio.uiEvents).toEqual(['buttonClick']);

    menu.start('campaign-hard');
    expect(audio.uiEvents).toEqual(['buttonClick']);
    expect(sim.startSessions).toHaveLength(0);

    gate.resolve();
    await flushUiShellStartup();

    expect(transition.calls.run).toBe(2);
    expect(sim.startSessions).toHaveLength(1);
    expect(renderer.calls.create).toBe(1);
    expect(input.calls.start).toBe(1);
    expect(shell.phase()).toEqual({ kind: 'running' });
  });

  it('starts gameplay input only when the running screen begins reveal', async () => {
    const menu = createMenuHarness();
    const transition = createPhaseTransitionCurtainHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });
    const revealGate = createDeferredVoid();

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 654,
      buildSessionDefinition: () => makeSession('reveal-session'),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPhaseTransitionCurtain: transition.factory,
      createPauseOverlay: createPauseHarness().factory,
      createResultOverlay: createResultHarness().factory,
      createSettingsOverlay: createSettingsOverlayHarness().factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    transition.deferNextReveal(revealGate.promise);
    menu.start('campaign-normal');
    await flushUiShellStartup();

    expect(shell.phase()).toEqual({ kind: 'running' });
    expect(sim.startSessions).toHaveLength(1);
    expect(renderer.calls.create).toBe(1);
    expect(hud.calls.attach).toBe(1);
    expect(input.calls.start).toBe(0);

    revealGate.resolve();
    await flushUiShellStartup();

    expect(input.calls.start).toBe(1);
  });

  it('routes training, fullscreen, teaser, and menu screen callbacks without starting teaser sessions', async () => {
    const menu = createMenuHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const requestFullscreen = vi.fn(() => Promise.resolve());
    const documentTarget = Object.assign(documentEvents, {
      pointerLockElement: null,
      fullscreenElement: null,
      documentElement: { requestFullscreen }
    });
    let builtPresetId: ModePresetId | null = null;

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 777,
      buildSessionDefinition: (preset) => {
        builtPresetId = preset.id;
        return makeSession('training-session');
      },
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: createPauseHarness().factory,
      createResultOverlay: createResultHarness().factory,
      createSettingsOverlay: createSettingsOverlayHarness().factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createHud: createHudHarness().factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.hoverButton();
    menu.switchMode();
    menu.teaser('soon');
    menu.openScreen('pets');
    await flushUiShellStartup();
    expect(menu.screen()).toBe('pets');
    menu.backToMainMenu();
    await flushUiShellStartup();
    expect(menu.screen()).toBe('main');
    expect(sim.startSessions).toHaveLength(0);

    menu.toggleFullscreen();
    expect(requestFullscreen).toHaveBeenCalledTimes(1);

    menu.startTraining();

    expect(builtPresetId).toBe('training');
    expect(sim.startSessions).toHaveLength(1);
    expect(renderer.calls.create).toBe(1);
    expect(input.calls.start).toBe(1);
    expect(audio.uiEvents).toEqual([
      'buttonHover',
      'modeSwitch',
      'buttonClick',
      'buttonClick',
      'buttonClick',
      'buttonClick',
      'buttonClick'
    ]);
    expect(shell.phase()).toEqual({ kind: 'running' });
  });

  it('wires Lab pet purchases through client progression and refreshes menu state', async () => {
    const menu = createMenuHarness();
    const store = createClientProgressionStore({
      storage: null,
      randomInt: () => 0
    });
    store.awardXp(125);
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      buildSessionDefinition: () => makeSession('lab-session'),
      createSimWorkerHost: createSimHarness().factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: createPauseHarness().factory,
      createResultOverlay: createResultHarness().factory,
      createSettingsOverlay: createSettingsOverlayHarness().factory,
      createRenderer: createRendererHarness().factory,
      createInputController: createInputHarness().factory,
      createHud: createHudHarness().factory,
      createAudio: createAudioHarness().factory,
      createClientProgressionStore: () => store,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    expect(menu.latestLabViewModel()?.totalXp).toBe(125);
    expect(menu.latestLabViewModel()?.stands.green).toMatchObject({
      price: 25,
      affordable: true,
      complete: false
    });
    expect(menu.latestLabViewModel()?.stands.purple.price).toBe(75);

    const purchasedPetIds: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      const result = menu.purchasePet('green');
      if (result === null || !result.ok) {
        throw new Error('expected green pet purchase to succeed');
      }
      purchasedPetIds.push(result.petId);
    }

    expect(purchasedPetIds).toEqual(['pet-01', 'pet-02', 'pet-03', 'pet-04', 'pet-05']);
    expect(store.get().ownedPetIds).toEqual(purchasedPetIds);
    expect(store.get().totalXp).toBe(0);
    expect(menu.latestLabViewModel()?.stands.green).toMatchObject({
      affordable: false,
      complete: true,
      ownedCount: 5,
      totalCount: 5
    });

    const completeResult = menu.purchasePet('green');

    expect(completeResult).toMatchObject({
      ok: false,
      reason: 'complete',
      totalXp: 0
    });
    expect(store.get().ownedPetIds).toEqual(purchasedPetIds);
  });

  it('wires Pets selection and clearing through client progression', async () => {
    const menu = createMenuHarness();
    const store = createClientProgressionStore({
      storage: null,
      randomInt: () => 0
    });
    store.awardXp(100);
    store.purchasePet('green');
    store.purchasePet('purple');
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      buildSessionDefinition: () => makeSession('pets-session'),
      createSimWorkerHost: createSimHarness().factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: createPauseHarness().factory,
      createResultOverlay: createResultHarness().factory,
      createSettingsOverlay: createSettingsOverlayHarness().factory,
      createRenderer: createRendererHarness().factory,
      createInputController: createInputHarness().factory,
      createHud: createHudHarness().factory,
      createAudio: createAudioHarness().factory,
      createClientProgressionStore: () => store,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    expect(menu.latestPetsViewModel()?.selectedPet).toBeNull();
    expect(menu.latestPetsViewModel()?.inventory.green.map((pet) => pet.petId)).toEqual([
      'pet-01'
    ]);
    expect(menu.latestPetsViewModel()?.inventory.purple.map((pet) => pet.petId)).toEqual([
      'pet-11'
    ]);

    const selectResult = menu.selectPet('pet-01');

    expect(selectResult).toEqual({ ok: true, selectedPetId: 'pet-01' });
    expect(store.get().selectedPetId).toBe('pet-01');
    expect(menu.latestPetsViewModel()?.selectedPet?.petId).toBe('pet-01');
    expect(menu.latestPetsViewModel()?.inventory.green).toEqual([]);

    menu.clearSelectedPet();

    expect(store.get().selectedPetId).toBeNull();
    expect(menu.latestPetsViewModel()?.selectedPet).toBeNull();
    expect(menu.latestPetsViewModel()?.inventory.green.map((pet) => pet.petId)).toEqual([
      'pet-01'
    ]);

    expect(menu.selectPet('pet-05')).toEqual({
      ok: false,
      reason: 'notOwned',
      selectedPetId: 'pet-05'
    });
    expect(store.get().selectedPetId).toBeNull();
  });

  it('passes the selected pet id into campaign renderer creation', async () => {
    const menu = createMenuHarness();
    const renderer = createRendererHarness();
    const store = createClientProgressionStore({
      storage: null,
      randomInt: () => 0
    });
    store.awardXp(25);
    store.purchasePet('green');
    store.selectPet(PET_01.id);
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      buildSessionDefinition: () => makeSession('campaign-pet-session'),
      createSimWorkerHost: createSimHarness().factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: createPauseHarness().factory,
      createResultOverlay: createResultHarness().factory,
      createSettingsOverlay: createSettingsOverlayHarness().factory,
      createRenderer: renderer.factory,
      createInputController: createInputHarness().factory,
      createHud: createHudHarness().factory,
      createAudio: createAudioHarness().factory,
      createClientProgressionStore: () => store,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();
    menu.start('campaign-normal');
    await flushUiShellStartup();

    expect(renderer.lastInit()?.selectedPetId).toBe(PET_01.id);
  });

  it('passes selected pet id to the builder but not renderer for runtime companion sessions', async () => {
    const menu = createMenuHarness();
    const renderer = createRendererHarness();
    const sim = createSimHarness();
    const store = createClientProgressionStore({
      storage: null,
      randomInt: () => 0
    });
    store.awardXp(25);
    store.purchasePet('green');
    store.selectPet(PET_01.id);
    const buildOptions: Array<Readonly<{ selectedPetId?: string | null }>> = [];
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      buildSessionDefinition: (_preset, options) => {
        buildOptions.push(options);
        return makeSession('campaign-runtime-companion-session', {
          companion: {
            petArchetypeId: options.selectedPetId ?? PET_01.id,
            maxHp: 4,
            contactBox: { width: 0.55, height: 0.55 },
            movement: { maxSpeed: 3, acceleration: 22, orbitRadius: 3.2 },
            threat: { acquireRadius: 5.5, releaseRadius: 6.5 },
            weaponLoadout: { weapons: ['pistol'], selectedIndex: 0 },
            boop: { radius: 1.1, impulse: 7, durationMs: 260, cooldownMs: 900 },
            rescue: { radius: 1.4, durationMs: 5000, reviveHpFraction: 0.5 }
          }
        });
      },
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: createPauseHarness().factory,
      createResultOverlay: createResultHarness().factory,
      createSettingsOverlay: createSettingsOverlayHarness().factory,
      createRenderer: renderer.factory,
      createInputController: createInputHarness().factory,
      createHud: createHudHarness().factory,
      createAudio: createAudioHarness().factory,
      createClientProgressionStore: () => store,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();
    menu.start('campaign-normal');
    await flushUiShellStartup();

    expect(buildOptions[0]?.selectedPetId).toBe(PET_01.id);
    expect(sim.startSessions[0]?.companion?.petArchetypeId).toBe(PET_01.id);
    expect(renderer.lastInit()?.selectedPetId).toBeNull();
  });

  it('does not pass selected pets into non-campaign renderer creation', async () => {
    const menu = createMenuHarness();
    const renderer = createRendererHarness();
    const store = createClientProgressionStore({
      storage: null,
      randomInt: () => 0
    });
    store.awardXp(25);
    store.purchasePet('green');
    store.selectPet(PET_01.id);
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      buildSessionDefinition: () => makeSession('training-pet-session'),
      createSimWorkerHost: createSimHarness().factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: createPauseHarness().factory,
      createResultOverlay: createResultHarness().factory,
      createSettingsOverlay: createSettingsOverlayHarness().factory,
      createRenderer: renderer.factory,
      createInputController: createInputHarness().factory,
      createHud: createHudHarness().factory,
      createAudio: createAudioHarness().factory,
      createClientProgressionStore: () => store,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();
    menu.startTraining();
    await flushUiShellStartup();

    expect(renderer.lastInit()?.selectedPetId).toBeNull();
  });

  it('starts the Dungeon preset from the Dungeon subscreen action', async () => {
    const menu = createMenuHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const dungeonBestWave = createDungeonBestWaveStoreHarness(9);
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });
    let builtPresetId: ModePresetId | null = null;

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      buildSessionDefinition: (preset) => {
        builtPresetId = preset.id;
        return makeSession('dungeon-session');
      },
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: createPauseHarness().factory,
      createResultOverlay: createResultHarness().factory,
      createSettingsOverlay: createSettingsOverlayHarness().factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createHud: createHudHarness().factory,
      createAudio: audio.factory,
      createDungeonBestWaveStore: dungeonBestWave.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    expect(menu.dungeonBestWave()).toBe(9);

    menu.startDungeon();
    await flushUiShellStartup();

    expect(builtPresetId).toBe('dungeon');
    expect(sim.startSessions).toHaveLength(1);
    expect(renderer.calls.create).toBe(1);
    expect(input.calls.start).toBe(1);
    expect(audio.uiEvents).toEqual(['buttonClick']);
    expect(shell.phase()).toEqual({ kind: 'running' });
  });

  it('records Dungeon waves cleared and refreshes the menu best number after a run', async () => {
    const menu = createMenuHarness();
    const result = createResultHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const dungeonBestWave = createDungeonBestWaveStoreHarness(5);
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      buildSessionDefinition: () =>
        makeSession('dungeon-session', {
          winCondition: { kind: 'dungeon' }
        }),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: createPauseHarness().factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: createSettingsOverlayHarness().factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createHud: createHudHarness().factory,
      createAudio: audio.factory,
      createDungeonBestWaveStore: dungeonBestWave.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.startDungeon();
    await flushUiShellStartup();
    sim.emit({
      ...makeTerminalEvent('loss', 123),
      summary: {
        ...makeResultSummary('loss', 123),
        dungeon: { wavesCleared: 8 }
      }
    });

    expect(dungeonBestWave.calls.record).toBe(1);
    expect(dungeonBestWave.recordResults()).toEqual([
      {
        previousBestWave: 5,
        bestWave: 8,
        isNewBest: true
      }
    ]);
    expect(menu.dungeonBestWave()).toBe(8);
    expect(result.isVisible()).toBe(true);
    expect(result.viewModel()?.dungeon).toEqual({
      wavesCleared: 8,
      previousBestWave: 5,
      bestWave: 8,
      isNewBest: true
    });
    expect(result.viewModel()?.escapePath).toBeNull();
    expect(shell.phase()).toMatchObject({ kind: 'result', outcome: 'loss' });

    result.backToMenu();

    expect(menu.isVisible()).toBe(true);
    expect(menu.dungeonBestWave()).toBe(8);

    menu.startDungeon();
    await flushUiShellStartup();
    sim.emit({
      ...makeTerminalEvent('loss', 456),
      summary: {
        ...makeResultSummary('loss', 456),
        dungeon: { wavesCleared: 7 }
      }
    });

    expect(dungeonBestWave.get()).toBe(8);
    expect(menu.dungeonBestWave()).toBe(8);
    expect(dungeonBestWave.calls.record).toBe(2);
  });

  it('routes the training button to the auto-start preset when one is configured', async () => {
    const menu = createMenuHarness();
    const result = createResultHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });
    const builtPresetIds: ModePresetId[] = [];

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      autoStartPresetId: 'campaign-easy',
      buildSessionDefinition: (preset) => {
        builtPresetIds.push(preset.id);
        return makeSession(`${preset.id}-session`);
      },
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: createPauseHarness().factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: createSettingsOverlayHarness().factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createHud: createHudHarness().factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    expect(builtPresetIds).toEqual(['campaign-easy']);
    expect(shell.phase()).toEqual({ kind: 'running' });

    sim.emit(makeTerminalEvent('win', 123));
    result.backToMenu();
    expect(shell.phase()).toEqual({ kind: 'menu' });

    menu.startTraining();
    await flushUiShellStartup();

    expect(builtPresetIds).toEqual(['campaign-easy', 'campaign-easy']);
    expect(sim.startSessions).toHaveLength(2);
    expect(shell.phase()).toEqual({ kind: 'running' });
  });

  it('routes Escape into overlay pause and exit back to menu with stopSession', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const escapeProgressPath = createEscapeProgressPathHarness();
    const dungeonWaveCounter = createDungeonWaveCounterHarness();
    const titleOverlay = createTitleOverlayHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createHud: hud.factory,
      createEscapeProgressPath: escapeProgressPath.factory,
      createDungeonWaveCounter: dungeonWaveCounter.factory,
      createTitleOverlay: titleOverlay.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.start();
    windowTarget.dispatch(
      'keydown',
      {
        code: 'Escape',
        preventDefault() {},
        repeat: false
      } as unknown as Event
    );

    expect(sim.calls.pause).toBe(1);
    expect(pause.isVisible()).toBe(true);
    expect(audio.uiEvents).toContain('overlayShow');
    expect(shell.phase()).toEqual({ kind: 'paused' });

    pause.exit();

    expect(sim.calls.stop).toBe(1);
    expect(input.calls.stop).toBe(1);
    expect(renderer.calls.dispose).toBe(1);
    expect(titleOverlay.calls.detach).toBe(1);
    expect(dungeonWaveCounter.calls.detach).toBe(1);
    expect(escapeProgressPath.calls.detach).toBe(1);
    expect(hud.calls.detach).toBe(1);
    expect(audio.calls.detach).toBe(1);
    expect(menu.isVisible()).toBe(true);
    expect(pause.isVisible()).toBe(false);
    expect(result.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'menu' });
  });

  it('routes Space into overlay pause and releases pointer lock for the menu cursor', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const canvas = { clientHeight: 900 } as HTMLCanvasElement;
    const documentTarget = Object.assign(documentEvents, {
      pointerLockElement: canvas as unknown as Element | null,
      exitPointerLock: vi.fn()
    });
    documentTarget.exitPointerLock.mockImplementation(() => {
      documentTarget.pointerLockElement = null;
    });
    const preventDefault = vi.fn();

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: () => ({
        render() {},
        handleEvent() {},
        fitToWindow() {},
        applyScalePolicy() {},
        dispose() {}
      }),
      createInputController: () => ({
        start() {},
        stop() {},
        isActive() {
          return true;
        },
        currentAim() {
          return { x: 0, y: 0 };
        },
        syncAim() {},
        requestLock() {}
      }),
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.start();
    windowTarget.dispatch(
      'keydown',
      {
        code: 'Space',
        preventDefault,
        repeat: false
      } as unknown as Event
    );

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(documentTarget.exitPointerLock).toHaveBeenCalledTimes(1);
    expect(documentTarget.pointerLockElement).toBeNull();
    expect(sim.calls.pause).toBe(1);
    expect(pause.isVisible()).toBe(true);
    expect(result.isVisible()).toBe(false);
    expect(audio.uiEvents).toContain('overlayShow');
    expect(shell.phase()).toEqual({ kind: 'paused' });
  });

  it('routes pointer lock loss into overlay pause while a run is active', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: () => ({
        render() {},
        handleEvent() {},
        fitToWindow() {},
        applyScalePolicy() {},
        dispose() {}
      }),
      createInputController: () => ({
        start() {},
        stop() {},
        isActive() {
          return true;
        },
        currentAim() {
          return { x: 0, y: 0 };
        },
        syncAim() {},
        requestLock() {}
      }),
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.start();
    documentEvents.dispatch('pointerlockchange', new Event('pointerlockchange'));

    expect(sim.calls.pause).toBe(1);
    expect(pause.isVisible()).toBe(true);
    expect(result.isVisible()).toBe(false);
    expect(audio.uiEvents).toContain('overlayShow');
    expect(shell.phase()).toEqual({ kind: 'paused' });
  });

  it('ignores pointer lock loss outside the running phase', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: () => ({
        render() {},
        handleEvent() {},
        fitToWindow() {},
        applyScalePolicy() {},
        dispose() {}
      }),
      createInputController: () => ({
        start() {},
        stop() {},
        isActive() {
          return true;
        },
        currentAim() {
          return { x: 0, y: 0 };
        },
        syncAim() {},
        requestLock() {}
      }),
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    documentEvents.dispatch('pointerlockchange', new Event('pointerlockchange'));

    expect(sim.calls.pause).toBe(0);
    expect(pause.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'menu' });

    menu.start();
    sim.emit(makeTerminalEvent('win', 123));
    documentEvents.dispatch('pointerlockchange', new Event('pointerlockchange'));

    expect(sim.calls.pause).toBe(0);
    expect(pause.isVisible()).toBe(false);
    expect(result.isVisible()).toBe(true);
    expect(shell.phase()).toMatchObject({ kind: 'result', outcome: 'win' });
  });

  it('keeps physical KeyP as dev pause without showing the pause overlay', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });
    const preventDefault = vi.fn();

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: () => ({
        render() {},
        handleEvent() {},
        fitToWindow() {},
        applyScalePolicy() {},
        dispose() {}
      }),
      createInputController: () => ({
        start() {},
        stop() {},
        isActive() {
          return true;
        },
        currentAim() {
          return { x: 0, y: 0 };
        },
        syncAim() {},
        requestLock() {}
      }),
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.start();
    windowTarget.dispatch(
      'keydown',
      {
        code: 'KeyP',
        key: 'З',
        preventDefault,
        repeat: false
      } as unknown as Event
    );

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(sim.calls.pause).toBe(1);
    expect(pause.isVisible()).toBe(false);
    expect(result.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'running' });

    windowTarget.dispatch(
      'keydown',
      {
        code: 'KeyP',
        key: 'p',
        preventDefault,
        repeat: false
      } as unknown as Event
    );

    expect(sim.calls.resume).toBe(1);
    expect(pause.isVisible()).toBe(false);
    expect(result.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'running' });
  });

  it('applies the initial master volume from client settings and keeps audio subscribed', () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const settings = createClientSettingsStoreHarness({ masterVolume: 0.25 });
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: createRendererHarness().factory,
      createInputController: createInputHarness().factory,
      createHud: hud.factory,
      createAudio: audio.factory,
      createClientSettingsStore: settings.factory,
      windowTarget,
      documentTarget
    });

    expect(audio.masterGainValues).toEqual([0.25]);

    settings.setMasterVolume(0.6);

    expect(audio.masterGainValues).toEqual([0.25, 0.6]);

    shell.dispose();
    expect(settings.calls.dispose).toBe(1);
  });

  it('uses the current render scale preset for renderer creation and unsubscribes it on teardown', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const settings = createClientSettingsStoreHarness({ renderScalePreset: 'high' });
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createHud: hud.factory,
      createAudio: audio.factory,
      createClientSettingsStore: settings.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.start();

    expect(renderer.lastInit()?.renderScalePreset).toBe('high');

    settings.setMasterVolume(0.5);
    expect(renderer.appliedPresets).toEqual([]);

    settings.setRenderScalePreset('low');
    expect(renderer.appliedPresets).toEqual(['low']);

    sim.emit(makeTerminalEvent('win', 123));
    settings.setRenderScalePreset('medium');

    expect(renderer.appliedPresets).toEqual(['low']);
  });

  it('opens settings from the menu and closes them without changing the phase', async () => {
    const parent = new FakeDomElement();
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settings = createSettingsOverlayHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: parent as unknown as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settings.factory,
      createRenderer: createRendererHarness().factory,
      createInputController: createInputHarness().factory,
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.openSettings();

    expect(settings.isVisible()).toBe(true);
    expect(menu.isVisible()).toBe(true);
    expect(shell.phase()).toEqual({ kind: 'menu' });
    expect(audio.uiEvents).toEqual(['buttonClick']);
    expect(Number(findHarnessRoot(parent, 'settings-overlay')?.style.zIndex ?? '0')).toBeGreaterThan(
      Number(findHarnessRoot(parent, 'menu-overlay')?.style.zIndex ?? '0')
    );

    settings.close();

    expect(settings.isVisible()).toBe(false);
    expect(menu.isVisible()).toBe(true);
    expect(shell.phase()).toEqual({ kind: 'menu' });
    expect(audio.uiEvents).toEqual(['buttonClick', 'buttonClick']);

    shell.dispose();
  });

  it('opens settings over pause, keeps the paused phase, and keeps the pause overlay underneath', async () => {
    const parent = new FakeDomElement();
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settings = createSettingsOverlayHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: parent as unknown as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settings.factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.start();
    windowTarget.dispatch(
      'keydown',
      {
        code: 'Escape',
        preventDefault() {},
        repeat: false
      } as unknown as Event
    );

    pause.openSettings();

    expect(settings.isVisible()).toBe(true);
    expect(pause.isVisible()).toBe(true);
    expect(shell.phase()).toEqual({ kind: 'paused' });
    expect(sim.calls.pause).toBe(1);
    expect(sim.calls.resume).toBe(0);
    expect(audio.uiEvents.at(-1)).toBe('buttonClick');
    expect(Number(findHarnessRoot(parent, 'settings-overlay')?.style.zIndex ?? '0')).toBeGreaterThan(
      Number(findHarnessRoot(parent, 'pause-overlay')?.style.zIndex ?? '0')
    );

    settings.pressButton();
    expect(audio.uiEvents.at(-1)).toBe('buttonClick');
    expect(shell.phase()).toEqual({ kind: 'paused' });

    settings.close();

    expect(settings.isVisible()).toBe(false);
    expect(pause.isVisible()).toBe(true);
    expect(shell.phase()).toEqual({ kind: 'paused' });
  });

  it('does not expose settings in running or result because the entry overlays are hidden', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settings = createSettingsOverlayHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: new FakeDomElement() as unknown as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settings.factory,
      createRenderer: createRendererHarness().factory,
      createInputController: createInputHarness().factory,
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.start();
    menu.openSettings();
    expect(settings.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'running' });

    sim.emit(makeTerminalEvent('win', 123));
    pause.openSettings();
    expect(settings.isVisible()).toBe(false);
    expect(shell.phase()).toMatchObject({ kind: 'result', outcome: 'win' });
  });

  it('freezes HUD updates while paused but keeps renderer rendering', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const escapeProgressPath = createEscapeProgressPathHarness();
    const dungeonWaveCounter = createDungeonWaveCounterHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createHud: hud.factory,
      createEscapeProgressPath: escapeProgressPath.factory,
      createDungeonWaveCounter: dungeonWaveCounter.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.start();
    shell.onFrame();
    expect(hud.calls.update).toBe(1);
    expect(escapeProgressPath.calls.update).toBe(1);
    expect(dungeonWaveCounter.calls.update).toBe(1);
    expect(renderer.calls.render).toBe(1);
    expect(audio.calls.update).toBe(1);

    windowTarget.dispatch(
      'keydown',
      {
        code: 'Escape',
        preventDefault() {},
        repeat: false
      } as unknown as Event
    );

    shell.onFrame();
    expect(hud.calls.update).toBe(1);
    expect(escapeProgressPath.calls.update).toBe(2);
    expect(dungeonWaveCounter.calls.update).toBe(2);
    expect(renderer.calls.render).toBe(2);
    expect(audio.calls.update).toBe(2);
    expect(pause.isVisible()).toBe(true);
    expect(pause.escapePaths().length).toBeGreaterThan(0);
    expect(result.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'paused' });
  });

  it('ignores Space while overlay pause is active', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });
    const preventDefault = vi.fn();

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: () => ({
        render() {},
        handleEvent() {},
        fitToWindow() {},
        applyScalePolicy() {},
        dispose() {}
      }),
      createInputController: () => ({
        start() {},
        stop() {},
        isActive() {
          return true;
        },
        currentAim() {
          return { x: 0, y: 0 };
        },
        syncAim() {},
        requestLock() {}
      }),
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.start();
    windowTarget.dispatch(
      'keydown',
      {
        code: 'Escape',
        preventDefault() {},
        repeat: false
      } as unknown as Event
    );
    windowTarget.dispatch(
      'keydown',
      {
        code: 'Space',
        preventDefault,
        repeat: false
      } as unknown as Event
    );

    expect(sim.calls.pause).toBe(1);
    expect(sim.calls.resume).toBe(0);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(pause.isVisible()).toBe(true);
    expect(result.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'paused' });
  });

  it('ignores pause hotkeys in menu and result phases', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });
    const preventDefault = vi.fn();

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: () => ({
        render() {},
        handleEvent() {},
        fitToWindow() {},
        applyScalePolicy() {},
        dispose() {}
      }),
      createInputController: () => ({
        start() {},
        stop() {},
        isActive() {
          return true;
        },
        currentAim() {
          return { x: 0, y: 0 };
        },
        syncAim() {},
        requestLock() {}
      }),
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    windowTarget.dispatch(
      'keydown',
      {
        code: 'Escape',
        preventDefault() {},
        repeat: false
      } as unknown as Event
    );
    windowTarget.dispatch(
      'keydown',
      {
        code: 'Space',
        preventDefault,
        repeat: false
      } as unknown as Event
    );
    windowTarget.dispatch(
      'keydown',
      {
        code: 'KeyP',
        key: 'P',
        preventDefault,
        repeat: false
      } as unknown as Event
    );

    expect(sim.calls.pause).toBe(0);
    expect(sim.calls.resume).toBe(0);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(pause.isVisible()).toBe(false);
    expect(result.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'menu' });

    menu.start();
    sim.emit(makeTerminalEvent('loss', 123));

    windowTarget.dispatch(
      'keydown',
      {
        code: 'Escape',
        preventDefault() {},
        repeat: false
      } as unknown as Event
    );
    windowTarget.dispatch(
      'keydown',
      {
        code: 'Space',
        preventDefault,
        repeat: false
      } as unknown as Event
    );
    windowTarget.dispatch(
      'keydown',
      {
        code: 'KeyP',
        key: 'p',
        preventDefault,
        repeat: false
      } as unknown as Event
    );

    expect(sim.calls.pause).toBe(0);
    expect(sim.calls.resume).toBe(0);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(pause.isVisible()).toBe(false);
    expect(result.isVisible()).toBe(true);
    expect(result.outcome()).toBe('loss');
    expect(shell.phase()).toMatchObject({ kind: 'result', outcome: 'loss' });
  });

  it.each([
    ['win', 'win'],
    ['loss', 'loss']
  ] as const)('transitions to result on %s without calling stopSession', async (kind, outcome) => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.start();
    const event = makeTerminalEvent(kind, 123);
    sim.emit(event);

    expect(sim.calls.stop).toBe(0);
    expect(input.calls.stop).toBe(1);
    expect(renderer.calls.dispose).toBe(1);
    expect(hud.calls.detach).toBe(1);
    expect(audio.events).toEqual([event]);
    expect(renderer.events).toEqual([event]);
    expect(audio.calls.detach).toBe(1);
    expect(menu.isVisible()).toBe(false);
    expect(result.isVisible()).toBe(true);
    expect(result.outcome()).toBe(outcome);
    expect(audio.uiEvents).toContain('overlayShow');
    const phase = shell.phase();
    expect(phase).toMatchObject({ kind: 'result', outcome });
    if (phase.kind !== 'result') {
      throw new Error('expected result phase');
    }
    expect(phase.summary).toBe(event.summary);
    expect(phase.viewModel).toBe(result.viewModel());
  });

  it.each([
    ['win', 'win'],
    ['loss', 'loss']
  ] as const)('awards result XP for player-started campaign %s', async (kind, outcome) => {
    const menu = createMenuHarness();
    const result = createResultHarness();
    const sim = createSimHarness();
    const progression = createClientProgressionStoreHarness({ totalXp: 10 });
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession('campaign-session'),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: createPauseHarness().factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: createSettingsOverlayHarness().factory,
      createRenderer: createRendererHarness().factory,
      createInputController: createInputHarness().factory,
      createHud: createHudHarness().factory,
      createAudio: createAudioHarness().factory,
      createClientProgressionStore: progression.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.start('campaign-normal');
    sim.emit({
      ...makeTerminalEvent(kind, 123),
      summary: {
        ...makeResultSummary(outcome, 123),
        kills: {
          total: 6,
          byArchetype: []
        }
      }
    });

    expect(progression.awards()).toEqual([6]);
    expect(progression.get().totalXp).toBe(16);
    expect(result.viewModel()?.xpReward).toEqual({
      xpEarned: 6,
      totalXp: 16
    });
  });

  it('shows a zero XP block for campaign results with no kills', async () => {
    const menu = createMenuHarness();
    const result = createResultHarness();
    const sim = createSimHarness();
    const progression = createClientProgressionStoreHarness({ totalXp: 12 });
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession('no-kill-campaign-session'),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: createPauseHarness().factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: createSettingsOverlayHarness().factory,
      createRenderer: createRendererHarness().factory,
      createInputController: createInputHarness().factory,
      createHud: createHudHarness().factory,
      createAudio: createAudioHarness().factory,
      createClientProgressionStore: progression.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.start('campaign-normal');
    sim.emit(makeTerminalEvent('loss', 123));

    expect(progression.awards()).toEqual([0]);
    expect(result.viewModel()?.xpReward).toEqual({
      xpEarned: 0,
      totalXp: 12
    });
  });

  it('omits result XP for training, Dungeon, and auto-start sessions', async () => {
    const scenarios: ReadonlyArray<{
      name: string;
      autoStartPresetId?: ModePresetId;
      start(menu: ReturnType<typeof createMenuHarness>): void;
      summary: SessionResultSummary;
    }> = [
      {
        name: 'training',
        start(menu): void {
          menu.startTraining();
        },
        summary: {
          ...makeResultSummary('loss', 123),
          kills: { total: 5, byArchetype: [] }
        }
      },
      {
        name: 'Dungeon',
        start(menu): void {
          menu.startDungeon();
        },
        summary: {
          ...makeResultSummary('loss', 123),
          kills: { total: 5, byArchetype: [] },
          dungeon: { wavesCleared: 3 }
        }
      },
      {
        name: 'auto-start campaign',
        autoStartPresetId: 'campaign-normal',
        start(): void {},
        summary: {
          ...makeResultSummary('win', 123),
          kills: { total: 5, byArchetype: [] }
        }
      }
    ];

    for (const scenario of scenarios) {
      const menu = createMenuHarness();
      const result = createResultHarness();
      const sim = createSimHarness();
      const progression = createClientProgressionStoreHarness({ totalXp: 10 });
      const windowTarget = new FakeEventTarget();
      const documentEvents = new FakeEventTarget();
      const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

      createUiShellForTest({
        parent: {} as HTMLElement,
        canvas: { clientHeight: 900 } as HTMLCanvasElement,
        autoStartPresetId: scenario.autoStartPresetId,
        makeSeed: () => 1,
        buildSessionDefinition: () => makeSession(`${scenario.name}-session`),
        createSimWorkerHost: sim.factory,
        createMenuOverlay: menu.factory,
        createPauseOverlay: createPauseHarness().factory,
        createResultOverlay: result.factory,
        createSettingsOverlay: createSettingsOverlayHarness().factory,
        createRenderer: createRendererHarness().factory,
        createInputController: createInputHarness().factory,
        createHud: createHudHarness().factory,
        createAudio: createAudioHarness().factory,
        createClientProgressionStore: progression.factory,
        windowTarget,
        documentTarget
      });

      await flushUiShellStartup();

      scenario.start(menu);
      await flushUiShellStartup();
      sim.emit({
        kind: scenario.summary.outcome,
        simTime: 123,
        summary: scenario.summary
      });

      expect(progression.awards(), scenario.name).toEqual([]);
      expect(result.viewModel()?.xpReward, scenario.name).toBeNull();
    }
  });

  it('fans runtime events out to audio and renderer while running', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });
    const event: RuntimeEvent = {
      kind: 'hit',
      simTime: 123,
      projectileId: 1,
      targetId: 2,
      targetKind: 'enemy',
      targetArchetypeId: 'slime-one-eye',
      weaponArchetypeId: 'pistol',
      damage: 1,
      impactDirX: 1,
      impactDirY: 0,
      x: 3,
      y: 4
    };

    createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.start();
    sim.emit(event);

    expect(audio.events).toEqual([event]);
    expect(renderer.events).toEqual([event]);
    expect(result.isVisible()).toBe(false);
  });

  it('returns from result overlay to menu without calling stopSession again', async () => {
    const menu = createMenuHarness();
    const pause = createPauseHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => 1,
      buildSessionDefinition: () => makeSession(),
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: pause.factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.start();
    sim.emit(makeTerminalEvent('win', 123));

    expect(sim.calls.stop).toBe(0);
    expect(result.isVisible()).toBe(true);
    expect(shell.phase()).toMatchObject({ kind: 'result', outcome: 'win' });

    result.backToMenu();

    expect(sim.calls.stop).toBe(0);
    expect(input.calls.stop).toBe(1);
    expect(renderer.calls.dispose).toBe(1);
    expect(hud.calls.detach).toBe(1);
    expect(audio.calls.detach).toBe(1);
    expect(menu.isVisible()).toBe(true);
    expect(result.isVisible()).toBe(false);
    expect(audio.uiEvents.filter((eventId) => eventId === 'buttonClick')).toHaveLength(2);
    expect(shell.phase()).toEqual({ kind: 'menu' });
  });

  it('restarts the last started preset from a loss result through the normal start path', async () => {
    const menu = createMenuHarness();
    const result = createResultHarness();
    const settingsOverlay = createSettingsOverlayHarness();
    const renderer = createRendererHarness();
    const input = createInputHarness();
    const sim = createSimHarness();
    const hud = createHudHarness();
    const audio = createAudioHarness();
    const windowTarget = new FakeEventTarget();
    const documentEvents = new FakeEventTarget();
    const documentTarget = Object.assign(documentEvents, { pointerLockElement: null });
    const builtPresetIds: ModePresetId[] = [];
    let nextSeed = 10;

    const shell = createUiShellForTest({
      parent: {} as HTMLElement,
      canvas: { clientHeight: 900 } as HTMLCanvasElement,
      makeSeed: () => nextSeed++,
      buildSessionDefinition: (preset, options) => {
        builtPresetIds.push(preset.id);
        return makeSession(`${preset.id}-${options.seed}`);
      },
      createSimWorkerHost: sim.factory,
      createMenuOverlay: menu.factory,
      createPauseOverlay: createPauseHarness().factory,
      createResultOverlay: result.factory,
      createSettingsOverlay: settingsOverlay.factory,
      createRenderer: renderer.factory,
      createInputController: input.factory,
      createHud: hud.factory,
      createAudio: audio.factory,
      windowTarget,
      documentTarget
    });

    await flushUiShellStartup();

    menu.start('campaign-hard');
    await flushUiShellStartup();
    sim.emit(makeTerminalEvent('loss', 123));

    expect(shell.phase()).toMatchObject({ kind: 'result', outcome: 'loss' });
    expect(sim.calls.stop).toBe(0);
    expect(input.calls.stop).toBe(1);
    expect(renderer.calls.dispose).toBe(1);
    expect(builtPresetIds).toEqual(['campaign-hard']);

    result.restart();
    await flushUiShellStartup();

    expect(sim.calls.stop).toBe(0);
    expect(builtPresetIds).toEqual(['campaign-hard', 'campaign-hard']);
    expect(sim.startSessions.map((session) => session.id)).toEqual([
      'campaign-hard-10',
      'campaign-hard-11'
    ]);
    expect(renderer.calls.create).toBe(2);
    expect(input.calls.start).toBe(2);
    expect(hud.calls.attach).toBe(2);
    expect(result.isVisible()).toBe(false);
    expect(menu.isVisible()).toBe(false);
    expect(shell.phase()).toEqual({ kind: 'running' });
    expect(audio.uiEvents.filter((eventId) => eventId === 'buttonClick')).toHaveLength(2);
  });
});
