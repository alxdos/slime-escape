import { PET_QUALITIES, type PetQuality } from '../../shared/content/pets';
import type {
  ModePresetId,
  OnlineModeEntry,
  PlayableModeEntry
} from '../../shared/content/sessions';

import { comicTextStyle } from './comicTextStyle';
import {
  MAIN_MENU_CONTROLS,
  MAIN_MENU_LOGO,
  MAIN_MENU_STAGE,
  MAIN_MENU_STAGE_WIDTH_VH,
  MENU_SUBSCREENS,
  type MenuImageLayout,
  type MenuControlLayout,
  type MenuScreenId,
  type MenuSubscreenControlLayout,
  type MenuSubscreenId
} from './MenuOverlayLayout';
import type {
  MenuLabPetViewModel,
  MenuLabPurchaseResult,
  MenuLabViewModel
} from './MenuLabViewModel';
import type {
  MenuPetsSelectionResult,
  MenuPetsViewModel
} from './MenuPetsViewModel';
import {
  CAMPAIGN_MODE_BY_CONTROL,
  DEFAULT_SELECTED_CAMPAIGN_MODE,
  isCampaignModeControl,
  resolveMenuControlAction,
  type TeaserControlId
} from './MenuOverlayState';
import { createSocialLinkRail } from './SocialLinkRail';

const TEASER_FEEDBACK_VISIBLE_MS = 7_000;
const TEASER_FEEDBACK_FADE_MS = 900;
const LAB_REVEAL_DISMISS_MS = 220;

export type MenuOverlayInit = Readonly<{
  parent: HTMLElement;
  modes: ReadonlyArray<PlayableModeEntry>;
  onlineModes: ReadonlyArray<OnlineModeEntry>;
  lab: MenuLabViewModel;
  pets: MenuPetsViewModel;
  onStart(presetId: ModePresetId): void;
  onStartOnline(presetId: ModePresetId): void;
  onStartTraining(): void;
  onOpenSettings(): void;
  onToggleFullscreen(): void;
  onOpenScreen(screenId: MenuSubscreenId): void;
  onBackToMainMenu(): void;
  onTeaser(controlId: TeaserControlId): void;
  onStartDungeon(): void;
  onPurchasePet(quality: PetQuality): MenuLabPurchaseResult;
  onSelectPet(petId: string): MenuPetsSelectionResult;
  onClearSelectedPet(): void;
  onButtonHover(): void;
  onModeSwitch(): void;
  dungeonBestWave: number;
}>;

export type MenuOverlay = Readonly<{
  show(): void;
  hide(): void;
  showScreen(screenId: MenuScreenId): void;
  screen(): MenuScreenId;
  setDungeonBestWave(bestWave: number): void;
  setLabViewModel(viewModel: MenuLabViewModel): void;
  setPetsViewModel(viewModel: MenuPetsViewModel): void;
  showFeedback(message: string): void;
  isVisible(): boolean;
  dispose(): void;
}>;

type MenuLabElements = Readonly<{
  root: HTMLDivElement;
  xpTotal: HTMLDivElement;
  stands: Readonly<Record<PetQuality, HTMLButtonElement>>;
}>;

type MenuPetsElements = Readonly<{
  root: HTMLDivElement;
  selectedArea: HTMLButtonElement;
  zones: Readonly<Record<PetQuality, HTMLDivElement>>;
}>;

export function createMenuOverlay(init: MenuOverlayInit): MenuOverlay {
  const root = document.createElement('div');
  root.dataset['role'] = 'menu-overlay';
  root.style.cssText = baseOverlayStyle();

  const style = document.createElement('style');
  style.textContent = menuOverlayCss();
  root.appendChild(style);

  const mainStage = document.createElement('div');
  mainStage.dataset['role'] = 'menu-stage';
  mainStage.style.cssText = stageStyle(MAIN_MENU_STAGE.background);

  const logo = createStageImage(MAIN_MENU_LOGO);
  mainStage.appendChild(logo);

  const modeButtons = new Map<ModePresetId, HTMLButtonElement>();
  const controlButtons: HTMLButtonElement[] = [];
  const subscreenButtons = new Map<MenuScreenId, HTMLButtonElement[]>();
  const subscreenStages = new Map<MenuSubscreenId, HTMLDivElement>();
  const labRevealedPets = new Map<PetQuality, MenuLabPetViewModel>();
  const labDismissingPets = new Set<PetQuality>();
  const labDismissTimeouts = new Map<PetQuality, number>();
  let selectedMode: ModePresetId = DEFAULT_SELECTED_CAMPAIGN_MODE;
  let activeScreen: MenuScreenId = 'main';
  let dungeonBestWave = formatDungeonBestWave(init.dungeonBestWave);
  let dungeonBestWaveElement: HTMLDivElement | null = null;
  let labViewModel = init.lab;
  let labElements: MenuLabElements | null = null;
  let petsViewModel = init.pets;
  let petsElements: MenuPetsElements | null = null;
  let feedbackTimeout: number | null = null;

  const teaserFeedback = document.createElement('div');
  teaserFeedback.dataset['role'] = 'menu-teaser-feedback';
  teaserFeedback.style.cssText = teaserFeedbackStyle();

  for (const [index, control] of MAIN_MENU_CONTROLS.entries()) {
    const button = createControlButton(control, index, handleControl, init.onButtonHover);
    controlButtons.push(button);
    if (isCampaignModeControl(control.id)) {
      modeButtons.set(CAMPAIGN_MODE_BY_CONTROL[control.id], button);
    }
    mainStage.appendChild(button);
  }
  for (const [index, mode] of init.onlineModes.entries()) {
    mainStage.appendChild(
      createOnlineModeButton(mode, index, init.onStartOnline, init.onButtonHover)
    );
  }
  mainStage.appendChild(teaserFeedback);

  const socialLinks = createSocialLinkRail();
  socialLinks.className = `${socialLinks.className} menu-social-link-rail`;
  socialLinks.dataset['placement'] = 'menu';
  socialLinks.style.cssText = `${socialLinks.style.cssText};${menuSocialLinkRailStyle()}`;
  mainStage.appendChild(socialLinks);

  root.appendChild(mainStage);
  init.parent.appendChild(root);

  let visible = true;
  applyModeSelection();

  return {
    show(): void {
      visible = true;
      root.style.display = 'flex';
      applyScreenVisibility();
      restartActiveScreenAnimations();
    },
    hide(): void {
      visible = false;
      root.style.display = 'none';
    },
    showScreen(screenId): void {
      activeScreen = screenId;
      if (screenId !== 'main') {
        ensureSubscreenStage(screenId);
      }
      applyScreenVisibility();
      restartActiveScreenAnimations();
    },
    screen(): MenuScreenId {
      return activeScreen;
    },
    setDungeonBestWave(bestWave): void {
      dungeonBestWave = formatDungeonBestWave(bestWave);
      syncDungeonBestWave();
    },
    setLabViewModel(viewModel): void {
      labViewModel = viewModel;
      renderLab();
    },
    setPetsViewModel(viewModel): void {
      petsViewModel = viewModel;
      renderPets();
    },
    showFeedback(message): void {
      showMenuFeedback(message);
    },
    isVisible(): boolean {
      return visible;
    },
    dispose(): void {
      if (feedbackTimeout !== null) {
        clearMenuTimeout(feedbackTimeout);
        feedbackTimeout = null;
      }
      for (const timeoutId of labDismissTimeouts.values()) {
        clearMenuTimeout(timeoutId);
      }
      labDismissTimeouts.clear();
      root.remove();
    }
  };

  function handleControl(controlId: MenuControlLayout['id']): void {
    const action = resolveMenuControlAction(controlId, selectedMode);

    switch (action.kind) {
      case 'selectMode': {
        const previousMode = selectedMode;
        selectedMode = action.presetId;
        applyModeSelection();
        if (selectedMode !== previousMode) {
          init.onModeSwitch();
        }
        return;
      }
      case 'start':
        init.onStart(action.presetId);
        return;
      case 'startTraining':
        init.onStartTraining();
        return;
      case 'openSettings':
        init.onOpenSettings();
        return;
      case 'toggleFullscreen':
        init.onToggleFullscreen();
        return;
      case 'openScreen':
        init.onOpenScreen(action.screenId);
        return;
      case 'teaser':
        showMenuFeedback('Coming Soon');
        init.onTeaser(action.controlId);
        return;
    }
  }

  function handleSubscreenControl(control: MenuSubscreenControlLayout): void {
    switch (control.kind) {
      case 'back':
        init.onBackToMainMenu();
        return;
      case 'mode':
        return;
      case 'start':
        if (control.id === 'dungeon-play') {
          init.onStartDungeon();
        }
        return;
    }
  }

  function handleLabStandClick(quality: PetQuality): void {
    if (labDismissingPets.has(quality)) {
      return;
    }

    if (labRevealedPets.has(quality)) {
      dismissLabPet(quality);
      return;
    }

    const stand = labViewModel.stands[quality];
    if (stand.complete) {
      renderLab();
      return;
    }

    const result = init.onPurchasePet(quality);
    if (!result.ok) {
      renderLab();
      return;
    }

    const pet = labViewModel.pets[result.petId];
    if (pet === undefined) {
      throw new Error(`Lab purchase returned unknown pet "${result.petId}"`);
    }
    if (pet.quality !== result.quality) {
      throw new Error(
        `Lab purchase returned ${pet.quality} pet "${pet.petId}" for ${result.quality} stand`
      );
    }
    labRevealedPets.set(result.quality, pet);
    renderLab();
  }

  function dismissLabPet(quality: PetQuality): void {
    labDismissingPets.add(quality);
    renderLab();

    const previousTimeout = labDismissTimeouts.get(quality);
    if (previousTimeout !== undefined) {
      clearMenuTimeout(previousTimeout);
    }

    const timeoutId = setMenuTimeout(() => {
      labDismissTimeouts.delete(quality);
      labDismissingPets.delete(quality);
      labRevealedPets.delete(quality);
      renderLab();
    }, LAB_REVEAL_DISMISS_MS);
    labDismissTimeouts.set(quality, timeoutId);
  }

  function handleOwnedPetClick(petId: string): void {
    const result = init.onSelectPet(petId);
    if (!result.ok) {
      renderPets();
      return;
    }
    renderPets();
  }

  function handleSelectedPetClick(): void {
    if (petsViewModel.selectedPet === null) {
      return;
    }
    init.onClearSelectedPet();
    renderPets();
  }

  function applyModeSelection(): void {
    for (const [presetId, button] of modeButtons.entries()) {
      const selected = presetId === selectedMode;
      button.dataset['selected'] = selected ? 'true' : 'false';
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    }
  }

  function showMenuFeedback(message: string): void {
    activeStage().appendChild(teaserFeedback);
    teaserFeedback.textContent = message;
    teaserFeedback.style.opacity = '1';
    if (feedbackTimeout !== null) {
      clearMenuTimeout(feedbackTimeout);
    }
    feedbackTimeout = setMenuTimeout(() => {
      teaserFeedback.style.opacity = '0';
      feedbackTimeout = null;
    }, TEASER_FEEDBACK_VISIBLE_MS);
  }

  function syncDungeonBestWave(): void {
    if (dungeonBestWaveElement === null) {
      return;
    }
    dungeonBestWaveElement.textContent = dungeonBestWave;
  }

  function renderLab(): void {
    if (labElements === null) {
      return;
    }

    labElements.xpTotal.textContent = `XP ${labViewModel.totalXp}`;
    for (const quality of PET_QUALITIES) {
      renderLabStand(labElements.stands[quality], quality);
    }
  }

  function renderLabStand(button: HTMLButtonElement, quality: PetQuality): void {
    const stand = labViewModel.stands[quality];
    const pet = labRevealedPets.get(quality);
    const state = pet !== undefined ? 'revealed' : stand.complete ? 'complete' : 'price';
    button.dataset['state'] = state;
    button.dataset['affordable'] = stand.affordable ? 'true' : 'false';
    button.dataset['ownedCount'] = String(stand.ownedCount);
    button.dataset['totalCount'] = String(stand.totalCount);
    button.setAttribute('aria-label', labStandAriaLabel(stand, pet));

    if (pet !== undefined) {
      const image = document.createElement('img');
      image.className = labDismissingPets.has(quality)
        ? 'menu-lab-revealed-pet menu-lab-pet-dismiss'
        : 'menu-lab-revealed-pet';
      image.dataset['role'] = 'menu-lab-revealed-pet';
      image.dataset['petId'] = pet.petId;
      image.dataset['quality'] = pet.quality;
      image.src = pet.image;
      image.alt = pet.displayName;
      image.draggable = false;
      image.style.cssText = labPetImageStyle();
      button.replaceChildren(image);
      return;
    }

    const price = document.createElement('span');
    price.dataset['role'] = 'menu-lab-stand-price';
    price.textContent = stand.complete ? 'Complete' : `${stand.price} XP`;
    price.style.cssText = labStandPriceStyle(stand);
    button.replaceChildren(price);
  }

  function renderPets(): void {
    if (petsElements === null) {
      return;
    }

    renderSelectedPet(petsElements.selectedArea);
    for (const quality of PET_QUALITIES) {
      const zone = petsElements.zones[quality];
      zone.replaceChildren(
        ...petsViewModel.inventory[quality].map((pet) =>
          createOwnedPetButton(pet, handleOwnedPetClick)
        )
      );
      zone.dataset['empty'] = petsViewModel.inventory[quality].length === 0 ? 'true' : 'false';
    }
  }

  function renderSelectedPet(button: HTMLButtonElement): void {
    const pet = petsViewModel.selectedPet;
    button.dataset['empty'] = pet === null ? 'true' : 'false';
    if (pet === null) {
      delete button.dataset['petId'];
      delete button.dataset['quality'];
      button.setAttribute('aria-label', 'No companion selected');
      const emptyLabel = document.createElement('span');
      emptyLabel.dataset['role'] = 'menu-pets-selected-empty';
      emptyLabel.textContent = 'No Companion';
      emptyLabel.style.cssText = petsSelectedEmptyStyle();
      button.replaceChildren(emptyLabel);
      return;
    }

    const image = createPetImage(pet, 'menu-pets-selected-image');
    button.dataset['petId'] = pet.petId;
    button.dataset['quality'] = pet.quality;
    button.setAttribute('aria-label', `${pet.displayName} selected`);
    button.replaceChildren(image);
  }

  function activeStage(): HTMLDivElement {
    if (activeScreen === 'main') {
      return mainStage;
    }
    return ensureSubscreenStage(activeScreen);
  }

  function restartAppearAnimations(): void {
    for (const button of controlButtons) {
      button.classList.remove('menu-control-enter');
    }
    for (const button of controlButtons) {
      void button.offsetWidth;
      button.classList.add('menu-control-enter');
    }
  }

  function restartSubscreenAnimations(screenId: MenuScreenId): void {
    for (const button of subscreenButtons.get(screenId) ?? []) {
      button.classList.remove('menu-control-enter');
    }
    for (const button of subscreenButtons.get(screenId) ?? []) {
      void button.offsetWidth;
      button.classList.add('menu-control-enter');
    }
  }

  function restartActiveScreenAnimations(): void {
    if (activeScreen === 'main') {
      restartAppearAnimations();
      return;
    }
    restartSubscreenAnimations(activeScreen);
  }

  function applyScreenVisibility(): void {
    mainStage.style.display = activeScreen === 'main' ? 'block' : 'none';
    for (const [screenId, stage] of subscreenStages.entries()) {
      stage.style.display = activeScreen === screenId ? 'block' : 'none';
    }
  }

  function ensureSubscreenStage(screenId: MenuSubscreenId): HTMLDivElement {
    const existingStage = subscreenStages.get(screenId);
    if (existingStage !== undefined) {
      return existingStage;
    }

    const layout = MENU_SUBSCREENS[screenId];
    const stage = document.createElement('div');
    stage.dataset['role'] = 'menu-subscreen-stage';
    stage.dataset['screenId'] = screenId;
    stage.style.cssText = `${stageStyle(layout.background)};display:none`;

    const buttons: HTMLButtonElement[] = [];
    for (const [index, control] of layout.controls.entries()) {
      const button = createSubscreenControlButton(
        control,
        index,
        handleSubscreenControl,
        init.onButtonHover
      );
      buttons.push(button);
      stage.appendChild(button);
    }
    if (screenId === 'dungeon') {
      dungeonBestWaveElement = createDungeonBestWaveElement();
      syncDungeonBestWave();
      stage.appendChild(dungeonBestWaveElement);
    }
    if (screenId === 'lab') {
      labElements = createLabElements(handleLabStandClick);
      stage.appendChild(labElements.root);
      renderLab();
    }
    if (screenId === 'pets') {
      petsElements = createPetsElements(handleSelectedPetClick);
      stage.appendChild(petsElements.root);
      renderPets();
    }

    subscreenButtons.set(screenId, buttons);
    subscreenStages.set(screenId, stage);
    root.appendChild(stage);
    return stage;
  }
}

function createOnlineModeButton(
  mode: OnlineModeEntry,
  index: number,
  onStartOnline: (presetId: ModePresetId) => void,
  onHover: () => void
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'menu-online-mode-button';
  button.dataset['role'] =
    mode.presetId === 'public-arena' ? 'menu-public-arena-button' : 'menu-online-mode-button';
  button.dataset['presetId'] = mode.presetId;
  button.setAttribute('aria-label', `Join ${mode.displayName}`);
  button.textContent = onlineModeButtonText(mode);
  button.style.cssText = onlineModeButtonStyle(index);
  button.addEventListener('click', () => onStartOnline(mode.presetId));
  button.addEventListener('pointerenter', onHover);
  return button;
}

function onlineModeButtonText(mode: OnlineModeEntry): string {
  return mode.presetId === 'public-arena' ? 'ONLINE ARENA' : mode.displayName.toUpperCase();
}

function createDungeonBestWaveElement(): HTMLDivElement {
  const element = document.createElement('div');
  element.dataset['role'] = 'menu-dungeon-best-wave';
  element.setAttribute('aria-label', 'Max wave');
  element.style.cssText = dungeonBestWaveStyle();
  return element;
}

function setMenuTimeout(callback: () => void, delayMs: number): number {
  return globalThis.setTimeout(callback, delayMs) as unknown as number;
}

function clearMenuTimeout(timeoutId: number): void {
  globalThis.clearTimeout(timeoutId);
}

function createLabElements(
  onStandClick: (quality: PetQuality) => void
): MenuLabElements {
  const root = document.createElement('div');
  root.dataset['role'] = 'menu-lab';
  root.style.cssText = labRootStyle();

  const xpTotal = document.createElement('div');
  xpTotal.dataset['role'] = 'menu-lab-xp-total';
  xpTotal.style.cssText = labXpTotalStyle();
  root.appendChild(xpTotal);

  const stands = {
    green: createLabStandButton('green', onStandClick),
    purple: createLabStandButton('purple', onStandClick)
  } satisfies Record<PetQuality, HTMLButtonElement>;

  for (const quality of PET_QUALITIES) {
    root.appendChild(stands[quality]);
  }

  return {
    root,
    xpTotal,
    stands
  };
}

function createLabStandButton(
  quality: PetQuality,
  onStandClick: (quality: PetQuality) => void
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'menu-lab-stand';
  button.dataset['role'] = 'menu-lab-stand';
  button.dataset['quality'] = quality;
  button.style.cssText = labStandButtonStyle(quality);
  button.addEventListener('click', () => onStandClick(quality));
  return button;
}

function createPetsElements(onSelectedPetClick: () => void): MenuPetsElements {
  const root = document.createElement('div');
  root.dataset['role'] = 'menu-pets';
  root.style.cssText = petsRootStyle();

  const selectedArea = document.createElement('button');
  selectedArea.type = 'button';
  selectedArea.dataset['role'] = 'menu-pets-selected-area';
  selectedArea.className = 'menu-pets-selected-area';
  selectedArea.style.cssText = petsSelectedAreaStyle();
  selectedArea.addEventListener('click', onSelectedPetClick);
  root.appendChild(selectedArea);

  const zones = {
    green: createPetsInventoryZone('green'),
    purple: createPetsInventoryZone('purple')
  } satisfies Record<PetQuality, HTMLDivElement>;

  for (const quality of PET_QUALITIES) {
    root.appendChild(zones[quality]);
  }

  return {
    root,
    selectedArea,
    zones
  };
}

function createPetsInventoryZone(quality: PetQuality): HTMLDivElement {
  const zone = document.createElement('div');
  zone.dataset['role'] = 'menu-pets-inventory-zone';
  zone.dataset['quality'] = quality;
  zone.style.cssText = petsInventoryZoneStyle(quality);
  return zone;
}

function createOwnedPetButton(
  pet: Readonly<{
    petId: string;
    displayName: string;
    quality: PetQuality;
    image: string;
  }>,
  onOwnedPetClick: (petId: string) => void
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset['role'] = 'menu-pets-owned-pet';
  button.dataset['petId'] = pet.petId;
  button.dataset['quality'] = pet.quality;
  button.className = 'menu-pets-owned-pet';
  button.setAttribute('aria-label', pet.displayName);
  button.style.cssText = petsOwnedPetButtonStyle();
  button.appendChild(createPetImage(pet, 'menu-pets-pet-image'));
  button.addEventListener('click', () => onOwnedPetClick(pet.petId));
  return button;
}

function createPetImage(
  pet: Readonly<{ displayName: string; image: string }>,
  role: string
): HTMLImageElement {
  const image = document.createElement('img');
  image.dataset['role'] = role;
  image.src = pet.image;
  image.alt = pet.displayName;
  image.draggable = false;
  image.style.cssText =
    role === 'menu-pets-selected-image' ? petsSelectedPetImageStyle() : petsPetImageStyle();
  return image;
}

function formatDungeonBestWave(bestWave: number): string {
  if (!Number.isFinite(bestWave) || bestWave <= 0) {
    return '0';
  }
  return String(Math.floor(bestWave));
}

function labStandAriaLabel(
  stand: Readonly<{
    quality: PetQuality;
    price: number;
    affordable: boolean;
    complete: boolean;
  }>,
  pet: MenuLabPetViewModel | undefined
): string {
  if (pet !== undefined) {
    return `${pet.displayName} revealed`;
  }
  if (stand.complete) {
    return `${stand.quality} stand complete`;
  }
  return `${stand.quality} stand ${stand.price} XP`;
}

function createStageImage(layout: MenuImageLayout): HTMLImageElement {
  const image = document.createElement('img');
  if (layout.id === 'logo') {
    image.className = 'menu-stage-logo';
  }
  image.dataset['role'] = `menu-${layout.id}`;
  image.alt = layout.alt;
  image.src = layout.src;
  image.draggable = false;
  image.style.cssText = stageImageStyle(layout);
  return image;
}

function createControlButton(
  control: MenuControlLayout,
  index: number,
  onControl: (controlId: MenuControlLayout['id']) => void,
  onHover: () => void
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'menu-image-button';
  button.dataset['role'] = 'menu-image-button';
  button.dataset['controlId'] = control.id;
  button.dataset['controlKind'] = control.kind;
  if (control.kind === 'teaser' || control.id === 'soon') {
    button.dataset['soon'] = 'true';
  }
  button.setAttribute('aria-label', control.label);
  if (isCampaignModeControl(control.id)) {
    button.setAttribute('aria-pressed', 'false');
  }
  button.style.cssText = controlButtonStyle(control, index);

  const image = document.createElement('img');
  image.alt = '';
  image.src = control.src;
  image.draggable = false;
  image.style.cssText = controlImageStyle();
  button.appendChild(image);

  button.addEventListener('click', () => onControl(control.id));
  button.addEventListener('pointerenter', onHover);

  return button;
}

function createSubscreenControlButton(
  control: MenuSubscreenControlLayout,
  index: number,
  onControl: (control: MenuSubscreenControlLayout) => void,
  onHover: () => void
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'menu-image-button';
  button.dataset['role'] = 'menu-subscreen-button';
  button.dataset['controlId'] = control.id;
  button.dataset['controlKind'] = control.kind;
  if (control.selected === true) {
    button.dataset['selected'] = 'true';
    button.setAttribute('aria-pressed', 'true');
    if (control.selectedTone !== undefined) {
      button.dataset['selectedTone'] = control.selectedTone;
    }
  }
  button.setAttribute('aria-label', control.label);
  button.style.cssText = controlButtonStyle(control, index);

  const image = document.createElement('img');
  image.alt = '';
  image.src = control.src;
  image.draggable = false;
  image.style.cssText = controlImageStyle();
  button.appendChild(image);

  button.addEventListener('click', () => onControl(control));
  button.addEventListener('pointerenter', onHover);

  return button;
}

function dungeonBestWaveStyle(): string {
  return [
    'position:absolute',
    'left:31.6%',
    'top:48.2%',
    'width:33.8%',
    'height:27.8%',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'z-index:20',
    'overflow:hidden',
    ...comicTextStyle({
      fontSize: '48px',
      color: '#2a1711',
      textAlign: 'center'
    }),
    'font-size:min(6.2cqw, 8.8cqh, 58px)',
    '-webkit-text-stroke:0',
    'text-shadow:none',
    'pointer-events:none',
    'user-select:none'
  ].join(';');
}

function labRootStyle(): string {
  return [
    'position:absolute',
    'inset:0',
    'z-index:22',
    'pointer-events:none'
  ].join(';');
}

function labXpTotalStyle(): string {
  return [
    'position:absolute',
    'left:4.6%',
    'top:4.2%',
    'min-width:16%',
    'box-sizing:border-box',
    'padding:5px 12px 7px',
    'border:3px solid #050505',
    'border-radius:8px',
    'background:#fff38b',
    'box-shadow:4px 4px 0 #000000',
    ...comicTextStyle({
      fontSize: '20px',
      color: '#ffffff',
      lineHeight: '1',
      textAlign: 'center'
    }),
    'font-size:min(2.8cqw, 4.5cqh, 24px)',
    'pointer-events:none',
    'user-select:none'
  ].join(';');
}

function labStandButtonStyle(quality: PetQuality): string {
  const leftPercent = quality === 'green' ? 19.2 : 57.4;
  const topPercent = quality === 'green' ? 45.6 : 44.8;
  return [
    'appearance:none',
    'position:absolute',
    `left:${leftPercent}%`,
    `top:${topPercent}%`,
    'width:24%',
    'height:33%',
    'display:flex',
    'align-items:flex-start',
    'justify-content:center',
    'box-sizing:border-box',
    'padding:0',
    'margin:0',
    'border:0',
    'background:transparent',
    'cursor:pointer',
    'line-height:1',
    'touch-action:manipulation',
    'pointer-events:auto'
  ].join(';');
}

function labStandPriceStyle(
  stand: Readonly<{ quality: PetQuality; complete: boolean }>
): string {
  return [
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'box-sizing:border-box',
    'min-width:68%',
    'max-width:100%',
    'margin-top:7%',
    'padding:5px 10px 7px',
    `background:${stand.complete ? '#e9fbff' : stand.quality === 'green' ? '#d7f7a2' : '#ead7ff'}`,
    'border:3px solid #050505',
    'border-radius:8px',
    'box-shadow:4px 4px 0 #000000',
    ...comicTextStyle({
      fontSize: stand.complete ? '17px' : '20px',
      color: '#ffffff',
      lineHeight: '1',
      textAlign: 'center'
    }),
    'font-size:min(2.6cqw, 4cqh, 22px)',
    'overflow-wrap:anywhere'
  ].join(';');
}

function labPetImageStyle(): string {
  return [
    'display:block',
    'width:58%',
    'height:58%',
    'margin-top:20%',
    'object-fit:contain',
    'image-rendering:auto',
    'filter:drop-shadow(5px 7px 0 rgba(0,0,0,0.72))',
    'pointer-events:none',
    'user-select:none'
  ].join(';');
}

function petsRootStyle(): string {
  return [
    'position:absolute',
    'inset:0',
    'z-index:22',
    'pointer-events:none'
  ].join(';');
}

function petsSelectedAreaStyle(): string {
  return [
    'appearance:none',
    'position:absolute',
    'left:8.8%',
    'top:5.2%',
    'width:27.6%',
    'height:31.4%',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'box-sizing:border-box',
    'padding:2.2%',
    'border-radius:8px',
    // 'border:3px solid #050505',
    // 'background:rgba(255,255,255,0.9)',
    // 'box-shadow:5px 5px 0 #000000',
    'border:0',
    'background:transparent',
    'box-shadow:none',
    'cursor:pointer',
    'pointer-events:auto',
    'touch-action:manipulation'
  ].join(';');
}

function petsInventoryZoneStyle(quality: PetQuality): string {
  const topPercent = quality === 'green' ? 12.8 : 60.6;
  return [
    'position:absolute',
    'left:56.4%',
    `top:${topPercent}%`,
    'width:34.8%',
    'height:35.2%',
    'display:grid',
    'grid-template-columns:repeat(3, minmax(0, 1fr))',
    'align-content:start',
    'gap:7%',
    'box-sizing:border-box',
    'padding:3.5%',
    'border-radius:8px',
    // 'border:3px solid #050505',
    // `background:${quality === 'green' ? 'rgba(215,247,162,0.78)' : 'rgba(234,215,255,0.78)'}`,
    // 'box-shadow:5px 5px 0 #000000',
    'border:0',
    'background:transparent',
    'box-shadow:none',
    'pointer-events:auto'
  ].join(';');
}

function petsOwnedPetButtonStyle(): string {
  return [
    'appearance:none',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'box-sizing:border-box',
    'min-width:0',
    'aspect-ratio:1',
    'padding:8%',
    'border:3px solid #050505',
    'border-radius:8px',
    'background:#fffdf4',
    'box-shadow:3px 3px 0 #000000',
    'cursor:pointer',
    'touch-action:manipulation'
  ].join(';');
}

function petsPetImageStyle(): string {
  return [
    ...petsPetImageBaseStyle(),
    'width:100%',
    'height:100%'
  ].join(';');
}

function petsSelectedPetImageStyle(): string {
  return [
    ...petsPetImageBaseStyle(),
    'width:42%',
    'height:62%',
    'max-width:180px',
    'max-height:180px'
  ].join(';');
}

function petsPetImageBaseStyle(): ReadonlyArray<string> {
  return [
    'display:block',
    'object-fit:contain',
    'image-rendering:auto',
    'filter:drop-shadow(3px 4px 0 rgba(0,0,0,0.64))',
    'pointer-events:none',
    'user-select:none'
  ];
}

function petsSelectedEmptyStyle(): string {
  return [
    ...comicTextStyle({
      fontSize: '18px',
      color: '#ffffff',
      lineHeight: '1.05',
      textAlign: 'center'
    }),
    'overflow-wrap:anywhere'
  ].join(';');
}

function stageImageStyle(layout: MenuImageLayout): string {
  return [
    'position:absolute',
    `left:${layout.leftPercent}%`,
    `top:${layout.topPercent}%`,
    `width:${layout.widthPercent}%`,
    `aspect-ratio:${layout.aspectRatio}`,
    'display:block',
    'height:auto',
    'object-fit:contain',
    layout.id === 'logo' ? 'pointer-events:auto' : 'pointer-events:none',
    layout.id === 'logo' ? 'cursor:default' : '',
    'user-select:none'
  ].filter(Boolean).join(';');
}

function baseOverlayStyle(): string {
  return [
    'position:fixed',
    'inset:0',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'box-sizing:border-box',
    'overflow:auto',
    'background:#050505',
    'z-index:100',
    'cursor:default',
    'container-type:size'
  ].join(';');
}

function stageStyle(background: string): string {
  return [
    'position:relative',
    `width:min(100cqw, ${MAIN_MENU_STAGE_WIDTH_VH.toFixed(3)}cqh)`,
    `aspect-ratio:${MAIN_MENU_STAGE.width} / ${MAIN_MENU_STAGE.height}`,
    `background-image:url("${background}")`,
    'background-size:100% 100%',
    'background-position:center',
    'background-repeat:no-repeat',
    'container-type:size',
    'overflow:hidden',
    'flex:0 0 auto'
  ].join(';');
}

function controlButtonStyle(
  control: Readonly<{
    leftPercent: number;
    topPercent?: number;
    bottomPercent?: number;
    widthPercent: number;
    aspectRatio: number;
  }>,
  index: number
): string {
  return [
    'appearance:none',
    'position:absolute',
    `left:${control.leftPercent}%`,
    control.bottomPercent === undefined
      ? `top:${control.topPercent ?? 0}%`
      : `bottom:${control.bottomPercent}%`,
    `width:${control.widthPercent}%`,
    `aspect-ratio:${control.aspectRatio}`,
    'display:block',
    'padding:0',
    'margin:0',
    'border:0',
    'background:transparent',
    'cursor:pointer',
    'line-height:0',
    'touch-action:manipulation',
    `animation-delay:${index * 35}ms`
  ].join(';');
}

function controlImageStyle(): string {
  return [
    'display:block',
    'width:100%',
    'height:100%',
    'object-fit:contain',
    'pointer-events:none',
    'user-select:none'
  ].join(';');
}

function teaserFeedbackStyle(): string {
  return [
    'position:absolute',
    'left:50%',
    'top:6%',
    'width:36%',
    'transform:translateX(-50%)',
    'z-index:30',
    'opacity:0',
    ...comicTextStyle({
      fontSize: '40px',
      color: '#f8f0a8',
      textAlign: 'center'
    }),
    'pointer-events:none',
    `transition:opacity ${TEASER_FEEDBACK_FADE_MS}ms ease`
  ].join(';');
}

function onlineModeButtonStyle(index: number): string {
  const leftPercent = index === 0 ? 38 : 38 + index * 19;
  return [
    'appearance:none',
    'position:absolute',
    `left:${leftPercent}%`,
    'top:6.8%',
    'width:24%',
    'min-height:8.8%',
    'z-index:28',
    'box-sizing:border-box',
    'padding:7px 13px 9px',
    'border:4px solid #050505',
    'border-radius:8px',
    'background:#d9fbff',
    'box-shadow:none',
    'cursor:pointer',
    'touch-action:manipulation',
    'letter-spacing:0',
    ...comicTextStyle({
      fontSize: '24px',
      color: '#ffffff',
      lineHeight: '0.95',
      textAlign: 'center'
    }),
    'font-size:min(3cqw, 4.5cqh, 25px)',
    'overflow-wrap:anywhere',
    'white-space:normal'
  ].join(';');
}

function menuSocialLinkRailStyle(): string {
  return [
    'position:absolute',
    'left:3.4%',
    'top:38%',
    'z-index:35',
    'transform:translateY(-50%) scale(0.9)',
    'transform-origin:left center'
  ].join(';');
}

function menuOverlayCss(): string {
  return `
@keyframes menu-control-appear {
  from { opacity: 0; transform: scale(0.5); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes menu-control-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes menu-lab-pet-flip {
  from {
    opacity: 0;
    transform: perspective(420px) rotateY(88deg) scale(0.82);
  }
  58% {
    opacity: 1;
    transform: perspective(420px) rotateY(-8deg) scale(1.08);
  }
  to {
    opacity: 1;
    transform: perspective(420px) rotateY(0deg) scale(1);
  }
}

@keyframes menu-lab-pet-dismiss {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(1.42);
  }
}

@keyframes menu-play-breathe {
  0%, 100% {
    filter: brightness(1) saturate(1);
    transform: scale(1);
  }
  50% {
    filter: brightness(1.12) saturate(1.06);
    transform: scale(1.025);
  }
}

.menu-stage-logo {
  filter:
    brightness(1)
    saturate(1)
    drop-shadow(0 0 0 rgba(124, 245, 143, 0))
    drop-shadow(0 0 0 rgba(125, 199, 255, 0));
  transition: filter 460ms ease-out;
}

.menu-stage-logo:hover {
  filter:
    brightness(1.22)
    saturate(1.14)
    drop-shadow(0 0 10px rgba(124, 245, 143, 0.86))
    drop-shadow(0 0 18px rgba(125, 199, 255, 0.7));
}

.menu-image-button {
  opacity: 1;
  transform: scale(1);
  transition: filter 140ms ease, transform 140ms ease;
  outline: none;
}

.menu-image-button.menu-control-enter {
  animation-name: menu-control-appear;
  animation-duration: 360ms;
  animation-timing-function: cubic-bezier(0.2, 0.9, 0.2, 1.15);
  animation-fill-mode: both;
}

.menu-image-button img {
  transition: filter 140ms ease, transform 140ms ease, opacity 140ms ease;
  filter: none;
}

.menu-image-button:hover img,
.menu-image-button:focus-visible img {
  filter: brightness(1.12) saturate(1.03) drop-shadow(6px 6px 0 #000000);
  transform: translate(-1px, -1px) scale(1.015);
}

.menu-image-button[data-selected="true"] img {
  filter:
    brightness(1.08)
    drop-shadow(3px 0 0 #7cf58f)
    drop-shadow(-3px 0 0 #7cf58f)
    drop-shadow(0 3px 0 #7cf58f)
    drop-shadow(0 -3px 0 #7cf58f)
    drop-shadow(2px 2px 0 #7cf58f)
    drop-shadow(-2px 2px 0 #7cf58f)
    drop-shadow(2px -2px 0 #7cf58f)
    drop-shadow(-2px -2px 0 #7cf58f);
}

.menu-image-button[data-control-id="play"] img {
  animation: menu-play-breathe 1800ms ease-in-out infinite;
}

.menu-lab-stand {
  outline: none;
}

.menu-lab-stand:hover [data-role="menu-lab-stand-price"],
.menu-lab-stand:focus-visible [data-role="menu-lab-stand-price"] {
  filter: brightness(1.1) saturate(1.05);
  transform: translate(-1px, -1px);
}

.menu-lab-stand[data-affordable="false"][data-state="price"] [data-role="menu-lab-stand-price"] {
  opacity: 0.64;
  filter: saturate(0.72);
}

.menu-lab-revealed-pet {
  animation: menu-lab-pet-flip 360ms cubic-bezier(0.2, 0.88, 0.22, 1.18) both;
}

.menu-lab-pet-dismiss {
  animation: menu-lab-pet-dismiss ${LAB_REVEAL_DISMISS_MS}ms ease-in forwards !important;
}

.menu-lab-stand:hover .menu-lab-revealed-pet,
.menu-lab-stand:focus-visible .menu-lab-revealed-pet {
  transform: translateY(-2px) scale(1.04);
}

.menu-pets-owned-pet,
.menu-pets-selected-area {
  outline: none;
}

.menu-pets-owned-pet,
.menu-pets-selected-area {
  transition: filter 140ms ease, transform 140ms ease;
}

.menu-pets-owned-pet:hover,
.menu-pets-owned-pet:focus-visible,
.menu-pets-selected-area[data-empty="false"]:hover,
.menu-pets-selected-area[data-empty="false"]:focus-visible {
  filter: brightness(1.08) saturate(1.04);
  transform: translate(-1px, -1px);
}

.menu-image-button[data-control-id="play"]:hover,
.menu-image-button[data-control-id="play"]:focus-visible {
  filter: drop-shadow(6px 6px 0 #000000);
  transform: translate(-1px, -1px) scale(1.015);
}

.menu-image-button[data-selected="true"]:hover img,
.menu-image-button[data-selected="true"]:focus-visible img {
  animation: none;
  filter:
    brightness(1.14)
    saturate(1.04)
    drop-shadow(3px 0 0 #7cf58f)
    drop-shadow(-3px 0 0 #7cf58f)
    drop-shadow(0 3px 0 #7cf58f)
    drop-shadow(0 -3px 0 #7cf58f)
    drop-shadow(2px 2px 0 #7cf58f)
    drop-shadow(-2px 2px 0 #7cf58f)
    drop-shadow(2px -2px 0 #7cf58f)
    drop-shadow(-2px -2px 0 #7cf58f)
    drop-shadow(6px 6px 0 #000000);
  transform: translate(-1px, -1px) scale(1.015);
}

.menu-image-button[data-selected="true"][data-selected-tone="lava"] img {
  filter:
    brightness(1.08)
    saturate(1.08)
    drop-shadow(3px 0 0 #ff7a1a)
    drop-shadow(-3px 0 0 #ff7a1a)
    drop-shadow(0 3px 0 #ff7a1a)
    drop-shadow(0 -3px 0 #ff7a1a)
    drop-shadow(2px 2px 0 #ffb13d)
    drop-shadow(-2px 2px 0 #ffb13d)
    drop-shadow(2px -2px 0 #d93600)
    drop-shadow(-2px -2px 0 #d93600);
}

.menu-image-button[data-selected="true"][data-selected-tone="lava"]:hover img,
.menu-image-button[data-selected="true"][data-selected-tone="lava"]:focus-visible img {
  filter:
    brightness(1.16)
    saturate(1.12)
    drop-shadow(3px 0 0 #ff7a1a)
    drop-shadow(-3px 0 0 #ff7a1a)
    drop-shadow(0 3px 0 #ff7a1a)
    drop-shadow(0 -3px 0 #ff7a1a)
    drop-shadow(2px 2px 0 #ffb13d)
    drop-shadow(-2px 2px 0 #ffb13d)
    drop-shadow(2px -2px 0 #d93600)
    drop-shadow(-2px -2px 0 #d93600)
    drop-shadow(6px 6px 0 #000000);
}

.menu-image-button[data-soon="true"] img {
  filter: saturate(0.86) brightness(0.92);
}

.menu-image-button[data-soon="true"]:hover img,
.menu-image-button[data-soon="true"]:focus-visible img {
  filter: saturate(1) brightness(1.06) drop-shadow(5px 5px 0 #000000);
}

.menu-online-mode-button {
  outline: none;
  transform: rotate(-1deg);
  transition: filter 140ms ease, transform 140ms ease;
}

.menu-online-mode-button:hover,
.menu-online-mode-button:focus-visible {
  filter: brightness(1.1) saturate(1.04) drop-shadow(6px 6px 0 #000000);
  transform: translate(-1px, -1px) rotate(-1deg) scale(1.015);
}

@media (max-width: 560px) {
  .menu-social-link-rail {
    transform: translateY(-50%) scale(0.78) !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .menu-image-button.menu-control-enter {
    animation-name: menu-control-fade;
    animation-duration: 160ms;
    animation-timing-function: ease;
  }

  .menu-image-button,
  .menu-image-button[data-control-id="play"]:hover,
  .menu-image-button[data-control-id="play"]:focus-visible,
  .menu-image-button:hover img,
  .menu-image-button:focus-visible img {
    transform: none;
  }

  .menu-image-button[data-selected="true"] img {
    filter:
      brightness(1.1)
      drop-shadow(3px 0 0 #7cf58f)
      drop-shadow(-3px 0 0 #7cf58f)
      drop-shadow(0 3px 0 #7cf58f)
      drop-shadow(0 -3px 0 #7cf58f)
      drop-shadow(2px 2px 0 #7cf58f)
      drop-shadow(-2px 2px 0 #7cf58f)
      drop-shadow(2px -2px 0 #7cf58f)
      drop-shadow(-2px -2px 0 #7cf58f);
  }

  .menu-image-button[data-selected="true"][data-selected-tone="lava"] img {
    filter:
      brightness(1.1)
      saturate(1.08)
      drop-shadow(3px 0 0 #ff7a1a)
      drop-shadow(-3px 0 0 #ff7a1a)
      drop-shadow(0 3px 0 #ff7a1a)
      drop-shadow(0 -3px 0 #ff7a1a)
      drop-shadow(2px 2px 0 #ffb13d)
      drop-shadow(-2px 2px 0 #ffb13d)
      drop-shadow(2px -2px 0 #d93600)
      drop-shadow(-2px -2px 0 #d93600);
  }

  .menu-image-button[data-control-id="play"] img {
    animation: none;
  }

  .menu-lab-revealed-pet,
  .menu-lab-pet-dismiss {
    animation: none !important;
  }

  .menu-pets-owned-pet,
  .menu-pets-selected-area {
    transition: none;
  }

  .menu-stage-logo:hover {
    filter:
      brightness(1.18)
      saturate(1.1)
      drop-shadow(0 0 12px rgba(124, 245, 143, 0.72));
  }

  .menu-image-button[data-selected="true"]:hover img,
  .menu-image-button[data-selected="true"]:focus-visible img {
    filter:
      brightness(1.14)
      saturate(1.04)
      drop-shadow(3px 0 0 #7cf58f)
      drop-shadow(-3px 0 0 #7cf58f)
      drop-shadow(0 3px 0 #7cf58f)
      drop-shadow(0 -3px 0 #7cf58f)
      drop-shadow(2px 2px 0 #7cf58f)
      drop-shadow(-2px 2px 0 #7cf58f)
      drop-shadow(2px -2px 0 #7cf58f)
      drop-shadow(-2px -2px 0 #7cf58f)
      drop-shadow(6px 6px 0 #000000);
  }

  .menu-image-button[data-selected="true"][data-selected-tone="lava"]:hover img,
  .menu-image-button[data-selected="true"][data-selected-tone="lava"]:focus-visible img {
    filter:
      brightness(1.16)
      saturate(1.12)
      drop-shadow(3px 0 0 #ff7a1a)
      drop-shadow(-3px 0 0 #ff7a1a)
      drop-shadow(0 3px 0 #ff7a1a)
      drop-shadow(0 -3px 0 #ff7a1a)
      drop-shadow(2px 2px 0 #ffb13d)
      drop-shadow(-2px 2px 0 #ffb13d)
      drop-shadow(2px -2px 0 #d93600)
      drop-shadow(-2px -2px 0 #d93600)
      drop-shadow(6px 6px 0 #000000);
  }
}
`;
}
