import { describe, expect, it, vi } from 'vitest';

import { PISTOL, SHOTGUN } from '../content/weapons';
import type { InputCommand } from '../input';
import { log } from '../log';
import type { PlayerConfig, SessionDefinition } from '../session';
import type { PlayerSnapshot, ProjectileSnapshot, Snapshot } from '../snapshot';
import { SIM_STEP_MS, SNAPSHOT_INTERVAL_MS } from '../timing';

import { createOnlinePredictionCore } from './OnlinePredictionCore';

describe('OnlinePredictionCore', () => {
  it('replays buffered inputs deterministically without extrapolating other actors', () => {
    const authoritative = makeSnapshot({
      simTimeMs: 200,
      entities: [makePlayer({ x: 1, y: 1 }), makePlayer({ id: 20, playerId: 'other', x: 8, y: -3 })]
    });
    const inputs: ReadonlyArray<Readonly<{ command: InputCommand; inputSequence: number }>> = [
      { command: { kind: 'move', dx: 1, dy: 0 }, inputSequence: 1 },
      { command: { kind: 'aim', x: 8, y: 1 }, inputSequence: 2 },
      { command: { kind: 'fire', phase: 'start' }, inputSequence: 3 }
    ];

    const first = runPrediction(authoritative, inputs);
    const second = runPrediction(authoritative, inputs);

    expect(first).toEqual(second);
    expect(first.simTimeMs).toBeCloseTo(200 + SIM_STEP_MS * 3, 6);
    expect(first.entities.some((entity) => entity.kind === 'player' && entity.playerId === 'other')).toBe(
      false
    );
    expect(selfPlayer(first).x).toBeGreaterThan(1);
    expect(projectiles(first).map((projectile) => projectile.spawnInputSequence)).toEqual([3]);
  });

  it('trims acknowledged inputs before replaying the remaining buffer', () => {
    const predictions: Snapshot[] = [];
    const core = createOnlinePredictionCore({
      onPredictedSnapshot: (snapshot) => predictions.push(snapshot)
    });

    core.start(makeSession(), 'self');
    core.receiveAuthoritativeSnapshot(makeSnapshot({ simTimeMs: 100 }));
    core.submitInput({ kind: 'move', dx: 1, dy: 0 }, 1);
    core.submitInput({ kind: 'move', dx: 0, dy: 1 }, 2);
    core.pump(0);
    core.pump(SIM_STEP_MS);
    core.receiveAuthoritativeSnapshot(
      makeSnapshot({
        simTimeMs: 100,
        lastInputSequence: { self: 1 }
      })
    );

    const predicted = lastSnapshot(predictions);
    const player = selfPlayer(predicted);
    expect(predicted.simTimeMs).toBeCloseTo(100 + SIM_STEP_MS, 6);
    expect(player.x).toBeCloseTo(0, 6);
    expect(player.y).toBeCloseTo((6 * SIM_STEP_MS) / 1000, 6);
  });

  it('replays held movement across the pre-reconcile elapsed sim time', () => {
    const predictions: Snapshot[] = [];
    const core = createOnlinePredictionCore({
      onPredictedSnapshot: (snapshot) => predictions.push(snapshot)
    });

    core.start(makeSession(), 'self');
    core.receiveAuthoritativeSnapshot(makeSnapshot({ simTimeMs: 100 }));
    core.submitInput({ kind: 'move', dx: 1, dy: 0 }, 1);
    core.pump(0);
    core.pump(200);

    core.receiveAuthoritativeSnapshot(
      makeSnapshot({
        simTimeMs: 100,
        lastInputSequence: {}
      })
    );

    const predicted = lastSnapshot(predictions);
    expect(predicted.simTimeMs).toBeCloseTo(300, 6);
    expect(selfPlayer(predicted).x).toBeCloseTo((6 * 200) / 1000, 6);
  });

  it('applies unacknowledged old commands before the first replay tick', () => {
    const predictions: Snapshot[] = [];
    const core = createOnlinePredictionCore({
      onPredictedSnapshot: (snapshot) => predictions.push(snapshot)
    });

    core.start(makeSession(), 'self');
    core.receiveAuthoritativeSnapshot(makeSnapshot({ simTimeMs: 100 }));
    core.submitInput({ kind: 'move', dx: 0, dy: -1 }, 1);
    core.pump(0);
    core.pump(100);

    core.receiveAuthoritativeSnapshot(
      makeSnapshot({
        simTimeMs: 150,
        lastInputSequence: {}
      })
    );

    const predicted = lastSnapshot(predictions);
    expect(predicted.simTimeMs).toBeCloseTo(200, 6);
    expect(selfPlayer(predicted).y).toBeLessThan(0);
  });

  it('preserves wall-clock continuity across authoritative reconcile', () => {
    const predictions: Snapshot[] = [];
    const core = createOnlinePredictionCore({
      onPredictedSnapshot: (snapshot) => predictions.push(snapshot)
    });

    core.start(makeSession(), 'self');
    core.receiveAuthoritativeSnapshot(makeSnapshot({ simTimeMs: 0 }));
    core.pump(0);
    core.pump(SIM_STEP_MS);
    core.receiveAuthoritativeSnapshot(makeSnapshot({ simTimeMs: SIM_STEP_MS }));

    const beforePump = lastSnapshot(predictions);
    core.pump(SIM_STEP_MS * 2);

    expect(lastSnapshot(predictions).simTimeMs).toBeGreaterThan(beforePump.simTimeMs);
  });

  it('snaps back to the authoritative position when the server rejects a predicted movement advantage', () => {
    const predictions: Snapshot[] = [];
    const core = createOnlinePredictionCore({
      onPredictedSnapshot: (snapshot) => predictions.push(snapshot)
    });

    core.start(makeSession(), 'self');
    core.receiveAuthoritativeSnapshot(makeSnapshot());
    core.submitInput({ kind: 'move', dx: 1, dy: 0 }, 1);
    core.pump(0);
    core.pump(SIM_STEP_MS);

    expect(selfPlayer(lastSnapshot(predictions)).x).toBeGreaterThan(0);

    core.receiveAuthoritativeSnapshot(
      makeSnapshot({
        simTimeMs: 150,
        entities: [makePlayer({ x: -2, y: 0 })],
        lastInputSequence: { self: 1 }
      })
    );

    expect(selfPlayer(lastSnapshot(predictions)).x).toBe(-2);
  });

  it('keeps movement-affecting status effects in the local replay', () => {
    const predicted = runPrediction(
      makeSnapshot({
        entities: [
          makePlayer({
            statusEffects: [{ kind: 'slow', speedMultiplier: 0.25, expireAtSimMs: 1000 }]
          })
        ]
      }),
      [{ command: { kind: 'move', dx: 1, dy: 0 }, inputSequence: 1 }]
    );

    expect(selfPlayer(predicted).x).toBeCloseTo((6 * 0.25 * SIM_STEP_MS) / 1000, 6);
  });

  it('does not regress local per-slot cooldowns from stale authoritative snapshots', () => {
    const predictions: Snapshot[] = [];
    const core = createOnlinePredictionCore({
      onPredictedSnapshot: (snapshot) => predictions.push(snapshot)
    });

    core.start(makeSession(), 'self');
    core.receiveAuthoritativeSnapshot(makeSnapshot({ simTimeMs: 0 }));
    core.submitInput({ kind: 'aim', x: 8, y: 0 }, 1);
    core.submitInput({ kind: 'fire', phase: 'start' }, 2);
    core.pump(0);
    core.pump(SIM_STEP_MS);

    const localCooldownReadyAt =
      selfPlayer(lastSnapshot(predictions)).weaponHud?.weapons[0]?.cooldownReadyAtSimMs ?? 0;
    expect(localCooldownReadyAt).toBeGreaterThan(0);

    core.receiveAuthoritativeSnapshot(
      makeSnapshot({
        simTimeMs: SIM_STEP_MS,
        entities: [
          makePlayer({
            weaponHud: makeWeaponHud(PISTOL.id, {
              cooldownStartedAtSimMs: 0,
              cooldownReadyAtSimMs: 0
            })
          })
        ],
        lastInputSequence: { self: 2 }
      })
    );

    expect(
      selfPlayer(lastSnapshot(predictions)).weaponHud?.weapons[0]?.cooldownReadyAtSimMs
    ).toBe(localCooldownReadyAt);
  });

  it('does not regress local overdrive timed effects from stale authoritative snapshots', () => {
    const predictions: Snapshot[] = [];
    const core = createOnlinePredictionCore({
      onPredictedSnapshot: (snapshot) => predictions.push(snapshot)
    });

    core.start(makeSession(), 'self');
    core.receiveAuthoritativeSnapshot(
      makeSnapshot({
        simTimeMs: 100,
        entities: [
          makePlayer({
            weaponHud: makeWeaponHud(PISTOL.id, {
              timedEffects: [
                {
                  kind: 'temporaryOverdrive',
                  cooldownMultiplier: 0.5,
                  startedAtSimMs: 200,
                  expiresAtSimMs: 900
                }
              ]
            })
          })
        ]
      })
    );
    core.receiveAuthoritativeSnapshot(
      makeSnapshot({
        simTimeMs: 120,
        entities: [
          makePlayer({
            weaponHud: makeWeaponHud(PISTOL.id, {
              timedEffects: [
                {
                  kind: 'temporaryOverdrive',
                  cooldownMultiplier: 0.5,
                  startedAtSimMs: 100,
                  expiresAtSimMs: 500
                }
              ]
            })
          })
        ]
      })
    );

    const overdrive =
      selfPlayer(lastSnapshot(predictions)).weaponHud?.weapons[0]?.timedEffects[0] ?? null;
    expect(overdrive).toMatchObject({
      kind: 'temporaryOverdrive',
      startedAtSimMs: 200,
      expiresAtSimMs: 900
    });
  });

  it('replaces the cooldown set on form change without leaking previous-form cooldowns', () => {
    const predictions: Snapshot[] = [];
    const core = createOnlinePredictionCore({
      onPredictedSnapshot: (snapshot) => predictions.push(snapshot)
    });

    core.start(makeSession(), 'self');
    core.receiveAuthoritativeSnapshot(
      makeSnapshot({
        simTimeMs: 100,
        entities: [
          makePlayer({
            formArchetypeId: null,
            weaponHud: makeWeaponHud(PISTOL.id, {
              cooldownReadyAtSimMs: 1000
            })
          })
        ]
      })
    );
    core.receiveAuthoritativeSnapshot(
      makeSnapshot({
        simTimeMs: 120,
        entities: [
          makePlayer({
            formArchetypeId: 'slime-one-eye',
            weaponHud: makeWeaponHud(PISTOL.id, {
              cooldownStartedAtSimMs: 0,
              cooldownReadyAtSimMs: 0
            })
          })
        ]
      })
    );

    expect(
      selfPlayer(lastSnapshot(predictions)).weaponHud?.weapons[0]?.cooldownReadyAtSimMs
    ).toBe(0);
  });

  it('drops predicted own projectiles once their firing input is acknowledged without an authoritative projectile', () => {
    const predictions: Snapshot[] = [];
    const core = createOnlinePredictionCore({
      onPredictedSnapshot: (snapshot) => predictions.push(snapshot)
    });

    core.start(makeSession(), 'self');
    core.receiveAuthoritativeSnapshot(makeSnapshot());
    core.submitInput({ kind: 'aim', x: 8, y: 0 }, 1);
    core.submitInput({ kind: 'fire', phase: 'start' }, 2);
    core.pump(0);
    core.pump(SIM_STEP_MS);
    core.receiveAuthoritativeSnapshot(makeSnapshot());

    expect(projectiles(lastSnapshot(predictions)).map((projectile) => projectile.spawnInputSequence)).toEqual([
      2
    ]);

    core.receiveAuthoritativeSnapshot(
      makeSnapshot({
        simTimeMs: 150,
        lastInputSequence: { self: 2 }
      })
    );

    expect(projectiles(lastSnapshot(predictions))).toEqual([]);
  });

  it('does not double-advance kept predicted projectiles during reconcile replay', () => {
    const predictions: Snapshot[] = [];
    const core = createOnlinePredictionCore({
      onPredictedSnapshot: (snapshot) => predictions.push(snapshot)
    });

    core.start(makeSession(), 'self');
    core.receiveAuthoritativeSnapshot(makeSnapshot({ simTimeMs: 0 }));
    core.submitInput({ kind: 'aim', x: 8, y: 0 }, 1);
    core.submitInput({ kind: 'fire', phase: 'start' }, 2);
    core.pump(0);
    core.pump(SIM_STEP_MS);

    const beforeReconcile = projectiles(lastSnapshot(predictions));
    expect(beforeReconcile).toHaveLength(1);

    core.receiveAuthoritativeSnapshot(
      makeSnapshot({
        simTimeMs: 0,
        lastInputSequence: {}
      })
    );

    const afterReconcile = projectiles(lastSnapshot(predictions));
    expect(afterReconcile).toHaveLength(1);
    expect(afterReconcile[0]!.x).toBeCloseTo(beforeReconcile[0]!.x, 6);
    expect(afterReconcile[0]!.y).toBeCloseTo(beforeReconcile[0]!.y, 6);
  });

  it('keeps predicted shotgun pellets distinct when authoritative snapshots confirm their shared input sequence', () => {
    const predictions: Snapshot[] = [];
    const core = createOnlinePredictionCore({
      onPredictedSnapshot: (snapshot) => predictions.push(snapshot)
    });
    const shotgunPlayer = makePlayer({ weaponHud: makeWeaponHud(SHOTGUN.id) });

    core.start(makeSession(SHOTGUN.id), 'self');
    core.receiveAuthoritativeSnapshot(makeSnapshot({ entities: [shotgunPlayer] }));
    core.submitInput({ kind: 'aim', x: 8, y: 0 }, 1);
    core.submitInput({ kind: 'fire', phase: 'start' }, 2);
    core.pump(0);
    core.pump(SIM_STEP_MS);
    core.submitInput({ kind: 'fire', phase: 'stop' }, 3);
    core.pump(SIM_STEP_MS * 3);
    core.receiveAuthoritativeSnapshot(makeSnapshot({ entities: [shotgunPlayer] }));

    const predictedBeforeAck = projectiles(lastSnapshot(predictions));
    const positionsBeforeAck = predictedBeforeAck.map(projectilePositionKey);
    expect(predictedBeforeAck).toHaveLength(5);
    expect(new Set(positionsBeforeAck).size).toBeGreaterThan(1);
    expect(predictedBeforeAck.map((projectile) => projectile.spawnInputSequence)).toEqual([
      2, 2, 2, 2, 2
    ]);

    const authoritativeProjectiles = predictedBeforeAck.map((projectile, index) => ({
      ...projectile,
      id: 100 + index,
      ownerId: shotgunPlayer.id,
      x: 20 + index,
      y: -20 - index
    }));
    core.receiveAuthoritativeSnapshot(
      makeSnapshot({
        simTimeMs: 150,
        entities: [shotgunPlayer, ...authoritativeProjectiles],
        lastInputSequence: { self: 3 }
      })
    );

    const predictedAfterAck = projectiles(lastSnapshot(predictions));
    expect(predictedAfterAck).toHaveLength(5);
    expect(predictedAfterAck.map(projectilePositionKey)).toEqual(positionsBeforeAck);
  });

  it('switches an acknowledged partial shotgun group to authoritative fallback', () => {
    const predictions: Snapshot[] = [];
    const core = createOnlinePredictionCore({
      onPredictedSnapshot: (snapshot) => predictions.push(snapshot)
    });
    const shotgunPlayer = makePlayer({ weaponHud: makeWeaponHud(SHOTGUN.id) });

    core.start(makeSession(SHOTGUN.id), 'self');
    core.receiveAuthoritativeSnapshot(makeSnapshot({ entities: [shotgunPlayer] }));
    core.submitInput({ kind: 'aim', x: 8, y: 0 }, 1);
    core.submitInput({ kind: 'fire', phase: 'start' }, 2);
    core.pump(0);
    core.pump(SIM_STEP_MS);
    core.submitInput({ kind: 'fire', phase: 'stop' }, 3);
    core.pump(SIM_STEP_MS * 3);
    core.receiveAuthoritativeSnapshot(makeSnapshot({ entities: [shotgunPlayer] }));

    const predictedBeforeAck = projectiles(lastSnapshot(predictions));
    expect(predictedBeforeAck).toHaveLength(5);

    const authoritativeProjectiles = predictedBeforeAck.slice(0, 3).map((projectile, index) => ({
      ...projectile,
      id: 200 + index,
      ownerId: shotgunPlayer.id,
      x: 20 + index,
      y: -20 - index
    }));
    core.receiveAuthoritativeSnapshot(
      makeSnapshot({
        simTimeMs: 150,
        entities: [shotgunPlayer, ...authoritativeProjectiles],
        lastInputSequence: { self: 3 }
      })
    );

    expect(projectiles(lastSnapshot(predictions))).toEqual([]);
  });

  it('keeps held-fire follow-up shots when the authoritative stream still has an older shot', () => {
    const predictions: Snapshot[] = [];
    const core = createOnlinePredictionCore({
      onPredictedSnapshot: (snapshot) => predictions.push(snapshot)
    });
    const pistolPlayer = makePlayer({ weaponHud: makeWeaponHud(PISTOL.id) });

    core.start(makeSession(PISTOL.id), 'self');
    core.receiveAuthoritativeSnapshot(makeSnapshot({ simTimeMs: 0, entities: [pistolPlayer] }));
    core.submitInput({ kind: 'aim', x: 8, y: 0 }, 41);
    core.submitInput({ kind: 'fire', phase: 'start' }, 42);
    core.pump(0);
    core.pump(PISTOL.cooldownMs + SIM_STEP_MS * 2);

    const beforeAck = lastSnapshot(predictions);
    const predictedBeforeAck = projectiles(beforeAck).filter(
      (projectile) => projectile.spawnInputSequence === 42
    );
    expect(predictedBeforeAck.length).toBeGreaterThanOrEqual(2);

    const authoritativeOlderShot = {
      ...predictedBeforeAck[0]!,
      id: 300,
      ownerId: pistolPlayer.id,
      x: -4,
      y: -4
    };
    core.receiveAuthoritativeSnapshot(
      makeSnapshot({
        simTimeMs: beforeAck.simTimeMs,
        entities: [pistolPlayer, authoritativeOlderShot],
        lastInputSequence: { self: 42 }
      })
    );

    const predictedAfterAck = projectiles(lastSnapshot(predictions)).filter(
      (projectile) => projectile.spawnInputSequence === 42
    );
    expect(predictedAfterAck).toHaveLength(predictedBeforeAck.length);
  });

  it('keeps a held-fire follow-up shot during the per-projectile rejection grace window', () => {
    const predictions: Snapshot[] = [];
    const core = createOnlinePredictionCore({
      onPredictedSnapshot: (snapshot) => predictions.push(snapshot)
    });

    core.start(makeSession(PISTOL.id), 'self');
    core.receiveAuthoritativeSnapshot(makeSnapshot({ simTimeMs: 0 }));
    core.submitInput({ kind: 'aim', x: 8, y: 0 }, 41);
    core.submitInput({ kind: 'fire', phase: 'start' }, 42);
    core.pump(0);
    core.pump(PISTOL.cooldownMs + SIM_STEP_MS * 2);

    const beforeAck = lastSnapshot(predictions);
    const predictedBeforeAck = projectiles(beforeAck).filter(
      (projectile) => projectile.spawnInputSequence === 42
    );
    expect(predictedBeforeAck.length).toBeGreaterThanOrEqual(2);

    core.receiveAuthoritativeSnapshot(
      makeSnapshot({
        simTimeMs: beforeAck.simTimeMs,
        lastInputSequence: { self: 42 }
      })
    );

    const predictedAfterAck = projectiles(lastSnapshot(predictions)).filter(
      (projectile) => projectile.spawnInputSequence === 42
    );
    expect(predictedAfterAck).toHaveLength(1);
  });

  it('warns and waits for a later snapshot when no session player config can seed prediction', () => {
    const warn = vi.spyOn(log, 'warn').mockImplementation(() => undefined);
    const predictions: Snapshot[] = [];
    const core = createOnlinePredictionCore({
      onPredictedSnapshot: (snapshot) => predictions.push(snapshot)
    });

    try {
      core.start({ ...makeSession(), dynamicRoster: true, players: [] }, 'self');
      core.receiveAuthoritativeSnapshot(makeSnapshot());

      expect(predictions).toEqual([]);
      expect(warn).toHaveBeenCalledWith(
        'online predictor cannot resolve self PlayerConfig; will retry on next snapshot',
        { playerId: 'self' }
      );
    } finally {
      warn.mockRestore();
    }
  });
});

function runPrediction(
  authoritative: Snapshot,
  inputs: ReadonlyArray<Readonly<{ command: InputCommand; inputSequence: number }>>
): Snapshot {
  const predictions: Snapshot[] = [];
  const core = createOnlinePredictionCore({
    onPredictedSnapshot: (snapshot) => predictions.push(snapshot)
  });
  core.start(makeSession(), 'self');
  core.receiveAuthoritativeSnapshot(authoritative);
  for (const input of inputs) {
    core.submitInput(input.command, input.inputSequence);
  }
  core.pump(0);
  core.pump(SIM_STEP_MS * inputs.length);
  core.receiveAuthoritativeSnapshot(authoritative);
  return lastSnapshot(predictions);
}

function lastSnapshot(snapshots: ReadonlyArray<Snapshot>): Snapshot {
  const snapshot = snapshots.at(-1);
  if (snapshot === undefined) throw new Error('expected predicted snapshot');
  return snapshot;
}

function selfPlayer(snapshot: Snapshot): PlayerSnapshot {
  const player = snapshot.entities.find(
    (entity): entity is PlayerSnapshot => entity.kind === 'player' && entity.playerId === 'self'
  );
  if (player === undefined) throw new Error('expected self player snapshot');
  return player;
}

function projectiles(snapshot: Snapshot): ProjectileSnapshot[] {
  return snapshot.entities.filter(
    (entity): entity is ProjectileSnapshot => entity.kind === 'projectile'
  );
}

function projectilePositionKey(projectile: ProjectileSnapshot): string {
  return `${projectile.x.toFixed(4)}:${projectile.y.toFixed(4)}`;
}

function makeSession(weaponArchetypeId = PISTOL.id): SessionDefinition {
  const player: PlayerConfig = {
    id: 'self',
    position: { x: 0, y: 0 },
    radius: 0.5,
    contactBox: { width: 1, height: 1 },
    maxSpeed: 6,
    maxHp: 10,
    loadout: { weapons: [weaponArchetypeId], selectedIndex: 0 },
    companion: null
  };
  return {
    id: 'online-prediction-core-test',
    seed: 1,
    arena: { width: 32, height: 18 },
    backgrounds: [],
    musicSampleId: null,
    modifiers: [],
    rules: {
      damage: { slimeFriendlyFire: false, playerVsPlayerDamage: false },
      aimAssist: { enabled: false, maxAngleRadians: 0, maxDistance: 0, strength: 0 }
    },
    encounters: [],
    winCondition: { kind: 'none' },
    lossCondition: { kind: 'none' },
    playerCoopRevive: null,
    uiMeta: null,
    players: [player],
    dynamicRoster: false
  };
}

function makeSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    simTimeMs: 100,
    entities: [makePlayer()],
    encounter: null,
    zone: { mode: 'disabled', margin: 0 },
    waveProgress: null,
    bossHud: null,
    lastInputSequence: {},
    ...overrides
  };
}

function makePlayer(overrides: Partial<PlayerSnapshot> = {}): PlayerSnapshot {
  return {
    id: 10,
    kind: 'player',
    playerId: 'self',
    x: 0,
    y: 0,
    hp: 10,
    maxHp: 10,
    state: 'alive',
    formArchetypeId: null,
    weaponHud: makeWeaponHud(PISTOL.id),
    statusEffects: [],
    ...overrides
  };
}

function makeWeaponHud(
  weaponArchetypeId: string,
  overrides: Partial<NonNullable<PlayerSnapshot['weaponHud']>['weapons'][number]> = {}
): NonNullable<PlayerSnapshot['weaponHud']> {
  return {
    selectedIndex: 0,
    weapons: [
      {
        index: 0,
        weaponArchetypeId,
        cooldownStartedAtSimMs: 0,
        cooldownReadyAtSimMs: 0,
        modifiers: [],
        timedEffects: [],
        ...overrides
      }
    ]
  };
}
