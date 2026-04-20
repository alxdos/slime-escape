import type { PlayableModeEntry } from '../../shared/content/playableModes';
import type { ModePresetId } from '../../shared/content/presets';

export type MenuOverlayInit = Readonly<{
  parent: HTMLElement;
  modes: ReadonlyArray<PlayableModeEntry>;
  onStart(presetId: ModePresetId): void;
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

  const card = document.createElement('div');
  card.style.cssText = cardStyle();

  const title = document.createElement('h1');
  title.textContent = 'Slime Escape';
  title.style.cssText = titleStyle();
  card.appendChild(title);

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
    'align-items:center',
    'justify-content:center',
    'background:rgba(5,6,10,0.85)',
    'z-index:100',
    'cursor:default'
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

function titleStyle(): string {
  return [
    'margin:0',
    'font-size:28px',
    'font-weight:600',
    'color:#e6e8ef',
    'letter-spacing:0.04em',
    'text-align:center'
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
