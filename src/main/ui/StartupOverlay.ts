import {
  createStartupAssetProgressViewModel,
  playStartupPresentationRitual,
  type StartupOverlayViewModel
} from './startupPresentation';
import { comicTextStyle } from './comicTextStyle';

export type StartupOverlayInit = Readonly<{
  parent: HTMLElement;
}>;

export type StartupOverlay = Readonly<{
  show(): void;
  hide(): void;
  isVisible(): boolean;
  setProgress(loaded: number, total: number): void;
  playRitual(): Promise<void>;
  dispose(): void;
}>;

export function createStartupOverlay(init: StartupOverlayInit): StartupOverlay {
  const root = document.createElement('div');
  root.dataset['role'] = 'startup-overlay';
  root.style.cssText = rootStyle();

  const image = document.createElement('img');
  image.alt = 'Slime Escape';
  image.src = '/images/slime-escape.jpg';
  image.style.cssText = imageStyle();
  root.appendChild(image);

  const footer = document.createElement('div');
  footer.style.cssText = footerStyle();

  const status = document.createElement('div');
  status.dataset['role'] = 'startup-status';
  status.style.cssText = statusStyle();
  footer.appendChild(status);

  const progressTrack = document.createElement('div');
  progressTrack.style.cssText = progressTrackStyle();

  const progressFill = document.createElement('div');
  progressFill.dataset['role'] = 'startup-progress-fill';
  progressFill.style.cssText = progressFillStyle();
  progressTrack.appendChild(progressFill);
  footer.appendChild(progressTrack);

  root.appendChild(footer);
  init.parent.appendChild(root);

  let visible = true;
  let disposed = false;

  function applyViewModel(viewModel: StartupOverlayViewModel): void {
    if (disposed) {
      return;
    }
    status.textContent = viewModel.label;
    progressFill.style.width = `${viewModel.progressPercent}%`;
  }

  applyViewModel(createStartupAssetProgressViewModel(0, 0));

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
    setProgress(loaded, total): void {
      applyViewModel(createStartupAssetProgressViewModel(loaded, total));
    },
    playRitual(): Promise<void> {
      return playStartupPresentationRitual(applyViewModel);
    },
    dispose(): void {
      disposed = true;
      root.remove();
    }
  };
}

function rootStyle(): string {
  return [
    'position:fixed',
    'inset:0',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'justify-content:center',
    'gap:32px',
    'padding:32px',
    'background:#ffffff',
    'z-index:120'
  ].join(';');
}

function imageStyle(): string {
  return [
    'display:block',
    'width:min(1120px, calc(100vw - 64px))',
    'height:min(630px, calc(100vh - 180px))',
    'object-fit:contain',
    'filter:drop-shadow(0 20px 48px rgba(16,24,40,0.18))'
  ].join(';');
}

function footerStyle(): string {
  return [
    'display:flex',
    'flex-direction:column',
    'gap:12px',
    'width:min(420px, calc(100vw - 64px))'
  ].join(';');
}

function statusStyle(): string {
  return [
    ...comicTextStyle({
      fontSize: '18px',
      color: '#f6ffb8',
      lineHeight: '1.2',
      textAlign: 'center'
    })
  ].join(';');
}

function progressTrackStyle(): string {
  return [
    'width:100%',
    'height:10px',
    'background:#d0d5dd',
    'border-radius:999px',
    'overflow:hidden'
  ].join(';');
}

function progressFillStyle(): string {
  return [
    'width:0%',
    'height:100%',
    'background:linear-gradient(90deg, #17b26a 0%, #12b76a 100%)',
    'border-radius:999px'
  ].join(';');
}
