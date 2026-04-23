import type { ModePresetId, PlayableModeEntry } from '../../shared/content/sessions';

export type MenuOverlayInit = Readonly<{
  parent: HTMLElement;
  modes: ReadonlyArray<PlayableModeEntry>;
  onStart(presetId: ModePresetId): void;
  onOpenSettings(): void;
}>;

export type MenuOverlay = Readonly<{
  show(): void;
  hide(): void;
  isVisible(): boolean;
  dispose(): void;
}>;

export function createMenuOverlay(init: MenuOverlayInit): MenuOverlay {
  const root = document.createElement('div');
  root.dataset['role'] = 'menu-overlay';
  root.style.cssText = baseOverlayStyle();

  const titleImage = document.createElement('img');
  titleImage.alt = 'Slime Escape';
  titleImage.src = '/images/title-1000.png';
  titleImage.style.cssText = titleImageStyle();
  root.appendChild(titleImage);

  const card = document.createElement('div');
  card.style.cssText = cardStyle();

  const subtitle = document.createElement('p');
  subtitle.textContent = 'Выбери режим и запусти новый забег.';
  subtitle.style.cssText = subtitleStyle();
  card.appendChild(subtitle);

  const modesList = document.createElement('div');
  modesList.style.cssText = modesListStyle();

  for (const mode of init.modes) {
    modesList.appendChild(createModeCard(mode, init.onStart));
  }
  card.appendChild(modesList);

  const actions = document.createElement('div');
  actions.style.cssText = actionsStyle();

  const settingsButton = document.createElement('button');
  settingsButton.type = 'button';
  settingsButton.textContent = 'Настройки';
  settingsButton.style.cssText = secondaryButtonStyle();
  settingsButton.addEventListener('click', () => init.onOpenSettings());
  actions.appendChild(settingsButton);

  card.appendChild(actions);

  root.appendChild(card);
  init.parent.appendChild(root);

  let visible = true;

  return {
    show(): void {
      visible = true;
      root.style.display = 'flex';
    },
    hide(): void {
      visible = false;
      root.style.display = 'none';
    },
    isVisible(): boolean {
      return visible;
    },
    dispose(): void {
      root.remove();
    }
  };
}

function baseOverlayStyle(): string {
  return [
    'position:fixed',
    'inset:0',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'justify-content:center',
    'gap:24px',
    'box-sizing:border-box',
    'padding:32px 24px',
    'overflow:auto',
    'background-image:linear-gradient(180deg, rgba(5,6,10,0.28) 0%, rgba(5,6,10,0.64) 100%), url("/images/bg/bg-menu.jpg")',
    'background-size:cover',
    'background-position:center bottom',
    'background-repeat:no-repeat',
    'z-index:100',
    'cursor:default'
  ].join(';');
}

function titleImageStyle(): string {
  return [
    'display:block',
    'width:min(500px, calc(100vw - 48px))',
    'height:auto',
    'filter:drop-shadow(0 16px 28px rgba(0,0,0,0.45))',
    'pointer-events:none',
    'user-select:none'
  ].join(';');
}

function cardStyle(): string {
  return [
    'display:flex',
    'flex-direction:column',
    'align-items:stretch',
    'gap:24px',
    'padding:32px 40px',
    'width:min(720px, calc(100vw - 48px))',
    'background:#11151c',
    'border:1px solid #2a3142',
    'border-radius:8px',
    'box-shadow:0 12px 40px rgba(0,0,0,0.6)'
  ].join(';');
}

function subtitleStyle(): string {
  return [
    'margin:0',
    'font-size:15px',
    'line-height:1.5',
    'color:#aeb7c8',
    'text-align:center'
  ].join(';');
}

function modesListStyle(): string {
  return [
    'display:grid',
    'grid-template-columns:repeat(auto-fit, minmax(240px, 1fr))',
    'gap:16px'
  ].join(';');
}

function actionsStyle(): string {
  return [
    'display:flex',
    'justify-content:flex-end'
  ].join(';');
}

function createModeCard(
  mode: PlayableModeEntry,
  onStart: (presetId: ModePresetId) => void
): HTMLElement {
  const root = document.createElement('section');
  root.dataset['role'] = 'menu-mode-card';
  root.dataset['presetId'] = mode.presetId;
  root.style.cssText = modeCardStyle();

  const heading = document.createElement('h2');
  heading.textContent = mode.displayName;
  heading.style.cssText = modeHeadingStyle();
  root.appendChild(heading);

  const description = document.createElement('p');
  description.textContent = mode.description;
  description.style.cssText = modeDescriptionStyle();
  root.appendChild(description);

  const startButton = document.createElement('button');
  startButton.type = 'button';
  startButton.textContent = 'Старт';
  startButton.style.cssText = primaryButtonStyle();
  startButton.addEventListener('click', () => onStart(mode.presetId));
  root.appendChild(startButton);

  return root;
}

function modeCardStyle(): string {
  return [
    'display:flex',
    'flex-direction:column',
    'gap:16px',
    'padding:20px',
    'background:#171c26',
    'border:1px solid #2a3142',
    'border-radius:8px'
  ].join(';');
}

function modeHeadingStyle(): string {
  return [
    'margin:0',
    'font-size:20px',
    'font-weight:600',
    'color:#e6e8ef'
  ].join(';');
}

function modeDescriptionStyle(): string {
  return [
    'margin:0',
    'min-height:48px',
    'font-size:14px',
    'line-height:1.5',
    'color:#b4bdd0'
  ].join(';');
}

function primaryButtonStyle(): string {
  return [
    'appearance:none',
    'border:none',
    'padding:12px 32px',
    'font-size:16px',
    'font-weight:600',
    'letter-spacing:0.04em',
    'color:#0a0c10',
    'background:#9ad6ff',
    'border-radius:4px',
    'cursor:pointer',
    'align-self:flex-start'
  ].join(';');
}

function secondaryButtonStyle(): string {
  return [
    'appearance:none',
    'padding:10px 24px',
    'font-size:15px',
    'font-weight:500',
    'letter-spacing:0.04em',
    'color:#cdd5e3',
    'background:transparent',
    'border:1px solid #2a3142',
    'border-radius:4px',
    'cursor:pointer'
  ].join(';');
}
