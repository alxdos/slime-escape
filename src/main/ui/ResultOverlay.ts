import { comicTextStyle } from './comicTextStyle';
import type {
  ResultBossViewModel,
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
  title: HTMLElement;
  summary: HTMLElement;
  statGrid: HTMLElement;
  bossPanel: HTMLElement;
  bossIcon: HTMLImageElement;
  bossText: HTMLElement;
  defeatCause: HTMLElement;
  killsSection: HTMLElement;
  killList: HTMLElement;
  backButton: HTMLElement;
}>;

export function createResultOverlay(init: ResultOverlayInit): ResultOverlay {
  const root = document.createElement('div');
  root.dataset['role'] = 'result-overlay';
  root.style.cssText = baseOverlayStyle();

  const style = document.createElement('style');
  style.textContent = resultOverlayCss();
  root.appendChild(style);

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

  root.appendChild(card);
  init.parent.appendChild(root);
  root.style.display = 'none';

  let visible = false;
  const parts: ResultOverlayParts = {
    root,
    title,
    summary,
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
  parts.statGrid.replaceChildren(
    ...viewModel.primaryStats.map((stat, index) =>
      createStatTile(stat, index, viewModel.outcome)
    )
  );
  renderBoss(parts.bossPanel, parts.bossIcon, parts.bossText, viewModel.boss);
  renderDefeatCause(parts.defeatCause, viewModel.defeatCause);
  renderKillRows(parts.killsSection, parts.killList, viewModel.killRows, viewModel.outcome);
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

function cardStyle(): string {
  return [
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'gap:16px',
    'box-sizing:border-box',
    'padding:26px 30px 30px',
    'width:min(820px, calc(100vw - 48px))',
    'max-height:calc(100vh - 48px)',
    'overflow:auto',
    'background:#fffdf4',
    'border:4px solid #050505',
    'border-radius:8px',
    'box-shadow:8px 8px 0 #000000'
  ].join(';');
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

function resultOverlayCss(): string {
  return `
.result-card {
  animation: result-card-enter 180ms ease-out;
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

@media (max-width: 560px) {
  .result-card {
    width: calc(100vw - 24px) !important;
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
