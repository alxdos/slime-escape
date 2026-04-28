import { describe, expect, it, vi } from 'vitest';

import type { EncounterDefinition, EncounterType, SessionDefinition } from '../shared/session';
import type { Snapshot } from '../shared/snapshot';
import {
  SLIME_ESCAPE_PORTAL_URL,
  VIBE_JAM_EXIT_URL,
  VIBE_JAM_PORTAL_CONTEXT_STORAGE_KEY,
  type VibeJamPortalStorage
} from './VibeJamPortalContext';
import { createVibeJamPortalController } from './VibeJamPortalController';

const RUNNING_PHASE = { kind: 'running' } as const;
const PAUSED_PHASE = { kind: 'paused' } as const;
const MENU_PHASE = { kind: 'menu' } as const;

describe('VibeJamPortalController', () => {
  it('shows a return portal two player widths left of spawn during non-boss encounters', () => {
    const storage = new FakeStorage();
    const controller = createVibeJamPortalController({
      href: inboundHref('https://previous.example/return'),
      storage,
      redirect: () => {}
    });
    const session = makeSession([encounter('wave-1', 'wave')]);

    controller.attachSession(session);
    const portals = controller.update(snapshot('wave-1', 'wave', 0), RUNNING_PHASE);

    expect(portals).toEqual([
      {
        kind: 'return',
        x: -2,
        y: 0,
        width: 1,
        height: 1
      }
    ]);
    expect(controller.hasActiveReturnContext()).toBe(true);
  });

  it('keeps the return context across pre-boss session detach and later sessions', () => {
    const storage = new FakeStorage();
    const controller = createVibeJamPortalController({
      href: inboundHref('https://previous.example/return'),
      storage,
      redirect: () => {}
    });

    controller.attachSession(makeSession([encounter('wave-1', 'wave')]));
    expect(controller.update(snapshot('wave-1', 'wave', 0), RUNNING_PHASE)).toHaveLength(1);
    controller.detachSession();

    controller.attachSession(makeSession([encounter('training-wave', 'wave')]));
    expect(controller.update(snapshot('training-wave', 'wave', 0), RUNNING_PHASE)).toHaveLength(1);
    expect(storage.entries.has(VIBE_JAM_PORTAL_CONTEXT_STORAGE_KEY)).toBe(true);
  });

  it('collapses and consumes the return context when a boss encounter is active', () => {
    const storage = new FakeStorage();
    const controller = createVibeJamPortalController({
      href: inboundHref('https://previous.example/return'),
      storage,
      redirect: () => {}
    });
    const session = makeSession([encounter('wave-1', 'wave'), encounter('boss-1', 'boss')]);

    controller.attachSession(session);
    expect(controller.update(snapshot('wave-1', 'wave', 0), RUNNING_PHASE)).toHaveLength(1);
    expect(controller.update(snapshot('boss-1', 'boss', 1), RUNNING_PHASE)).toEqual([]);
    expect(controller.hasActiveReturnContext()).toBe(false);
    expect(storage.entries.has(VIBE_JAM_PORTAL_CONTEXT_STORAGE_KEY)).toBe(false);

    controller.detachSession();
    controller.attachSession(makeSession([encounter('later-wave', 'wave')]));
    expect(controller.update(snapshot('later-wave', 'wave', 0), RUNNING_PHASE)).toEqual([]);
  });

  it('does not show return portals during menus or missing snapshots', () => {
    const controller = createVibeJamPortalController({
      href: inboundHref('https://previous.example/return'),
      storage: new FakeStorage(),
      redirect: () => {}
    });
    const session = makeSession([encounter('wave-1', 'wave'), encounter('portal-exit', 'portal')]);

    controller.attachSession(session);

    expect(controller.update(snapshot('wave-1', 'wave', 0), MENU_PHASE)).toEqual([]);
    expect(controller.update(null, RUNNING_PHASE)).toEqual([]);
  });

  it('stays visible while paused before boss lock-in', () => {
    const controller = createVibeJamPortalController({
      href: inboundHref('https://previous.example/return'),
      storage: new FakeStorage(),
      redirect: () => {}
    });

    controller.attachSession(makeSession([encounter('break-1', 'break')]));

    expect(controller.update(snapshot('break-1', 'break', 0), PAUSED_PHASE)).toHaveLength(1);
  });

  it('does not create a return portal without a usable inbound ref', () => {
    const controller = createVibeJamPortalController({
      href: 'https://slimeescape.com/portal?portal=true&ref=not-a-url',
      storage: new FakeStorage(),
      redirect: () => {}
    });

    controller.attachSession(makeSession([encounter('wave-1', 'wave')]));

    expect(controller.update(snapshot('wave-1', 'wave', 0), RUNNING_PHASE)).toEqual([]);
    expect(controller.hasActiveReturnContext()).toBe(false);
  });

  it('clamps the return portal inside the arena', () => {
    const controller = createVibeJamPortalController({
      href: inboundHref('https://previous.example/return'),
      storage: new FakeStorage(),
      redirect: () => {}
    });
    const session = makeSession([encounter('wave-1', 'wave')], {
      playerX: -1.5,
      arenaWidth: 4
    });

    controller.attachSession(session);

    expect(controller.update(snapshot('wave-1', 'wave', 0), RUNNING_PHASE)[0]?.x).toBe(-1.5);
  });

  it('redirects through the return portal exactly once when the player overlaps it', () => {
    const redirect = vi.fn();
    const controller = createVibeJamPortalController({
      href: 'https://slimeescape.com/portal?portal=true&ref=https%3A%2F%2Fprevious.example%2Freturn%3Fexisting%3D1&username=Alex',
      storage: new FakeStorage(),
      redirect
    });
    const session = makeSession([encounter('wave-1', 'wave')]);

    controller.attachSession(session);
    controller.update(snapshot('wave-1', 'wave', 0, { playerX: -2, playerY: 0 }), RUNNING_PHASE);
    controller.update(snapshot('wave-1', 'wave', 0, { playerX: -2, playerY: 0 }), RUNNING_PHASE);

    expect(redirect).toHaveBeenCalledTimes(1);
    const url = new URL(redirect.mock.calls[0]?.[0] ?? '');
    expect(url.origin + url.pathname).toBe('https://previous.example/return');
    expect(url.searchParams.get('existing')).toBe('1');
    expect(url.searchParams.get('portal')).toBe('true');
    expect(url.searchParams.get('ref')).toBe(SLIME_ESCAPE_PORTAL_URL);
    expect(url.searchParams.get('username')).toBe('Alex');
    expect(controller.portals()).toEqual([]);
  });

  it('shows the exit portal only during portal encounters and shifts it right off the player', () => {
    const controller = createVibeJamPortalController({
      href: inboundHref('https://previous.example/return'),
      storage: new FakeStorage(),
      redirect: () => {}
    });
    const session = makeSession([
      encounter('wave-1', 'wave'),
      encounter('portal-exit', 'portal')
    ]);

    controller.attachSession(session);
    const wavePortals = controller.update(snapshot('wave-1', 'wave', 0), RUNNING_PHASE);
    const exitPortals = controller.update(
      snapshot('portal-exit', 'portal', 1, { playerX: 0, playerY: 0 }),
      RUNNING_PHASE
    );

    expect(wavePortals.map((portal) => portal.kind)).toEqual(['return']);
    expect(exitPortals).toEqual([
      {
        kind: 'exit',
        x: 1,
        y: 0,
        width: 1,
        height: 1
      }
    ]);
  });

  it('opens the final exit portal without an inbound return context', () => {
    const controller = createVibeJamPortalController({
      href: 'https://slimeescape.com/portal',
      storage: new FakeStorage(),
      redirect: () => {}
    });
    const session = makeSession([encounter('portal-exit', 'portal')]);

    controller.attachSession(session);

    expect(controller.update(snapshot('portal-exit', 'portal', 0, { playerX: 2 }), RUNNING_PHASE)).toEqual([
      {
        kind: 'exit',
        x: 0,
        y: 0,
        width: 1,
        height: 1
      }
    ]);
  });

  it('redirects through the exit portal with Slime Escape as ref and forwarded optional params', () => {
    const redirect = vi.fn();
    const controller = createVibeJamPortalController({
      href: 'https://slimeescape.com/portal?portal=true&ref=https%3A%2F%2Fprevious.example%2Freturn&username=Alex&color=lime',
      storage: new FakeStorage(),
      redirect
    });
    const session = makeSession([encounter('portal-exit', 'portal')]);

    controller.attachSession(session);
    controller.update(snapshot('portal-exit', 'portal', 0, { playerX: 0, playerY: 0 }), RUNNING_PHASE);
    controller.update(snapshot('portal-exit', 'portal', 0, { playerX: 1, playerY: 0 }), RUNNING_PHASE);

    expect(redirect).toHaveBeenCalledTimes(1);
    const url = new URL(redirect.mock.calls[0]?.[0] ?? '');
    expect(url.origin + url.pathname).toBe(VIBE_JAM_EXIT_URL);
    expect(url.searchParams.get('ref')).toBe(SLIME_ESCAPE_PORTAL_URL);
    expect(url.searchParams.get('username')).toBe('Alex');
    expect(url.searchParams.get('color')).toBe('lime');
  });
});

function inboundHref(ref: string): string {
  return `https://slimeescape.com/portal?portal=true&ref=${encodeURIComponent(ref)}`;
}

function snapshot(
  id: string,
  type: EncounterType,
  index: number,
  options: Readonly<{ playerX?: number; playerY?: number }> = {}
): Snapshot {
  return {
    simTimeMs: 0,
    entities: [
      {
        id: 1,
        kind: 'player',
        x: options.playerX ?? 100,
        y: options.playerY ?? 100,
        hp: 5,
        maxHp: 5
      }
    ],
    encounter: { id, type, index, elapsedMs: 0, waveOrdinal: type === 'wave' ? index + 1 : null },
    zone: { mode: 'disabled', margin: 0 },
    waveProgress: null,
    bossHud: null,
    weaponHud: null
  };
}

function encounter(id: string, type: EncounterType): EncounterDefinition {
  return {
    id,
    type,
    backgroundId: null,
    introDurationMs: 0,
    name: null,
    text: null,
    spawnPlan: { kind: 'empty' },
    zoneBehavior: { kind: 'disabled' },
    objectives: [],
    rewardRules: null,
    transitionRules: { kind: 'never', next: 'sequential' },
    tuning: null
  };
}

function makeSession(
  encounters: ReadonlyArray<EncounterDefinition>,
  options: Readonly<{ playerX?: number; arenaWidth?: number }> = {}
): SessionDefinition {
  return {
    id: 'test-session',
    seed: 1,
    arena: { width: options.arenaWidth ?? 16, height: 9 },
    player: {
      position: { x: options.playerX ?? 0, y: 0 },
      radius: 0.5,
      contactBox: { width: 1, height: 1 },
      maxSpeed: 5,
      maxHp: 5
    },
    loadout: null,
    backgrounds: [],
    musicSampleId: null,
    modifiers: [],
    rules: {
      damage: { slimeFriendlyFire: false },
      aimAssist: { enabled: false, maxAngleRadians: 0, maxDistance: 0, strength: 0 }
    },
    encounters,
    winCondition: { kind: 'none' },
    lossCondition: { kind: 'none' },
    uiMeta: null
  };
}

class FakeStorage implements VibeJamPortalStorage {
  readonly entries = new Map<string, string>();

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }
}
