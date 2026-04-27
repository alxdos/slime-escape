import type { SessionDefinition } from '../shared/session';
import type { EncounterSnapshot, Snapshot } from '../shared/snapshot';
import type { UiShellPhase } from './ui/UiShellPhase';
import {
  clearStoredVibeJamPortalContext,
  resolveInitialVibeJamPortalContext,
  type VibeJamPortalContext,
  type VibeJamPortalStorage
} from './VibeJamPortalContext';

export type VibeJamPortalDescriptor = Readonly<{
  kind: 'return';
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type VibeJamPortalControllerInit = Readonly<{
  href: string;
  storage: VibeJamPortalStorage | null;
}>;

export type VibeJamPortalController = Readonly<{
  attachSession(session: SessionDefinition): void;
  update(snapshot: Snapshot | null, phase: UiShellPhase): ReadonlyArray<VibeJamPortalDescriptor>;
  detachSession(): void;
  portals(): ReadonlyArray<VibeJamPortalDescriptor>;
  hasActiveReturnContext(): boolean;
}>;

export function createVibeJamPortalController(
  init: VibeJamPortalControllerInit
): VibeJamPortalController {
  let context: VibeJamPortalContext | null = resolveInitialVibeJamPortalContext(
    init.href,
    init.storage
  );
  let session: SessionDefinition | null = null;
  let returnPortal: VibeJamPortalDescriptor | null = null;
  let visiblePortals: ReadonlyArray<VibeJamPortalDescriptor> = [];

  function attachSession(nextSession: SessionDefinition): void {
    session = nextSession;
    returnPortal = context === null ? null : createReturnPortalDescriptor(nextSession);
    visiblePortals = [];
  }

  function update(snapshot: Snapshot | null, phase: UiShellPhase): ReadonlyArray<VibeJamPortalDescriptor> {
    if (session === null || context === null || returnPortal === null) {
      visiblePortals = [];
      return visiblePortals;
    }

    if (phase.kind !== 'running' && phase.kind !== 'paused') {
      visiblePortals = [];
      return visiblePortals;
    }

    const encounter = snapshot?.encounter ?? null;
    if (encounter === null) {
      visiblePortals = [];
      return visiblePortals;
    }

    const type = resolveEncounterType(session, encounter);
    if (type === 'boss') {
      consumeReturnContext();
      return visiblePortals;
    }
    if (type === 'portal') {
      visiblePortals = [];
      return visiblePortals;
    }

    visiblePortals = [returnPortal];
    return visiblePortals;
  }

  function detachSession(): void {
    session = null;
    returnPortal = null;
    visiblePortals = [];
  }

  function consumeReturnContext(): void {
    context = null;
    returnPortal = null;
    visiblePortals = [];
    clearStoredVibeJamPortalContext(init.storage);
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
  const preferredX = session.player.position.x - 2 * width;
  const preferredY = session.player.position.y;
  return {
    kind: 'return',
    x: clampPortalCenter(preferredX, width, session.arena.width),
    y: clampPortalCenter(preferredY, height, session.arena.height),
    width,
    height
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
