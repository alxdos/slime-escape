import {
  type ClientSettings,
  type ClientSettingsStore,
  type RenderScalePreset
} from '../settings/ClientSettingsStore';

import { comicTextStyle } from './comicTextStyle';

export type SettingsOverlayInit = Readonly<{
  parent: HTMLElement;
  store: ClientSettingsStore;
  onClose(): void;
  onButtonClick?(): void;
}>;

export type SettingsOverlay = Readonly<{
  show(): void;
  hide(): void;
  isVisible(): boolean;
  dispose(): void;
}>;

export function createSettingsOverlay(init: SettingsOverlayInit): SettingsOverlay {
  const root = document.createElement('div');
  root.dataset['role'] = 'settings-overlay';
  root.style.cssText = baseOverlayStyle();

  const style = document.createElement('style');
  style.textContent = settingsOverlayCss();
  root.appendChild(style);

  const card = document.createElement('div');
  card.style.cssText = cardStyle();

  const title = document.createElement('h2');
  title.textContent = 'Settings';
  title.style.cssText = titleStyle();
  card.appendChild(title);

  const volumeSection = document.createElement('section');
  volumeSection.style.cssText = sectionStyle();

  const volumeHeader = document.createElement('div');
  volumeHeader.style.cssText = rowStyle();

  const volumeLabel = document.createElement('span');
  volumeLabel.textContent = 'Volume';
  volumeLabel.style.cssText = sectionLabelStyle();
  volumeHeader.appendChild(volumeLabel);

  const volumeValue = document.createElement('span');
  volumeValue.dataset['role'] = 'settings-master-volume-value';
  volumeValue.style.cssText = valueStyle();
  volumeHeader.appendChild(volumeValue);

  volumeSection.appendChild(volumeHeader);

  const volumeInput = document.createElement('input');
  volumeInput.dataset['role'] = 'settings-master-volume';
  volumeInput.type = 'range';
  volumeInput.min = '0';
  volumeInput.max = '1';
  volumeInput.step = '0.01';
  volumeInput.className = 'settings-comic-range';
  volumeInput.style.cssText = sliderStyle();
  volumeInput.addEventListener('input', () => {
    init.store.setMasterVolume(Number(volumeInput.value));
  });
  volumeSection.appendChild(volumeInput);
  card.appendChild(volumeSection);

  const renderScaleSection = document.createElement('section');
  renderScaleSection.style.cssText = sectionStyle();

  const renderScaleLabel = document.createElement('span');
  renderScaleLabel.textContent = 'Graphics resolution';
  renderScaleLabel.style.cssText = sectionLabelStyle();
  renderScaleSection.appendChild(renderScaleLabel);

  const presetButtonRow = document.createElement('div');
  presetButtonRow.style.cssText = presetButtonRowStyle();
  const presetButtons: Record<RenderScalePreset, HTMLButtonElement> = {
    low: createPresetButton('low', 'Low', init),
    medium: createPresetButton('medium', 'Medium', init),
    high: createPresetButton('high', 'High', init)
  };

  for (const preset of ['low', 'medium', 'high'] as const) {
    presetButtonRow.appendChild(presetButtons[preset]);
  }
  renderScaleSection.appendChild(presetButtonRow);
  card.appendChild(renderScaleSection);

  const closeButton = document.createElement('button');
  closeButton.dataset['role'] = 'settings-close';
  closeButton.className = 'settings-comic-button';
  closeButton.type = 'button';
  closeButton.textContent = 'Close';
  closeButton.style.cssText = closeButtonStyle();
  closeButton.addEventListener('click', () => {
    init.onButtonClick?.();
    init.onClose();
  });
  card.appendChild(closeButton);

  root.appendChild(card);
  init.parent.appendChild(root);
  root.style.display = 'none';

  let visible = false;

  function syncUi(settings: ClientSettings): void {
    volumeInput.value = settings.masterVolume.toFixed(2);
    volumeValue.textContent = `${Math.round(settings.masterVolume * 100)}%`;
    for (const preset of ['low', 'medium', 'high'] as const) {
      const button = presetButtons[preset];
      const selected = preset === settings.renderScalePreset;
      button.dataset['selected'] = selected ? 'true' : 'false';
      button.style.cssText = selected ? activePresetButtonStyle() : presetButtonStyle();
    }
  }

  syncUi(init.store.get());
  const unsubscribe = init.store.subscribe((settings) => {
    syncUi(settings);
  });

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
      unsubscribe();
      root.remove();
    }
  };
}

function createPresetButton(
  preset: RenderScalePreset,
  label: string,
  init: SettingsOverlayInit
): HTMLButtonElement {
  const button = document.createElement('button');
  button.dataset['role'] = `settings-render-scale-${preset}`;
  button.className = 'settings-comic-button';
  button.type = 'button';
  button.textContent = label;
  button.style.cssText = presetButtonStyle();
  button.addEventListener('click', () => {
    init.onButtonClick?.();
    init.store.setRenderScalePreset(preset);
  });
  return button;
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
    'background:rgba(255,255,255,0.42)',
    'z-index:105',
    'cursor:default'
  ].join(';');
}

function cardStyle(): string {
  return [
    'display:flex',
    'flex-direction:column',
    'gap:18px',
    'box-sizing:border-box',
    'padding:24px 28px 26px',
    'width:min(520px, calc(100vw - 48px))',
    'background:#fffdf4',
    'border:4px solid #050505',
    'border-radius:8px',
    'box-shadow:8px 8px 0 #000000'
  ].join(';');
}

function titleStyle(): string {
  return [
    'margin:0',
    ...comicTextStyle({
      fontSize: '30px',
      color: '#fff38b',
      lineHeight: '1',
      textAlign: 'center',
      shadow: 'strong'
    })
  ].join(';');
}

function sectionStyle(): string {
  return [
    'display:flex',
    'flex-direction:column',
    'gap:12px',
    'padding:14px',
    'background:#e9fbff',
    'border:3px solid #050505',
    'border-radius:8px',
    'box-shadow:4px 4px 0 #000000'
  ].join(';');
}

function rowStyle(): string {
  return [
    'display:flex',
    'align-items:center',
    'justify-content:space-between',
    'gap:16px'
  ].join(';');
}

function sectionLabelStyle(): string {
  return [
    ...comicTextStyle({
      fontSize: '18px',
      color: '#ffffff',
      lineHeight: '1.1'
    })
  ].join(';');
}

function valueStyle(): string {
  return [
    ...comicTextStyle({
      fontSize: '18px',
      color: '#9ef6ff',
      lineHeight: '1.1',
      textAlign: 'right'
    }),
    'min-width:58px'
  ].join(';');
}

function sliderStyle(): string {
  return [
    'width:100%',
    'height:30px',
    'cursor:pointer',
    'accent-color:#71f79f'
  ].join(';');
}

function presetButtonRowStyle(): string {
  return [
    'display:grid',
    'grid-template-columns:repeat(3, minmax(0, 1fr))',
    'gap:10px'
  ].join(';');
}

function presetButtonStyle(): string {
  return [
    'appearance:none',
    'padding:10px 12px',
    ...comicTextStyle({
      fontSize: '16px',
      color: '#ffffff',
      lineHeight: '1'
    }),
    'background:#b8f1ff',
    'border:3px solid #050505',
    'border-radius:7px',
    'box-shadow:4px 4px 0 #000000',
    'cursor:pointer',
    'min-height:42px'
  ].join(';');
}

function activePresetButtonStyle(): string {
  return [
    'appearance:none',
    'padding:10px 12px',
    ...comicTextStyle({
      fontSize: '16px',
      color: '#fff38b',
      lineHeight: '1',
      shadow: 'strong'
    }),
    'background:#7cf58f',
    'border:3px solid #050505',
    'border-radius:7px',
    'box-shadow:4px 4px 0 #000000',
    'cursor:pointer',
    'min-height:42px'
  ].join(';');
}

function closeButtonStyle(): string {
  return [
    'appearance:none',
    'border:3px solid #050505',
    'padding:10px 28px 11px',
    ...comicTextStyle({
      fontSize: '18px',
      color: '#ffffff',
      lineHeight: '1'
    }),
    'background:#ff9fcf',
    'border-radius:7px',
    'box-shadow:4px 4px 0 #000000',
    'cursor:pointer',
    'align-self:flex-end',
    'min-width:156px'
  ].join(';');
}

function settingsOverlayCss(): string {
  return `
.settings-comic-button {
  transition: filter 120ms ease, transform 120ms ease;
}

.settings-comic-button:hover,
.settings-comic-button:focus-visible {
  filter: brightness(1.08) saturate(1.06);
  transform: translate(-1px, -1px);
}

.settings-comic-range {
  appearance: none;
  background: transparent;
}

.settings-comic-range::-webkit-slider-runnable-track {
  height: 14px;
  background: #ffffff;
  border: 3px solid #050505;
  border-radius: 8px;
  box-shadow: 3px 3px 0 #000000;
}

.settings-comic-range::-webkit-slider-thumb {
  appearance: none;
  width: 26px;
  height: 26px;
  margin-top: -9px;
  background: #fff38b;
  border: 3px solid #050505;
  border-radius: 50%;
  box-shadow: 3px 3px 0 #000000;
}

.settings-comic-range::-moz-range-track {
  height: 14px;
  background: #ffffff;
  border: 3px solid #050505;
  border-radius: 8px;
  box-shadow: 3px 3px 0 #000000;
}

.settings-comic-range::-moz-range-thumb {
  width: 22px;
  height: 22px;
  background: #fff38b;
  border: 3px solid #050505;
  border-radius: 50%;
  box-shadow: 3px 3px 0 #000000;
}

@media (prefers-reduced-motion: reduce) {
  .settings-comic-button {
    transition: none;
  }

  .settings-comic-button:hover,
  .settings-comic-button:focus-visible {
    transform: none;
  }
}
`;
}
