import { assertNever } from '../../shared/protocol';

import { comicTextStyle } from './comicTextStyle';
import type {
  ResultBossViewModel,
  ResultEscapePathViewModel,
  ResultKillRowViewModel,
  ResultStatViewModel,
  ResultViewModel
} from './ResultViewModel';

export type ResultOutcome = 'win' | 'loss';

export type ResultOverlayInit = Readonly<{
  parent: HTMLElement;
  onBackToMenu(): void;
}>;

export type ResultOverlay = Readonly<{
  show(viewModel: ResultViewModel): void;
  hide(): void;
  isVisible(): boolean;
  dispose(): void;
}>;

type ResultOverlayParts = Readonly<{
  root: HTMLElement;
  effectsLayer: HTMLElement;
  title: HTMLElement;
  summary: HTMLElement;
  escapePath: HTMLElement;
  statGrid: HTMLElement;
  bossPanel: HTMLElement;
  bossIcon: HTMLImageElement;
  bossText: HTMLElement;
  defeatCause: HTMLElement;
  killsSection: HTMLElement;
  killList: HTMLElement;
  backButton: HTMLElement;
}>;

type ResultEffectShape = 'spark' | 'confetti' | 'slime';

type ResultEffectSpec = Readonly<{
  id: string;
  shape: ResultEffectShape;
  leftPercent: number;
  topPercent: number;
  sizePx: number;
  color: string;
  travelX: number;
  travelY: number;
  rotationDeg: number;
  delayMs: number;
  durationMs: number;
}>;

const VICTORY_EFFECTS: ReadonlyArray<ResultEffectSpec> = [
  makeEffect('left-spark-a', 'spark', 0, 20, 22, '#fff38b', -158, -78, -16, 0, 950),
  makeEffect('right-spark-a', 'spark', 100, 20, 20, '#7cf58f', 154, -72, 22, 45, 980),
  makeEffect('left-spark-b', 'spark', 0, 34, 18, '#b8f1ff', -148, -26, 34, 105, 940),
  makeEffect('right-spark-b', 'spark', 100, 34, 19, '#ffcf6b', 146, -20, -24, 155, 1010),
  makeEffect('left-confetti-a', 'confetti', 0, 24, 12, '#ff9fcf', -118, 192, 18, 20, 2600),
  makeEffect('right-confetti-a', 'confetti', 100, 24, 10, '#b8f1ff', 116, 198, -30, 160, 2680),
  makeEffect('left-confetti-b', 'confetti', 0, 34, 11, '#7cf58f', -92, 222, 48, 320, 2520),
  makeEffect('right-confetti-b', 'confetti', 100, 34, 13, '#fff38b', 88, 230, -42, 470, 2620),
  makeEffect('left-slime-pop', 'slime', 0, 48, 18, '#7cf58f', -118, 64, 10, 260, 1080),
  makeEffect('right-slime-pop', 'slime', 100, 48, 16, '#b8f1ff', 118, 68, -18, 310, 1110),
  makeEffect('left-confetti-c', 'confetti', 0, 40, 9, '#ffcf6b', -74, 238, 62, 640, 2500),
  makeEffect('right-spark-c', 'spark', 100, 42, 15, '#fff38b', 126, 10, -8, 420, 920),
  makeEffect('left-confetti-d', 'confetti', 0, 22, 10, '#b8f1ff', -132, 170, -28, 820, 2720),
  makeEffect('right-confetti-d', 'confetti', 100, 22, 12, '#ff9fcf', 128, 178, 36, 990, 2760),
  makeEffect('left-confetti-e', 'confetti', 0, 56, 13, '#fff38b', -112, 214, -54, 1160, 2660),
  makeEffect('right-confetti-e', 'confetti', 100, 56, 11, '#7cf58f', 108, 222, 58, 1330, 2700),
  makeEffect('left-confetti-f', 'confetti', 0, 24, 8, '#ffcf6b', -152, 152, 72, 1500, 2540),
  makeEffect('right-confetti-f', 'confetti', 100, 24, 9, '#b8f1ff', 148, 158, -68, 1660, 2580),
  makeEffect('left-spark-c', 'spark', 0, 44, 14, '#ffcf6b', -142, 26, -36, 805, 930),
  makeEffect('right-slime-pop-b', 'slime', 100, 50, 14, '#ff9fcf', 138, 72, 24, 865, 1040)
];

const DEFEAT_EFFECTS: ReadonlyArray<ResultEffectSpec> = [
  makeEffect('slime-a', 'slime', 22, 31, 30, '#b7df79', -10, 20, -12, 0, 920),
  makeEffect('slime-b', 'slime', 77, 33, 24, '#ff9fcf', 12, 24, 18, 80, 980),
  makeEffect('slime-c', 'slime', 28, 68, 22, '#d7f7a2', -8, 28, 26, 120, 900),
  makeEffect('slime-d', 'slime', 72, 70, 28, '#ffb5a7', 10, 30, -22, 170, 1040),
  makeEffect('drop-a', 'slime', 45, 23, 14, '#b7df79', -4, 38, 8, 210, 960),
  makeEffect('drop-b', 'slime', 56, 22, 16, '#ff9fcf', 5, 42, -10, 250, 1020),
  makeEffect('splash-a', 'confetti', 38, 52, 12, '#ffe7f3', -18, 20, 34, 300, 840),
  makeEffect('splash-b', 'confetti', 62, 51, 12, '#d7f7a2', 18, 22, -34, 340, 880)
];

export function createResultOverlay(init: ResultOverlayInit): ResultOverlay {
  const root = document.createElement('div');
  root.dataset['role'] = 'result-overlay';
  root.style.cssText = baseOverlayStyle();

  const style = document.createElement('style');
  style.textContent = resultOverlayCss();
  root.appendChild(style);

  const stage = document.createElement('div');
  stage.className = 'result-stage';
  stage.style.cssText = stageStyle();

  const effectsLayer = document.createElement('div');
  effectsLayer.className = 'result-effects';
  effectsLayer.dataset['role'] = 'result-effects';
  effectsLayer.style.cssText = effectsLayerStyle();
  stage.appendChild(effectsLayer);

  const card = document.createElement('div');
  card.className = 'result-card';
  card.style.cssText = cardStyle();

  const title = document.createElement('h2');
  title.className = 'result-title';
  title.dataset['role'] = 'result-title';
  title.style.cssText = titleStyle();
  card.appendChild(title);

  const summary = document.createElement('p');
  summary.className = 'result-summary';
  summary.dataset['role'] = 'result-summary';
  summary.style.cssText = summaryStyle();
  card.appendChild(summary);

  const escapePath = document.createElement('section');
  escapePath.className = 'result-escape-path';
  escapePath.dataset['role'] = 'result-escape-path';
  escapePath.style.cssText = resultEscapePathStyle();
  card.appendChild(escapePath);

  const statGrid = document.createElement('div');
  statGrid.className = 'result-stat-grid';
  statGrid.dataset['role'] = 'result-stat-grid';
  statGrid.style.cssText = statGridStyle();
  card.appendChild(statGrid);

  const bossPanel = document.createElement('div');
  bossPanel.className = 'result-boss-panel';
  bossPanel.dataset['role'] = 'result-boss';
  bossPanel.style.cssText = bossPanelStyle();

  const bossIcon = document.createElement('img');
  bossIcon.className = 'result-boss-icon';
  bossIcon.dataset['role'] = 'result-boss-icon';
  bossIcon.draggable = false;
  bossIcon.style.cssText = bossIconStyle();
  bossPanel.appendChild(bossIcon);

  const bossText = document.createElement('span');
  bossText.dataset['role'] = 'result-boss-text';
  bossText.style.cssText = bossTextStyle();
  bossPanel.appendChild(bossText);
  card.appendChild(bossPanel);

  const defeatCause = document.createElement('div');
  defeatCause.dataset['role'] = 'result-defeat-cause';
  defeatCause.style.cssText = defeatCauseStyle();
  card.appendChild(defeatCause);

  const killsSection = document.createElement('section');
  killsSection.className = 'result-kills-section';
  killsSection.dataset['role'] = 'result-kills-section';
  killsSection.style.cssText = killsSectionStyle();

  const killsHeading = document.createElement('h3');
  killsHeading.textContent = 'Трофеи забега';
  killsHeading.style.cssText = killsHeadingStyle();
  killsSection.appendChild(killsHeading);

  const killList = document.createElement('div');
  killList.className = 'result-kill-list';
  killList.dataset['role'] = 'result-kill-list';
  killList.style.cssText = killListStyle();
  killsSection.appendChild(killList);
  card.appendChild(killsSection);

  const backButton = document.createElement('button');
  backButton.dataset['role'] = 'result-back-to-menu';
  backButton.className = 'result-comic-button';
  backButton.type = 'button';
  backButton.textContent = 'Вернуться в меню';
  backButton.style.cssText = primaryButtonStyle();
  backButton.addEventListener('click', () => init.onBackToMenu());
  card.appendChild(backButton);

  stage.appendChild(card);
  root.appendChild(stage);
  init.parent.appendChild(root);
  root.style.display = 'none';

  let visible = false;
  const parts: ResultOverlayParts = {
    root,
    effectsLayer,
    title,
    summary,
    escapePath,
    statGrid,
    bossPanel,
    bossIcon,
    bossText,
    defeatCause,
    killsSection,
    killList,
    backButton
  };

  return {
    show(viewModel): void {
      visible = true;
      applyViewModel(viewModel, parts);
      root.style.display = 'flex';
    },
    hide(): void {
      visible = false;
      delete root.dataset['outcome'];
      root.style.display = 'none';
      title.textContent = '';
      summary.textContent = '';
      effectsLayer.replaceChildren();
      delete effectsLayer.dataset['outcome'];
      hideEscapePath(escapePath);
      statGrid.replaceChildren();
      killList.replaceChildren();
      hideBoss(bossPanel, bossIcon, bossText);
      hideDefeatCause(defeatCause);
      killsSection.style.display = 'none';
    },
    isVisible(): boolean {
      return visible;
    },
    dispose(): void {
      root.remove();
    }
  };
}

function applyViewModel(viewModel: ResultViewModel, parts: ResultOverlayParts): void {
  const outcome = viewModel.outcome;
  parts.root.dataset['outcome'] = outcome;
  renderEffects(parts.effectsLayer, outcome);

  if (outcome === 'win') {
    parts.title.textContent = viewModel.title;
    parts.title.style.cssText = titleStyle('#fff38b');
    parts.summary.textContent = viewModel.subtitle;
    parts.summary.style.cssText = summaryStyle('#e9fbff');
    parts.backButton.style.cssText = primaryButtonStyle('#7cf58f');
    parts.bossPanel.style.cssText = bossPanelStyle('#e9fbff');
    renderDynamicSections(viewModel, parts);
    return;
  }

  parts.title.textContent = viewModel.title;
  parts.title.style.cssText = titleStyle('#ff9fcf');
  parts.summary.textContent = viewModel.subtitle;
  parts.summary.style.cssText = summaryStyle('#ffe7f3');
  parts.backButton.style.cssText = primaryButtonStyle('#ff9fcf');
  parts.bossPanel.style.cssText = bossPanelStyle('#ffe7f3');
  renderDynamicSections(viewModel, parts);
}

function renderDynamicSections(viewModel: ResultViewModel, parts: ResultOverlayParts): void {
  renderEscapePath(parts.escapePath, viewModel.escapePath, viewModel.outcome);
  parts.statGrid.replaceChildren(
    ...viewModel.primaryStats.map((stat, index) =>
      createStatTile(stat, index, viewModel.outcome)
    )
  );
  renderBoss(parts.bossPanel, parts.bossIcon, parts.bossText, viewModel.boss);
  renderDefeatCause(parts.defeatCause, viewModel.defeatCause);
  renderKillRows(parts.killsSection, parts.killList, viewModel.killRows, viewModel.outcome);
}

function renderEscapePath(
  container: HTMLElement,
  escapePath: ResultEscapePathViewModel | null,
  outcome: ResultOutcome
): void {
  if (escapePath === null) {
    hideEscapePath(container);
    return;
  }

  container.style.cssText = resultEscapePathStyle(outcome);
  container.style.display = 'grid';
  container.replaceChildren(
    createEscapePathTitle(escapePath),
    createEscapePathTrack(escapePath),
    createEscapePathText(escapePath)
  );
}

function hideEscapePath(container: HTMLElement): void {
  container.style.display = 'none';
  container.replaceChildren();
}

function createEscapePathTitle(escapePath: ResultEscapePathViewModel): HTMLElement {
  const title = document.createElement('div');
  title.dataset['role'] = 'result-escape-path-title';
  title.textContent = escapePath.title;
  title.style.cssText = resultEscapePathTitleStyle();
  return title;
}

function createEscapePathTrack(escapePath: ResultEscapePathViewModel): HTMLElement {
  const track = document.createElement('div');
  track.dataset['role'] = 'result-escape-path-track';
  track.style.cssText = resultEscapePathTrackStyle();
  const nodes: HTMLElement[] = [];
  if (
    escapePath.path.stop.kind === 'loss' &&
    escapePath.path.stop.anchor === 'afterCompletedWaves' &&
    escapePath.path.completedWaves === 0
  ) {
    nodes.push(createEscapePathStopMarker('afterCompletedWaves'));
  }
  for (const point of escapePath.path.points) {
    const node = document.createElement('span');
    node.dataset['role'] = 'result-escape-path-point';
    node.dataset['waveIndex'] = String(point.index);
    node.dataset['state'] = point.state;
    node.textContent = escapePathPointSymbol(point.state);
    node.style.cssText = resultEscapePathPointStyle(point.state);
    nodes.push(node);
    if (
      escapePath.path.stop.kind === 'loss' &&
      escapePath.path.stop.anchor === 'afterCompletedWaves' &&
      point.index === escapePath.path.completedWaves
    ) {
      nodes.push(createEscapePathStopMarker('afterCompletedWaves'));
    }
  }
  if (escapePath.path.stop.kind === 'loss' && escapePath.path.stop.anchor === 'beforeFlag') {
    nodes.push(createEscapePathStopMarker('beforeFlag'));
  }
  const flag = document.createElement('span');
  flag.dataset['role'] = 'result-escape-path-flag';
  flag.dataset['state'] = escapePath.path.flagState;
  flag.textContent = '🏁';
  flag.style.cssText = resultEscapePathFlagStyle(escapePath.path.flagState);
  track.replaceChildren(...nodes, flag);
  return track;
}

function createEscapePathStopMarker(anchor: 'afterCompletedWaves' | 'beforeFlag'): HTMLElement {
  const marker = document.createElement('span');
  marker.dataset['role'] = 'result-escape-path-stop';
  marker.dataset['anchor'] = anchor;
  marker.textContent = '✕';
  marker.style.cssText = resultEscapePathPointStyle('stopped');
  return marker;
}

function createEscapePathText(escapePath: ResultEscapePathViewModel): HTMLElement {
  const text = document.createElement('div');
  text.dataset['role'] = 'result-escape-path-text';
  text.style.cssText = resultEscapePathTextStyle();
  const summary = document.createElement('span');
  summary.dataset['role'] = 'result-escape-path-summary';
  summary.textContent = escapePath.summaryText;
  text.appendChild(summary);
  if (escapePath.detailText !== null) {
    const detail = document.createElement('small');
    detail.dataset['role'] = 'result-escape-path-detail';
    detail.textContent = escapePath.detailText;
    detail.style.cssText = resultEscapePathDetailStyle();
    text.appendChild(detail);
  }
  return text;
}

function escapePathPointSymbol(
  state: ResultEscapePathViewModel['path']['points'][number]['state']
): string {
  switch (state) {
    case 'completed':
      return '●';
    case 'active':
      return '◉';
    case 'stopped':
      return '✕';
    case 'upcoming':
      return '○';
    default:
      return assertNever(state);
  }
}

function renderEffects(effectsLayer: HTMLElement, outcome: ResultOutcome): void {
  effectsLayer.dataset['outcome'] = outcome;
  const specs = outcome === 'win' ? VICTORY_EFFECTS : DEFEAT_EFFECTS;
  effectsLayer.replaceChildren(...specs.map((spec) => createEffectParticle(spec, outcome)));
}

function createEffectParticle(spec: ResultEffectSpec, outcome: ResultOutcome): HTMLElement {
  const particle = document.createElement('div');
  particle.className = 'result-effect-particle';
  particle.dataset['role'] = 'result-effect-particle';
  particle.dataset['effectId'] = spec.id;
  particle.dataset['effectShape'] = spec.shape;
  particle.style.cssText = effectParticleStyle(spec, outcome);
  return particle;
}

function createStatTile(
  stat: ResultStatViewModel,
  index: number,
  outcome: ResultOutcome
): HTMLElement {
  const tile = document.createElement('div');
  tile.dataset['role'] = 'result-stat';
  tile.dataset['statId'] = stat.id;
  tile.style.cssText = statTileStyle(statBackground(outcome, index));

  const label = document.createElement('span');
  label.dataset['role'] = 'result-stat-label';
  label.textContent = stat.label;
  label.style.cssText = statLabelStyle();
  tile.appendChild(label);

  const value = document.createElement('strong');
  value.dataset['role'] = 'result-stat-value';
  value.textContent = stat.value;
  value.style.cssText = statValueStyle();
  tile.appendChild(value);

  return tile;
}

function renderBoss(
  bossPanel: HTMLElement,
  bossIcon: HTMLImageElement,
  bossText: HTMLElement,
  boss: ResultBossViewModel | null
): void {
  if (boss === null) {
    hideBoss(bossPanel, bossIcon, bossText);
    return;
  }

  bossPanel.style.display = 'flex';
  bossPanel.dataset['defeated'] = boss.defeated ? 'true' : 'false';
  bossIcon.src = boss.iconUrl;
  bossIcon.alt = boss.label;
  bossText.textContent = boss.text;
}

function hideBoss(
  bossPanel: HTMLElement,
  bossIcon: HTMLImageElement,
  bossText: HTMLElement
): void {
  bossPanel.style.display = 'none';
  delete bossPanel.dataset['defeated'];
  bossIcon.src = '';
  bossIcon.alt = '';
  bossText.textContent = '';
}

function renderDefeatCause(defeatCause: HTMLElement, text: string | null): void {
  if (text === null) {
    hideDefeatCause(defeatCause);
    return;
  }

  defeatCause.style.display = 'block';
  defeatCause.textContent = text;
}

function hideDefeatCause(defeatCause: HTMLElement): void {
  defeatCause.style.display = 'none';
  defeatCause.textContent = '';
}

function renderKillRows(
  killsSection: HTMLElement,
  killList: HTMLElement,
  rows: ReadonlyArray<ResultKillRowViewModel>,
  outcome: ResultOutcome
): void {
  if (rows.length === 0) {
    killsSection.style.display = 'none';
    killList.replaceChildren();
    return;
  }

  killsSection.style.display = 'flex';
  killList.replaceChildren(...rows.map((row) => createKillRow(row, outcome)));
}

function createKillRow(row: ResultKillRowViewModel, outcome: ResultOutcome): HTMLElement {
  const element = document.createElement('div');
  element.dataset['role'] = 'result-kill-row';
  element.dataset['entityKind'] = row.entityKind;
  element.dataset['archetypeId'] = row.archetypeId;
  element.style.cssText = killRowStyle(outcome);

  const icon = document.createElement('img');
  icon.dataset['role'] = 'result-kill-icon';
  icon.src = row.iconUrl;
  icon.alt = row.label;
  icon.draggable = false;
  icon.style.cssText = killIconStyle();
  element.appendChild(icon);

  const label = document.createElement('span');
  label.dataset['role'] = 'result-kill-label';
  label.textContent = row.label;
  label.style.cssText = killLabelStyle();
  element.appendChild(label);

  const count = document.createElement('strong');
  count.dataset['role'] = 'result-kill-count';
  count.textContent = `x${row.count}`;
  count.style.cssText = killCountStyle();
  element.appendChild(count);

  return element;
}

function baseOverlayStyle(): string {
  return [
    'position:fixed',
    'inset:0',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'box-sizing:border-box',
    'padding:24px',
    'overflow:auto',
    'background:rgba(255,255,255,0.46)',
    'z-index:110',
    'cursor:default'
  ].join(';');
}

function effectsLayerStyle(): string {
  return [
    'position:absolute',
    'inset:0',
    'overflow:visible',
    'pointer-events:none',
    'z-index:2'
  ].join(';');
}

function stageStyle(): string {
  return [
    'position:relative',
    'width:min(820px, calc(100vw - 48px))',
    'max-height:calc(100vh - 48px)',
    'overflow:visible',
    'flex:0 1 auto'
  ].join(';');
}

function cardStyle(): string {
  return [
    'position:relative',
    'z-index:1',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'gap:16px',
    'box-sizing:border-box',
    'padding:26px 30px 30px',
    'width:100%',
    'max-height:calc(100vh - 48px)',
    'overflow:auto',
    'background:#fffdf4',
    'border:4px solid #050505',
    'border-radius:8px',
    'box-shadow:8px 8px 0 #000000'
  ].join(';');
}

function effectParticleStyle(spec: ResultEffectSpec, outcome: ResultOutcome): string {
  return [
    'position:absolute',
    `left:${spec.leftPercent}%`,
    `top:${spec.topPercent}%`,
    `width:${spec.sizePx}px`,
    `height:${effectHeight(spec)}px`,
    `background:${spec.color}`,
    'border:3px solid #050505',
    `border-radius:${effectRadius(spec)}`,
    'box-shadow:3px 3px 0 #000000',
    `--result-effect-x:${spec.travelX}px`,
    `--result-effect-y:${spec.travelY}px`,
    `--result-effect-rotation:${spec.rotationDeg}deg`,
    `transform:translate(-50%, -50%) rotate(${spec.rotationDeg}deg)`,
    `animation:${effectAnimation(spec, outcome)} ${spec.durationMs}ms ${effectTiming(spec, outcome)} ${spec.delayMs}ms ${effectIterations(spec, outcome)} both`
  ].join(';');
}

function effectHeight(spec: ResultEffectSpec): number {
  if (spec.shape === 'confetti') return Math.max(8, Math.round(spec.sizePx * 0.55));
  if (spec.shape === 'spark') return spec.sizePx;
  return Math.max(12, Math.round(spec.sizePx * 0.78));
}

function effectRadius(spec: ResultEffectSpec): string {
  if (spec.shape === 'spark') return '50% 18% 50% 18%';
  if (spec.shape === 'confetti') return '4px';
  return '55% 45% 62% 38%';
}

function effectAnimation(spec: ResultEffectSpec, outcome: ResultOutcome): string {
  if (outcome === 'win' && spec.shape === 'confetti') return 'result-victory-confetti';
  return outcome === 'win' ? 'result-victory-pop' : 'result-defeat-drip';
}

function effectIterations(spec: ResultEffectSpec, outcome: ResultOutcome): number {
  if (outcome === 'win') return spec.shape === 'confetti' ? 5 : 3;
  return 1;
}

function effectTiming(spec: ResultEffectSpec, outcome: ResultOutcome): string {
  if (outcome === 'win' && spec.shape === 'confetti') return 'cubic-bezier(0.25, 0.46, 0.45, 0.94)';
  return 'ease-out';
}

function titleStyle(color = '#fff38b'): string {
  return [
    'margin:0',
    ...comicTextStyle({
      fontSize: '30px',
      lineHeight: '1',
      color,
      textAlign: 'center',
      shadow: 'strong'
    }),
    'overflow-wrap:anywhere'
  ].join(';');
}

function summaryStyle(background = '#e9fbff'): string {
  return [
    'margin:0',
    'box-sizing:border-box',
    'width:100%',
    'padding:14px 16px 16px',
    `background:${background}`,
    'border:3px solid #050505',
    'border-radius:8px',
    'box-shadow:4px 4px 0 #000000',
    ...comicTextStyle({
      fontSize: '17px',
      color: '#ffffff',
      lineHeight: '1.25',
      textAlign: 'center'
    }),
    'overflow-wrap:anywhere'
  ].join(';');
}

function resultEscapePathStyle(outcome: ResultOutcome = 'win'): string {
  return [
    'display:none',
    'box-sizing:border-box',
    'width:100%',
    'gap:8px',
    'justify-items:center',
    'padding:10px 8px 12px',
    `background:${outcome === 'win' ? 'rgba(124,245,143,0.16)' : 'rgba(255,159,207,0.15)'}`,
    'border-radius:8px'
  ].join(';');
}

function resultEscapePathTitleStyle(): string {
  return [
    ...comicTextStyle({
      fontSize: '17px',
      color: '#fff38b',
      lineHeight: '1',
      textAlign: 'center',
      shadow: 'strong'
    }),
    'overflow-wrap:anywhere'
  ].join(';');
}

function resultEscapePathTrackStyle(): string {
  return [
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'gap:7px',
    'max-width:100%',
    'overflow:hidden',
    'white-space:nowrap'
  ].join(';');
}

function resultEscapePathPointStyle(
  state: ResultEscapePathViewModel['path']['points'][number]['state']
): string {
  const color =
    state === 'active'
      ? '#ffd166'
      : state === 'upcoming'
        ? '#7d8795'
        : state === 'stopped'
          ? '#ff5c7e'
          : '#1fbf77';
  const glow =
    state === 'active'
      ? '0 0 9px rgba(255,209,102,0.78)'
      : state === 'stopped'
      ? '0 0 8px rgba(255,92,126,0.65)'
      : state === 'completed'
        ? '0 0 7px rgba(31,191,119,0.46)'
        : 'none';
  return [
    'display:inline-grid',
    'place-items:center',
    'width:16px',
    'height:16px',
    ...comicTextStyle({
      fontSize: '17px',
      color,
      lineHeight: '1'
    }),
    `text-shadow:${glow}`,
    state === 'upcoming' ? 'opacity:0.6' : 'opacity:1'
  ].join(';');
}

function resultEscapePathFlagStyle(flagState: 'pending' | 'reached'): string {
  return [
    'display:inline-grid',
    'place-items:center',
    'width:20px',
    'height:20px',
    'font-size:18px',
    'line-height:1',
    flagState === 'reached'
      ? 'filter:drop-shadow(0 0 8px rgba(31,191,119,0.72))'
      : 'opacity:0.76'
  ].join(';');
}

function resultEscapePathTextStyle(): string {
  return [
    'display:grid',
    'gap:3px',
    'justify-items:center',
    ...comicTextStyle({
      fontSize: '15px',
      color: '#ffffff',
      lineHeight: '1.12',
      textAlign: 'center'
    }),
    'overflow-wrap:anywhere'
  ].join(';');
}

function resultEscapePathDetailStyle(): string {
  return [
    'display:block',
    ...comicTextStyle({
      fontSize: '13px',
      color: '#f2fbff',
      lineHeight: '1.15',
      textAlign: 'center'
    }),
    'overflow-wrap:anywhere'
  ].join(';');
}

function statGridStyle(): string {
  return [
    'display:grid',
    'grid-template-columns:repeat(auto-fit, minmax(136px, 1fr))',
    'gap:10px',
    'width:100%',
    'box-sizing:border-box'
  ].join(';');
}

function statTileStyle(background: string): string {
  return [
    'display:flex',
    'flex-direction:column',
    'justify-content:space-between',
    'gap:6px',
    'box-sizing:border-box',
    'min-height:84px',
    'padding:12px 14px',
    `background:${background}`,
    'border:3px solid #050505',
    'border-radius:8px',
    'box-shadow:3px 3px 0 #000000',
    'overflow:hidden'
  ].join(';');
}

function statLabelStyle(): string {
  return [
    ...comicTextStyle({
      fontSize: '14px',
      color: '#ffffff',
      lineHeight: '1.1'
    }),
    'overflow-wrap:anywhere'
  ].join(';');
}

function statValueStyle(): string {
  return [
    'display:block',
    ...comicTextStyle({
      fontSize: '22px',
      color: '#ffffff',
      lineHeight: '1'
    }),
    'overflow-wrap:anywhere'
  ].join(';');
}

function bossPanelStyle(background = '#e9fbff'): string {
  return [
    'display:none',
    'align-items:center',
    'gap:12px',
    'box-sizing:border-box',
    'width:100%',
    'padding:12px 14px',
    `background:${background}`,
    'border:3px solid #050505',
    'border-radius:8px',
    'box-shadow:4px 4px 0 #000000'
  ].join(';');
}

function bossIconStyle(): string {
  return [
    'width:48px',
    'height:48px',
    'object-fit:contain',
    'flex:0 0 auto',
    'image-rendering:auto'
  ].join(';');
}

function bossTextStyle(): string {
  return [
    'flex:1 1 auto',
    ...comicTextStyle({
      fontSize: '18px',
      color: '#ffffff',
      lineHeight: '1.15'
    }),
    'overflow-wrap:anywhere'
  ].join(';');
}

function defeatCauseStyle(): string {
  return [
    'display:none',
    'box-sizing:border-box',
    'width:100%',
    'padding:10px 14px 12px',
    'background:#d7f7a2',
    'border:3px solid #050505',
    'border-radius:8px',
    'box-shadow:3px 3px 0 #000000',
    ...comicTextStyle({
      fontSize: '17px',
      color: '#ffffff',
      lineHeight: '1.15',
      textAlign: 'center'
    }),
    'overflow-wrap:anywhere'
  ].join(';');
}

function killsSectionStyle(): string {
  return [
    'display:none',
    'flex-direction:column',
    'gap:10px',
    'box-sizing:border-box',
    'width:100%'
  ].join(';');
}

function killsHeadingStyle(): string {
  return [
    'margin:0',
    ...comicTextStyle({
      fontSize: '18px',
      color: '#fff38b',
      lineHeight: '1',
      textAlign: 'left',
      shadow: 'strong'
    }),
    'overflow-wrap:anywhere'
  ].join(';');
}

function killListStyle(): string {
  return [
    'display:grid',
    'grid-template-columns:repeat(auto-fit, minmax(210px, 1fr))',
    'gap:9px',
    'width:100%'
  ].join(';');
}

function killRowStyle(outcome: ResultOutcome): string {
  return [
    'display:grid',
    'grid-template-columns:42px minmax(0, 1fr) auto',
    'align-items:center',
    'gap:10px',
    'box-sizing:border-box',
    'min-height:56px',
    'padding:7px 10px',
    `background:${outcome === 'win' ? '#ffffff' : '#fff3f8'}`,
    'border:3px solid #050505',
    'border-radius:8px',
    'box-shadow:3px 3px 0 #000000'
  ].join(';');
}

function killIconStyle(): string {
  return [
    'width:38px',
    'height:38px',
    'object-fit:contain',
    'image-rendering:auto'
  ].join(';');
}

function killLabelStyle(): string {
  return [
    ...comicTextStyle({
      fontSize: '15px',
      color: '#ffffff',
      lineHeight: '1.1'
    }),
    'overflow-wrap:anywhere',
    'min-width:0'
  ].join(';');
}

function killCountStyle(): string {
  return [
    ...comicTextStyle({
      fontSize: '18px',
      color: '#ffffff',
      lineHeight: '1'
    }),
    'white-space:nowrap'
  ].join(';');
}

function primaryButtonStyle(background = '#7cf58f'): string {
  return [
    'appearance:none',
    'border:3px solid #050505',
    'padding:11px 24px 12px',
    ...comicTextStyle({
      fontSize: '18px',
      color: '#ffffff',
      lineHeight: '1'
    }),
    `background:${background}`,
    'border-radius:7px',
    'box-shadow:4px 4px 0 #000000',
    'cursor:pointer',
    'width:100%',
    'min-height:46px'
  ].join(';');
}

function statBackground(outcome: ResultOutcome, index: number): string {
  const palette =
    outcome === 'win'
      ? ['#fff38b', '#7cf58f', '#b8f1ff', '#ffcf6b']
      : ['#ffe7f3', '#d7f7a2', '#ffb5a7', '#b8f1ff'];
  return palette[index % palette.length] ?? (outcome === 'win' ? '#fff38b' : '#ffe7f3');
}

function makeEffect(
  id: string,
  shape: ResultEffectShape,
  leftPercent: number,
  topPercent: number,
  sizePx: number,
  color: string,
  travelX: number,
  travelY: number,
  rotationDeg: number,
  delayMs: number,
  durationMs: number
): ResultEffectSpec {
  return {
    id,
    shape,
    leftPercent,
    topPercent,
    sizePx,
    color,
    travelX,
    travelY,
    rotationDeg,
    delayMs,
    durationMs
  };
}

function resultOverlayCss(): string {
  return `
.result-card {
  animation: result-card-enter 180ms ease-out;
}

.result-effect-particle {
  will-change: transform, opacity;
}

.result-comic-button {
  transition: filter 120ms ease, transform 120ms ease;
}

.result-comic-button:hover,
.result-comic-button:focus-visible {
  filter: brightness(1.08) saturate(1.06);
  transform: translate(-1px, -1px);
}

@keyframes result-card-enter {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes result-victory-pop {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.38) rotate(var(--result-effect-rotation));
  }
  32% {
    opacity: 1;
  }
  to {
    opacity: 0;
    transform: translate(calc(-50% + var(--result-effect-x)), calc(-50% + var(--result-effect-y))) scale(1.08) rotate(var(--result-effect-rotation));
  }
}

@keyframes result-victory-confetti {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.72) rotate(var(--result-effect-rotation));
  }
  18% {
    opacity: 1;
    transform: translate(calc(-50% + (var(--result-effect-x) * 0.22)), calc(-50% - 92px)) scale(1) rotate(calc(var(--result-effect-rotation) + 70deg));
  }
  34% {
    opacity: 0.96;
    transform: translate(calc(-50% + (var(--result-effect-x) * 0.38)), calc(-50% - 74px)) scale(0.98) rotate(calc(var(--result-effect-rotation) + 135deg));
  }
  68% {
    opacity: 0.78;
    transform: translate(calc(-50% + (var(--result-effect-x) * 0.72)), calc(-50% + (var(--result-effect-y) * 0.44))) scale(0.9) rotate(calc(var(--result-effect-rotation) + 245deg));
  }
  to {
    opacity: 0;
    transform: translate(calc(-50% + var(--result-effect-x)), calc(-50% + var(--result-effect-y))) scale(0.78) rotate(calc(var(--result-effect-rotation) + 320deg));
  }
}

@keyframes result-defeat-drip {
  from {
    opacity: 0;
    transform: translate(-50%, calc(-50% - 16px)) scale(0.72) rotate(var(--result-effect-rotation));
  }
  42% {
    opacity: 0.95;
  }
  to {
    opacity: 0.5;
    transform: translate(calc(-50% + var(--result-effect-x)), calc(-50% + var(--result-effect-y))) scale(1) rotate(var(--result-effect-rotation));
  }
}

@media (max-width: 560px) {
  .result-stage {
    width: calc(100vw - 24px) !important;
    max-height: calc(100vh - 24px) !important;
  }

  .result-card {
    max-height: calc(100vh - 24px) !important;
    padding: 18px 16px 20px !important;
    gap: 12px !important;
  }

  .result-stat-grid,
  .result-kill-list {
    grid-template-columns: 1fr !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .result-card {
    animation: none;
  }

  .result-effect-particle {
    animation: none !important;
    opacity: 0.42 !important;
  }

  .result-comic-button {
    transition: none;
  }

  .result-comic-button:hover,
  .result-comic-button:focus-visible {
    transform: none;
  }
}
`;
}
