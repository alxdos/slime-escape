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
    title: outcome === 'win' ? 'Победа!' : 'Забег окончен',
    subtitle:
      outcome === 'win' ? 'Ты выбрался из мира слаймов' : 'Слизни снова сомкнули ловушку',
    primaryStats: [
      { id: 'progress', label: 'Прогресс', value: outcome === 'win' ? '100%' : '73%' },
      { id: 'duration', label: 'Время', value: outcome === 'win' ? '04:18' : '03:12' },
      { id: 'total-kills', label: 'Убито слаймов', value: outcome === 'win' ? '143' : '96' },
      { id: 'drops', label: 'Собрано усилений', value: '12' }
    ],
    escapePath: {
      title: 'Карта Побега',
      summaryText:
        outcome === 'win' ? 'Путь до флага пройден' : 'Ты добрался до волны 2 из 3',
      detailText: outcome === 'win' ? null : 'До выхода оставалось 1 волна',
      path: {
        kind: 'path',
        presentation: 'result',
        totalWaves: 3,
        completedWaves: outcome === 'win' ? 3 : 1,
        activeWaveIndex: outcome === 'win' ? null : 2,
        points:
          outcome === 'win'
            ? [
                { index: 1, state: 'completed', label: 'Волна 1' },
                { index: 2, state: 'completed', label: 'Волна 2' },
                { index: 3, state: 'completed', label: 'Волна 3' }
              ]
            : [
                { index: 1, state: 'completed', label: 'Волна 1' },
                { index: 2, state: 'stopped', label: 'Волна 2' },
                { index: 3, state: 'upcoming', label: 'Волна 3' }
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
        label: 'Обычный слайм',
        count: 80,
        iconUrl: '/slime.png'
      },
      {
        id: 'boss:king',
        entityKind: 'boss',
        archetypeId: 'king',
        label: 'Король слаймов',
        count: 1,
        iconUrl: '/king.png'
      }
    ],
    boss: {
      archetypeId: 'king',
      label: 'Король слаймов',
      iconUrl: '/king.png',
      text: outcome === 'win' ? 'Босс повержен' : 'Босс: осталось 28% HP',
      defeated: outcome === 'win',
      hpPercent: outcome === 'win' ? 0 : 28
    },
    defeatCause: outcome === 'loss' ? 'Добил: Прыгающий слайм' : null,
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

    const overlay = createResultOverlay({
      parent: parent as unknown as HTMLElement,
      onBackToMenu
    });

    const root = findByRole(parent, 'result-overlay');
    const style = root.children[0];
    const effectsLayer = findByRole(root, 'result-effects');
    const title = findByRole(root, 'result-title');
    const summary = findByRole(root, 'result-summary');
    const escapePath = findByRole(root, 'result-escape-path');
    const statGrid = findByRole(root, 'result-stat-grid');
    const bossPanel = findByRole(root, 'result-boss');
    const bossText = findByRole(root, 'result-boss-text');
    const defeatCause = findByRole(root, 'result-defeat-cause');
    const killSection = findByRole(root, 'result-kills-section');
    const killList = findByRole(root, 'result-kill-list');
    const backButton = findByRole(root, 'result-back-to-menu');

    expect(root.style.display).toBe('none');
    expect(root.style.cssText).toContain('background:rgba(255,255,255,0.46)');
    expect(style?.textContent).toContain('prefers-reduced-motion');
    expect(style?.textContent).toContain('.result-effect-particle');
    expect(style?.textContent).toContain('result-victory-confetti');
    expect(effectsLayer.parent?.className).toBe('result-stage');
    expect(backButton.textContent).toBe('Вернуться в меню');
    expect(backButton.className).toBe('result-comic-button');

    overlay.show(makeViewModel('win'));
    expect(overlay.isVisible()).toBe(true);
    expect(root.style.display).toBe('flex');
    expect(root.dataset['outcome']).toBe('win');
    expect(title.textContent).toBe('Победа!');
    expect(summary.textContent).toBe('Ты выбрался из мира слаймов');
    expect(summary.style.cssText).toContain('background:#e9fbff');
    const winEscapePathTrack = findByRole(root, 'result-escape-path-track');
    expect(escapePath.style.display).toBe('grid');
    expect(findByRole(root, 'result-escape-path-title').textContent).toBe('Карта Побега');
    expect(findByRole(root, 'result-escape-path-summary').textContent).toBe(
      'Путь до флага пройден'
    );
    expect(findAllByRole(winEscapePathTrack, 'result-escape-path-point').map((point) => point.dataset['state'])).toEqual([
      'completed',
      'completed',
      'completed'
    ]);
    expect(findByRole(winEscapePathTrack, 'result-escape-path-flag').dataset['state']).toBe(
      'reached'
    );
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
    expect(findByRole(firstStat!, 'result-stat-label').textContent).toBe('Прогресс');
    expect(findByRole(firstStat!, 'result-stat-value').textContent).toBe('100%');
    expect(bossPanel.style.display).toBe('flex');
    expect(bossPanel.dataset['defeated']).toBe('true');
    expect(bossText.textContent).toBe('Босс повержен');
    expect(defeatCause.style.display).toBe('none');
    const killRows = findAllByRole(killList, 'result-kill-row');
    expect(killSection.style.display).toBe('flex');
    expect(killRows).toHaveLength(2);
    expect(findByRole(killRows[0]!, 'result-kill-label').textContent).toBe('Обычный слайм');
    expect(findByRole(killRows[0]!, 'result-kill-count').textContent).toBe('x80');
    expect(findByRole(killRows[0]!, 'result-kill-icon').src).toBe('/slime.png');

    overlay.show(makeViewModel('loss', { killRows: [] }));
    expect(root.dataset['outcome']).toBe('loss');
    expect(title.textContent).toBe('Забег окончен');
    expect(summary.textContent).toBe('Слизни снова сомкнули ловушку');
    expect(summary.style.cssText).toContain('background:#ffe7f3');
    const lossEscapePathTrack = findByRole(root, 'result-escape-path-track');
    expect(findByRole(root, 'result-escape-path-summary').textContent).toBe(
      'Ты добрался до волны 2 из 3'
    );
    expect(findByRole(root, 'result-escape-path-detail').textContent).toBe(
      'До выхода оставалось 1 волна'
    );
    expect(findAllByRole(lossEscapePathTrack, 'result-escape-path-point').map((point) => point.dataset['state'])).toEqual([
      'completed',
      'stopped',
      'upcoming'
    ]);
    expect(findByRole(lossEscapePathTrack, 'result-escape-path-flag').dataset['state']).toBe(
      'pending'
    );

    overlay.show(
      makeViewModel('loss', {
        killRows: [],
        escapePath: {
          title: 'Карта Побега',
          summaryText: 'Ты добрался до волны 2 из 2',
          detailText: 'Флаг был уже рядом',
          path: {
            kind: 'path',
            presentation: 'result',
            totalWaves: 2,
            completedWaves: 2,
            activeWaveIndex: null,
            points: [
              { index: 1, state: 'completed', label: 'Волна 1' },
              { index: 2, state: 'completed', label: 'Волна 2' }
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

    expect(backButton.style.cssText).toContain('background:#ff9fcf');
    expect(effectsLayer.dataset['outcome']).toBe('loss');
    const defeatParticles = findAllByRole(effectsLayer, 'result-effect-particle');
    expect(defeatParticles).toHaveLength(8);
    expect(defeatParticles[0]?.dataset['effectId']).toBe('slime-a');
    expect(defeatParticles[0]?.style.cssText).toContain('animation:result-defeat-drip');
    expect(bossPanel.dataset['defeated']).toBe('false');
    expect(bossText.textContent).toBe('Босс: осталось 28% HP');
    expect(defeatCause.style.display).toBe('block');
    expect(defeatCause.textContent).toBe('Добил: Прыгающий слайм');
    expect(killSection.style.display).toBe('none');
    expect(findAllByRole(killList, 'result-kill-row')).toHaveLength(0);

    backButton.dispatch('click');
    expect(onBackToMenu).toHaveBeenCalledTimes(1);

    overlay.hide();
    expect(overlay.isVisible()).toBe(false);
    expect(root.style.display).toBe('none');
    expect(root.dataset['outcome']).toBeUndefined();
    expect(title.textContent).toBe('');
    expect(summary.textContent).toBe('');
    expect(effectsLayer.dataset['outcome']).toBeUndefined();
    expect(findAllByRole(effectsLayer, 'result-effect-particle')).toHaveLength(0);
    expect(escapePath.style.display).toBe('none');
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
      onBackToMenu(): void {}
    });

    overlay.dispose();

    expect(findByRoleOptional(parent, 'result-overlay')).toBeNull();
  });
});
