import { buildSessionDefinition } from '../../shared/content/buildSession';
import {
  getOnlineModeCatalog,
  getPlayableModeCatalog,
  DUNGEON_PRESET,
  resolveModePreset,
  SESSION_PRESET_TEMPLATES,
  type ModePreset,
  type ModePresetId
} from '../../shared/content/sessions';
import { PET_ECONOMY } from '../../shared/content/pets';
import type { RuntimeEvent } from '../../shared/events';
import type { InputCommand } from '../../shared/input';
import { log } from '../../shared/log';
import { assertNever } from '../../shared/protocol';
import type {
  ArenaHostEvent,
  ArenaHostLobbyStateEvent,
  PublicArenaInputIntent,
  PublicArenaPlayerId,
  PublicArenaWorldBounds
} from '../../shared/arenaHostProtocol';
import type { Snapshot } from '../../shared/snapshot';
import type { Loadout, PlayerConfig, SessionDefinition } from '../../shared/session';
import type { SessionResultOutcome, SessionResultSummary } from '../../shared/sessionResult';
import { SNAPSHOT_INTERVAL_MS } from '../../shared/timing';
import { createAudio, type Audio } from '../audio/Audio';
import { applyAimAssist } from '../input/AimAssist';
import { createInputController, type InputController, type InputControllerInit } from '../input/InputController';
import {
  createMobileInputController,
  type MobileInputControllerInit
} from '../input/MobileInputController';
import {
  resolveEffectiveGameViewport,
  type GameViewportProvider,
  type MobileWebProfile
} from '../mobileWebProfile';
import {
  createVisibleAreaCamera,
  type VisibleAreaCamera,
  type VisibleAreaProfile
} from '../visibleArea';
import {
  createClientProgressionStore,
  type ClientProgressionStore
} from '../progression/ClientProgressionStore';
import { createRenderer, type Renderer, type RendererInit } from '../render/Renderer';
import type { TextureMap } from '../render/spritePreload';
import {
  createClientSettingsStore,
  type ClientSettingsStore
} from '../settings/ClientSettingsStore';
import {
  createDungeonBestWaveStore,
  type DungeonBestWaveStore
} from '../settings/DungeonBestWaveStore';
import {
  createSimWorkerHost,
  type SimWorkerHost,
  type SimWorkerHostOptions,
  type SnapshotPair
} from '../sim/SimWorkerHost';
import {
  publicArenaClientConfig,
  type PublicArenaClientConfig
} from '../publicArenaConfig';
import {
  createPublicArenaClient,
  type PublicArenaClient,
  type PublicArenaClientInit
} from '../online/PublicArenaClient';
import { publicArenaSnapshotView } from '../online/publicArenaSnapshotView';
import {
  createPublicArenaRenderer,
  type PublicArenaRenderer,
  type PublicArenaRendererInit
} from '../online/PublicArenaRenderer';
import {
  createBrowserVibeJamPortalStorage,
  type VibeJamPortalStorage
} from '../VibeJamPortalContext';
import {
  createVibeJamPortalController,
  type VibeJamPortalController,
  type VibeJamPortalControllerInit,
  type VibeJamPortalPublicArenaSnapshot
} from '../VibeJamPortalController';

import {
  createEscapeProgressPath,
  type EscapeProgressPath,
  type EscapeProgressPathInit
} from './EscapeProgressPath';
import { deriveLiveEscapeProgressPathViewModel } from './EscapeProgressPathViewModel';
import {
  createDungeonWaveCounter,
  type DungeonWaveCounter,
  type DungeonWaveCounterInit
} from './DungeonWaveCounter';
import {
  createMenuOverlay,
  type MenuOverlay,
  type MenuOverlayInit
} from './MenuOverlay';
import {
  createMobileControlsOverlay,
  type MobileControlsOverlay,
  type MobileControlsOverlayInit
} from './MobileControlsOverlay';
import { buildMenuLabViewModel } from './MenuLabViewModel';
import { buildMenuPetsViewModel } from './MenuPetsViewModel';
import type { MenuSubscreenId } from './MenuOverlayLayout';
import {
  createPhaseTransitionCurtain,
  type PhaseTransitionCurtain,
  type PhaseTransitionCurtainInit
} from './PhaseTransitionCurtain';
import { createHud, type Hud, type HudInit } from './Hud';
import { createPauseOverlay, type PauseOverlay, type PauseOverlayInit } from './PauseOverlay';
import {
  createPublicArenaHud,
  type PublicArenaHud,
  type PublicArenaHudInit
} from './PublicArenaHud';
import {
  createPublicArenaCombatAffordances,
  type PublicArenaCombatAffordances,
  type PublicArenaCombatAffordancesInit
} from './PublicArenaCombatAffordances';
import {
  createPublicArenaMenuOverlay,
  type PublicArenaMenuOverlay,
  type PublicArenaMenuOverlayInit
} from './PublicArenaMenuOverlay';
import {
  createPublicArenaStatusOverlay,
  type PublicArenaStatusOverlay,
  type PublicArenaStatusOverlayInit
} from './PublicArenaStatusOverlay';
import {
  createResultOverlay,
  type ResultOverlay,
  type ResultOverlayInit
} from './ResultOverlay';
import { buildResultViewModel } from './ResultViewModel';
import type { ResultDungeonBestState, ResultXpRewardState } from './ResultViewModel';
import {
  createSettingsOverlay,
  type SettingsOverlay,
  type SettingsOverlayInit
} from './SettingsOverlay';
import {
  createStartupErrorOverlay,
  type StartupErrorOverlay,
  type StartupErrorOverlayInit
} from './StartupErrorOverlay';
import {
  createStartupOverlay,
  type StartupOverlay,
  type StartupOverlayInit
} from './StartupOverlay';
import {
  createTitleOverlay,
  type TitleOverlay,
  type TitleOverlayInit
} from './TitleOverlay';
import { STARTUP_SPRITE_SPECS } from './startupAssets';
import { preloadStartupAssets } from './startupPreload';
import type { UiShellPhase } from './UiShellPhase';

export type SessionResult = SessionResultOutcome;
export type { UiShellPhase } from './UiShellPhase';
export { STARTUP_SPRITE_SPECS } from './startupAssets';

type WindowTarget = Pick<Window, 'addEventListener' | 'removeEventListener'> &
  Partial<Pick<Window, 'innerWidth' | 'innerHeight' | 'devicePixelRatio' | 'matchMedia'>>;
type DocumentTarget = Pick<Document, 'addEventListener' | 'removeEventListener'> & {
  pointerLockElement: Element | null;
  exitPointerLock?: () => void;
  fullscreenElement?: Element | null;
  documentElement?: {
    requestFullscreen?: () => Promise<void>;
  };
  exitFullscreen?: () => Promise<void>;
};

type BuildSessionDefinitionFn = (
  preset: Parameters<typeof buildSessionDefinition>[0],
  options: Parameters<typeof buildSessionDefinition>[1]
) => SessionDefinition;
type CreateSimWorkerHostFn = (options?: SimWorkerHostOptions) => SimWorkerHost;
type CreateMenuOverlayFn = (init: MenuOverlayInit) => MenuOverlay;
type CreatePhaseTransitionCurtainFn = (
  init: PhaseTransitionCurtainInit
) => PhaseTransitionCurtain;
type CreatePauseOverlayFn = (init: PauseOverlayInit) => PauseOverlay;
type CreatePublicArenaHudFn = (init: PublicArenaHudInit) => PublicArenaHud;
type CreatePublicArenaCombatAffordancesFn = (
  init: PublicArenaCombatAffordancesInit
) => PublicArenaCombatAffordances;
type CreatePublicArenaMenuOverlayFn = (
  init: PublicArenaMenuOverlayInit
) => PublicArenaMenuOverlay;
type CreatePublicArenaStatusOverlayFn = (
  init: PublicArenaStatusOverlayInit
) => PublicArenaStatusOverlay;
type CreateResultOverlayFn = (init: ResultOverlayInit) => ResultOverlay;
type CreateSettingsOverlayFn = (init: SettingsOverlayInit) => SettingsOverlay;
type CreateStartupOverlayFn = (init: StartupOverlayInit) => StartupOverlay;
type CreateStartupErrorOverlayFn = (init: StartupErrorOverlayInit) => StartupErrorOverlay;
type CreateRendererFn = (init: RendererInit) => Renderer;
type CreateInputControllerFn = (init: InputControllerInit) => InputController;
type CreateMobileInputControllerFn = (init: MobileInputControllerInit) => InputController;
type CreateHudFn = (init: HudInit) => Hud;
type CreateMobileControlsOverlayFn = (
  init: MobileControlsOverlayInit
) => MobileControlsOverlay;
type CreateEscapeProgressPathFn = (init: EscapeProgressPathInit) => EscapeProgressPath;
type CreateDungeonWaveCounterFn = (init: DungeonWaveCounterInit) => DungeonWaveCounter;
type CreateTitleOverlayFn = (init: TitleOverlayInit) => TitleOverlay;
type CreateVibeJamPortalControllerFn = (
  init: VibeJamPortalControllerInit
) => VibeJamPortalController;
type CreateAudioFn = () => Audio;
type CreatePublicArenaClientFn = (init: PublicArenaClientInit) => PublicArenaClient;
type CreatePublicArenaRendererFn = (init: PublicArenaRendererInit) => PublicArenaRenderer;
type CreateClientSettingsStoreFn = () => ClientSettingsStore;
type CreateDungeonBestWaveStoreFn = () => DungeonBestWaveStore;
type CreateClientProgressionStoreFn = () => ClientProgressionStore;
type RunStartupPreloadFn = (
  onProgress: (loaded: number, total: number) => void
) => Promise<TextureMap>;
type OnlinePredictionBufferedInput = Readonly<{
  command: InputCommand;
  inputSequence: number;
  sentAtMs: number;
}>;
type OnlinePredictionPendingFireAck = Readonly<{
  inputSequence: number;
  sentAtMs: number;
}>;
type SequencedPublicArenaInput = Readonly<{
  command: InputCommand;
  intent: PublicArenaInputIntent;
  inputSequence: number;
}>;
type ReloadPageFn = () => void;
type AssignLocationFn = (url: string) => void;

export type UiShellInit = Readonly<{
  parent: HTMLElement;
  canvas: HTMLCanvasElement;
  autoStartPresetId?: ModePresetId;
  autoStartPublicArena?: boolean;
  startupImageSrc?: string;
  buildSessionDefinition?: BuildSessionDefinitionFn;
  createSimWorkerHost?: CreateSimWorkerHostFn;
  createMenuOverlay?: CreateMenuOverlayFn;
  createPhaseTransitionCurtain?: CreatePhaseTransitionCurtainFn;
  createPauseOverlay?: CreatePauseOverlayFn;
  createPublicArenaHud?: CreatePublicArenaHudFn;
  createPublicArenaCombatAffordances?: CreatePublicArenaCombatAffordancesFn;
  createPublicArenaStatusOverlay?: CreatePublicArenaStatusOverlayFn;
  createResultOverlay?: CreateResultOverlayFn;
  createSettingsOverlay?: CreateSettingsOverlayFn;
  createStartupOverlay?: CreateStartupOverlayFn;
  createStartupErrorOverlay?: CreateStartupErrorOverlayFn;
  createRenderer?: CreateRendererFn;
  createInputController?: CreateInputControllerFn;
  createMobileInputController?: CreateMobileInputControllerFn;
  createHud?: CreateHudFn;
  createMobileControlsOverlay?: CreateMobileControlsOverlayFn;
  createEscapeProgressPath?: CreateEscapeProgressPathFn;
  createDungeonWaveCounter?: CreateDungeonWaveCounterFn;
  createTitleOverlay?: CreateTitleOverlayFn;
  createVibeJamPortalController?: CreateVibeJamPortalControllerFn;
  createAudio?: CreateAudioFn;
  createPublicArenaClient?: CreatePublicArenaClientFn;
  createPublicArenaRenderer?: CreatePublicArenaRendererFn;
  createPublicArenaMenuOverlay?: CreatePublicArenaMenuOverlayFn;
  createClientSettingsStore?: CreateClientSettingsStoreFn;
  createDungeonBestWaveStore?: CreateDungeonBestWaveStoreFn;
  createClientProgressionStore?: CreateClientProgressionStoreFn;
  runStartupPreload?: RunStartupPreloadFn;
  reloadPage?: ReloadPageFn;
  assignLocation?: AssignLocationFn;
  makeSeed?: () => number;
  portalHref?: string;
  portalStorage?: VibeJamPortalStorage | null;
  publicArenaConfig?: PublicArenaClientConfig;
  windowTarget?: WindowTarget;
  documentTarget?: DocumentTarget;
  gameViewport?: GameViewportProvider;
  mobileProfile?: MobileWebProfile;
}>;

export type UiShell = Readonly<{
  onFrame(): void;
  phase(): UiShellPhase;
  dispose(): void;
}>;

const LOADING_PHASE: UiShellPhase = { kind: 'loading' };
const MENU_PHASE: UiShellPhase = { kind: 'menu' };
const RUNNING_PHASE: UiShellPhase = { kind: 'running' };
const ONLINE_CONNECTING_PHASE: UiShellPhase = { kind: 'onlineConnecting' };
const ONLINE_LOBBY_PHASE: UiShellPhase = { kind: 'onlineLobby' };
const ONLINE_PHASE: UiShellPhase = { kind: 'online' };
const PAUSED_PHASE: UiShellPhase = { kind: 'paused' };
const ESCAPE_KEY_CODE = 'Escape';
const SPACE_KEY_CODE = 'Space';
const DEV_PAUSE_KEY_CODE = 'KeyP';
const CAMPAIGN_PRESET_IDS = new Set<ModePresetId>([
  'campaign-easy',
  'campaign-normal',
  'campaign-hard'
]);
const PUBLIC_ARENA_CONNECTING_MESSAGE = 'Joining Public Arena';
const PUBLIC_ARENA_NOT_CONFIGURED_MESSAGE = 'Public arena server is not configured.';
const ONLINE_SESSION_NOT_CONFIGURED_MESSAGE = 'Online session server is not configured.';
const ONLINE_PREDICTION_RTT_ESTIMATE_ALPHA = 0.25;
const ONLINE_PREDICTION_REJECT_WINDOW_MIN_MS = 100;
const ONLINE_PREDICTION_REJECT_WINDOW_MAX_MS = 500;

type SessionStartSource = 'campaign' | 'nonCampaign' | 'autoStart';

export function createUiShell(init: UiShellInit): UiShell {
  const builder = init.buildSessionDefinition ?? buildSessionDefinition;
  const makeSeed = init.makeSeed ?? defaultMakeSeed;
  const menuFactory = init.createMenuOverlay ?? createMenuOverlay;
  const phaseTransitionCurtainFactory =
    init.createPhaseTransitionCurtain ?? createPhaseTransitionCurtain;
  const pauseFactory = init.createPauseOverlay ?? createPauseOverlay;
  const resultFactory = init.createResultOverlay ?? createResultOverlay;
  const settingsOverlayFactory = init.createSettingsOverlay ?? createSettingsOverlay;
  const canMountStartupOverlays =
    typeof (init.parent as Partial<HTMLElement>).appendChild === 'function' &&
    typeof document !== 'undefined';
  const publicArenaStatusFactory =
    init.createPublicArenaStatusOverlay ??
    (canMountStartupOverlays ? createPublicArenaStatusOverlay : createNullPublicArenaStatusOverlay);
  const publicArenaMenuFactory =
    init.createPublicArenaMenuOverlay ??
    (canMountStartupOverlays ? createPublicArenaMenuOverlay : createNullPublicArenaMenuOverlay);
  const publicArenaHudFactory =
    init.createPublicArenaHud ??
    (canMountStartupOverlays ? createPublicArenaHud : createNullPublicArenaHud);
  const publicArenaCombatAffordancesFactory = isMobileInputMode()
    ? createNullPublicArenaCombatAffordances
    : (init.createPublicArenaCombatAffordances ??
      (canMountStartupOverlays
        ? createPublicArenaCombatAffordances
        : createNullPublicArenaCombatAffordances));
  const startupOverlayFactory =
    init.createStartupOverlay ??
    (canMountStartupOverlays ? createStartupOverlay : createNullStartupOverlay);
  const startupErrorOverlayFactory =
    init.createStartupErrorOverlay ??
    (canMountStartupOverlays ? createStartupErrorOverlay : createNullStartupErrorOverlay);
  const rendererFactory = init.createRenderer ?? createRenderer;
  const inputFactory = init.createInputController ?? createInputController;
  const mobileInputFactory = init.createMobileInputController ?? createMobileInputController;
  const hudFactory = init.createHud ?? createHud;
  const canMountMobileControls =
    typeof (init.parent as Partial<HTMLElement>).appendChild === 'function' &&
    typeof document !== 'undefined';
  const mobileControlsFactory =
    init.createMobileControlsOverlay ??
    (canMountMobileControls ? createMobileControlsOverlay : createNullMobileControlsOverlay);
  const escapeProgressPathFactory =
    init.createEscapeProgressPath ?? createEscapeProgressPath;
  const dungeonWaveCounterFactory =
    init.createDungeonWaveCounter ?? createDungeonWaveCounter;
  const titleOverlayFactory = init.createTitleOverlay ?? createTitleOverlay;
  const portalControllerFactory =
    init.createVibeJamPortalController ?? createVibeJamPortalController;
  const audioFactory = init.createAudio ?? createAudio;
  const publicArenaClientFactory =
    init.createPublicArenaClient ?? createPublicArenaClient;
  const publicArenaRendererFactory =
    init.createPublicArenaRenderer ?? createPublicArenaRenderer;
  const clientSettingsStoreFactory =
    init.createClientSettingsStore ?? createClientSettingsStore;
  const dungeonBestWaveStoreFactory =
    init.createDungeonBestWaveStore ?? createDungeonBestWaveStore;
  const clientProgressionStoreFactory =
    init.createClientProgressionStore ?? createClientProgressionStore;
  const runStartupPreload = init.runStartupPreload ?? defaultRunStartupPreload;
  const reloadPage = init.reloadPage ?? defaultReloadPage;
  const assignLocation = init.assignLocation ?? defaultAssignLocation;
  const resolvedPublicArenaConfig = init.publicArenaConfig ?? publicArenaClientConfig;
  const windowTarget = init.windowTarget ?? window;
  const documentTarget = init.documentTarget ?? document;
  const gameViewport =
    init.gameViewport ??
    createWindowGameViewport(windowTarget, init.mobileProfile ?? { isMobile: false });
  const rendererWindowTarget = createRendererWindowTarget(gameViewport);
  const autoStartPresetId = init.autoStartPresetId ?? null;
  const autoStartPublicArena = init.autoStartPublicArena === true;
  const portalStorage =
    init.portalStorage === undefined ? createBrowserVibeJamPortalStorage() : init.portalStorage;
  const portalController = portalControllerFactory({
    href: init.portalHref ?? defaultPortalHref(),
    storage: portalStorage,
    redirect: assignLocation
  });

  let activeSession: SessionDefinition | null = null;
  let preloadedTextures: TextureMap | null = null;
  let renderer: Renderer | null = null;
  let input: InputController | null = null;
  let publicArenaClient: PublicArenaClient | null = null;
  let publicArenaRenderer: PublicArenaRenderer | null = null;
  let onlineRenderer: Renderer | null = null;
  let publicArenaInput: InputController | null = null;
  let publicArenaVisibleAreaCamera: VisibleAreaCamera | null = null;
  let onlineVisibleAreaCamera: VisibleAreaCamera | null = null;
  let publicArenaPreviousSnapshot: Snapshot | null = null;
  let publicArenaSnapshot: Snapshot | null = null;
  let publicArenaSnapshotReceivedAtMs = 0;
  let publicArenaPlayerId: PublicArenaPlayerId | null = null;
  let publicArenaArena: PublicArenaWorldBounds | null = null;
  let publicArenaPlayerCap: number | null = null;
  let activeOnlineSessionId: ModePresetId | null = null;
  let activeOnlineSession: SessionDefinition | null = null;
  let onlineLobbyState: ArenaHostLobbyStateEvent | null = null;
  let nextPublicArenaInputSequence = 1;
  let onlinePredictionActive = false;
  let onlinePredictionInputBuffer: OnlinePredictionBufferedInput[] = [];
  let onlinePredictionPendingFireAcks: OnlinePredictionPendingFireAck[] = [];
  let onlinePredictionRttEstimateMs: number | null = null;
  let onlineCampaignHudAttached = false;
  let onlineStatusMessage = PUBLIC_ARENA_CONNECTING_MESSAGE;
  let publicArenaMenuOpen = false;
  let publicArenaConnectionId = 0;
  let unsubscribeRendererSettings: (() => void) | null = null;
  let settingsVisible = false;
  let phase: UiShellPhase = LOADING_PHASE;
  let disposed = false;
  let transitionActive = false;
  let lastStartedPreset: ModePreset | null = null;
  let lastStartedSource: SessionStartSource | null = null;
  const hud = hudFactory({ parent: init.parent, isMobile: isMobileInputMode() });
  const mobileControls = mobileControlsFactory({ parent: init.parent });
  const escapeProgressPath = escapeProgressPathFactory({ parent: init.parent });
  const dungeonWaveCounter = dungeonWaveCounterFactory({ parent: init.parent });
  const titleOverlay = titleOverlayFactory({
    parent: init.parent,
    isMobile: isMobileInputMode()
  });
  const clientSettingsStore = clientSettingsStoreFactory();
  const dungeonBestWaveStore = dungeonBestWaveStoreFactory();
  const clientProgressionStore = clientProgressionStoreFactory();
  let unsubscribeClientProgression: (() => void) | null = null;
  const audio = audioFactory();
  audio.setMasterGain(clientSettingsStore.get().masterVolume);
  const unsubscribeAudioSettings = clientSettingsStore.subscribe((settings) => {
    audio.setMasterGain(settings.masterVolume);
  });
  let unlockGestureArmed = true;

  const sim =
    (init.createSimWorkerHost ?? createSimWorkerHost)({
      onEvent(event) {
        handleSimEvent(event);
      }
    });

  const startupOverlay = startupOverlayFactory({
    parent: init.parent,
    imageSrc: init.startupImageSrc
  });
  const startupErrorOverlay = startupErrorOverlayFactory({
    parent: init.parent,
    onReload() {
      reloadPage();
    }
  });
  const phaseTransitionCurtain = phaseTransitionCurtainFactory({
    parent: init.parent
  });

  const menu = menuFactory({
    parent: init.parent,
    modes: getPlayableModeCatalog(),
    onlineModes: getOnlineModeCatalog(),
    lab: buildMenuLabViewModel(clientProgressionStore.get()),
    pets: buildMenuPetsViewModel(clientProgressionStore.get()),
    onStart(presetId) {
      if (phase.kind !== 'menu' || isTransitionActive()) {
        return;
      }
      audio.playUi('buttonClick');
      startPresetId(presetId, classifyPlayerStartSource(presetId));
    },
    onStartOnline(presetId) {
      if (phase.kind !== 'menu' || isTransitionActive()) {
        return;
      }
      audio.playUi('buttonClick');
      startOnlineSession(presetId);
    },
    onStartTraining() {
      if (phase.kind !== 'menu' || isTransitionActive()) {
        return;
      }
      audio.playUi('buttonClick');
      startPresetId(autoStartPresetId ?? 'training', 'nonCampaign');
    },
    onOpenSettings() {
      if (phase.kind !== 'menu' || isTransitionActive()) {
        return;
      }
      audio.playUi('buttonClick');
      openSettings();
    },
    onToggleFullscreen() {
      if (phase.kind !== 'menu' || isTransitionActive()) {
        return;
      }
      audio.playUi('buttonClick');
      void toggleFullscreen();
    },
    onOpenScreen(screenId) {
      if (phase.kind !== 'menu' || isTransitionActive()) {
        return;
      }
      audio.playUi('buttonClick');
      openMenuScreen(screenId);
    },
    onBackToMainMenu() {
      if (phase.kind !== 'menu' || isTransitionActive()) {
        return;
      }
      audio.playUi('buttonClick');
      closeMenuScreen();
    },
    onTeaser(controlId) {
      if (phase.kind !== 'menu' || isTransitionActive()) {
        return;
      }
      audio.playUi('buttonClick');
      log.info('menu teaser selected', { controlId });
    },
    onStartDungeon() {
      if (phase.kind !== 'menu' || isTransitionActive()) {
        return;
      }
      audio.playUi('buttonClick');
      startPresetId(DUNGEON_PRESET.id, 'nonCampaign');
    },
    onPurchasePet(quality) {
      const result = clientProgressionStore.purchasePet(quality);
      syncMenuLabViewModel();
      return result;
    },
    onSelectPet(petId) {
      const result = clientProgressionStore.selectPet(petId);
      syncMenuPetsViewModel();
      return result;
    },
    onClearSelectedPet() {
      clientProgressionStore.clearSelectedPet();
      syncMenuPetsViewModel();
    },
    onButtonHover() {
      if (phase.kind !== 'menu' || isTransitionActive()) {
        return;
      }
      audio.playUi('buttonHover');
    },
    onModeSwitch() {
      if (phase.kind !== 'menu' || isTransitionActive()) {
        return;
      }
      audio.playUi('modeSwitch');
    },
    dungeonBestWave: dungeonBestWaveStore.get()
  });
  unsubscribeClientProgression = clientProgressionStore.subscribe(() => {
    syncMenuLabViewModel();
    syncMenuPetsViewModel();
  });

  const pause = pauseFactory({
    parent: init.parent,
    onResume() {
      audio.playUi('buttonClick');
      resumeOverlayPause();
    },
    onExit() {
      audio.playUi('buttonClick');
      exitToMenu();
    },
    onOpenSettings() {
      audio.playUi('buttonClick');
      openSettings();
    }
  });

  const publicArenaStatus = publicArenaStatusFactory({
    parent: init.parent,
    onBack() {
      audio.playUi('buttonClick');
      exitPublicArenaToMenu();
    },
    onLobbyStart() {
      audio.playUi('buttonClick');
      publicArenaClient?.sendInput({ kind: 'lobby:start' });
    },
    onLobbyTransferHost(targetActorId) {
      audio.playUi('buttonClick');
      publicArenaClient?.sendInput({ kind: 'lobby:transferHost', targetActorId });
    }
  });
  const publicArenaMenu = publicArenaMenuFactory({
    parent: init.parent,
    onResume() {
      audio.playUi('buttonClick');
      resumePublicArenaMenu();
    },
    onExit() {
      audio.playUi('buttonClick');
      exitPublicArenaToMenu();
    }
  });
  const publicArenaHud = publicArenaHudFactory({
    parent: init.parent
  });
  const publicArenaCombatAffordances = publicArenaCombatAffordancesFactory({
    parent: init.parent
  });

  const result = resultFactory({
    parent: init.parent,
    onBackToMenu() {
      audio.playUi('buttonClick');
      exitToMenu();
    },
    onRestart() {
      audio.playUi('buttonClick');
      restartLastSession();
    }
  });

  const settingsOverlay = settingsOverlayFactory({
    parent: init.parent,
    store: clientSettingsStore,
    onClose() {
      closeSettings();
    },
    onButtonClick() {
      audio.playUi('buttonClick');
    }
  });

  function handleSimEvent(event: RuntimeEvent): void {
    audio.handleEvent(event);
    renderer?.handleEvent(event);
    if (event.kind === 'win' || event.kind === 'loss') {
      handleRunEnd(event);
      return;
    }
    if (
      event.kind === 'dropSpawn' ||
      event.kind === 'dropPickup' ||
      event.kind === 'dropExpire'
    ) {
      log.info(`drop event: ${event.kind}`, {
        simTime: event.simTime,
        entityId: event.entityId,
        archetypeId: event.archetypeId
      });
    }
  }

  function applyPhaseVisibility(): void {
    switch (phase.kind) {
      case 'loading':
        startupOverlay.show();
        startupErrorOverlay.hide();
        menu.hide();
        pause.hide();
        publicArenaStatus.hide();
        publicArenaMenuOpen = false;
        publicArenaMenu.hide();
        publicArenaCombatAffordances.hide();
        publicArenaHud.hide();
        result.hide();
        mobileControls.hide();
        syncSettingsVisibility();
        return;
      case 'menu':
        startupOverlay.hide();
        startupErrorOverlay.hide();
        menu.show();
        pause.hide();
        publicArenaStatus.hide();
        publicArenaMenuOpen = false;
        publicArenaMenu.hide();
        publicArenaCombatAffordances.hide();
        publicArenaHud.hide();
        result.hide();
        mobileControls.hide();
        syncSettingsVisibility();
        return;
      case 'running':
        startupOverlay.hide();
        startupErrorOverlay.hide();
        menu.hide();
        pause.hide();
        publicArenaStatus.hide();
        publicArenaMenuOpen = false;
        publicArenaMenu.hide();
        publicArenaCombatAffordances.hide();
        publicArenaHud.hide();
        result.hide();
        if (isMobileInputMode()) {
          mobileControls.show();
        } else {
          mobileControls.hide();
        }
        syncSettingsVisibility();
        return;
      case 'onlineConnecting':
        startupOverlay.hide();
        startupErrorOverlay.hide();
        menu.hide();
        pause.hide();
        result.hide();
        mobileControls.hide();
        publicArenaStatus.show(onlineStatusMessage);
        publicArenaMenuOpen = false;
        publicArenaMenu.hide();
        publicArenaCombatAffordances.hide();
        publicArenaHud.hide();
        syncSettingsVisibility();
        return;
      case 'onlineLobby':
        startupOverlay.hide();
        startupErrorOverlay.hide();
        menu.hide();
        pause.hide();
        result.hide();
        mobileControls.hide();
        showOnlineLobbyStatus();
        publicArenaMenuOpen = false;
        publicArenaMenu.hide();
        publicArenaCombatAffordances.hide();
        publicArenaHud.hide();
        syncSettingsVisibility();
        return;
      case 'online':
        startupOverlay.hide();
        startupErrorOverlay.hide();
        menu.hide();
        pause.hide();
        result.hide();
        if (isMobileInputMode() && !publicArenaMenuOpen) {
          mobileControls.show();
        } else {
          mobileControls.hide();
        }
        publicArenaStatus.hide();
        if (publicArenaMenuOpen) {
          publicArenaMenu.show();
        } else {
          publicArenaMenu.hide();
        }
        if (!onlineCampaignHudAttached && !isMobileInputMode() && !publicArenaMenuOpen) {
          publicArenaCombatAffordances.show();
        } else {
          publicArenaCombatAffordances.hide();
        }
        if (onlineCampaignHudAttached) {
          publicArenaHud.hide();
        } else {
          publicArenaHud.show();
        }
        syncSettingsVisibility();
        return;
      case 'paused':
        startupOverlay.hide();
        startupErrorOverlay.hide();
        menu.hide();
        pause.show();
        publicArenaStatus.hide();
        publicArenaMenuOpen = false;
        publicArenaMenu.hide();
        publicArenaCombatAffordances.hide();
        publicArenaHud.hide();
        result.hide();
        mobileControls.hide();
        syncSettingsVisibility();
        return;
      case 'result':
        startupOverlay.hide();
        startupErrorOverlay.hide();
        menu.hide();
        pause.hide();
        publicArenaStatus.hide();
        publicArenaMenuOpen = false;
        publicArenaMenu.hide();
        publicArenaCombatAffordances.hide();
        publicArenaHud.hide();
        result.show(phase.viewModel);
        mobileControls.hide();
        syncSettingsVisibility();
        return;
      case 'error':
        startupOverlay.hide();
        menu.hide();
        pause.hide();
        publicArenaStatus.hide();
        publicArenaMenuOpen = false;
        publicArenaMenu.hide();
        publicArenaCombatAffordances.hide();
        publicArenaHud.hide();
        result.hide();
        startupErrorOverlay.show(phase.message);
        mobileControls.hide();
        syncSettingsVisibility();
        return;
      default:
        assertNever(phase);
    }
  }

  function syncSettingsVisibility(): void {
    if (settingsVisible && (phase.kind === 'menu' || phase.kind === 'paused')) {
      settingsOverlay.show();
      return;
    }
    settingsVisible = false;
    settingsOverlay.hide();
  }

  function showOnlineLobbyStatus(): void {
    const state = onlineLobbyState;
    const selfActorId = publicArenaPlayerId;
    if (state === null || selfActorId === null) {
      publicArenaStatus.show(onlineStatusMessage);
      return;
    }
    publicArenaStatus.showLobby({
      sessionDisplayName: onlineModeDisplayName(state.sessionConfigId),
      roomId: state.roomId,
      selfActorId,
      state: state.state,
      joined: state.joined,
      hostActorId: state.hostActorId,
      maxPlayers: state.maxPlayers,
      lateJoinAllowed: state.lateJoinAllowed
    });
  }

  function onlineModeDisplayName(presetId: ModePresetId): string {
    return SESSION_PRESET_TEMPLATES[presetId].displayName;
  }

  function onlineConnectingMessage(presetId: ModePresetId): string {
    return presetId === 'public-arena'
      ? PUBLIC_ARENA_CONNECTING_MESSAGE
      : `Joining ${onlineModeDisplayName(presetId)}`;
  }

  function openSettings(): void {
    if (phase.kind !== 'menu' && phase.kind !== 'paused') {
      return;
    }
    settingsVisible = true;
    syncSettingsVisibility();
  }

  function closeSettings(): void {
    settingsVisible = false;
    syncSettingsVisibility();
  }

  function syncMenuLabViewModel(): void {
    menu.setLabViewModel(buildMenuLabViewModel(clientProgressionStore.get()));
  }

  function syncMenuPetsViewModel(): void {
    menu.setPetsViewModel(buildMenuPetsViewModel(clientProgressionStore.get()));
  }

  async function toggleFullscreen(): Promise<void> {
    try {
      if (documentTarget.fullscreenElement != null) {
        const exitFullscreen = documentTarget.exitFullscreen;
        if (typeof exitFullscreen === 'function') {
          await exitFullscreen.call(documentTarget);
        }
        return;
      }

      const requestFullscreen = documentTarget.documentElement?.requestFullscreen;
      if (typeof requestFullscreen !== 'function') {
        log.warn('fullscreen request is not supported');
        return;
      }
      await requestFullscreen.call(documentTarget.documentElement);
    } catch (error: unknown) {
      log.warn('fullscreen request failed', { error: formatStartupError(error) });
    }
  }

  function setPhase(next: UiShellPhase): void {
    const previousPhase = phase;
    phase = next;
    applyPhaseVisibility();
    if (next.kind === 'paused' && previousPhase.kind !== 'paused') {
      audio.playUi('overlayShow');
    }
    if (next.kind === 'result' && previousPhase.kind !== 'result') {
      audio.playUi('overlayShow');
    }
  }

  function openMenuScreen(screenId: MenuSubscreenId): void {
    if (phase.kind !== 'menu' || menu.screen() !== 'main' || isTransitionActive()) {
      return;
    }

    transitionActive = true;
    void phaseTransitionCurtain
      .run(() => {
        menu.showScreen(screenId);
      })
      .finally(() => {
        transitionActive = false;
      });
  }

  function closeMenuScreen(): void {
    if (phase.kind !== 'menu' || menu.screen() === 'main' || isTransitionActive()) {
      return;
    }

    transitionActive = true;
    void phaseTransitionCurtain
      .run(() => {
        menu.showScreen('main');
      })
      .finally(() => {
        transitionActive = false;
      });
  }

  function startPresetId(presetId: ModePresetId, source: SessionStartSource): void {
    if (phase.kind !== 'menu' || isTransitionActive()) return;
    const preset = resolveModePreset(presetId);
    void startPresetWithTransition(preset, source);
  }

  function startOnlineSession(presetId: ModePresetId): void {
    if (phase.kind !== 'menu' || publicArenaClient !== null) {
      return;
    }
    const serverUrl = resolvedPublicArenaConfig.serverUrl;
    if (serverUrl === null) {
      menu.showFeedback(
        presetId === 'public-arena'
          ? PUBLIC_ARENA_NOT_CONFIGURED_MESSAGE
          : ONLINE_SESSION_NOT_CONFIGURED_MESSAGE
      );
      return;
    }

    const connectionId = publicArenaConnectionId + 1;
    publicArenaConnectionId = connectionId;
    nextPublicArenaInputSequence = 1;
    activeOnlineSessionId = presetId;
    onlineStatusMessage = onlineConnectingMessage(presetId);
    setPhase(ONLINE_CONNECTING_PHASE);
    const nextPublicArenaClient = publicArenaClientFactory({
      serverUrl,
      requestedSessionId: presetId,
      selectedPetId: clientProgressionStore.get().selectedPetId,
      onAccepted(message) {
        if (!isCurrentPublicArenaConnection(connectionId)) {
          return;
        }
        const acceptedSessionId = message.sessionConfigId ?? presetId;
        activeOnlineSessionId = acceptedSessionId;
        attachPublicArenaPresentation({
          playerId: message.actorId,
          arena: message.arena,
          playerCap: message.playerCap,
          sessionConfigId: acceptedSessionId
        });
        log.info('online session accepted', {
          playerId: message.actorId,
          population: message.population,
          sessionConfigId: acceptedSessionId,
          roomId: message.roomId ?? null,
          roomState: message.roomState ?? 'running'
        });
        if (message.roomState === 'open') {
          onlineStatusMessage = `Joining ${onlineModeDisplayName(acceptedSessionId)}`;
          setPhase(ONLINE_CONNECTING_PHASE);
          return;
        }
        setPhase(ONLINE_PHASE);
      },
      onRejected(message) {
        if (!finishPublicArenaConnection(connectionId)) {
          return;
        }
        tearDownPublicArenaPresentation();
        setPhase(MENU_PHASE);
        menu.showFeedback(message.message);
      },
      onSnapshot(snapshot) {
        if (!isCurrentPublicArenaConnection(connectionId)) {
          return;
        }
        publicArenaPreviousSnapshot = publicArenaSnapshot;
        publicArenaSnapshot = snapshot;
        publicArenaSnapshotReceivedAtMs = currentUiTimeMs();
        handleAuthoritativeOnlineSnapshot(snapshot);
        const arena = requirePublicArenaArena();
        const visibleAreaCamera = ensureOnlineRendererForSnapshot(arena, snapshot);
        ensurePublicArenaInput(arena, visibleAreaCamera);
        if (onlineCampaignHudAttached) {
          publicArenaHud.hide();
          publicArenaCombatAffordances.hide();
        } else {
          publicArenaHud.update(snapshot, publicArenaPlayerId, publicArenaPlayerCap);
          publicArenaCombatAffordances.update(snapshot, publicArenaPlayerId);
        }
      },
      onPresentation(event) {
        if (!isCurrentPublicArenaConnection(connectionId)) {
          return;
        }
        handlePublicArenaPresentationEvent(event);
      },
      onClose(reason) {
        if (!finishPublicArenaConnection(connectionId)) {
          return;
        }
        tearDownPublicArenaPresentation();
        setPhase(MENU_PHASE);
        menu.showFeedback(reason.message);
      }
    });
    if (!isCurrentPublicArenaConnection(connectionId)) {
      nextPublicArenaClient.disconnect();
      return;
    }
    publicArenaClient = nextPublicArenaClient;
  }

  function isCurrentPublicArenaConnection(connectionId: number): boolean {
    return publicArenaConnectionId === connectionId;
  }

  function finishPublicArenaConnection(connectionId: number): boolean {
    if (!isCurrentPublicArenaConnection(connectionId)) {
      return false;
    }
    publicArenaConnectionId += 1;
    publicArenaClient = null;
    return true;
  }

  function handlePublicArenaPresentationEvent(event: ArenaHostEvent): void {
    if (event.kind === 'host:lobby:state') {
      handleOnlineLobbyState(event);
      return;
    }
    if (event.kind === 'host:lobby:hostChanged') {
      handleOnlineLobbyHostChanged(event.newHostActorId);
      return;
    }
    if (event.kind === 'host:lobby:start') {
      setPhase(ONLINE_PHASE);
      return;
    }
    if (event.kind === 'host:levelUp') {
      return;
    }
    if (event.kind === 'playerSpawn') {
      return;
    }
    audio.handleEvent(event);
    onlineRenderer?.handleEvent(event);
    if (event.kind === 'win' || event.kind === 'loss') {
      handleOnlineRunEnd(event);
    }
  }

  function handleOnlineLobbyState(event: ArenaHostLobbyStateEvent): void {
    onlineLobbyState = event;
    activeOnlineSessionId = event.sessionConfigId;
    if (!onlineCampaignHudAttached && onlineRenderer === null) {
      // Dynamic-roster online sessions are built lazily from the latest lobby roster.
      activeOnlineSession = null;
    }
    if (event.state === 'open') {
      setPhase(ONLINE_LOBBY_PHASE);
      return;
    }
    if (phase.kind === 'onlineConnecting' || phase.kind === 'onlineLobby') {
      setPhase(ONLINE_PHASE);
    }
  }

  function handleOnlineLobbyHostChanged(newHostActorId: string): void {
    const state = onlineLobbyState;
    if (state === null) {
      return;
    }
    onlineLobbyState = {
      ...state,
      hostActorId: newHostActorId
    };
    if (phase.kind === 'onlineLobby') {
      showOnlineLobbyStatus();
    }
  }

  function attachPublicArenaPresentation(
    handshake: Readonly<{
      playerId: PublicArenaPlayerId;
      arena: PublicArenaWorldBounds;
      playerCap: number;
      sessionConfigId: ModePresetId;
    }>
  ): void {
    tearDownPublicArenaPresentation();
    publicArenaSnapshot = null;
    publicArenaPreviousSnapshot = null;
    publicArenaSnapshotReceivedAtMs = 0;
    publicArenaPlayerId = handshake.playerId;
    publicArenaArena = handshake.arena;
    publicArenaPlayerCap = handshake.playerCap;
    activeOnlineSessionId = handshake.sessionConfigId;
    portalController.attachPublicArena();
    publicArenaHud.update(null, publicArenaPlayerId, handshake.playerCap);
    publicArenaCombatAffordances.update(null, publicArenaPlayerId);
  }

  function requirePublicArenaArena(): PublicArenaWorldBounds {
    if (publicArenaArena === null) {
      throw new Error('Public Arena snapshot arrived before joinAccepted arena config.');
    }
    return publicArenaArena;
  }

  function ensureOnlineRendererForSnapshot(
    arena: PublicArenaWorldBounds,
    snapshot: Snapshot
  ): VisibleAreaCamera {
    if (activeOnlineSessionId !== 'public-arena' && isCampaignShapeOnlineSnapshot(snapshot)) {
      attachOnlineCampaignHud();
      return ensureOnlineCampaignRenderer(arena);
    }
    return ensurePublicArenaRenderer(arena);
  }

  function ensurePublicArenaRenderer(arena: PublicArenaWorldBounds): VisibleAreaCamera {
    if (publicArenaRenderer !== null) {
      if (publicArenaVisibleAreaCamera === null) {
        throw new Error('Public arena renderer is missing its visible-area camera.');
      }
      return publicArenaVisibleAreaCamera;
    }
    if (preloadedTextures === null) {
      throw new Error('Public arena renderer requires preloaded sprite textures.');
    }
    const visibleAreaCamera = createVisibleAreaCamera({
      arena,
      profile: visibleAreaProfile(),
      effectiveViewport: currentEffectiveViewport(),
      playerPosition: findPublicArenaSelfPosition()
    });
    const nextRenderer = publicArenaRendererFactory({
      canvas: init.canvas,
      renderScalePreset: clientSettingsStore.get().renderScalePreset,
      arena,
      selfId: requirePublicArenaPlayerId(),
      spriteTextures: preloadedTextures,
      visibleAreaCamera,
      getSnapshotPair: onlineSnapshotPair,
      getPredictedSnapshotPair: sim.predictedSnapshotPair,
      getPortalDescriptors: portalController.portals,
      getAim: () =>
        publicArenaInput !== null && publicArenaInput.isActive()
          ? publicArenaInput.currentAim()
          : null,
      windowTarget: rendererWindowTarget
    });
    unsubscribeRendererSettings?.();
    unsubscribeRendererSettings = clientSettingsStore.subscribe((settings) => {
      nextRenderer.applyScalePolicy(settings.renderScalePreset);
    });
    publicArenaRenderer = nextRenderer;
    publicArenaVisibleAreaCamera = visibleAreaCamera;
    return visibleAreaCamera;
  }

  function ensureOnlineCampaignRenderer(arena: PublicArenaWorldBounds): VisibleAreaCamera {
    if (onlineRenderer !== null) {
      if (onlineVisibleAreaCamera === null) {
        throw new Error('Online campaign renderer is missing its visible-area camera.');
      }
      return onlineVisibleAreaCamera;
    }
    if (preloadedTextures === null) {
      throw new Error('Online campaign renderer requires preloaded sprite textures.');
    }
    const session = requireActiveOnlineSession();
    const visibleAreaCamera = createVisibleAreaCamera({
      arena,
      profile: visibleAreaProfile(),
      effectiveViewport: currentEffectiveViewport(),
      playerPosition: findPublicArenaSelfPosition()
    });
    const nextRenderer = rendererFactory({
      canvas: init.canvas,
      renderScalePreset: clientSettingsStore.get().renderScalePreset,
      arena,
      session,
      spriteTextures: preloadedTextures,
      selectedPetId: null,
      visibleAreaCamera,
      getSnapshotPair: onlineSnapshotPair,
      getPredictedSnapshotPair: sim.predictedSnapshotPair,
      getPortalDescriptors: portalController.portals,
      getAim: () =>
        publicArenaInput !== null && publicArenaInput.isActive()
          ? publicArenaInput.currentAim()
          : null,
      windowTarget: rendererWindowTarget
    });
    unsubscribeRendererSettings?.();
    unsubscribeRendererSettings = clientSettingsStore.subscribe((settings) => {
      nextRenderer.applyScalePolicy(settings.renderScalePreset);
    });
    onlineRenderer = nextRenderer;
    onlineVisibleAreaCamera = visibleAreaCamera;
    return visibleAreaCamera;
  }

  function ensurePublicArenaInput(
    arena: PublicArenaWorldBounds,
    visibleAreaCamera: VisibleAreaCamera
  ): void {
    if (publicArenaInput !== null) {
      return;
    }
    const activePublicArenaClient = publicArenaClient;
    if (activePublicArenaClient === null || phase.kind !== 'online' || publicArenaMenuOpen) {
      return;
    }
    const nextInput = createPublicArenaInputController(
      arena,
      visibleAreaCamera,
      activePublicArenaClient
    );
    publicArenaInput = nextInput;
    nextInput.start();
  }

  function attachOnlineCampaignHud(): void {
    const session = requireActiveOnlineSession();
    if (onlineCampaignHudAttached) {
      return;
    }
    hud.attach(session);
    escapeProgressPath.attach(session);
    titleOverlay.attach(session);
    onlineCampaignHudAttached = true;
    applyPhaseVisibility();
  }

  function requireActiveOnlineSession(): SessionDefinition {
    if (activeOnlineSession !== null) {
      return activeOnlineSession;
    }
    const sessionId = activeOnlineSessionId;
    if (sessionId === null) {
      throw new Error('Online presentation session requires an accepted session id.');
    }
    const baseSession = builder(resolveModePreset(sessionId), {
      seed: 0,
      selectedPetId: null
    });
    activeOnlineSession = withOnlinePresentationPlayers(baseSession, sessionId);
    return activeOnlineSession;
  }

  function withOnlinePresentationPlayers(
    session: SessionDefinition,
    sessionId: ModePresetId
  ): SessionDefinition {
    const template = SESSION_PRESET_TEMPLATES[sessionId];
    if (!session.dynamicRoster) {
      return session;
    }
    return {
      ...session,
      dynamicRoster: true,
      players: onlinePresentationActors().map((actor) => ({
        ...template.playerTemplate,
        id: actor.actorId,
        loadout: copyLoadout(template.playerTemplate.loadout),
        companion:
          template.companion === null || actor.petArchetypeId === null
            ? null
            : {
                ...template.companion,
                weaponLoadout: copyLoadout(template.companion.weaponLoadout),
                petArchetypeId: actor.petArchetypeId
              }
      }))
    };
  }

  function onlinePresentationActors(): ReadonlyArray<
    Readonly<{ actorId: string; petArchetypeId: string | null }>
  > {
    if (onlineLobbyState !== null) {
      return onlineLobbyState.joined;
    }
    if (publicArenaPlayerId === null) {
      return [];
    }
    return [
      {
        actorId: publicArenaPlayerId,
        petArchetypeId: clientProgressionStore.get().selectedPetId
      }
    ];
  }

  function onlineSnapshotPair(): SnapshotPair {
    const prev = snapshotWithSelfPlayerFirst(publicArenaPreviousSnapshot, publicArenaPlayerId);
    const curr = snapshotWithSelfPlayerFirst(publicArenaSnapshot, publicArenaPlayerId);
    return {
      prev,
      curr,
      currReceivedAtMs: publicArenaSnapshotReceivedAtMs,
      nowMs: currentUiTimeMs()
    };
  }

  function ensureOnlinePredictionStarted(): void {
    const playerId = publicArenaPlayerId;
    if (onlinePredictionActive || playerId === null) return;
    const session = requireActiveOnlineSession();
    sim.startSession(session, { mode: 'online-predictor', selfPlayerId: playerId });
    onlinePredictionActive = true;
    onlinePredictionInputBuffer = [];
    onlinePredictionPendingFireAcks = [];
    onlinePredictionRttEstimateMs = null;
  }

  function stopOnlinePrediction(): void {
    if (!onlinePredictionActive) return;
    onlinePredictionActive = false;
    onlinePredictionInputBuffer = [];
    onlinePredictionPendingFireAcks = [];
    onlinePredictionRttEstimateMs = null;
    sim.stopSession();
  }

  function handleAuthoritativeOnlineSnapshot(snapshot: Snapshot): void {
    ensureOnlinePredictionStarted();
    trackPredictedFireRejectedSnap(snapshot);
    trimOnlinePredictionInputBuffer(snapshot);
    if (onlinePredictionActive) {
      sim.acceptAuthoritativeSnapshot(snapshot);
    }
  }

  function trackPredictedFireRejectedSnap(snapshot: Snapshot): void {
    const playerId = publicArenaPlayerId;
    if (
      playerId === null ||
      (onlinePredictionInputBuffer.length === 0 &&
        onlinePredictionPendingFireAcks.length === 0)
    ) {
      return;
    }
    const acknowledged = snapshot.lastInputSequence[playerId] ?? 0;
    if (acknowledged <= 0) return;
    const self = snapshot.entities.find(
      (entity) => entity.kind === 'player' && entity.playerId === playerId
    );
    if (self === undefined || self.kind !== 'player') return;
    const ownProjectileSequences = new Set<number>();
    for (const entity of snapshot.entities) {
      if (
        entity.kind === 'projectile' &&
        entity.ownerKind === 'player' &&
        entity.ownerId === self.id &&
        entity.spawnInputSequence !== null
      ) {
        ownProjectileSequences.add(entity.spawnInputSequence);
      }
    }
    const nowMs = currentUiTimeMs();
    updateOnlinePredictionRttEstimate(acknowledged, nowMs);
    for (const entry of onlinePredictionInputBuffer) {
      if (
        entry.inputSequence <= acknowledged &&
        entry.command.kind === 'fire' &&
        entry.command.phase === 'start' &&
        !ownProjectileSequences.has(entry.inputSequence) &&
        !onlinePredictionPendingFireAcks.some(
          (pending) => pending.inputSequence === entry.inputSequence
        )
      ) {
        onlinePredictionPendingFireAcks.push({
          inputSequence: entry.inputSequence,
          sentAtMs: entry.sentAtMs
        });
      }
    }
    const rejectionWindowMs = predictedFireRejectedWindowMs();
    onlinePredictionPendingFireAcks = onlinePredictionPendingFireAcks.filter((entry) => {
      if (entry.inputSequence > acknowledged) return true;
      if (ownProjectileSequences.has(entry.inputSequence)) return false;
      if (nowMs - entry.sentAtMs >= rejectionWindowMs) return false;
      return true;
    });
  }

  function updateOnlinePredictionRttEstimate(acknowledged: number, nowMs: number): void {
    for (const entry of onlinePredictionInputBuffer) {
      if (entry.inputSequence > acknowledged) continue;
      const sampleMs = Math.min(
        ONLINE_PREDICTION_REJECT_WINDOW_MAX_MS,
        Math.max(0, nowMs - entry.sentAtMs - SNAPSHOT_INTERVAL_MS)
      );
      onlinePredictionRttEstimateMs =
        onlinePredictionRttEstimateMs === null
          ? sampleMs
          : onlinePredictionRttEstimateMs +
            (sampleMs - onlinePredictionRttEstimateMs) * ONLINE_PREDICTION_RTT_ESTIMATE_ALPHA;
    }
  }

  function predictedFireRejectedWindowMs(): number {
    const rttEstimateMs = onlinePredictionRttEstimateMs ?? SNAPSHOT_INTERVAL_MS;
    return Math.min(
      ONLINE_PREDICTION_REJECT_WINDOW_MAX_MS,
      Math.max(
        ONLINE_PREDICTION_REJECT_WINDOW_MIN_MS,
        rttEstimateMs * 2 + SNAPSHOT_INTERVAL_MS
      )
    );
  }

  function trimOnlinePredictionInputBuffer(snapshot: Snapshot): void {
    const playerId = publicArenaPlayerId;
    if (playerId === null || onlinePredictionInputBuffer.length === 0) return;
    const acknowledged = snapshot.lastInputSequence[playerId] ?? 0;
    onlinePredictionInputBuffer = onlinePredictionInputBuffer.filter(
      (entry) => entry.inputSequence > acknowledged
    );
  }

  function isCampaignShapeOnlineSnapshot(snapshot: Snapshot): boolean {
    return (
      snapshot.encounter !== null ||
      snapshot.waveProgress !== null ||
      snapshot.bossHud !== null ||
      snapshot.zone.mode !== 'disabled'
    );
  }

  function createPublicArenaInputController(
    arena: PublicArenaWorldBounds,
    visibleAreaCamera: VisibleAreaCamera,
    activePublicArenaClient: PublicArenaClient
  ): InputController {
    const inputCommandSink = (command: InputCommand): void => {
      sendSequencedPublicArenaInput(activePublicArenaClient, command);
    };
    const sharedInput = {
      pixelsPerWorldUnit: () =>
        pixelsPerWorldUnitFromVisibleArea(init.canvas, visibleAreaCamera),
      visibleArea: () => visibleAreaCamera.visibleArea(),
      initialAim: findPublicArenaSelfPosition(),
      onCommand: inputCommandSink
    };
    if (isMobileInputMode()) {
      return mobileInputFactory({
        ...sharedInput,
        surface: init.parent,
        pauseElement: () => mobileControls.pauseButtonElement(),
        weaponSlotElements: () => queryWeaponSlotElements(init.parent),
        onPause: openPublicArenaMenu
      });
    }
    return inputFactory({
      ...sharedInput,
      canvas: init.canvas
    });
  }

  function sequencedPublicArenaIntentFromInput(
    command: InputCommand
  ): SequencedPublicArenaInput | null {
    const intent = publicArenaIntentFromInput(command);
    if (intent === null) return null;
    const inputSequence = nextPublicArenaInputSequence;
    nextPublicArenaInputSequence += 1;
    return { command, intent: { ...intent, inputSequence }, inputSequence };
  }

  function sendSequencedPublicArenaInput(
    activePublicArenaClient: PublicArenaClient | null,
    command: InputCommand
  ): void {
    const sequenced = sequencedPublicArenaIntentFromInput(command);
    if (sequenced === null) return;
    activePublicArenaClient?.sendInput(sequenced.intent);
    if (!onlinePredictionActive) return;
    onlinePredictionInputBuffer.push({
      command: sequenced.command,
      inputSequence: sequenced.inputSequence,
      sentAtMs: currentUiTimeMs()
    });
    sim.sendSequencedInput(sequenced.command, sequenced.inputSequence);
  }

  function openPublicArenaMenu(): void {
    if (phase.kind !== 'online' || publicArenaMenuOpen) {
      return;
    }
    publicArenaMenuOpen = true;
    stopPublicArenaInputForMenu();
    applyPhaseVisibility();
  }

  function resumePublicArenaMenu(): void {
    if (phase.kind !== 'online' || !publicArenaMenuOpen) {
      return;
    }
    publicArenaMenuOpen = false;
    applyPhaseVisibility();
    const snapshot = publicArenaSnapshot;
    const visibleAreaCamera = publicArenaVisibleAreaCamera;
    const arena = publicArenaArena;
    if (arena === null || snapshot === null || visibleAreaCamera === null) {
      return;
    }
    ensurePublicArenaInput(arena, visibleAreaCamera);
  }

  function stopPublicArenaInputForMenu(): void {
    const activePublicArenaClient = publicArenaClient;
    sendSequencedPublicArenaInput(activePublicArenaClient, { kind: 'move', dx: 0, dy: 0 });
    sendSequencedPublicArenaInput(activePublicArenaClient, { kind: 'fire', phase: 'stop' });
    const previousInput = publicArenaInput;
    publicArenaInput = null;
    previousInput?.stop();
  }

  function findPublicArenaSelfPosition(): Readonly<{ x: number; y: number }> {
    const snapshot = publicArenaSnapshotView(publicArenaSnapshot);
    const selfId = publicArenaPlayerId;
    const self =
      selfId === null ? undefined : snapshot?.players.find((player) => player.id === selfId);
    return self === undefined ? { x: 0, y: 0 } : { x: self.x, y: self.y };
  }

  function publicArenaPortalSnapshot(): VibeJamPortalPublicArenaSnapshot | null {
    const snapshot = publicArenaSnapshot;
    if (snapshot === null) {
      return null;
    }
    const view = publicArenaSnapshotView(snapshot);
    const selfId = publicArenaPlayerId;
    const self =
      selfId === null ? undefined : view?.players.find((player) => player.id === selfId);
    return {
      simTimeMs: snapshot.simTimeMs,
      player: self === undefined ? null : { x: self.x, y: self.y }
    };
  }

  function tearDownPublicArenaPresentation(): void {
    publicArenaMenuOpen = false;
    publicArenaMenu.hide();
    publicArenaCombatAffordances.hide();
    if (
      publicArenaRenderer === null &&
      onlineRenderer === null &&
      publicArenaInput === null &&
      publicArenaVisibleAreaCamera === null &&
      onlineVisibleAreaCamera === null &&
      publicArenaSnapshot === null &&
      publicArenaPlayerId === null &&
      publicArenaArena === null &&
      publicArenaPlayerCap === null &&
      activeOnlineSession === null &&
      onlineLobbyState === null &&
      !onlinePredictionActive
    ) {
      publicArenaHud.hide();
      publicArenaCombatAffordances.hide();
      return;
    }
    const previousInput = publicArenaInput;
    const previousRenderer = publicArenaRenderer;
    const previousOnlineRenderer = onlineRenderer;
    const previousUnsubscribeRendererSettings = unsubscribeRendererSettings;
    publicArenaInput = null;
    publicArenaRenderer = null;
    onlineRenderer = null;
    publicArenaVisibleAreaCamera = null;
    onlineVisibleAreaCamera = null;
    publicArenaPreviousSnapshot = null;
    publicArenaSnapshot = null;
    publicArenaSnapshotReceivedAtMs = 0;
    publicArenaPlayerId = null;
    publicArenaArena = null;
    publicArenaPlayerCap = null;
    activeOnlineSessionId = null;
    activeOnlineSession = null;
    onlineLobbyState = null;
    stopOnlinePrediction();
    if (onlineCampaignHudAttached) {
      titleOverlay.detach();
      escapeProgressPath.detach();
      hud.detach();
      onlineCampaignHudAttached = false;
    }
    unsubscribeRendererSettings = null;
    portalController.detachSession();
    previousInput?.stop();
    previousUnsubscribeRendererSettings?.();
    previousRenderer?.dispose();
    previousOnlineRenderer?.dispose();
    publicArenaHud.hide();
    publicArenaCombatAffordances.hide();
  }

  function requirePublicArenaPlayerId(): PublicArenaPlayerId {
    if (publicArenaPlayerId === null) {
      throw new Error('Public Arena renderer requires the joinAccepted player id.');
    }
    return publicArenaPlayerId;
  }

  async function startPresetWithTransition(
    preset: ModePreset,
    source: SessionStartSource
  ): Promise<void> {
    if (phase.kind !== 'menu' || activeSession !== null || isTransitionActive()) {
      return;
    }

    transitionActive = true;
    try {
      await phaseTransitionCurtain.run(
        () => {
          startPreset(preset, { startInput: false, source });
        },
        () => {
          if (phase.kind === 'running') {
            input?.start();
          }
        }
      );
    } finally {
      transitionActive = false;
    }
  }

  function startPreset(
    preset: ModePreset,
    options: Readonly<{ startInput: boolean; source: SessionStartSource }> = {
      startInput: true,
      source: 'nonCampaign'
    }
  ): void {
    if (phase.kind !== 'menu') return;
    if (activeSession !== null) return;

    const selectedPetId = clientProgressionStore.get().selectedPetId;
    const session = builder(preset, {
      seed: makeSeed(),
      selectedPetId
    });
    const clientSettings = clientSettingsStore.get();
    const spriteTextures = preloadedTextures;
    if (spriteTextures === null) {
      throw new Error('Sprite textures must be preloaded before starting a session');
    }

    let nextRenderer: Renderer | null = null;
    let nextInput: InputController | null = null;
    let nextUnsubscribeRendererSettings: (() => void) | null = null;
    const visibleAreaCamera = createSessionVisibleAreaCamera(session);
    try {
      nextRenderer = rendererFactory({
        canvas: init.canvas,
        renderScalePreset: clientSettings.renderScalePreset,
        arena: session.arena,
        session,
        spriteTextures,
        selectedPetId:
          !session.players.some((player) => player.companion !== null) &&
          options.source === 'campaign'
            ? selectedPetId
            : null,
        visibleAreaCamera,
        getSnapshotPair: sim.snapshotPair,
        getPortalDescriptors: portalController.portals,
        getAim: () => (input !== null && input.isActive() ? input.currentAim() : null),
        windowTarget: rendererWindowTarget
      });
      const activeRenderer = nextRenderer;
      let lastRendererPreset = clientSettings.renderScalePreset;
      nextUnsubscribeRendererSettings = clientSettingsStore.subscribe((settings) => {
        if (settings.renderScalePreset === lastRendererPreset) {
          return;
        }
        lastRendererPreset = settings.renderScalePreset;
        activeRenderer.applyScalePolicy(settings.renderScalePreset);
      });

      nextInput = createSessionInputController(session, visibleAreaCamera);
    } catch (error: unknown) {
      nextUnsubscribeRendererSettings?.();
      nextRenderer?.dispose();
      throw error;
    }

    let audioAttached = false;
    let sessionStarted = false;
    let hudAttached = false;
    let escapeProgressPathAttached = false;
    let dungeonWaveCounterAttached = false;
    let titleOverlayAttached = false;
    let portalControllerAttached = false;
    try {
      audio.attach(session);
      audioAttached = true;
      sim.startSession(session);
      sessionStarted = true;
      if (options.startInput) {
        nextInput.start();
      }
      hud.attach(session);
      hudAttached = true;
      escapeProgressPath.attach(session);
      escapeProgressPathAttached = true;
      dungeonWaveCounter.attach(session);
      dungeonWaveCounterAttached = true;
      titleOverlay.attach(session);
      titleOverlayAttached = true;
      portalController.attachSession(session);
      portalControllerAttached = true;
    } catch (error: unknown) {
      if (portalControllerAttached) {
        portalController.detachSession();
      }
      if (titleOverlayAttached) {
        titleOverlay.detach();
      }
      if (dungeonWaveCounterAttached) {
        dungeonWaveCounter.detach();
      }
      if (escapeProgressPathAttached) {
        escapeProgressPath.detach();
      }
      if (hudAttached) {
        hud.detach();
      }
      nextInput.stop();
      if (sessionStarted) {
        sim.stopSession();
      }
      if (audioAttached) {
        audio.detach();
      }
      nextUnsubscribeRendererSettings?.();
      nextRenderer.dispose();
      throw error;
    }

    renderer = nextRenderer;
    input = nextInput;
    activeSession = session;
    unsubscribeRendererSettings?.();
    unsubscribeRendererSettings = nextUnsubscribeRendererSettings;
    lastStartedPreset = preset;
    lastStartedSource = options.source;

    setPhase(RUNNING_PHASE);
  }

  function tearDownClientSession(): void {
    const previousInput = input;
    const previousRenderer = renderer;
    const previousUnsubscribeRendererSettings = unsubscribeRendererSettings;
    const hadClientSession =
      activeSession !== null || previousInput !== null || previousRenderer !== null;

    input = null;
    renderer = null;
    activeSession = null;
    settingsVisible = false;
    unsubscribeRendererSettings = null;

    previousInput?.stop();
    previousUnsubscribeRendererSettings?.();
    previousRenderer?.dispose();
    if (hadClientSession) {
      portalController.detachSession();
      titleOverlay.detach();
      dungeonWaveCounter.detach();
      escapeProgressPath.detach();
      hud.detach();
      audio.detach();
    }
  }

  function exitToMenu(): void {
    const previousPhase = phase;
    if (
      previousPhase.kind === 'onlineConnecting' ||
      previousPhase.kind === 'onlineLobby' ||
      previousPhase.kind === 'online'
    ) {
      exitPublicArenaToMenu();
      return;
    }

    if (previousPhase.kind === 'running' || previousPhase.kind === 'paused') {
      tearDownClientSession();
      sim.stopSession();
      setPhase(MENU_PHASE);
      return;
    }

    if (previousPhase.kind !== 'result') {
      return;
    }

    setPhase(MENU_PHASE);
  }

  function exitPublicArenaToMenu(): void {
    if (
      phase.kind !== 'onlineConnecting' &&
      phase.kind !== 'onlineLobby' &&
      phase.kind !== 'online'
    ) {
      return;
    }
    const activePublicArenaClient = publicArenaClient;
    publicArenaConnectionId += 1;
    tearDownPublicArenaPresentation();
    publicArenaClient = null;
    activePublicArenaClient?.disconnect();
    setPhase(MENU_PHASE);
  }

  function restartLastSession(): void {
    if (phase.kind !== 'result' || phase.outcome !== 'loss') {
      return;
    }
    if (lastStartedPreset === null || isTransitionActive()) {
      return;
    }

    const preset = lastStartedPreset;
    const source = lastStartedSource ?? 'nonCampaign';
    setPhase(MENU_PHASE);
    void startPresetWithTransition(preset, source);
  }

  function handleRunEnd(event: Extract<RuntimeEvent, { kind: 'win' | 'loss' }>): void {
    if (activeSession === null) return;
    const session = activeSession;
    const kind = event.kind;
    const simTimeMs = event.simTime;
    log.info(`run ended: ${kind}`, { simTimeMs });
    let dungeonBest: ResultDungeonBestState | null = null;
    if (event.summary.dungeon !== null) {
      const record = dungeonBestWaveStore.record(event.summary.dungeon.wavesCleared);
      menu.setDungeonBestWave(record.bestWave);
      dungeonBest = record;
    }
    const xpReward = awardResultXp(event.summary);
    const viewModel = buildResultViewModel(session, event.summary, { dungeonBest, xpReward });
    tearDownClientSession();
    setPhase({ kind: 'result', outcome: kind, summary: event.summary, viewModel });
  }

  function handleOnlineRunEnd(event: Extract<RuntimeEvent, { kind: 'win' | 'loss' }>): void {
    const session = requireActiveOnlineSession();
    const kind = event.kind;
    log.info(`online run ended: ${kind}`, {
      simTimeMs: event.simTime,
      sessionConfigId: activeOnlineSessionId
    });
    const viewModel = buildResultViewModel(session, event.summary, {
      dungeonBest: null,
      xpReward: null
    });
    const activePublicArenaClient = publicArenaClient;
    publicArenaConnectionId += 1;
    publicArenaClient = null;
    activePublicArenaClient?.disconnect();
    tearDownPublicArenaPresentation();
    setPhase({ kind: 'result', outcome: kind, summary: event.summary, viewModel });
  }

  function awardResultXp(summary: SessionResultSummary): ResultXpRewardState | null {
    if (lastStartedSource !== 'campaign') {
      return null;
    }

    const xpEarned = Math.max(
      0,
      Math.floor(summary.kills.total * PET_ECONOMY.xpPerDestroyedSlime)
    );
    const progression = clientProgressionStore.awardXp(xpEarned);
    return {
      xpEarned,
      totalXp: progression.totalXp
    };
  }

  function classifyPlayerStartSource(presetId: ModePresetId): SessionStartSource {
    return CAMPAIGN_PRESET_IDS.has(presetId) ? 'campaign' : 'nonCampaign';
  }

  function isRunningSessionActive(): boolean {
    return activeSession !== null && phase.kind === 'running';
  }

  function enterOverlayPause(): void {
    if (!isRunningSessionActive()) return;
    const session = activeSession;
    if (session === null) return;
    if (isMobileInputMode()) {
      input?.stop();
    } else if (documentTarget.pointerLockElement !== null) {
      documentTarget.exitPointerLock?.();
    }
    if (!sim.isPaused()) {
      sim.pause();
    }
    pause.setEscapePath(
      deriveLiveEscapeProgressPathViewModel(session, sim.snapshotPair().curr)
    );
    setPhase(PAUSED_PHASE);
  }

  function resumeOverlayPause(): void {
    if (activeSession === null) return;
    if (phase.kind !== 'paused') return;
    if (isMobileInputMode()) {
      input?.start();
    } else {
      input?.requestLock();
    }
    if (sim.isPaused()) {
      sim.resume();
    }
    setPhase(RUNNING_PHASE);
  }

  function onResize(): void {
    fitToWindow();
  }

  function unlockAudioFromGesture(): void {
    if (!unlockGestureArmed) {
      return;
    }
    if (phase.kind === 'loading' || phase.kind === 'error') {
      return;
    }
    unlockGestureArmed = false;
    windowTarget.removeEventListener('pointerdown', unlockAudioFromGesture as EventListener);
    windowTarget.removeEventListener('keydown', unlockAudioFromGesture as EventListener);
    audio.unlock();
  }

  function onPointerLockChange(): void {
    // Browsers consume the Escape keydown that releases Pointer Lock, so
    // lock loss is the reliable desktop trigger for pause or the online menu.
    if (documentTarget.pointerLockElement !== null) return;
    if (phase.kind === 'online' && publicArenaInput !== null) {
      openPublicArenaMenu();
      return;
    }
    if (activeSession === null) return;
    enterOverlayPause();
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (phase.kind === 'online') {
      if (event.code === SPACE_KEY_CODE || event.code === ESCAPE_KEY_CODE) {
        event.preventDefault();
        openPublicArenaMenu();
      }
      return;
    }

    if (event.code === SPACE_KEY_CODE) {
      if (!isRunningSessionActive()) return;
      event.preventDefault();
      enterOverlayPause();
      return;
    }

    if (event.code === ESCAPE_KEY_CODE) {
      enterOverlayPause();
      return;
    }

    if (event.code === DEV_PAUSE_KEY_CODE && !event.repeat) {
      if (!isRunningSessionActive()) return;
      event.preventDefault();
      if (sim.isPaused()) {
        sim.resume();
      } else {
        sim.pause();
      }
    }
  }

  function attach(): void {
    windowTarget.addEventListener('pointerdown', unlockAudioFromGesture as EventListener);
    windowTarget.addEventListener('keydown', unlockAudioFromGesture as EventListener);
    windowTarget.addEventListener('resize', onResize);
    windowTarget.addEventListener('orientationchange', onResize);
    windowTarget.addEventListener('keydown', onKeyDown as EventListener);
    documentTarget.addEventListener('pointerlockchange', onPointerLockChange);
  }

  function detach(): void {
    windowTarget.removeEventListener('pointerdown', unlockAudioFromGesture as EventListener);
    windowTarget.removeEventListener('keydown', unlockAudioFromGesture as EventListener);
    windowTarget.removeEventListener('resize', onResize);
    windowTarget.removeEventListener('orientationchange', onResize);
    windowTarget.removeEventListener('keydown', onKeyDown as EventListener);
    documentTarget.removeEventListener('pointerlockchange', onPointerLockChange);
  }

  function fitToWindow(): void {
    renderer?.fitToWindow();
    publicArenaRenderer?.fitToWindow();
    onlineRenderer?.fitToWindow();
  }

  function createSessionInputController(
    session: SessionDefinition,
    visibleAreaCamera: VisibleAreaCamera
  ): InputController {
    const primaryPlayer = requirePrimaryPlayer(session);
    const inputCommandSink = (command: InputCommand): void => {
      sim.sendInput(applyAimAssist(command, session.rules.aimAssist, sim.snapshotPair().curr));
    };
    const sharedInput = {
      pixelsPerWorldUnit: () =>
        pixelsPerWorldUnitFromVisibleArea(init.canvas, visibleAreaCamera),
      visibleArea: () => visibleAreaCamera.visibleArea(),
      initialAim: primaryPlayer.position,
      onCommand: inputCommandSink
    };
    if (isMobileInputMode()) {
      return mobileInputFactory({
        ...sharedInput,
        surface: init.parent,
        pauseElement: () => mobileControls.pauseButtonElement(),
        weaponSlotElements: () => queryWeaponSlotElements(init.parent),
        onPause: enterOverlayPause
      });
    }
    return inputFactory({
      ...sharedInput,
      canvas: init.canvas
    });
  }

  function isMobileInputMode(): boolean {
    return init.mobileProfile?.isMobile === true;
  }

  function createSessionVisibleAreaCamera(session: SessionDefinition): VisibleAreaCamera {
    return createVisibleAreaCamera({
      arena: session.arena,
      profile: visibleAreaProfile(),
      effectiveViewport: currentEffectiveViewport(),
      playerPosition: requirePrimaryPlayer(session).position
    });
  }

  function requirePrimaryPlayer(session: SessionDefinition): PlayerConfig {
    const player = session.players[0];
    if (player === undefined) {
      throw new Error(`session "${session.id}" has no primary player`);
    }
    return player;
  }

  function visibleAreaProfile(): VisibleAreaProfile {
    return isMobileInputMode() ? 'mobile' : 'desktop';
  }

  function currentEffectiveViewport(): Readonly<{ width: number; height: number }> {
    return gameViewport.current();
  }

  function pixelsPerWorldUnitFromVisibleArea(
    canvas: HTMLCanvasElement,
    visibleAreaCamera: VisibleAreaCamera
  ): number {
    return canvas.clientHeight / visibleAreaCamera.visibleArea().height;
  }

  function onStartupPreloadProgress(loaded: number, total: number): void {
    startupOverlay.setProgress(loaded, total);
  }

  function isTransitionActive(): boolean {
    return transitionActive || phaseTransitionCurtain.isActive();
  }

  function releasePreloadedTextures(): void {
    if (preloadedTextures === null) {
      return;
    }
    for (const texture of new Set(Object.values(preloadedTextures))) {
      texture.dispose();
    }
    preloadedTextures = null;
  }

  async function startStartupPreload(): Promise<void> {
    startupOverlay.setProgress(0, 0);
    try {
      const textures = await runStartupPreload(onStartupPreloadProgress);
      if (disposed) {
        disposeTextureMap(textures);
        return;
      }
      await startupOverlay.playRitual();
      if (disposed) {
        disposeTextureMap(textures);
        return;
      }
      let texturesOwnedByShell = false;
      await phaseTransitionCurtain.run(() => {
        if (disposed) {
          return;
        }
        preloadedTextures = textures;
        texturesOwnedByShell = true;
        setPhase(MENU_PHASE);
        if (autoStartPublicArena) {
          startOnlineSession('public-arena');
        } else if (autoStartPresetId !== null) {
          startPreset(resolveModePreset(autoStartPresetId), {
            startInput: true,
            source: 'autoStart'
          });
        }
      });
      if (disposed) {
        if (!texturesOwnedByShell) {
          disposeTextureMap(textures);
        }
        return;
      }
    } catch (error: unknown) {
      if (disposed) {
        return;
      }
      setPhase({
        kind: 'error',
        reason: 'preload',
        message: formatStartupError(error)
      });
    }
  }

  attach();
  applyPhaseVisibility();
  void startStartupPreload();

  return {
    onFrame(): void {
      const snapshotPair = sim.snapshotPair();
      const onlinePair = phase.kind === 'online' ? onlineSnapshotPair() : null;
      if (activeSession !== null) {
        portalController.update(snapshotPair.curr, phase);
      }
      if (publicArenaClient !== null || publicArenaRenderer !== null) {
        portalController.updatePublicArena(publicArenaPortalSnapshot(), phase);
      }
      if (isRunningSessionActive()) {
        hud.update(snapshotPair);
      }
      if (onlineCampaignHudAttached && activeOnlineSession !== null && phase.kind === 'online') {
        const activeOnlinePair = onlinePair ?? onlineSnapshotPair();
        hud.update(activeOnlinePair);
        escapeProgressPath.update(activeOnlinePair, phase);
        titleOverlay.update(activeOnlinePair, phase);
      }
      if (activeSession !== null) {
        escapeProgressPath.update(snapshotPair, phase);
        dungeonWaveCounter.update(snapshotPair, phase);
        titleOverlay.update(snapshotPair, phase);
        if (phase.kind === 'paused') {
          pause.setEscapePath(
            deriveLiveEscapeProgressPathViewModel(activeSession, snapshotPair.curr)
          );
        }
      }
      const audioSnapshotPair = onlinePair ?? snapshotPair;
      audio.update(audioSnapshotPair, phase, audioSnapshotPair.curr?.encounter ?? null);
      renderer?.render();
      input?.syncAim();
      if (phase.kind === 'online') {
        publicArenaRenderer?.render();
        onlineRenderer?.render();
        publicArenaInput?.syncAim();
      }
    },
    phase(): UiShellPhase {
      return phase;
    },
    dispose(): void {
      disposed = true;
      detach();
      const activePublicArenaClient = publicArenaClient;
      publicArenaConnectionId += 1;
      tearDownPublicArenaPresentation();
      publicArenaClient = null;
      activePublicArenaClient?.disconnect();
      tearDownClientSession();
      releasePreloadedTextures();
      startupOverlay.dispose();
      startupErrorOverlay.dispose();
      phaseTransitionCurtain.dispose();
      menu.dispose();
      pause.dispose();
      publicArenaHud.dispose();
      publicArenaCombatAffordances.dispose();
      publicArenaMenu.dispose();
      publicArenaStatus.dispose();
      result.dispose();
      settingsOverlay.dispose();
      mobileControls.dispose();
      titleOverlay.dispose();
      dungeonWaveCounter.dispose();
      escapeProgressPath.dispose();
      hud.dispose();
      unsubscribeAudioSettings();
      unsubscribeClientProgression?.();
      unsubscribeClientProgression = null;
      clientSettingsStore.dispose();
      clientProgressionStore.dispose();
      audio.dispose();
      sim.dispose();
    }
  };
}

async function defaultRunStartupPreload(
  onProgress: (loaded: number, total: number) => void
): Promise<TextureMap> {
  return preloadStartupAssets(onProgress);
}

function defaultReloadPage(): void {
  location.reload();
}

function defaultAssignLocation(url: string): void {
  location.assign(url);
}

function defaultPortalHref(): string {
  if (typeof location === 'undefined') {
    return '';
  }
  return location.href;
}

function queryWeaponSlotElements(parent: HTMLElement): HTMLElement[] {
  return [...parent.querySelectorAll<HTMLElement>('[data-weapon-slot]')];
}

function createWindowGameViewport(
  windowTarget: WindowTarget,
  profile: MobileWebProfile
): GameViewportProvider {
  const matchMedia = windowTarget.matchMedia;
  return {
    current(): Readonly<{ width: number; height: number }> {
      const effectiveViewport = resolveEffectiveGameViewport(profile, {
        width: safeViewportSide(windowTarget.innerWidth, 16),
        height: safeViewportSide(windowTarget.innerHeight, 9)
      });
      return { width: effectiveViewport.width, height: effectiveViewport.height };
    },
    devicePixelRatio(): number {
      return safeViewportSide(windowTarget.devicePixelRatio, 1);
    },
    ...(matchMedia === undefined
      ? {}
      : {
          matchMedia(query: string): MediaQueryList {
            return matchMedia.call(windowTarget, query);
          }
        })
  };
}

function createRendererWindowTarget(gameViewport: GameViewportProvider): RendererInit['windowTarget'] {
  const matchMedia = gameViewport.matchMedia;

  return {
    get innerWidth(): number {
      return gameViewport.current().width;
    },
    get innerHeight(): number {
      return gameViewport.current().height;
    },
    get devicePixelRatio(): number {
      return gameViewport.devicePixelRatio();
    },
    ...(matchMedia === undefined
      ? {}
      : {
          matchMedia(query: string): MediaQueryList {
            return matchMedia.call(gameViewport, query);
          }
        })
  };
}

function safeViewportSide(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? value : fallback;
}

function formatStartupError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown preload error';
}

function snapshotWithSelfPlayerFirst(
  snapshot: Snapshot | null,
  selfId: PublicArenaPlayerId | null
): Snapshot | null {
  if (snapshot === null || selfId === null) {
    return snapshot;
  }
  const selfIndex = snapshot.entities.findIndex(
    (entity) => entity.kind === 'player' && entity.playerId === selfId
  );
  if (selfIndex <= 0) {
    return snapshot;
  }
  const self = snapshot.entities[selfIndex];
  if (self === undefined) {
    return snapshot;
  }
  return {
    ...snapshot,
    entities: [
      self,
      ...snapshot.entities.slice(0, selfIndex),
      ...snapshot.entities.slice(selfIndex + 1)
    ]
  };
}

function currentUiTimeMs(): number {
  return globalThis.performance?.now() ?? Date.now();
}

function copyLoadout(loadout: Loadout | null): Loadout | null {
  return loadout === null ? null : { ...loadout, weapons: [...loadout.weapons] };
}

function publicArenaIntentFromInput(command: InputCommand): InputCommand | null {
  switch (command.kind) {
    case 'move':
    case 'aim':
    case 'fire':
    case 'selectWeaponSlot':
    case 'holsterWeapon':
      return command;
    default:
      assertNever(command);
  }
}

function createNullStartupOverlay(_init: StartupOverlayInit): StartupOverlay {
  return {
    show(): void {},
    hide(): void {},
    isVisible(): boolean {
      return false;
    },
    setProgress(): void {},
    playRitual(): Promise<void> {
      return Promise.resolve();
    },
    dispose(): void {}
  };
}

function createNullStartupErrorOverlay(
  _init: StartupErrorOverlayInit
): StartupErrorOverlay {
  return {
    show(): void {},
    hide(): void {},
    isVisible(): boolean {
      return false;
    },
    dispose(): void {}
  };
}

function createNullMobileControlsOverlay(
  _init: MobileControlsOverlayInit
): MobileControlsOverlay {
  const pauseButton = {} as HTMLElement;
  return {
    show(): void {},
    hide(): void {},
    isVisible(): boolean {
      return false;
    },
    pauseButtonElement(): HTMLElement {
      return pauseButton;
    },
    dispose(): void {}
  };
}

function createNullPublicArenaHud(_init: PublicArenaHudInit): PublicArenaHud {
  return {
    show(): void {},
    update(): void {},
    hide(): void {},
    isVisible(): boolean {
      return false;
    },
    dispose(): void {}
  };
}

function createNullPublicArenaCombatAffordances(
  _init: PublicArenaCombatAffordancesInit
): PublicArenaCombatAffordances {
  return {
    show(): void {},
    update(): void {},
    hide(): void {},
    isVisible(): boolean {
      return false;
    },
    dispose(): void {}
  };
}

function createNullPublicArenaStatusOverlay(
  _init: PublicArenaStatusOverlayInit
): PublicArenaStatusOverlay {
  return {
    show(): void {},
    showLobby(): void {},
    hide(): void {},
    isVisible(): boolean {
      return false;
    },
    dispose(): void {}
  };
}

function createNullPublicArenaMenuOverlay(
  _init: PublicArenaMenuOverlayInit
): PublicArenaMenuOverlay {
  return {
    show(): void {},
    hide(): void {},
    isVisible(): boolean {
      return false;
    },
    dispose(): void {}
  };
}

function disposeTextureMap(textures: TextureMap): void {
  for (const texture of new Set(Object.values(textures))) {
    texture.dispose();
  }
}

function defaultMakeSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}
