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

export type VibeJamPortalController = Readonly<{
  attachSession(session: SessionDefinition): void;
  update(snapshot: Snapshot | null, phase: UiShellPhase): ReadonlyArray<VibeJamPortalDescriptor>;
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

export function createVibeJamPortalController(
  init: VibeJamPortalControllerInit
): VibeJamPortalController {
  let context: VibeJamPortalContext | null = resolveInitialVibeJamPortalContext(
    init.href,
    init.storage
  );
  let exitForwardContext: VibeJamPortalContext | null = context;
  let session: SessionDefinition | null = null;
  let returnPortal: VibeJamPortalDescriptor | null = null;
  let exitPortal: VibeJamPortalDescriptor | null = null;
  let visiblePortals: ReadonlyArray<VibeJamPortalDescriptor> = [];
  let pendingRedirect: PendingPortalRedirect | null = null;
  let redirectTriggered = false;

  function attachSession(nextSession: SessionDefinition): void {
    session = nextSession;
    returnPortal = context !== null && hasPortalEncounter(nextSession)
      ? createReturnPortalDescriptor(nextSession)
      : null;
    exitPortal = shouldOpenExitPortalOnAttach(nextSession)
      ? createExitPortalDescriptor(nextSession, null)
      : null;
    visiblePortals = [];
  }

  function update(snapshot: Snapshot | null, phase: UiShellPhase): ReadonlyArray<VibeJamPortalDescriptor> {
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
    if (type === 'portal' && exitPortal === null) {
      exitPortal = createExitPortalDescriptor(session, snapshot);
    }
    if (type === 'portal') {
      updatePendingRedirect(snapshot.simTimeMs);
      visiblePortals = collectVisiblePortals();
      beginRedirectOnPlayerOverlap(session, snapshot);
      visiblePortals = collectVisiblePortals();
      return visiblePortals;
    }

    if (type === 'boss' && hasPortalEncounter(session)) {
      consumeReturnContext();
    }

    updatePendingRedirect(snapshot.simTimeMs);
    visiblePortals = collectVisiblePortals();
    beginRedirectOnPlayerOverlap(session, snapshot);
    visiblePortals = collectVisiblePortals();
    return visiblePortals;
  }

  function detachSession(): void {
    session = null;
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
    activeSession: SessionDefinition,
    snapshot: Snapshot
  ): void {
    if (pendingRedirect !== null || redirectTriggered) return;
    const player = findPlayerSnapshot(snapshot);
    if (player === null) return;

    for (const portal of visiblePortals) {
      if (!overlapsPortal(player, activeSession.player.contactBox, portal)) continue;
      const targetUrl = resolvePortalTargetUrl(portal);
      if (targetUrl === null) return;
      pendingRedirect = {
        portalKind: portal.kind,
        targetUrl,
        startedAtSimMs: snapshot.simTimeMs,
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
    detachSession,
    portals(): ReadonlyArray<VibeJamPortalDescriptor> {
      return visiblePortals;
    },
    hasActiveReturnContext(): boolean {
      return context !== null;
    }
  };
}

function createReturnPortalDescriptor(session: SessionDefinition): VibeJamPortalDescriptor {
  const width = session.player.contactBox.width;
  const height = session.player.contactBox.height;
  const preferredX = session.player.position.x - PORTAL_OFFSET_PLAYER_WIDTHS * width;
  const preferredY = session.player.position.y;
  return {
    kind: 'return',
    x: clampPortalCenter(preferredX, width, session.arena.width),
    y: clampPortalCenter(preferredY, height, session.arena.height),
    width,
    height
  };
}

function createExitPortalDescriptor(
  session: SessionDefinition,
  snapshot: Snapshot | null
): VibeJamPortalDescriptor {
  const width = session.player.contactBox.width;
  const height = session.player.contactBox.height;
  const y = clampPortalCenter(session.player.position.y, height, session.arena.height);
  const maxX = session.arena.width / 2 - width / 2;
  const step = Math.max(width, session.player.contactBox.width);
  const player = findPlayerSnapshot(snapshot);
  let x = clampPortalCenter(
    session.player.position.x + PORTAL_OFFSET_PLAYER_WIDTHS * width,
    width,
    session.arena.width
  );

  if (player === null) {
    return { kind: 'exit', x, y, width, height };
  }

  let guard = 0;
  const candidate = (): VibeJamPortalDescriptor => ({ kind: 'exit', x, y, width, height });
  while (
    overlapsPortal(player, session.player.contactBox, candidate()) &&
    x < maxX &&
    guard < 64
  ) {
    x = Math.min(maxX, x + step);
    guard += 1;
  }
  return candidate();
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
  return snapshot.entities.find((entity): entity is PlayerSnapshot => entity.kind === 'player') ?? null;
}

function overlapsPortal(
  player: PlayerSnapshot,
  playerContactBox: ContactBox,
  portal: VibeJamPortalDescriptor
): boolean {
  return (
    Math.abs(player.x - portal.x) < (playerContactBox.width + portal.width) / 2 &&
    Math.abs(player.y - portal.y) < (playerContactBox.height + portal.height) / 2
  );
}
