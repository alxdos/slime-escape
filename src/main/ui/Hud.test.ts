import { describe, expect, it, vi } from 'vitest';

import type { SessionDefinition } from '../../shared/session';
import type { Snapshot } from '../../shared/snapshot';
import { DROP_VISUALS } from '../render/dropVisuals';
import { PROJECTILE_VISUALS } from '../render/projectileVisuals';
import type { SnapshotPair } from '../sim/SimWorkerHost';

import { createHud, deriveHudViewModel, formatElapsedMs } from './Hud';

class FakeStyle {
  private readonly values = new Map<string, string>();
  writeCount = 0;

  get cssText(): string {
    return this.values.get('cssText') ?? '';
  }

  set cssText(value: string) {
    this.write('cssText', value);
  }

  get display(): string {
    return this.values.get('display') ?? '';
  }

  set display(value: string) {
    this.write('display', value);
  }

  get width(): string {
    return this.values.get('width') ?? '';
  }

  set width(value: string) {
    this.write('width', value);
  }

  get height(): string {
    return this.values.get('height') ?? '';
  }

  set height(value: string) {
    this.write('height', value);
  }

  get borderColor(): string {
    return this.values.get('borderColor') ?? '';
  }

  set borderColor(value: string) {
    this.write('borderColor', value);
  }

  get background(): string {
    return this.values.get('background') ?? '';
  }

  set background(value: string) {
    this.write('background', value);
  }

  get boxShadow(): string {
    return this.values.get('boxShadow') ?? '';
  }

  set boxShadow(value: string) {
    this.write('boxShadow', value);
  }

  private write(key: string, value: string): void {
    if (this.values.get(key) === value) return;
    this.values.set(key, value);
    this.writeCount += 1;
  }
}

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly style = new FakeStyle();
  readonly attributes = new Map<string, string>();
  parent: FakeElement | null = null;
  draggable = true;
  private text = '';
  private source = '';

  constructor(readonly tagName: string) {}

  get textContent(): string {
    return this.text;
  }

  set textContent(value: string | null) {
    this.text = value ?? '';
  }

  get src(): string {
    return this.source;
  }

  set src(value: string) {
    this.source = value;
  }

  get alt(): string {
    return this.attributes.get('alt') ?? '';
  }

  set alt(value: string) {
    this.attributes.set('alt', value);
  }

  appendChild<T extends FakeElement>(child: T): T {
    child.parent?.removeChild(child);
    child.parent = this;
    this.children.push(child);
    return child;
  }

  replaceChildren(...children: FakeElement[]): void {
    for (const child of this.children) {
      child.parent = null;
    }
    this.children.length = 0;
    for (const child of children) {
      this.appendChild(child);
    }
  }

  remove(): void {
    this.parent?.removeChild(this);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  private removeChild(child: FakeElement): void {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
    }
    child.parent = null;
  }
}

class FakeDocument {
  createCount = 0;

  createElement(tagName: string): FakeElement {
    this.createCount += 1;
    return new FakeElement(tagName);
  }
}

function makeSession(): SessionDefinition {
  return {
    id: 'hud-session',
    seed: 1,
    arena: { width: 16, height: 9 },
    player: {
      position: { x: 0, y: 0 },
      radius: 0.5,
      contactBox: { width: 1, height: 1 },
      maxSpeed: 5,
      maxHp: 5
    },
    companion: null,
    loadout: { weapons: ['pistol'], selectedIndex: 0 },
    backgrounds: [],
    musicSampleId: null,
    modifiers: [],
    rules: {
      damage: { slimeFriendlyFire: false },
      aimAssist: { enabled: false, maxAngleRadians: 0, maxDistance: 0, strength: 0 }
    },
    encounters: [
      {
        id: 'wave-1',
        type: 'wave',
        backgroundId: null,
        introDurationMs: 0,
        name: null,
        text: null,
        spawnPlan: { kind: 'wave', spawns: [], spawnIntervalMs: 1000, maxAlive: 2 },
        zoneBehavior: { kind: 'disabled' },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      },
      {
        id: 'break-1',
        type: 'break',
        backgroundId: null,
        introDurationMs: 0,
        name: null,
        text: null,
        spawnPlan: { kind: 'empty' },
        zoneBehavior: { kind: 'disabled' },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'timer', durationMs: 1000, next: 'sequential' },
        tuning: null
      },
      {
        id: 'wave-2',
        type: 'wave',
        backgroundId: null,
        introDurationMs: 0,
        name: null,
        text: null,
        spawnPlan: { kind: 'wave', spawns: [], spawnIntervalMs: 1000, maxAlive: 2 },
        zoneBehavior: { kind: 'disabled' },
        objectives: [],
        rewardRules: null,
        transitionRules: { kind: 'allEnemiesCleared', next: 'sequential' },
        tuning: null
      }
    ],
    winCondition: { kind: 'allEncountersComplete' },
    lossCondition: { kind: 'playerDeath' },
    uiMeta: null
  };
}

type TestEncounterSnapshot =
  Omit<NonNullable<Snapshot['encounter']>, 'waveOrdinal'> &
    Partial<Pick<NonNullable<Snapshot['encounter']>, 'waveOrdinal'>>;

type TestSnapshotOverrides =
  Partial<Omit<Snapshot, 'encounter'>> &
    Readonly<{ encounter?: TestEncounterSnapshot | null }>;

function makeSnapshot(overrides: TestSnapshotOverrides = {}): Snapshot {
  const { encounter: encounterOverride, ...otherOverrides } = overrides;
  const encounter = overrides.encounter ?? {
    id: 'wave-2',
    type: 'wave' as const,
    index: 2,
    elapsedMs: 65000
  };
  return {
    simTimeMs: 0,
    entities: [
      {
        id: 1,
        kind: 'player',
        x: 0,
        y: 0,
        hp: 4,
        maxHp: 5
      }
    ],
    zone: { mode: 'disabled', margin: 0 },
    waveProgress: { dispatched: 3, total: 7, alive: 2 },
    bossHud: null,
    weaponHud: null,
    ...otherOverrides,
    encounter: normalizeEncounterSnapshot(encounterOverride === undefined ? encounter : encounterOverride)
  };
}

function normalizeEncounterSnapshot(
  encounter: TestEncounterSnapshot | null
): Snapshot['encounter'] {
  if (encounter === null) return null;
  return {
    waveOrdinal: encounter.type === 'wave' ? encounter.index + 1 : null,
    ...encounter
  };
}

function makeSnapshotPair(curr: Snapshot | null): SnapshotPair {
  return {
    prev: null,
    curr,
    currReceivedAtMs: 0,
    nowMs: 0
  };
}

function withFakeDocument(run: (document: FakeDocument) => void): void {
  const fakeDocument = new FakeDocument();
  vi.stubGlobal('document', fakeDocument as unknown as Document);
  try {
    run(fakeDocument);
  } finally {
    vi.unstubAllGlobals();
  }
}

function asHtmlElement(element: FakeElement): HTMLElement {
  return element as unknown as HTMLElement;
}

function requireElement(element: FakeElement | null): FakeElement {
  if (element === null) {
    throw new Error('expected fake DOM element');
  }
  return element;
}

function childAt(root: FakeElement, index: number): FakeElement {
  const child = root.children[index];
  if (child === undefined) {
    throw new Error(`expected fake DOM child at ${index}`);
  }
  return child;
}

function findByDataset(root: FakeElement, key: string, value: string): FakeElement | null {
  if (root.dataset[key] === value) {
    return root;
  }
  for (const child of root.children) {
    const found = findByDataset(child, key, value);
    if (found !== null) {
      return found;
    }
  }
  return null;
}

function findAllByTag(root: FakeElement, tagName: string): FakeElement[] {
  const found: FakeElement[] = [];
  if (root.tagName === tagName) {
    found.push(root);
  }
  for (const child of root.children) {
    found.push(...findAllByTag(child, tagName));
  }
  return found;
}

function totalStyleWrites(root: FakeElement): number {
  let count = root.style.writeCount;
  for (const child of root.children) {
    count += totalStyleWrites(child);
  }
  return count;
}

function makeBossSnapshot(): Snapshot {
  return makeSnapshot({
    entities: [
      {
        id: 1,
        kind: 'player',
        x: 0,
        y: 0,
        hp: 4,
        maxHp: 5
      },
      {
        id: 99,
        kind: 'boss',
        archetypeId: 'boss-scrap-king',
        x: 1,
        y: 1,
        hp: 22,
        maxHp: 40,
        phaseIndex: 1,
        phaseId: 'desperation',
        activeAttackIds: ['dashSlam']
      }
    ],
    encounter: {
      id: 'campaign-boss',
      type: 'boss',
      index: 2,
      elapsedMs: 12000
    },
    waveProgress: null,
    bossHud: {
      entityId: 99,
      phaseIndex: 1,
      phaseId: 'desperation',
      hp: 22,
      maxHp: 40,
      activeAttackIds: ['dashSlam']
    }
  });
}

describe('Hud view model', () => {
  it('formats elapsed milliseconds as mm:ss', () => {
    expect(formatElapsedMs(0)).toBe('00:00');
    expect(formatElapsedMs(65000)).toBe('01:05');
    expect(formatElapsedMs(601000)).toBe('10:01');
  });

  it('derives run timer from sim time and compact player HP', () => {
    const view = deriveHudViewModel(
      makeSession(),
      makeSnapshot({
        simTimeMs: 125000,
        encounter: {
          id: 'wave-2',
          type: 'wave',
          index: 2,
          elapsedMs: 65000
        }
      })
    );

    expect(view.runTimerText).toBe('02:05');
    expect(view.playerHp).toEqual({
      text: '4 / 5',
      current: 4,
      max: 5,
      ratio: 0.8
    });
    expect(view.weaponSlots).toEqual([]);
    expect(view.selectedWeaponIndex).toBeNull();
    expect(view.boss).toBeNull();
  });

  it('derives sorted weapon slots with cooldown, modifier badges and timed badges', () => {
    const view = deriveHudViewModel(
      makeSession(),
      makeSnapshot({
        simTimeMs: 450,
        weaponHud: {
          selectedIndex: 1,
          weapons: [
            {
              index: 1,
              weaponArchetypeId: 'shotgun',
              cooldownStartedAtSimMs: 200,
              cooldownReadyAtSimMs: 700,
              modifiers: [
                { kind: 'projectileSizeMultiplier', multiplier: 2 },
                { kind: 'pierceBonus', amount: 1 },
                { kind: 'projectileSizeMultiplier', multiplier: 1.5 }
              ],
              timedEffects: [
                {
                  kind: 'temporaryOverdrive',
                  cooldownMultiplier: 0.5,
                  startedAtSimMs: 100,
                  expiresAtSimMs: 900
                }
              ]
            },
            {
              index: 0,
              weaponArchetypeId: 'pistol',
              cooldownStartedAtSimMs: 0,
              cooldownReadyAtSimMs: 0,
              modifiers: [],
              timedEffects: []
            }
          ]
        }
      })
    );

    expect(view.selectedWeaponIndex).toBe(1);
    expect(view.weaponSlots).toEqual([
      {
        index: 0,
        hotkeyText: '1',
        weaponArchetypeId: 'pistol',
        titleText: 'Pistol',
        projectileImage: PROJECTILE_VISUALS['pistol']!.image,
        isSelected: false,
        cooldownRatio: 0,
        modifierBadges: [],
        timedBadges: []
      },
      {
        index: 1,
        hotkeyText: '2',
        weaponArchetypeId: 'shotgun',
        titleText: 'Shotgun',
        projectileImage: PROJECTILE_VISUALS['shotgun']!.image,
        isSelected: true,
        cooldownRatio: 0.5,
        modifierBadges: [
          {
            kind: 'projectileSizeMultiplier',
            count: 2,
            image: DROP_VISUALS['size-up']!.image
          },
          { kind: 'pierceBonus', count: 1, image: DROP_VISUALS['pierce']!.image }
        ],
        timedBadges: [
          {
            kind: 'temporaryOverdrive',
            remainingRatio: 0.5625,
            image: DROP_VISUALS['overdrive']!.image
          }
        ]
      }
    ]);
  });

  it('reuses weapon slot DOM while updating live cooldown and timed fills', () => {
    withFakeDocument((fakeDocument) => {
      const parent = new FakeElement('main');
      const hud = createHud({ parent: asHtmlElement(parent) });
      hud.attach(makeSession());

      const firstSnapshot = makeSnapshot({
        simTimeMs: 450,
        weaponHud: {
          selectedIndex: 1,
          weapons: [
            {
              index: 0,
              weaponArchetypeId: 'pistol',
              cooldownStartedAtSimMs: 0,
              cooldownReadyAtSimMs: 0,
              modifiers: [],
              timedEffects: []
            },
            {
              index: 1,
              weaponArchetypeId: 'shotgun',
              cooldownStartedAtSimMs: 200,
              cooldownReadyAtSimMs: 700,
              modifiers: [
                { kind: 'projectileSizeMultiplier', multiplier: 2 },
                { kind: 'projectileSizeMultiplier', multiplier: 1.5 }
              ],
              timedEffects: [
                {
                  kind: 'temporaryOverdrive',
                  cooldownMultiplier: 0.5,
                  startedAtSimMs: 100,
                  expiresAtSimMs: 900
                }
              ]
            }
          ]
        }
      });

      hud.update(makeSnapshotPair(firstSnapshot));

      const weaponBar = requireElement(findByDataset(parent, 'role', 'hud-weapon-bar'));
      const shotgunSlot = requireElement(findByDataset(weaponBar, 'weaponSlot', '1'));
      const frame = childAt(shotgunSlot, 1);
      const cooldownFill = childAt(frame, 1);
      const projectileImage = findAllByTag(shotgunSlot, 'img').at(-1);
      if (projectileImage === undefined) {
        throw new Error('expected projectile image');
      }
      expect(cooldownFill.style.height).toBe('50%');
      expect(weaponBar.style.cssText).not.toContain('backdrop-filter');
      expect(weaponBar.style.cssText).toContain('overflow:visible');
      expect(frame.style.cssText).toContain('backdrop-filter:blur(8px)');
      const movementHint = requireElement(findByDataset(parent, 'role', 'hud-movement-hint'));
      const wKey = requireElement(findByDataset(movementHint, 'key', 'W'));
      expect(movementHint.style.cssText).not.toContain('backdrop-filter');
      expect(wKey.style.cssText).not.toContain('backdrop-filter');
      expect(requireElement(findByDataset(parent, 'role', 'hud-fire-hint')).style.cssText).not.toContain(
        'backdrop-filter'
      );

      const createCountAfterFirstSnapshot = fakeDocument.createCount;
      const styleWritesAfterFirstSnapshot = totalStyleWrites(parent);
      const secondSnapshot = makeSnapshot({
        simTimeMs: 600,
        weaponHud: {
          selectedIndex: 1,
          weapons: [
            {
              index: 0,
              weaponArchetypeId: 'pistol',
              cooldownStartedAtSimMs: 0,
              cooldownReadyAtSimMs: 0,
              modifiers: [],
              timedEffects: []
            },
            {
              index: 1,
              weaponArchetypeId: 'shotgun',
              cooldownStartedAtSimMs: 200,
              cooldownReadyAtSimMs: 700,
              modifiers: [
                { kind: 'projectileSizeMultiplier', multiplier: 2 },
                { kind: 'projectileSizeMultiplier', multiplier: 1.5 }
              ],
              timedEffects: [
                {
                  kind: 'temporaryOverdrive',
                  cooldownMultiplier: 0.5,
                  startedAtSimMs: 100,
                  expiresAtSimMs: 900
                }
              ]
            }
          ]
        }
      });

      hud.update(makeSnapshotPair(secondSnapshot));

      expect(fakeDocument.createCount).toBe(createCountAfterFirstSnapshot);
      expect(requireElement(findByDataset(weaponBar, 'weaponSlot', '1'))).toBe(shotgunSlot);
      expect(findAllByTag(shotgunSlot, 'img').at(-1)).toBe(projectileImage);
      expect(cooldownFill.style.height).toBe('20%');
      expect(totalStyleWrites(parent)).toBeGreaterThan(styleWritesAfterFirstSnapshot);

      const styleWritesAfterSecondSnapshot = totalStyleWrites(parent);
      hud.update({ ...makeSnapshotPair(secondSnapshot), nowMs: 1000 });

      expect(fakeDocument.createCount).toBe(createCountAfterFirstSnapshot);
      expect(totalStyleWrites(parent)).toBe(styleWritesAfterSecondSnapshot);
    });
  });

  it('fails fast when a weapon slot has no projectile visual', () => {
    expect(() =>
      deriveHudViewModel(
        makeSession(),
        makeSnapshot({
          weaponHud: {
            selectedIndex: 0,
            weapons: [
              {
                index: 0,
                weaponArchetypeId: 'pistol',
                cooldownStartedAtSimMs: 0,
                cooldownReadyAtSimMs: 0,
                modifiers: [],
                timedEffects: []
              }
            ]
          }
        }),
        { projectileVisuals: {}, dropVisuals: DROP_VISUALS }
      )
    ).toThrow('projectile visual missing for HUD archetype "pistol"');
  });

  it('fails fast when an upgrade badge has no drop visual', () => {
    expect(() =>
      deriveHudViewModel(
        makeSession(),
        makeSnapshot({
          weaponHud: {
            selectedIndex: 0,
            weapons: [
              {
                index: 0,
                weaponArchetypeId: 'pistol',
                cooldownStartedAtSimMs: 0,
                cooldownReadyAtSimMs: 0,
                modifiers: [{ kind: 'projectileSizeMultiplier', multiplier: 2 }],
                timedEffects: []
              }
            ]
          }
        }),
        { projectileVisuals: PROJECTILE_VISUALS, dropVisuals: {} }
      )
    ).toThrow('drop badge visual missing for HUD archetype "size-up"');
  });

  it('keeps weapon slots visible and unselected while holstered', () => {
    const view = deriveHudViewModel(
      makeSession(),
      makeSnapshot({
        weaponHud: {
          selectedIndex: null,
          weapons: [
            {
              index: 0,
              weaponArchetypeId: 'pistol',
              cooldownStartedAtSimMs: 0,
              cooldownReadyAtSimMs: 0,
              modifiers: [],
              timedEffects: []
            }
          ]
        }
      })
    );

    expect(view.selectedWeaponIndex).toBeNull();
    expect(view.weaponSlots).toHaveLength(1);
    expect(view.weaponSlots[0]?.isSelected).toBe(false);
  });

  it('hides desktop control hints for mobile HUD instances', () => {
    withFakeDocument(() => {
      const parent = new FakeElement('main');
      const hud = createHud({ parent: asHtmlElement(parent), isMobile: true });
      hud.attach(makeSession());

      expect(requireElement(findByDataset(parent, 'role', 'hud-movement-hint')).style.display).toBe(
        'none'
      );
      expect(requireElement(findByDataset(parent, 'role', 'hud-fire-hint')).style.display).toBe(
        'none'
      );
    });
  });

  it('shows boss block only when bossHud is present and resolves phase through archetype data', () => {
    const bossView = deriveHudViewModel(makeSession(), makeBossSnapshot());

    expect(bossView.boss).not.toBeNull();
    expect(bossView.boss?.titleText).toBe('Scrap King');
    expect(bossView.boss?.phaseText).toBe('Phase 2/2 · desperation');
    expect(bossView.boss?.hpText).toBe('22 / 40');
    expect(bossView.boss?.hpRatio).toBe(0.55);
  });

  it('keeps boss summary hidden when only the boss entity is present without bossHud', () => {
    const view = deriveHudViewModel(
      makeSession(),
      makeSnapshot({
        entities: [
          {
            id: 1,
            kind: 'player',
            x: 0,
            y: 0,
            hp: 4,
            maxHp: 5
          },
          {
            id: 99,
            kind: 'boss',
            archetypeId: 'boss-scrap-king',
            x: 1,
            y: 1,
            hp: 22,
            maxHp: 40,
            phaseIndex: 1,
            phaseId: 'desperation',
            activeAttackIds: ['dashSlam']
          }
        ],
        encounter: {
          id: 'campaign-boss',
          type: 'boss',
          index: 2,
          elapsedMs: 12000
        },
        waveProgress: null,
        bossHud: null
      })
    );

    expect(view.boss).toBeNull();
  });

  it('falls back to an unknown phase count when boss archetype is unavailable', () => {
    const bossView = deriveHudViewModel(
      makeSession(),
      makeSnapshot({
        entities: [
          {
            id: 1,
            kind: 'player',
            x: 0,
            y: 0,
            hp: 4,
            maxHp: 5
          },
          {
            id: 99,
            kind: 'boss',
            archetypeId: 'missing-boss',
            x: 1,
            y: 1,
            hp: 22,
            maxHp: 40,
            phaseIndex: 1,
            phaseId: 'desperation',
            activeAttackIds: ['dashSlam']
          }
        ],
        encounter: {
          id: 'campaign-boss',
          type: 'boss',
          index: 2,
          elapsedMs: 12000
        },
        waveProgress: null,
        bossHud: {
          entityId: 99,
          phaseIndex: 1,
          phaseId: 'desperation',
          hp: 22,
          maxHp: 40,
          activeAttackIds: ['dashSlam']
        }
      })
    );

    expect(bossView.boss?.phaseText).toBe('Phase 2/? · desperation');
  });

  it('falls back to waiting state before the first snapshot arrives', () => {
    const view = deriveHudViewModel(makeSession(), null);

    expect(view.runTimerText).toBe('00:00');
    expect(view.playerHp).toEqual({
      text: '-- / 5',
      current: null,
      max: 5,
      ratio: 0
    });
    expect(view.weaponSlots).toEqual([]);
    expect(view.selectedWeaponIndex).toBeNull();
    expect(view.boss).toBeNull();
  });
});
