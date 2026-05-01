import { describe, expect, it } from 'vitest';

import { buildSessionDefinition } from '../content/buildSession';
import { SANDBOX_PRESET } from '../content/sessions';
import { PISTOL } from '../content/weapons';
import type { RuntimeEvent } from '../events';
import type { PlayerConfig, SessionDefinition } from '../session';
import type { Snapshot } from '../snapshot';
import { SIM_STEP_MS } from '../timing';

import { createSimulationCore } from './SimulationCore';

describe('SimulationCore', () => {
  it('accepts public input for two controlled actors and emits per-actor fire events', () => {
    const snapshots: Snapshot[] = [];
    const events: RuntimeEvent[] = [];
    const core = createSimulationCore({
      onSnapshot: (snapshot) => snapshots.push(snapshot),
      onEvent: (event) => events.push(event)
    });
    const session = makeMultiActorSession();

    core.start(session);
    core.submitInput('alpha', { kind: 'move', dx: 1, dy: 0 });
    core.submitInput('alpha', { kind: 'aim', x: 5, y: 0 });
    core.submitInput('alpha', { kind: 'fire', phase: 'start' });
    core.submitInput('bravo', { kind: 'move', dx: -1, dy: 0 });
    core.submitInput('bravo', { kind: 'aim', x: -5, y: 0 });
    core.submitInput('bravo', { kind: 'fire', phase: 'start' });
    core.pump(0);
    core.pump(SIM_STEP_MS);

    const fireEvents = events.filter(
      (event): event is Extract<RuntimeEvent, { kind: 'fire' }> => event.kind === 'fire'
    );
    expect(fireEvents).toHaveLength(2);
    expect(fireEvents.map((event) => event.weaponArchetypeId)).toEqual([PISTOL.id, PISTOL.id]);
    expect(fireEvents.map((event) => Math.sign(event.dirX))).toEqual([1, -1]);
    const playerSnapshot = snapshots[0]?.entities.find((entity) => entity.kind === 'player');
    expect(playerSnapshot?.x).toBeGreaterThan(session.players[0].position.x);
  });

  it('keeps ghost players movable while filtering combat inputs', () => {
    const snapshots: Snapshot[] = [];
    const events: RuntimeEvent[] = [];
    const core = createSimulationCore({
      onSnapshot: (snapshot) => snapshots.push(snapshot),
      onEvent: (event) => events.push(event)
    });
    const session = makeAllPlayersDeadContactSession();

    core.start(session);
    core.pump(0);
    core.pump(SIM_STEP_MS);
    core.pump(SIM_STEP_MS * 2);

    const ghostBeforeMove = lastPlayerSnapshot(snapshots);
    expect(ghostBeforeMove.state).toBe('ghost');
    expect(ghostBeforeMove.weaponHud).toBeNull();
    expect(events.map((event) => event.kind)).toContain('playerDowned');

    const fireEventsBefore = events.filter((event) => event.kind === 'fire').length;
    core.submitInput('solo', { kind: 'aim', x: 5, y: 0 });
    core.submitInput('solo', { kind: 'fire', phase: 'start' });
    core.submitInput('solo', { kind: 'move', dx: 1, dy: 0 });
    core.pump(SIM_STEP_MS * 3);
    core.pump(SIM_STEP_MS * 4);

    const ghostAfterMove = lastPlayerSnapshot(snapshots);
    const fireEventsAfter = events.filter((event) => event.kind === 'fire').length;
    expect(fireEventsAfter).toBe(fireEventsBefore);
    expect(ghostAfterMove.state).toBe('ghost');
    expect(ghostAfterMove.x).toBeGreaterThan(ghostBeforeMove.x);
  });

  it('runs lifecycle, input, snapshots, and stop through the public facade', () => {
    const snapshots: Snapshot[] = [];
    const events: RuntimeEvent[] = [];
    const core = createSimulationCore({
      onSnapshot: (snapshot) => snapshots.push(snapshot),
      onEvent: (event) => events.push(event)
    });
    const session = buildSessionDefinition(SANDBOX_PRESET, { seed: 1 });

    core.pump(0);
    core.pump(SIM_STEP_MS * 10);
    expect(events).toHaveLength(0);
    expect(snapshots).toHaveLength(0);

    core.start(session);
    core.submitInput(session.players[0].id, { kind: 'move', dx: 1, dy: 0 });
    core.pump(0);
    core.pump(SIM_STEP_MS);

    expect(events.map((event) => event.kind)).toEqual([
      'sessionStart',
      'playerSpawn',
      'encounterStart'
    ]);
    expect(snapshots).toHaveLength(1);
    const player = snapshots[0]?.entities.find((entity) => entity.kind === 'player');
    expect(player?.x).toBeGreaterThan(session.players[0].position.x);

    core.stop();
    expect(events.map((event) => event.kind)).toEqual([
      'sessionStart',
      'playerSpawn',
      'encounterStart',
      'encounterEnd',
      'sessionStop'
    ]);
    const snapshotsAfterStop = snapshots.length;

    core.pump(SIM_STEP_MS * 2);

    expect(snapshots).toHaveLength(snapshotsAfterStop);
  });

  it('applies addPlayer at a tick boundary and emits playerSpawn with per-player HUD', () => {
    const snapshots: Snapshot[] = [];
    const events: RuntimeEvent[] = [];
    const core = createSimulationCore({
      onSnapshot: (snapshot) => snapshots.push(snapshot),
      onEvent: (event) => events.push(event)
    });

    core.start(makeDynamicRosterSession());
    core.addPlayer(dynamicPlayer('alpha'), { invulnerableUntilSimMs: 250 });

    expect(events.map((event) => event.kind)).toEqual(['sessionStart', 'encounterStart']);

    core.pump(0);
    expect(events.map((event) => event.kind)).toEqual(['sessionStart', 'encounterStart']);

    core.pump(SIM_STEP_MS);

    const spawn = events.find((event) => event.kind === 'playerSpawn');
    if (spawn?.kind !== 'playerSpawn') throw new Error('expected playerSpawn');
    expect(spawn.playerId).toBe('alpha');
    const player = snapshots.at(-1)?.entities.find((entity) => entity.kind === 'player');
    if (player?.kind !== 'player') throw new Error('expected player snapshot');
    expect(player.playerId).toBe('alpha');
    expect(player.formArchetypeId).toBeNull();
    expect(player.weaponHud?.selectedIndex).toBe(0);
  });

  it('mutates player form in place and removes loadout when requested', () => {
    const snapshots: Snapshot[] = [];
    const core = createSimulationCore({
      onSnapshot: (snapshot) => snapshots.push(snapshot),
      onEvent: () => {}
    });
    let now = 0;

    core.start(makeDynamicRosterSession());
    core.addPlayer(dynamicPlayer('alpha'));
    core.pump(now);
    now += SIM_STEP_MS;
    core.pump(now);

    const entityIdBefore = lastPlayerSnapshot(snapshots).id;
    core.setPlayerForm(
      'alpha',
      {
        formArchetypeId: 'slime-one-eye',
        maxHp: 10,
        radius: 0.8,
        contactBox: { width: 1.6, height: 1.6 },
        maxSpeed: 3,
        loadout: null
      },
      { refillHp: true }
    );
    now += SIM_STEP_MS;
    core.pump(now);
    now += SIM_STEP_MS;
    core.pump(now);

    const player = lastPlayerSnapshot(snapshots);
    expect(player.id).toBe(entityIdBefore);
    expect(player.formArchetypeId).toBe('slime-one-eye');
    expect(player.hp).toBe(10);
    expect(player.maxHp).toBe(10);
    expect(player.weaponHud).toBeNull();
  });

  it('removePlayer drops the actor, input slot, and owned projectiles without death events', () => {
    const snapshots: Snapshot[] = [];
    const events: RuntimeEvent[] = [];
    const core = createSimulationCore({
      onSnapshot: (snapshot) => snapshots.push(snapshot),
      onEvent: (event) => events.push(event)
    });
    let now = 0;

    core.start(makeDynamicRosterSession());
    core.addPlayer(dynamicPlayer('alpha'));
    core.pump(now);
    now += SIM_STEP_MS;
    core.pump(now);
    core.submitInput('alpha', { kind: 'aim', x: 8, y: 0 });
    core.submitInput('alpha', { kind: 'fire', phase: 'start' });
    now += SIM_STEP_MS;
    core.pump(now);
    now += SIM_STEP_MS;
    core.pump(now);
    expect(lastSnapshot(snapshots).entities.some((entity) => entity.kind === 'projectile')).toBe(
      true
    );

    core.removePlayer('alpha');
    now += SIM_STEP_MS;
    core.pump(now);
    now += SIM_STEP_MS;
    core.pump(now);

    expect(lastSnapshot(snapshots).entities.some((entity) => entity.kind === 'player')).toBe(
      false
    );
    expect(lastSnapshot(snapshots).entities.some((entity) => entity.kind === 'projectile')).toBe(
      false
    );
    expect(events.some((event) => event.kind === 'death')).toBe(false);
  });
});

function lastSnapshot(snapshots: ReadonlyArray<Snapshot>): Snapshot {
  const snapshot = snapshots.at(-1);
  if (snapshot === undefined) throw new Error('expected snapshot');
  return snapshot;
}

function lastPlayerSnapshot(snapshots: ReadonlyArray<Snapshot>): Extract<Snapshot['entities'][number], { kind: 'player' }> {
  const player = lastSnapshot(snapshots).entities.find((entity) => entity.kind === 'player');
  if (player?.kind !== 'player') throw new Error('expected player snapshot');
  return player;
}

function makeMultiActorSession(): SessionDefinition {
  return {
    id: 'multi-actor-core-test',
    seed: 1,
    arena: { width: 32, height: 18 },
    dynamicRoster: false,
    players: [
      {
        id: 'alpha',
        position: { x: -1, y: 0 },
        radius: 0.5,
        contactBox: { width: 1, height: 1 },
        maxSpeed: 6,
        maxHp: 2,
        loadout: { weapons: [PISTOL.id], selectedIndex: 0 },
        companion: null
      },
      {
        id: 'bravo',
        position: { x: 1, y: 0 },
        radius: 0.5,
        contactBox: { width: 1, height: 1 },
        maxSpeed: 6,
        maxHp: 2,
        loadout: { weapons: [PISTOL.id], selectedIndex: 0 },
        companion: null
      }
    ],
    backgrounds: [],
    musicSampleId: null,
    modifiers: [],
    rules: {
      damage: { slimeFriendlyFire: true },
      aimAssist: { enabled: false, maxAngleRadians: 0, maxDistance: 0, strength: 0 }
    },
    encounters: [
      {
        id: 'sandbox',
        type: 'sandbox',
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
      }
    ],
    winCondition: { kind: 'none' },
    lossCondition: { kind: 'playerDeath' },
    uiMeta: null
  };
}

function makeDynamicRosterSession(): SessionDefinition {
  return {
    id: 'dynamic-roster-core-test',
    seed: 1,
    arena: { width: 32, height: 18 },
    dynamicRoster: true,
    players: [],
    backgrounds: [],
    musicSampleId: null,
    modifiers: [],
    rules: {
      damage: { slimeFriendlyFire: true },
      aimAssist: { enabled: false, maxAngleRadians: 0, maxDistance: 0, strength: 0 }
    },
    encounters: [
      {
        id: 'sandbox',
        type: 'sandbox',
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
      }
    ],
    winCondition: { kind: 'none' },
    lossCondition: { kind: 'respawnOnDeath' },
    uiMeta: null
  };
}

function dynamicPlayer(id: string): PlayerConfig {
  return {
    id,
    position: { x: 0, y: 0 },
    radius: 0.5,
    contactBox: { width: 1, height: 1 },
    maxSpeed: 6,
    maxHp: 4,
    loadout: { weapons: [PISTOL.id], selectedIndex: 0 },
    companion: null
  };
}

function makeAllPlayersDeadContactSession(): SessionDefinition {
  return {
    id: 'ghost-input-core-test',
    seed: 1,
    arena: { width: 32, height: 18 },
    dynamicRoster: false,
    players: [
      {
        id: 'solo',
        position: { x: 0, y: 0 },
        radius: 0.5,
        contactBox: { width: 1, height: 1 },
        maxSpeed: 6,
        maxHp: 1,
        loadout: { weapons: [PISTOL.id], selectedIndex: 0 },
        companion: null
      }
    ],
    backgrounds: [],
    musicSampleId: null,
    modifiers: [],
    rules: {
      damage: { slimeFriendlyFire: true },
      aimAssist: { enabled: false, maxAngleRadians: 0, maxDistance: 0, strength: 0 }
    },
    encounters: [
      {
        id: 'contact',
        type: 'sandbox',
        backgroundId: null,
        introDurationMs: 0,
        name: null,
        text: null,
        spawnPlan: {
          kind: 'static',
          spawns: [{ archetypeId: 'slime-one-eye', position: { x: 0, y: 0 } }]
        },
        zoneBehavior: { kind: 'disabled' },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'never', next: 'sequential' },
        tuning: null
      }
    ],
    winCondition: { kind: 'none' },
    lossCondition: { kind: 'allPlayersDead' },
    uiMeta: null
  };
}
