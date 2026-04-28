import { afterEach, describe, expect, it, vi } from 'vitest';

import { createResultOverlay } from './ResultOverlay';
import type { ResultViewModel } from './ResultViewModel';

class FakeStyle {
  cssText = '';
  display = '';
}

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly style = new FakeStyle();
  readonly listeners = new Map<string, Array<() => void>>();
  parent: FakeElement | null = null;
  textContent = '';
  type = '';
  className = '';
  src = '';
  alt = '';
  draggable = true;
  attributes = new Map<string, string>();

  appendChild(child: FakeElement): FakeElement {
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
    if (this.parent === null) {
      return;
    }
    this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }

  addEventListener(type: string, listener: () => void): void {
    const bucket = this.listeners.get(type) ?? [];
    bucket.push(listener);
    this.listeners.set(type, bucket);
  }

  dispatch(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener();
    }
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
}

class FakeDocument {
  createElement(): FakeElement {
    return new FakeElement();
  }
}

function findByRole(root: FakeElement, role: string): FakeElement {
  if (root.dataset['role'] === role) {
    return root;
  }
  for (const child of root.children) {
    const match = findByRoleOptional(child, role);
    if (match !== null) {
      return match;
    }
  }
  throw new Error(`role ${role} not found`);
}

function findByRoleOptional(root: FakeElement, role: string): FakeElement | null {
  if (root.dataset['role'] === role) {
    return root;
  }
  for (const child of root.children) {
    const match = findByRoleOptional(child, role);
    if (match !== null) {
      return match;
    }
  }
  return null;
}

function findAllByRole(root: FakeElement, role: string): FakeElement[] {
  const matches: FakeElement[] = [];
  if (root.dataset['role'] === role) {
    matches.push(root);
  }
  for (const child of root.children) {
    matches.push(...findAllByRole(child, role));
  }
  return matches;
}

const originalDocument = globalThis.document;

function makeViewModel(
  outcome: 'win' | 'loss',
  overrides: Partial<ResultViewModel> = {}
): ResultViewModel {
  return {
    outcome,
    title: outcome === 'win' ? 'Victory!' : 'Run Over',
    subtitle:
      outcome === 'win' ? 'You escaped the slime world' : 'The slimes caught you',
    dungeon: null,
    xpReward: null,
    primaryStats: [
      { id: 'progress', label: 'Progress', value: outcome === 'win' ? '100%' : '73%' },
      { id: 'duration', label: 'Time', value: outcome === 'win' ? '04:18' : '03:12' },
      { id: 'total-kills', label: 'Slimes defeated', value: outcome === 'win' ? '143' : '96' },
      { id: 'drops', label: 'Power-ups collected', value: '12' }
    ],
    escapePath: {
      title: 'Escape Map',
      summaryText:
        outcome === 'win' ? 'You reached the exit flag' : 'You reached wave 2 of 3',
      detailText: outcome === 'win' ? null : '1 wave left to the exit',
      path: {
        kind: 'path',
        presentation: 'result',
        totalWaves: 3,
        completedWaves: outcome === 'win' ? 3 : 1,
        activeWaveIndex: outcome === 'win' ? null : 2,
        points:
          outcome === 'win'
            ? [
                { index: 1, state: 'completed', label: 'Wave 1' },
                { index: 2, state: 'completed', label: 'Wave 2' },
                { index: 3, state: 'completed', label: 'Wave 3' }
              ]
            : [
                { index: 1, state: 'completed', label: 'Wave 1' },
                { index: 2, state: 'stopped', label: 'Wave 2' },
                { index: 3, state: 'upcoming', label: 'Wave 3' }
              ],
        stop:
          outcome === 'win' ? { kind: 'none' } : { kind: 'loss', anchor: 'activeWave' },
        flagState: outcome === 'win' ? 'reached' : 'pending'
      }
    },
    killRows: [
      {
        id: 'enemy:slime',
        entityKind: 'enemy',
        archetypeId: 'slime',
        label: 'Basic Slime',
        count: 80,
        iconUrl: '/slime.png'
      },
      {
        id: 'boss:king',
        entityKind: 'boss',
        archetypeId: 'king',
        label: 'Slime King',
        count: 1,
        iconUrl: '/king.png'
      }
    ],
    boss: {
      archetypeId: 'king',
      label: 'Slime King',
      iconUrl: '/king.png',
      text: outcome === 'win' ? 'Boss defeated' : 'Boss: 28% HP left',
      defeated: outcome === 'win',
      hpPercent: outcome === 'win' ? 0 : 28
    },
    defeatCause: outcome === 'loss' ? 'Defeated by: Jumping Slime' : null,
    ...overrides
  };
}

afterEach(() => {
  if (originalDocument === undefined) {
    delete (globalThis as Partial<typeof globalThis>).document;
    return;
  }
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: originalDocument
  });
});

describe('createResultOverlay', () => {
  it('renders win and loss states in the comic modal style', () => {
    const fakeDocument = new FakeDocument();
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: fakeDocument
    });

    const parent = new FakeElement();
    const onBackToMenu = vi.fn();
    const onRestart = vi.fn();

    const overlay = createResultOverlay({
      parent: parent as unknown as HTMLElement,
      onBackToMenu,
      onRestart
    });

    const root = findByRole(parent, 'result-overlay');
    const style = root.children[0];
    const layout = findByRole(root, 'result-layout');
    const socialRail = findByRole(root, 'social-link-rail');
    const effectsLayer = findByRole(root, 'result-effects');
    const title = findByRole(root, 'result-title');
    const summary = findByRole(root, 'result-summary');
    const dungeonPanel = findByRole(root, 'result-dungeon');
    const xpPanel = findByRole(root, 'result-xp');
    const escapePath = findByRole(root, 'result-escape-path');
    const statGrid = findByRole(root, 'result-stat-grid');
    const bossPanel = findByRole(root, 'result-boss');
    const bossText = findByRole(root, 'result-boss-text');
    const defeatCause = findByRole(root, 'result-defeat-cause');
    const killSection = findByRole(root, 'result-kills-section');
    const killList = findByRole(root, 'result-kill-list');
    const restartButton = findByRole(root, 'result-restart');
    const backButton = findByRole(root, 'result-back-to-menu');

    expect(root.style.display).toBe('none');
    expect(root.style.cssText).toContain('background:rgba(255,255,255,0.46)');
    expect(style?.textContent).toContain('prefers-reduced-motion');
    expect(style?.textContent).toContain('.result-effect-particle');
    expect(style?.textContent).toContain('result-victory-confetti');
    expect(style?.textContent).toContain('.result-social-link-rail');
    expect(layout.className).toBe('result-layout');
    expect(socialRail.className).toBe('social-link-rail result-social-link-rail');
    expect(socialRail.dataset['placement']).toBe('result');
    expect(socialRail.parent).toBe(layout);
    expect(findAllByRole(socialRail, 'social-link').map((link) => link.dataset['socialLinkId'])).toEqual([
      'github',
      'discord'
    ]);
    expect(effectsLayer.parent?.className).toBe('result-stage');
    expect(restartButton.textContent).toBe('Restart');
    expect(restartButton.className).toBe('result-comic-button');
    expect(restartButton.style.display).toBe('none');
    expect(backButton.textContent).toBe('Back to Menu');
    expect(backButton.className).toBe('result-comic-button');

    overlay.show(makeViewModel('win'));
    expect(overlay.isVisible()).toBe(true);
    expect(root.style.display).toBe('flex');
    expect(root.dataset['outcome']).toBe('win');
    expect(title.textContent).toBe('Victory!');
    expect(summary.textContent).toBe('You escaped the slime world');
    expect(summary.style.cssText).toContain('background:#e9fbff');
    const winEscapePathTrack = findByRole(root, 'result-escape-path-track');
    expect(escapePath.style.display).toBe('grid');
    expect(findByRole(root, 'result-escape-path-title').textContent).toBe('Escape Map');
    expect(findByRole(root, 'result-escape-path-summary').textContent).toBe(
      'You reached the exit flag'
    );
    expect(findAllByRole(winEscapePathTrack, 'result-escape-path-point').map((point) => point.dataset['state'])).toEqual([
      'completed',
      'completed',
      'completed'
    ]);
    expect(findByRole(winEscapePathTrack, 'result-escape-path-flag').dataset['state']).toBe(
      'reached'
    );
    expect(dungeonPanel.style.display).toBe('none');
    expect(xpPanel.style.display).toBe('none');
    expect(restartButton.style.display).toBe('none');
    expect(backButton.style.cssText).toContain('background:#7cf58f');
    expect(effectsLayer.dataset['outcome']).toBe('win');
    const victoryParticles = findAllByRole(effectsLayer, 'result-effect-particle');
    expect(victoryParticles).toHaveLength(20);
    expect(victoryParticles[0]?.dataset['effectId']).toBe('left-spark-a');
    expect(victoryParticles[0]?.style.cssText).toContain('animation:result-victory-pop');
    expect(victoryParticles[4]?.dataset['effectId']).toBe('left-confetti-a');
    expect(victoryParticles[4]?.style.cssText).toContain('animation:result-victory-confetti');
    expect(victoryParticles[4]?.style.cssText).toContain('5 both');
    expect(findAllByRole(statGrid, 'result-stat')).toHaveLength(4);
    const firstStat = findAllByRole(statGrid, 'result-stat')[0];
    expect(firstStat?.dataset['statId']).toBe('progress');
    expect(findByRole(firstStat!, 'result-stat-label').textContent).toBe('Progress');
    expect(findByRole(firstStat!, 'result-stat-value').textContent).toBe('100%');
    expect(bossPanel.style.display).toBe('flex');
    expect(bossPanel.dataset['defeated']).toBe('true');
    expect(bossText.textContent).toBe('Boss defeated');
    expect(defeatCause.style.display).toBe('none');
    const killRows = findAllByRole(killList, 'result-kill-row');
    expect(killSection.style.display).toBe('flex');
    expect(killRows).toHaveLength(2);
    expect(findByRole(killRows[0]!, 'result-kill-label').textContent).toBe('Basic Slime');
    expect(findByRole(killRows[0]!, 'result-kill-count').textContent).toBe('x80');
    expect(findByRole(killRows[0]!, 'result-kill-icon').src).toBe('/slime.png');

    overlay.show(makeViewModel('win', { xpReward: { xpEarned: 12, totalXp: 40 } }));
    expect(xpPanel.style.display).toBe('grid');
    expect(findByRole(xpPanel, 'result-xp-label').textContent).toBe('XP earned');
    expect(findByRole(xpPanel, 'result-xp-earned').textContent).toBe('+12');
    expect(findByRole(xpPanel, 'result-xp-total').textContent).toBe('Total XP: 40');

    overlay.show(makeViewModel('loss', { killRows: [] }));
    expect(root.dataset['outcome']).toBe('loss');
    expect(title.textContent).toBe('Run Over');
    expect(summary.textContent).toBe('The slimes caught you');
    expect(summary.style.cssText).toContain('background:#ffe7f3');
    const lossEscapePathTrack = findByRole(root, 'result-escape-path-track');
    expect(findByRole(root, 'result-escape-path-summary').textContent).toBe(
      'You reached wave 2 of 3'
    );
    expect(findByRole(root, 'result-escape-path-detail').textContent).toBe(
      '1 wave left to the exit'
    );
    expect(findAllByRole(lossEscapePathTrack, 'result-escape-path-point').map((point) => point.dataset['state'])).toEqual([
      'completed',
      'stopped',
      'upcoming'
    ]);
    expect(findByRole(lossEscapePathTrack, 'result-escape-path-flag').dataset['state']).toBe(
      'pending'
    );
    expect(restartButton.style.display).toBe('block');
    expect(restartButton.style.cssText).toContain('background:#ff9fcf');
    expect(backButton.style.cssText).toContain('background:#b8f1ff');
    expect(xpPanel.style.display).toBe('none');

    overlay.show(
      makeViewModel('loss', {
        killRows: [],
        escapePath: {
          title: 'Escape Map',
          summaryText: 'You reached wave 2 of 2',
          detailText: 'The exit was close',
          path: {
            kind: 'path',
            presentation: 'result',
            totalWaves: 2,
            completedWaves: 2,
            activeWaveIndex: null,
            points: [
              { index: 1, state: 'completed', label: 'Wave 1' },
              { index: 2, state: 'completed', label: 'Wave 2' }
            ],
            stop: { kind: 'loss', anchor: 'beforeFlag' },
            flagState: 'pending'
          }
        }
      })
    );
    const finalBossTrack = findByRole(root, 'result-escape-path-track');
    const finalBossStops = findAllByRole(finalBossTrack, 'result-escape-path-stop');
    expect(finalBossStops).toHaveLength(1);
    expect(finalBossStops[0]?.dataset['anchor']).toBe('beforeFlag');
    expect(findByRole(finalBossTrack, 'result-escape-path-flag').dataset['state']).toBe(
      'pending'
    );

    expect(effectsLayer.dataset['outcome']).toBe('loss');
    const defeatParticles = findAllByRole(effectsLayer, 'result-effect-particle');
    expect(defeatParticles).toHaveLength(8);
    expect(defeatParticles[0]?.dataset['effectId']).toBe('slime-a');
    expect(defeatParticles[0]?.style.cssText).toContain('animation:result-defeat-drip');
    expect(defeatParticles[0]?.style.cssText).toContain('left:0%');
    expect(defeatParticles[0]?.style.cssText).toContain('--result-effect-x:-82px');
    expect(defeatParticles[0]?.style.cssText).toContain(' 1 both');
    expect(defeatParticles[1]?.style.cssText).toContain('left:100%');
    expect(defeatParticles[1]?.style.cssText).toContain('--result-effect-x:82px');
    expect(defeatParticles[6]?.style.cssText).toContain('left:0%');
    expect(defeatParticles[7]?.style.cssText).toContain('left:100%');
    expect(bossPanel.dataset['defeated']).toBe('false');
    expect(bossText.textContent).toBe('Boss: 28% HP left');
    expect(defeatCause.style.display).toBe('block');
    expect(defeatCause.textContent).toBe('Defeated by: Jumping Slime');
    expect(killSection.style.display).toBe('none');
    expect(findAllByRole(killList, 'result-kill-row')).toHaveLength(0);

    overlay.show(
      makeViewModel('loss', {
        title: 'Dungeon Run Over',
        subtitle: 'New Best!',
        dungeon: {
          wavesCleared: 12,
          previousBestWave: 8,
          bestWave: 12,
          isNewBest: true
        },
        escapePath: null,
        primaryStats: [
          { id: 'duration', label: 'Time', value: '03:12' },
          { id: 'total-kills', label: 'Slimes defeated', value: '96' }
        ],
        killRows: []
      })
    );

    expect(title.textContent).toBe('Dungeon Run Over');
    expect(summary.textContent).toBe('New Best!');
    expect(dungeonPanel.style.display).toBe('grid');
    expect(findByRole(dungeonPanel, 'result-dungeon-label').textContent).toBe(
      'Waves cleared'
    );
    expect(findByRole(dungeonPanel, 'result-dungeon-waves').textContent).toBe('12');
    expect(findByRole(dungeonPanel, 'result-dungeon-best').textContent).toBe(
      'Local best: 12'
    );
    expect(findByRole(dungeonPanel, 'result-dungeon-new-best').textContent).toBe(
      'New Best!'
    );
    expect(escapePath.style.display).toBe('none');
    expect(findAllByRole(statGrid, 'result-stat').map((stat) => stat.dataset['statId'])).toEqual([
      'duration',
      'total-kills'
    ]);

    restartButton.dispatch('click');
    expect(onRestart).toHaveBeenCalledTimes(1);

    backButton.dispatch('click');
    expect(onBackToMenu).toHaveBeenCalledTimes(1);

    overlay.hide();
    expect(overlay.isVisible()).toBe(false);
    expect(root.style.display).toBe('none');
    expect(root.dataset['outcome']).toBeUndefined();
    expect(title.textContent).toBe('');
    expect(summary.textContent).toBe('');
    expect(effectsLayer.dataset['outcome']).toBeUndefined();
    expect(restartButton.style.display).toBe('none');
    expect(findAllByRole(effectsLayer, 'result-effect-particle')).toHaveLength(0);
    expect(escapePath.style.display).toBe('none');
    expect(dungeonPanel.style.display).toBe('none');
    expect(dungeonPanel.children).toHaveLength(0);
    expect(xpPanel.style.display).toBe('none');
    expect(xpPanel.children).toHaveLength(0);
    expect(escapePath.children).toHaveLength(0);
    expect(findAllByRole(statGrid, 'result-stat')).toHaveLength(0);
    expect(killSection.style.display).toBe('none');
    expect(bossPanel.style.display).toBe('none');
    expect(defeatCause.style.display).toBe('none');
  });

  it('removes itself on dispose', () => {
    const fakeDocument = new FakeDocument();
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: fakeDocument
    });

    const parent = new FakeElement();
    const overlay = createResultOverlay({
      parent: parent as unknown as HTMLElement,
      onBackToMenu(): void {},
      onRestart(): void {}
    });

    overlay.dispose();

    expect(findByRoleOptional(parent, 'result-overlay')).toBeNull();
  });
});
