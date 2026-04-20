import {
  type ClientSettings,
  type ClientSettingsStore,
  type RenderScalePreset
} from '../settings/ClientSettingsStore';

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

  const card = document.createElement('div');
  card.style.cssText = cardStyle();

  const title = document.createElement('h2');
  title.textContent = 'Настройки';
  title.style.cssText = titleStyle();
  card.appendChild(title);

  const volumeSection = document.createElement('section');
  volumeSection.style.cssText = sectionStyle();

  const volumeHeader = document.createElement('div');
  volumeHeader.style.cssText = rowStyle();

  const volumeLabel = document.createElement('span');
  volumeLabel.textContent = 'Громкость';
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
  volumeInput.style.cssText = sliderStyle();
  volumeInput.addEventListener('input', () => {
    init.store.setMasterVolume(Number(volumeInput.value));
  });
  volumeSection.appendChild(volumeInput);
  card.appendChild(volumeSection);

  const renderScaleSection = document.createElement('section');
  renderScaleSection.style.cssText = sectionStyle();

  const renderScaleLabel = document.createElement('span');
  renderScaleLabel.textContent = 'Разрешение арены';
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
  closeButton.type = 'button';
  closeButton.textContent = 'Закрыть';
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
    'background:rgba(5,6,10,0.76)',
    'z-index:105',
    'cursor:default'
  ].join(';');
}

function cardStyle(): string {
  return [
    'display:flex',
    'flex-direction:column',
    'gap:20px',
    'padding:28px 32px',
    'width:min(460px, calc(100vw - 48px))',
    'background:#11151c',
    'border:1px solid #2a3142',
    'border-radius:8px',
    'box-shadow:0 12px 40px rgba(0,0,0,0.6)'
  ].join(';');
}

function titleStyle(): string {
  return [
    'margin:0',
    'font-size:22px',
    'font-weight:600',
    'color:#e6e8ef',
    'letter-spacing:0.04em'
  ].join(';');
}

function sectionStyle(): string {
  return [
    'display:flex',
    'flex-direction:column',
    'gap:10px'
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
    'font-size:15px',
    'font-weight:600',
    'color:#e6e8ef'
  ].join(';');
}

function valueStyle(): string {
  return [
    'font-size:14px',
    'color:#9ad6ff'
  ].join(';');
}

function sliderStyle(): string {
  return [
    'width:100%',
    'cursor:pointer'
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
    'padding:10px 14px',
    'font-size:14px',
    'font-weight:600',
    'letter-spacing:0.03em',
    'color:#cdd5e3',
    'background:transparent',
    'border:1px solid #2a3142',
    'border-radius:4px',
    'cursor:pointer'
  ].join(';');
}

function activePresetButtonStyle(): string {
  return [
    'appearance:none',
    'padding:10px 14px',
    'font-size:14px',
    'font-weight:600',
    'letter-spacing:0.03em',
    'color:#0a0c10',
    'background:#9ad6ff',
    'border:1px solid #9ad6ff',
    'border-radius:4px',
    'cursor:pointer'
  ].join(';');
}

function closeButtonStyle(): string {
  return [
    'appearance:none',
    'border:none',
    'padding:10px 28px',
    'font-size:15px',
    'font-weight:600',
    'letter-spacing:0.04em',
    'color:#0a0c10',
    'background:#9ad6ff',
    'border-radius:4px',
    'cursor:pointer',
    'align-self:flex-end'
  ].join(';');
}
