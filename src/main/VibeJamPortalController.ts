import { PUBLIC_ARENA_ARENA, PUBLIC_ARENA_PLAYER } from '../shared/content/publicArena';
import type { ContactBox, SessionDefinition } from '../shared/session';
import type { EncounterSnapshot, PlayerSnapshot, Snapshot } from '../shared/snapshot';
import type { UiShellPhase } from './ui/UiShellPhase';
import {
  buildVibeJamExitUrl,
  buildVibeJamReturnUrl,
  clearStoredVibeJamPortalContext,
  resolveInitialVibeJamPortalContext,
  type VibeJamPortalContext,
  type VibeJamPortalStorage
} from './VibeJamPortalContext';

export type VibeJamPortalDescriptor = Readonly<{
  kind: 'return' | 'exit';
  x: number;
  y: number;
  width: number;
  height: number;
  travelStartedAtSimMs?: number;
  travelDurationMs?: number;
}>;

export const VIBE_JAM_PORTAL_TRAVEL_DURATION_MS = 560;
const PORTAL_OFFSET_PLAYER_WIDTHS = 8;

export type VibeJamPortalControllerInit = Readonly<{
  href: string;
  storage: VibeJamPortalStorage | null;
  redirect(url: string): void;
}>;

export type VibeJamPortalPublicArenaSnapshot = Readonly<{
  simTimeMs: number;
  player: Readonly<{ x: number; y: number }> | null;
}>;

export type VibeJamPortalController = Readonly<{
  attachSession(session: SessionDefinition): void;
  update(snapshot: Snapshot | null, phase: UiShellPhase): ReadonlyArray<VibeJamPortalDescriptor>;
  attachPublicArena(): void;
  updatePublicArena(
    snapshot: VibeJamPortalPublicArenaSnapshot | null,
    phase: UiShellPhase
  ): ReadonlyArray<VibeJamPortalDescriptor>;
  detachSession(): void;
  portals(): ReadonlyArray<VibeJamPortalDescriptor>;
  hasActiveReturnContext(): boolean;
}>;

type PendingPortalRedirect = Readonly<{
  portalKind: VibeJamPortalDescriptor['kind'];
  targetUrl: string;
  startedAtSimMs: number;
  durationMs: number;
}>;

type PortalPlacementSource = Readonly<{
  arena: Readonly<{ width: number; height: number }>;
  playerContactBox: ContactBox;
}>;

export function createVibeJamPortalController(
  init: VibeJamPortalControllerInit
): VibeJamPortalController {
  let context: VibeJamPortalContext | null = resolveInitialVibeJamPortalContext(
    init.href,
    init.storage
  );
  let exitForwardContext: VibeJamPortalContext | null = context;
  let session: SessionDefinition | null = null;
  let publicArenaAttached = false;
  let returnPortal: VibeJamPortalDescriptor | null = null;
  let exitPortal: VibeJamPortalDescriptor | null = null;
  let visiblePortals: ReadonlyArray<VibeJamPortalDescriptor> = [];
  let pendingRedirect: PendingPortalRedirect | null = null;
  let redirectTriggered = false;
  const portalEntrypoint = isPortalEntrypointHref(init.href);

  function attachSession(nextSession: SessionDefinition): void {
    session = nextSession;
    publicArenaAttached = false;
    const placement = placementSourceFromSession(nextSession);
    returnPortal = context !== null && hasPortalEncounter(nextSession)
      ? createReturnPortalDescriptor(placement)
      : null;
    exitPortal = shouldOpenExitPortalOnAttach(nextSession)
      ? createExitPortalDescriptor(placement, null)
      : null;
    visiblePortals = [];
  }

  function attachPublicArena(): void {
    session = null;
    publicArenaAttached = true;
    const placement = publicArenaPlacementSource();
    returnPortal = context !== null && portalEntrypoint
      ? createReturnPortalDescriptor(placement)
      : null;
    exitPortal = portalEntrypoint ? createExitPortalDescriptor(placement, null) : null;
    visiblePortals = [];
  }

  function update(
    snapshot: Snapshot | null,
    phase: UiShellPhase
  ): ReadonlyArray<VibeJamPortalDescriptor> {
    if (session === null) {
      visiblePortals = [];
      return visiblePortals;
    }

    if (phase.kind !== 'running' && phase.kind !== 'paused') {
      visiblePortals = [];
      return visiblePortals;
    }

    if (snapshot === null || snapshot.encounter === null) {
      visiblePortals = [];
      return visiblePortals;
    }

    const encounter = snapshot.encounter;
    const type = resolveEncounterType(session, encounter);
    const placement = placementSourceFromSession(session);
    if (type === 'portal' && exitPortal === null) {
      exitPortal = createExitPortalDescriptor(placement, findPlayerSnapshot(snapshot));
    }
    if (type === 'portal') {
      updatePendingRedirect(snapshot.simTimeMs);
      visiblePortals = collectVisiblePortals();
      beginRedirectOnPlayerOverlap(
        findPlayerSnapshot(snapshot),
        placement.playerContactBox,
        snapshot.simTimeMs
      );
      visiblePortals = collectVisiblePortals();
      return visiblePortals;
    }

    if (type === 'boss' && hasPortalEncounter(session)) {
      consumeReturnContext();
    }

    updatePendingRedirect(snapshot.simTimeMs);
    visiblePortals = collectVisiblePortals();
    beginRedirectOnPlayerOverlap(
      findPlayerSnapshot(snapshot),
      placement.playerContactBox,
      snapshot.simTimeMs
    );
    visiblePortals = collectVisiblePortals();
    return visiblePortals;
  }

  function updatePublicArena(
    snapshot: VibeJamPortalPublicArenaSnapshot | null,
    phase: UiShellPhase
  ): ReadonlyArray<VibeJamPortalDescriptor> {
    if (!publicArenaAttached) {
      visiblePortals = [];
      return visiblePortals;
    }

    if (phase.kind !== 'online') {
      visiblePortals = [];
      return visiblePortals;
    }

    if (snapshot !== null) {
      updatePendingRedirect(snapshot.simTimeMs);
    }
    visiblePortals = collectVisiblePortals();
    if (snapshot !== null) {
      beginRedirectOnPlayerOverlap(
        snapshot.player,
        publicArenaPlacementSource().playerContactBox,
        snapshot.simTimeMs
      );
    }
    visiblePortals = collectVisiblePortals();
    return visiblePortals;
  }

  function detachSession(): void {
    session = null;
    publicArenaAttached = false;
    returnPortal = null;
    exitPortal = null;
    visiblePortals = [];
    pendingRedirect = null;
  }

  function consumeReturnContext(): void {
    context = null;
    returnPortal = null;
    clearStoredVibeJamPortalContext(init.storage);
  }

  function collectVisiblePortals(): ReadonlyArray<VibeJamPortalDescriptor> {
    const next: VibeJamPortalDescriptor[] = [];
    if (context !== null && returnPortal !== null) {
      next.push(applyTravelState(returnPortal));
    }
    if (exitPortal !== null) {
      next.push(applyTravelState(exitPortal));
    }
    return next;
  }

  function applyTravelState(portal: VibeJamPortalDescriptor): VibeJamPortalDescriptor {
    if (pendingRedirect === null || pendingRedirect.portalKind !== portal.kind) {
      return portal;
    }
    return {
      ...portal,
      travelStartedAtSimMs: pendingRedirect.startedAtSimMs,
      travelDurationMs: pendingRedirect.durationMs
    };
  }

  function beginRedirectOnPlayerOverlap(
    player: Readonly<{ x: number; y: number }> | null,
    playerContactBox: ContactBox,
    simTimeMs: number
  ): void {
    if (pendingRedirect !== null || redirectTriggered) return;
    if (player === null) return;

    for (const portal of visiblePortals) {
      if (!overlapsPortal(player, playerContactBox, portal)) continue;
      const targetUrl = resolvePortalTargetUrl(portal);
      if (targetUrl === null) return;
      pendingRedirect = {
        portalKind: portal.kind,
        targetUrl,
        startedAtSimMs: simTimeMs,
        durationMs: VIBE_JAM_PORTAL_TRAVEL_DURATION_MS
      };
      redirectTriggered = true;
      init.redirect(targetUrl);
      return;
    }
  }

  function resolvePortalTargetUrl(portal: VibeJamPortalDescriptor): string | null {
    if (portal.kind === 'return') {
      return context === null ? null : buildVibeJamReturnUrl(context);
    }
    return buildVibeJamExitUrl(exitForwardContext);
  }

  function updatePendingRedirect(simTimeMs: number): void {
    if (pendingRedirect === null || redirectTriggered) return;
    if (simTimeMs - pendingRedirect.startedAtSimMs < pendingRedirect.durationMs) return;
    redirectTriggered = true;
    init.redirect(pendingRedirect.targetUrl);
  }

  return {
    attachSession,
    update,
    attachPublicArena,
    updatePublicArena,
    detachSession,
    portals(): ReadonlyArray<VibeJamPortalDescriptor> {
      return visiblePortals;
    },
    hasActiveReturnContext(): boolean {
      return context !== null;
    }
  };
}

function createReturnPortalDescriptor(source: PortalPlacementSource): VibeJamPortalDescriptor {
  const width = source.playerContactBox.width;
  const height = source.playerContactBox.height;
  const preferredX = -PORTAL_OFFSET_PLAYER_WIDTHS * width;
  const preferredY = 0;
  return {
    kind: 'return',
    x: clampPortalCenter(preferredX, width, source.arena.width),
    y: clampPortalCenter(preferredY, height, source.arena.height),
    width,
    height
  };
}

function createExitPortalDescriptor(
  source: PortalPlacementSource,
  player: Readonly<{ x: number; y: number }> | null
): VibeJamPortalDescriptor {
  const width = source.playerContactBox.width;
  const height = source.playerContactBox.height;
  const y = clampPortalCenter(0, height, source.arena.height);
  const maxX = source.arena.width / 2 - width / 2;
  const step = Math.max(width, source.playerContactBox.width);
  let x = clampPortalCenter(
    PORTAL_OFFSET_PLAYER_WIDTHS * width,
    width,
    source.arena.width
  );

  if (player === null) {
    return { kind: 'exit', x, y, width, height };
  }

  let guard = 0;
  const candidate = (): VibeJamPortalDescriptor => ({ kind: 'exit', x, y, width, height });
  while (
    overlapsPortal(player, source.playerContactBox, candidate()) &&
    x < maxX &&
    guard < 64
  ) {
    x = Math.min(maxX, x + step);
    guard += 1;
  }
  return candidate();
}

function placementSourceFromSession(session: SessionDefinition): PortalPlacementSource {
  return {
    arena: session.arena,
    playerContactBox: session.players[0].contactBox
  };
}

function publicArenaPlacementSource(): PortalPlacementSource {
  return {
    arena: PUBLIC_ARENA_ARENA,
    playerContactBox: PUBLIC_ARENA_PLAYER.contactBox
  };
}

function clampPortalCenter(value: number, portalSize: number, arenaSize: number): number {
  const halfArena = arenaSize / 2;
  const halfPortal = portalSize / 2;
  const min = -halfArena + halfPortal;
  const max = halfArena - halfPortal;
  if (min > max) return 0;
  return Math.min(max, Math.max(min, value));
}

function shouldOpenExitPortalOnAttach(session: SessionDefinition): boolean {
  return session.encounters[0]?.type === 'portal';
}

function isPortalEntrypointHref(href: string): boolean {
  try {
    const url = new URL(href);
    return url.pathname.replace(/\/+$/u, '') === '/portal';
  } catch {
    return false;
  }
}

function hasPortalEncounter(session: SessionDefinition): boolean {
  return session.encounters.some((encounter) => encounter.type === 'portal');
}

function resolveEncounterType(
  session: SessionDefinition,
  encounter: EncounterSnapshot
): SessionDefinition['encounters'][number]['type'] {
  const byIndex = session.encounters[encounter.index];
  if (byIndex?.id === encounter.id) {
    return byIndex.type;
  }
  const byId = session.encounters.find((definition) => definition.id === encounter.id);
  return byId?.type ?? encounter.type;
}

function findPlayerSnapshot(snapshot: Snapshot | null): PlayerSnapshot | null {
  if (snapshot === null) return null;
  return (
    snapshot.entities.find((entity): entity is PlayerSnapshot => entity.kind === 'player') ?? null
  );
}

function overlapsPortal(
  player: Readonly<{ x: number; y: number }>,
  playerContactBox: ContactBox,
  portal: VibeJamPortalDescriptor
): boolean {
  return (
    Math.abs(player.x - portal.x) < (playerContactBox.width + portal.width) / 2 &&
    Math.abs(player.y - portal.y) < (playerContactBox.height + portal.height) / 2
  );
}
