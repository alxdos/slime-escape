import { BOSS_ARCHETYPES, type BossArchetype } from '../../shared/content/bosses';
import { WEAPON_ARCHETYPES, type WeaponModifier } from '../../shared/content/weapons';
import type { SessionDefinition } from '../../shared/session';
import type {
  BossHudSnapshot,
  BossSnapshot,
  PlayerSnapshot,
  Snapshot
} from '../../shared/snapshot';
import { DROP_VISUALS } from '../render/dropVisuals';
import { PROJECTILE_VISUALS } from '../render/projectileVisuals';
import type { SpriteVisualSpec } from '../render/SpriteVisualSpec';
import type { SnapshotPair } from '../sim/SimWorkerHost';

import { COMIC_TEXT_FONT_FAMILY, comicTextStyle } from './comicTextStyle';

export type HudInit = Readonly<{
  parent: HTMLElement;
  isMobile?: boolean;
}>;

export type Hud = Readonly<{
  attach(session: SessionDefinition): void;
  update(snapshotPair: SnapshotPair): void;
  detach(): void;
  dispose(): void;
}>;

export type HudViewModel = Readonly<{
  runTimerText: string;
  playerHp: PlayerHpViewModel;
  weaponSlots: ReadonlyArray<WeaponSlotViewModel>;
  selectedWeaponIndex: number | null;
  boss: BossViewModel | null;
}>;

export type PlayerHpViewModel = Readonly<{
  text: string;
  current: number | null;
  max: number;
  ratio: number;
}>;

export type WeaponSlotViewModel = Readonly<{
  index: number;
  hotkeyText: string;
  weaponArchetypeId: string;
  titleText: string;
  projectileImage: string;
  isSelected: boolean;
  cooldownRatio: number;
  modifierBadges: ReadonlyArray<WeaponModifierBadgeViewModel>;
  timedBadges: ReadonlyArray<WeaponTimedBadgeViewModel>;
}>;

export type WeaponModifierBadgeViewModel = Readonly<{
  kind: WeaponModifier['kind'];
  count: number;
  image: string;
}>;

export type WeaponTimedBadgeViewModel = Readonly<{
  kind: 'temporaryOverdrive';
  remainingRatio: number;
  image: string;
}>;

export type BossViewModel = Readonly<{
  titleText: string;
  phaseText: string;
  hpText: string;
  hpRatio: number;
}>;

export type HudVisualRegistries = Readonly<{
  projectileVisuals: Readonly<Record<string, Pick<SpriteVisualSpec, 'image'>>>;
  dropVisuals: Readonly<Record<string, Pick<SpriteVisualSpec, 'image'>>>;
}>;

const DEFAULT_HUD_VISUAL_REGISTRIES: HudVisualRegistries = {
  projectileVisuals: PROJECTILE_VISUALS,
  dropVisuals: DROP_VISUALS
};

const MODIFIER_BADGE_DROP_IDS: Readonly<Record<WeaponModifier['kind'], string>> = {
  projectileSizeMultiplier: 'size-up',
  projectileSpeedMultiplier: 'speed-up',
  symmetricProjectileMultiplier: 'multi-shot',
  pierceBonus: 'pierce',
  fragmentExplosion: 'fragment'
};

const TIMED_EFFECT_BADGE_DROP_IDS: Readonly<Record<WeaponTimedBadgeViewModel['kind'], string>> = {
  temporaryOverdrive: 'overdrive'
};

export function createHud(init: HudInit): Hud {
  const root = document.createElement('div');
  root.dataset['role'] = 'hud';
  root.style.cssText = rootStyle();
  root.style.display = 'none';

  const hudDom = createHudDom(root, init.isMobile === true);
  const renderState = createHudRenderState();

  init.parent.appendChild(root);

  let session: SessionDefinition | null = null;
  let lastRenderedSnapshot: Snapshot | null | undefined;

  return {
    attach(nextSession): void {
      session = nextSession;
      root.style.display = 'block';
      resetHudRenderState(renderState);
      render(deriveHudViewModel(nextSession, null), hudDom, renderState);
      lastRenderedSnapshot = null;
    },
    update(snapshotPair): void {
      if (session === null) return;
      if (lastRenderedSnapshot === snapshotPair.curr) return;
      render(deriveHudViewModel(session, snapshotPair.curr), hudDom, renderState);
      lastRenderedSnapshot = snapshotPair.curr;
    },
    detach(): void {
      session = null;
      lastRenderedSnapshot = undefined;
      root.style.display = 'none';
    },
    dispose(): void {
      root.remove();
    }
  };
}

export function deriveHudViewModel(
  session: SessionDefinition,
  snapshot: Snapshot | null,
  visualRegistries: HudVisualRegistries = DEFAULT_HUD_VISUAL_REGISTRIES
): HudViewModel {
  const player = snapshot === null ? null : findPlayerSnapshot(snapshot);

  return {
    runTimerText: formatElapsedMs(snapshot?.simTimeMs ?? 0),
    playerHp: derivePlayerHp(session, player),
    weaponSlots: deriveWeaponSlots(snapshot, visualRegistries),
    selectedWeaponIndex: player?.weaponHud?.selectedIndex ?? null,
    boss: deriveBossSummary(snapshot)
  };
}

export function formatElapsedMs(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${pad2(minutes)}:${pad2(seconds)}`;
}

function render(viewModel: HudViewModel, dom: HudDom, state: HudRenderState): void {
  setTextContent(dom.timer, viewModel.runTimerText, 'timerText', state);
  setTextContent(dom.hpText, viewModel.playerHp.text, 'hpText', state);
  setStyleWidth(
    dom.hpFill,
    `${Math.round(viewModel.playerHp.ratio * 100)}%`,
    'hpFillWidth',
    state
  );
  renderBossStrip(viewModel.boss, dom, state);
  renderHudWeaponSlots(viewModel.weaponSlots, dom.weaponBar, state.weaponBar);
}

type HudDom = Readonly<{
  timer: HTMLElement;
  hpText: HTMLElement;
  hpFill: HTMLElement;
  bossStrip: HTMLElement;
  bossTitle: HTMLElement;
  bossMeta: HTMLElement;
  bossFill: HTMLElement;
  weaponBar: HTMLElement;
}>;

type HudRenderState = {
  timerText: string | null;
  hpText: string | null;
  hpFillWidth: string | null;
  bossVisible: boolean | null;
  bossTitle: string | null;
  bossMeta: string | null;
  bossFillWidth: string | null;
  weaponBar: HudWeaponBarRenderState;
};

type HudTextStateKey = 'timerText' | 'hpText' | 'bossTitle' | 'bossMeta';
type HudWidthStateKey = 'hpFillWidth' | 'bossFillWidth';

export type HudWeaponBarRenderState = {
  signature: string | null;
  display: string | null;
  slots: WeaponSlotDom[];
};

type WeaponSlotDom = {
  root: HTMLElement;
  frame: HTMLElement;
  hotkey: HTMLElement;
  cooldownFill: HTMLElement;
  image: HTMLImageElement;
  badges: HTMLElement;
  modifierBadges: Map<WeaponModifier['kind'], ModifierBadgeDom>;
  timedBadges: Map<WeaponTimedBadgeViewModel['kind'], TimedBadgeDom>;
  badgeOrderSignature: string | null;
  isSelected: boolean | null;
  hotkeyText: string | null;
  projectileImage: string | null;
  cooldownHeight: string | null;
};

type ModifierBadgeDom = {
  root: HTMLElement;
  image: HTMLImageElement;
  imageSrc: string;
  count: HTMLElement | null;
  countText: string | null;
};

type TimedBadgeDom = {
  root: HTMLElement;
  fill: HTMLElement;
  image: HTMLImageElement;
  imageSrc: string;
  remainingHeight: string | null;
};

function createHudRenderState(): HudRenderState {
  return {
    timerText: null,
    hpText: null,
    hpFillWidth: null,
    bossVisible: null,
    bossTitle: null,
    bossMeta: null,
    bossFillWidth: null,
    weaponBar: createHudWeaponBarRenderState()
  };
}

function resetHudRenderState(state: HudRenderState): void {
  state.timerText = null;
  state.hpText = null;
  state.hpFillWidth = null;
  state.bossVisible = null;
  state.bossTitle = null;
  state.bossMeta = null;
  state.bossFillWidth = null;
  state.weaponBar.signature = null;
  state.weaponBar.display = null;
  state.weaponBar.slots = [];
}

function createHudDom(root: HTMLElement, isMobile: boolean): HudDom {
  const topLeft = document.createElement('section');
  topLeft.dataset['role'] = 'hud-run-status';
  topLeft.style.cssText = topLeftStatusStyle();
  const timer = document.createElement('div');
  timer.style.cssText = timerStyle();
  const hpRow = document.createElement('div');
  hpRow.style.cssText = hpRowStyle();
  const hpText = document.createElement('span');
  hpText.style.cssText = hpTextStyle();
  const hpTrack = document.createElement('div');
  hpTrack.style.cssText = hpTrackStyle();
  const hpFill = document.createElement('div');
  hpFill.style.cssText = hpFillStyle();
  hpTrack.appendChild(hpFill);
  hpRow.appendChild(hpText);
  hpRow.appendChild(hpTrack);
  topLeft.appendChild(timer);
  topLeft.appendChild(hpRow);
  root.appendChild(topLeft);

  const bossStrip = document.createElement('section');
  bossStrip.dataset['role'] = 'hud-boss-strip';
  bossStrip.style.cssText = bossStripStyle();
  const bossTitle = document.createElement('div');
  bossTitle.style.cssText = bossTitleStyle();
  const bossMeta = document.createElement('div');
  bossMeta.style.cssText = bossMetaStyle();
  const bossTrack = document.createElement('div');
  bossTrack.style.cssText = bossBarTrackStyle();
  const bossFill = document.createElement('div');
  bossFill.style.cssText = bossBarFillStyle();
  bossTrack.appendChild(bossFill);
  bossStrip.appendChild(bossTitle);
  bossStrip.appendChild(bossMeta);
  bossStrip.appendChild(bossTrack);
  root.appendChild(bossStrip);

  root.appendChild(createHudMovementHint(isMobile));

  const weaponBar = createHudWeaponBarElement();
  root.appendChild(weaponBar);

  root.appendChild(createHudFireHint(isMobile));

  return { timer, hpText, hpFill, bossStrip, bossTitle, bossMeta, bossFill, weaponBar };
}

function renderBossStrip(
  viewModel: BossViewModel | null,
  dom: HudDom,
  state: HudRenderState
): void {
  if (viewModel === null) {
    if (state.bossVisible === false) return;
    dom.bossStrip.style.display = 'none';
    state.bossVisible = false;
    setTextContent(dom.bossTitle, '', 'bossTitle', state);
    setTextContent(dom.bossMeta, '', 'bossMeta', state);
    setStyleWidth(dom.bossFill, '0%', 'bossFillWidth', state);
    return;
  }
  if (state.bossVisible !== true) {
    dom.bossStrip.style.display = 'grid';
    state.bossVisible = true;
  }
  setTextContent(dom.bossTitle, viewModel.titleText, 'bossTitle', state);
  setTextContent(dom.bossMeta, `${viewModel.phaseText} · ${viewModel.hpText}`, 'bossMeta', state);
  setStyleWidth(
    dom.bossFill,
    `${Math.round(viewModel.hpRatio * 100)}%`,
    'bossFillWidth',
    state
  );
}

function setTextContent(
  element: HTMLElement,
  value: string,
  key: HudTextStateKey,
  state: HudRenderState
): void {
  if (state[key] === value) return;
  element.textContent = value;
  state[key] = value;
}

function setStyleWidth(
  element: HTMLElement,
  value: string,
  key: HudWidthStateKey,
  state: HudRenderState
): void {
  if (state[key] === value) return;
  element.style.width = value;
  state[key] = value;
}

export function renderHudWeaponSlots(
  slots: ReadonlyArray<WeaponSlotViewModel>,
  weaponBar: HTMLElement,
  state: HudWeaponBarRenderState
): void {
  const signature = weaponSlotsSignature(slots);
  if (state.signature !== signature) {
    state.slots = slots.map(createWeaponSlotElement);
    weaponBar.replaceChildren(...state.slots.map((slot) => slot.root));
    state.signature = signature;
  }
  const display = slots.length === 0 ? 'none' : 'flex';
  if (state.display !== display) {
    weaponBar.style.display = display;
    state.display = display;
  }
  for (let i = 0; i < slots.length; i += 1) {
    const slot = slots[i];
    const slotDom = state.slots[i];
    if (slot === undefined || slotDom === undefined) continue;
    updateWeaponSlotElement(slot, slotDom);
  }
}

function ratioHeight(ratio: number): string {
  return `${Math.round(clampRatio(ratio) * 100)}%`;
}

function applyWeaponSlotSelectedState(frame: HTMLElement, isSelected: boolean): void {
  frame.style.borderColor = isSelected ? 'rgba(255,255,255,0.94)' : 'rgba(255,255,255,0.18)';
  frame.style.background = isSelected ? 'rgba(30,39,62,0.82)' : 'rgba(5,8,14,0.56)';
  frame.style.boxShadow = isSelected
    ? '0 0 0 3px rgba(125,211,252,0.22), 0 10px 26px rgba(0,0,0,0.3)'
    : '0 8px 22px rgba(0,0,0,0.24)';
}

function weaponSlotsSignature(slots: ReadonlyArray<WeaponSlotViewModel>): string {
  return slots.map((slot) => `${slot.index}:${slot.weaponArchetypeId}`).join('|');
}

function createWeaponSlotElement(slot: WeaponSlotViewModel): WeaponSlotDom {
  const root = document.createElement('div');
  root.dataset['weaponSlot'] = String(slot.index);
  root.style.cssText = weaponSlotWrapperStyle();

  const badges = document.createElement('div');
  badges.style.cssText = weaponBadgeRowStyle();
  root.appendChild(badges);

  const frame = document.createElement('div');
  frame.style.cssText = weaponSlotStyle();

  const hotkey = document.createElement('span');
  hotkey.style.cssText = weaponSlotHotkeyStyle();
  frame.appendChild(hotkey);

  const cooldownFill = document.createElement('div');
  cooldownFill.style.cssText = cooldownFillStyle();
  frame.appendChild(cooldownFill);

  const image = document.createElement('img');
  image.alt = '';
  image.draggable = false;
  image.style.cssText = weaponSlotImageStyle();
  frame.appendChild(image);

  root.appendChild(frame);

  const dom: WeaponSlotDom = {
    root,
    frame,
    hotkey,
    cooldownFill,
    image,
    badges,
    modifierBadges: new Map(),
    timedBadges: new Map(),
    badgeOrderSignature: null,
    isSelected: null,
    hotkeyText: null,
    projectileImage: null,
    cooldownHeight: null
  };
  updateWeaponSlotElement(slot, dom);
  return dom;
}

function updateWeaponSlotElement(slot: WeaponSlotViewModel, dom: WeaponSlotDom): void {
  if (dom.isSelected !== slot.isSelected) {
    applyWeaponSlotSelectedState(dom.frame, slot.isSelected);
    dom.isSelected = slot.isSelected;
  }
  if (dom.hotkeyText !== slot.hotkeyText) {
    dom.hotkey.textContent = slot.hotkeyText;
    dom.hotkeyText = slot.hotkeyText;
  }
  if (dom.projectileImage !== slot.projectileImage) {
    dom.image.src = slot.projectileImage;
    dom.projectileImage = slot.projectileImage;
  }
  const cooldownHeight = ratioHeight(slot.cooldownRatio);
  if (dom.cooldownHeight !== cooldownHeight) {
    dom.cooldownFill.style.height = cooldownHeight;
    dom.cooldownHeight = cooldownHeight;
  }
  renderWeaponBadges(slot.modifierBadges, slot.timedBadges, dom);
}

function renderWeaponBadges(
  modifierBadges: ReadonlyArray<WeaponModifierBadgeViewModel>,
  timedBadges: ReadonlyArray<WeaponTimedBadgeViewModel>,
  slotDom: WeaponSlotDom
): void {
  const nextKinds = new Set<WeaponModifier['kind']>();
  const orderedBadges: HTMLElement[] = [];
  for (const badge of modifierBadges) {
    nextKinds.add(badge.kind);
    let badgeDom = slotDom.modifierBadges.get(badge.kind);
    if (badgeDom === undefined) {
      badgeDom = createModifierBadgeElement(badge);
      slotDom.modifierBadges.set(badge.kind, badgeDom);
    } else {
      updateModifierBadgeElement(badge, badgeDom);
    }
    orderedBadges.push(badgeDom.root);
  }
  for (const kind of slotDom.modifierBadges.keys()) {
    if (!nextKinds.has(kind)) {
      slotDom.modifierBadges.delete(kind);
    }
  }
  const nextTimedKinds = new Set<WeaponTimedBadgeViewModel['kind']>();
  for (const badge of timedBadges) {
    nextTimedKinds.add(badge.kind);
    let badgeDom = slotDom.timedBadges.get(badge.kind);
    if (badgeDom === undefined) {
      badgeDom = createTimedBadgeElement(badge);
      slotDom.timedBadges.set(badge.kind, badgeDom);
    } else {
      updateTimedBadgeElement(badge, badgeDom);
    }
    orderedBadges.push(badgeDom.root);
  }
  for (const kind of slotDom.timedBadges.keys()) {
    if (!nextTimedKinds.has(kind)) {
      slotDom.timedBadges.delete(kind);
    }
  }
  const badgeOrderSignature = [
    ...modifierBadges.map((badge) => `m:${badge.kind}`),
    ...timedBadges.map((badge) => `t:${badge.kind}`)
  ].join('|');
  if (slotDom.badgeOrderSignature !== badgeOrderSignature) {
    slotDom.badges.replaceChildren(...orderedBadges);
    slotDom.badgeOrderSignature = badgeOrderSignature;
  }
}

function createModifierBadgeElement(badge: WeaponModifierBadgeViewModel): ModifierBadgeDom {
  const root = createBadgeShell();
  const image = createBadgeImage(badge.image);
  root.appendChild(image);
  const dom: ModifierBadgeDom = {
    root,
    image,
    imageSrc: badge.image,
    count: null,
    countText: null
  };
  syncModifierBadgeCount(badge.count, dom);
  return dom;
}

function updateModifierBadgeElement(
  badge: WeaponModifierBadgeViewModel,
  dom: ModifierBadgeDom
): void {
  if (dom.imageSrc !== badge.image) {
    dom.image.src = badge.image;
    dom.imageSrc = badge.image;
  }
  syncModifierBadgeCount(badge.count, dom);
}

function syncModifierBadgeCount(countValue: number, dom: ModifierBadgeDom): void {
  if (countValue > 1) {
    if (dom.count === null) {
      dom.count = document.createElement('span');
      dom.count.style.cssText = badgeCountStyle();
      dom.root.appendChild(dom.count);
    }
    const countText = String(countValue);
    if (dom.countText !== countText) {
      dom.count.textContent = countText;
      dom.countText = countText;
    }
  } else if (dom.count !== null) {
    dom.count.remove();
    dom.count = null;
    dom.countText = null;
  }
}

function createTimedBadgeElement(badge: WeaponTimedBadgeViewModel): TimedBadgeDom {
  const root = createBadgeShell();
  const fill = document.createElement('div');
  fill.style.cssText = timedBadgeFillStyle();
  root.appendChild(fill);
  const image = createBadgeImage(badge.image);
  root.appendChild(image);
  const remainingHeight = ratioHeight(badge.remainingRatio);
  const dom: TimedBadgeDom = {
    root,
    fill,
    image,
    imageSrc: badge.image,
    remainingHeight
  };
  fill.style.height = remainingHeight;
  return dom;
}

function updateTimedBadgeElement(badge: WeaponTimedBadgeViewModel, dom: TimedBadgeDom): void {
  if (dom.imageSrc !== badge.image) {
    dom.image.src = badge.image;
    dom.imageSrc = badge.image;
  }
  const remainingHeight = ratioHeight(badge.remainingRatio);
  if (dom.remainingHeight !== remainingHeight) {
    dom.fill.style.height = remainingHeight;
    dom.remainingHeight = remainingHeight;
  }
}

function createBadgeShell(): HTMLElement {
  const root = document.createElement('div');
  root.style.cssText = badgeShellStyle();
  return root;
}

function createBadgeImage(src: string): HTMLImageElement {
  const image = document.createElement('img');
  image.src = src;
  image.alt = '';
  image.draggable = false;
  image.style.cssText = badgeImageStyle();
  return image;
}

export function createHudWeaponBarRenderState(): HudWeaponBarRenderState {
  return {
    signature: null,
    display: null,
    slots: []
  };
}

export function createHudWeaponBarElement(): HTMLElement {
  const weaponBar = document.createElement('section');
  weaponBar.dataset['role'] = 'hud-weapon-bar';
  weaponBar.style.cssText = weaponBarStyle();
  return weaponBar;
}

export function createHudMovementHint(isMobile: boolean): HTMLElement {
  const root = document.createElement('section');
  root.dataset['role'] = 'hud-movement-hint';
  root.style.cssText = movementHintStyle();
  if (isMobile) {
    root.style.display = 'none';
  }
  for (const key of ['W', 'A', 'S', 'D']) {
    const keycap = document.createElement('span');
    keycap.textContent = key;
    keycap.dataset['key'] = key;
    keycap.style.cssText = keycapStyle(key);
    root.appendChild(keycap);
  }
  return root;
}

export function createHudFireHint(isMobile: boolean): HTMLElement {
  const root = document.createElement('section');
  root.dataset['role'] = 'hud-fire-hint';
  root.style.cssText = fireHintStyle();
  if (isMobile) {
    root.style.display = 'none';
  }
  const mouse = document.createElement('span');
  mouse.setAttribute('aria-hidden', 'true');
  mouse.style.cssText = mouseIconStyle();
  const button = document.createElement('span');
  button.style.cssText = mouseButtonStyle();
  mouse.appendChild(button);
  const label = document.createElement('span');
  label.textContent = 'Left click: shoot';
  label.style.cssText = fireHintTextStyle();
  root.appendChild(mouse);
  root.appendChild(label);
  return root;
}

function derivePlayerHp(session: SessionDefinition, player: PlayerSnapshot | null): PlayerHpViewModel {
  const max = player?.maxHp ?? session.players[0].maxHp;
  const current = player === null ? null : clampHp(player.hp);
  return {
    text: current === null ? `-- / ${max}` : `${current} / ${max}`,
    current,
    max,
    ratio: current === null || max <= 0 ? 0 : clampRatio(current / max)
  };
}

function deriveBossSummary(snapshot: Snapshot | null): BossViewModel | null {
  const bossHud = snapshot?.bossHud ?? null;
  if (bossHud === null) {
    return null;
  }

  const bossEntity = snapshot === null ? null : findBossSnapshot(snapshot, bossHud.entityId);
  const bossArchetype =
    bossEntity === null ? null : BOSS_ARCHETYPES[bossEntity.archetypeId] ?? null;

  return {
    titleText: bossArchetype?.displayName ?? 'Boss',
    phaseText: formatBossPhaseText(bossHud, bossArchetype),
    hpText: `${clampHp(bossHud.hp)} / ${bossHud.maxHp}`,
    hpRatio: clampRatio(bossHud.maxHp <= 0 ? 0 : bossHud.hp / bossHud.maxHp)
  };
}

function deriveWeaponSlots(
  snapshot: Snapshot | null,
  visualRegistries: HudVisualRegistries
): ReadonlyArray<WeaponSlotViewModel> {
  const player = snapshot === null ? null : findPlayerSnapshot(snapshot);
  const weaponHud = player?.weaponHud ?? null;
  if (weaponHud === null) return [];
  const simTimeMs = snapshot?.simTimeMs ?? 0;
  return [...weaponHud.weapons]
    .sort((a, b) => a.index - b.index)
    .map((weapon) => {
      const archetype = WEAPON_ARCHETYPES[weapon.weaponArchetypeId];
      return {
        index: weapon.index,
        hotkeyText: `${weapon.index + 1}`,
        weaponArchetypeId: weapon.weaponArchetypeId,
        titleText: archetype?.displayName ?? weapon.weaponArchetypeId,
        projectileImage: requireVisualImage(
          visualRegistries.projectileVisuals,
          weapon.weaponArchetypeId,
          'projectile'
        ),
        isSelected: weaponHud.selectedIndex === weapon.index,
        cooldownRatio: deriveCooldownRatio(
          weapon.cooldownStartedAtSimMs,
          weapon.cooldownReadyAtSimMs,
          simTimeMs
        ),
        modifierBadges: groupModifierBadges(weapon.modifiers, visualRegistries),
        timedBadges: weapon.timedEffects.map((effect) => ({
          kind: effect.kind,
          remainingRatio: deriveTimedEffectRemainingRatio(
            effect.startedAtSimMs,
            effect.expiresAtSimMs,
            simTimeMs
          ),
          image: requireVisualImage(
            visualRegistries.dropVisuals,
            TIMED_EFFECT_BADGE_DROP_IDS[effect.kind],
            'drop badge'
          )
        }))
      };
    });
}

function deriveCooldownRatio(
  cooldownStartedAtSimMs: number,
  cooldownReadyAtSimMs: number,
  simTimeMs: number
): number {
  if (simTimeMs >= cooldownReadyAtSimMs) return 0;
  const durationMs = Math.max(1, cooldownReadyAtSimMs - cooldownStartedAtSimMs);
  return clampRatio((cooldownReadyAtSimMs - simTimeMs) / durationMs);
}

function deriveTimedEffectRemainingRatio(
  startedAtSimMs: number,
  expiresAtSimMs: number,
  simTimeMs: number
): number {
  if (simTimeMs >= expiresAtSimMs) return 0;
  const durationMs = Math.max(1, expiresAtSimMs - startedAtSimMs);
  return clampRatio((expiresAtSimMs - simTimeMs) / durationMs);
}

function groupModifierBadges(
  modifiers: ReadonlyArray<WeaponModifier>,
  visualRegistries: HudVisualRegistries
): ReadonlyArray<WeaponModifierBadgeViewModel> {
  const badges = new Map<WeaponModifier['kind'], WeaponModifierBadgeViewModel>();
  for (const modifier of modifiers) {
    const existing = badges.get(modifier.kind);
    if (existing === undefined) {
      badges.set(modifier.kind, {
        kind: modifier.kind,
        count: 1,
        image: requireVisualImage(
          visualRegistries.dropVisuals,
          MODIFIER_BADGE_DROP_IDS[modifier.kind],
          'drop badge'
        )
      });
    } else {
      badges.set(modifier.kind, {
        kind: existing.kind,
        count: existing.count + 1,
        image: existing.image
      });
    }
  }
  return [...badges.values()];
}

function requireVisualImage(
  visuals: Readonly<Record<string, Pick<SpriteVisualSpec, 'image'>>>,
  archetypeId: string,
  area: string
): string {
  const visual = visuals[archetypeId];
  if (visual === undefined) {
    throw new Error(`${area} visual missing for HUD archetype "${archetypeId}"`);
  }
  return visual.image;
}

function formatBossPhaseText(
  bossHud: BossHudSnapshot,
  bossArchetype: BossArchetype | null
): string {
  const phaseCountText =
    bossArchetype === null ? '?' : `${Math.max(1, bossArchetype.phases.length)}`;
  const phaseId = bossArchetype?.phases[bossHud.phaseIndex]?.id ?? bossHud.phaseId;
  return `Phase ${bossHud.phaseIndex + 1}/${phaseCountText} · ${phaseId}`;
}

function findPlayerSnapshot(snapshot: Snapshot): PlayerSnapshot | null {
  for (const entity of snapshot.entities) {
    if (entity.kind === 'player') {
      return entity;
    }
  }
  return null;
}

function findBossSnapshot(snapshot: Snapshot, entityId: number): BossSnapshot | null {
  for (const entity of snapshot.entities) {
    if (entity.kind === 'boss' && entity.id === entityId) {
      return entity;
    }
  }
  return null;
}

function clampHp(hp: number): number {
  return Math.max(0, Math.floor(hp));
}

function clampRatio(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function rootStyle(): string {
  return [
    'position:fixed',
    'inset:0',
    'z-index:30',
    'pointer-events:none',
    `font-family:${COMIC_TEXT_FONT_FAMILY}`,
    'color:#eef4ff'
  ].join(';');
}

function topLeftStatusStyle(): string {
  return [
    'position:fixed',
    'top:42px',
    'left:56px',
    'display:none',
    'gap:6px',
    'min-width:118px',
    'padding:8px 10px',
    'border:1px solid rgba(255,255,255,0.16)',
    'border-radius:8px',
    'background:rgba(5,8,14,0.58)',
    'box-shadow:0 8px 22px rgba(0,0,0,0.22)',
    'backdrop-filter:blur(8px)'
  ].join(';');
}

function timerStyle(): string {
  return [
    ...comicTextStyle({
      fontSize: '22px',
      fontWeight: 900,
      lineHeight: '1',
      color: '#ffffff'
    }),
    'font-variant-numeric:tabular-nums',
    'font-feature-settings:"tnum"'
  ].join(';');
}

function hpRowStyle(): string {
  return [
    'display:grid',
    'grid-template-columns:max-content 64px',
    'align-items:center',
    'gap:8px'
  ].join(';');
}

function hpTextStyle(): string {
  return [
    ...comicTextStyle({
      fontSize: '12px',
      fontWeight: 800,
      lineHeight: '1.2',
      color: '#dff4ff'
    }),
    'font-variant-numeric:tabular-nums',
    'font-feature-settings:"tnum"',
    'white-space:nowrap'
  ].join(';');
}

function hpTrackStyle(): string {
  return [
    'height:6px',
    'border-radius:4px',
    'overflow:hidden',
    'background:rgba(255,255,255,0.14)'
  ].join(';');
}

function hpFillStyle(): string {
  return [
    'height:100%',
    'width:0%',
    'border-radius:4px',
    'background:#6ee7a8'
  ].join(';');
}

function bossStripStyle(): string {
  return [
    'position:fixed',
    'top:14px',
    'left:50%',
    'transform:translateX(-50%)',
    'display:none',
    'grid-template-columns:minmax(0, 1fr) max-content',
    'grid-template-rows:auto 8px',
    'align-items:center',
    'gap:5px 12px',
    'width:min(520px, 56%)',
    'padding:8px 12px',
    'border:1px solid rgba(255,255,255,0.16)',
    'border-radius:8px',
    'background:rgba(7,9,14,0.62)',
    'box-shadow:0 8px 22px rgba(0,0,0,0.24)',
    'backdrop-filter:blur(8px)'
  ].join(';');
}

function bossTitleStyle(): string {
  return [
    'min-width:0',
    ...comicTextStyle({
      fontSize: '14px',
      fontWeight: 900,
      lineHeight: '1.15',
      color: '#ffffff'
    }),
    'white-space:nowrap',
    'overflow:hidden',
    'text-overflow:ellipsis'
  ].join(';');
}

function bossMetaStyle(): string {
  return [
    ...comicTextStyle({
      fontSize: '11px',
      fontWeight: 800,
      lineHeight: '1.15',
      color: '#d6f6ff'
    }),
    'white-space:nowrap',
    'font-variant-numeric:tabular-nums',
    'font-feature-settings:"tnum"'
  ].join(';');
}

function bossBarTrackStyle(): string {
  return [
    'grid-column:1 / -1',
    'width:100%',
    'height:8px',
    'background:rgba(255,255,255,0.08)',
    'border-radius:6px',
    'overflow:hidden'
  ].join(';');
}

function bossBarFillStyle(): string {
  return [
    'width:0%',
    'height:100%',
    'background:linear-gradient(90deg, #ff7a90 0%, #ffd166 100%)',
    'border-radius:6px'
  ].join(';');
}

function movementHintStyle(): string {
  return [
    'position:fixed',
    'left:64px',
    'bottom:48px',
    'display:grid',
    'grid-template-columns:repeat(3, 34px)',
    'grid-template-rows:repeat(2, 34px)',
    'gap:5px',
    'opacity:0.62'
  ].join(';');
}

function keycapStyle(key: string): string {
  const gridColumn = key === 'W' ? '2' : key === 'A' ? '1' : key === 'S' ? '2' : '3';
  const gridRow = key === 'W' ? '1' : '2';
  return [
    `grid-column:${gridColumn}`,
    `grid-row:${gridRow}`,
    'display:grid',
    'place-items:center',
    'width:34px',
    'height:34px',
    'border:1px solid rgba(255,255,255,0.22)',
    'border-radius:7px',
    'background:rgba(6,10,18,0.54)',
    'box-shadow:0 5px 14px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.08)',
    ...comicTextStyle({
      fontSize: '13px',
      fontWeight: 900,
      lineHeight: '1',
      color: '#f5f8ff'
    })
  ].join(';');
}

function weaponBarStyle(): string {
  return [
    'position:fixed',
    'left:50%',
    'bottom:40px',
    'transform:translateX(-50%)',
    'display:none',
    'align-items:end',
    'justify-content:center',
    'gap:8px',
    'max-width:min(72%, 620px)',
    'padding:8px',
    'overflow:visible'
  ].join(';');
}

function weaponSlotWrapperStyle(): string {
  return [
    'position:relative',
    'width:58px',
    'height:80px',
    'box-sizing:border-box',
    'flex:0 0 58px',
    'display:flex',
    'align-items:end',
    'justify-content:center'
  ].join(';');
}

function weaponBadgeRowStyle(): string {
  return [
    'position:absolute',
    'left:0',
    'right:0',
    'top:0',
    'height:22px',
    'display:flex',
    'align-items:end',
    'justify-content:center',
    'gap:2px',
    'overflow:visible'
  ].join(';');
}

function weaponSlotStyle(): string {
  return [
    'position:relative',
    'display:grid',
    'place-items:center',
    'width:58px',
    'height:58px',
    'box-sizing:border-box',
    'border-radius:8px',
    'border:2px solid rgba(255,255,255,0.18)',
    'background:rgba(5,8,14,0.56)',
    'box-shadow:0 8px 22px rgba(0,0,0,0.24)',
    'backdrop-filter:blur(8px)',
    'overflow:hidden'
  ].join(';');
}

function weaponSlotHotkeyStyle(): string {
  return [
    'position:absolute',
    'top:4px',
    'left:5px',
    ...comicTextStyle({
      fontSize: '11px',
      fontWeight: 900,
      lineHeight: '1',
      color: '#dfe8f8'
    }),
    'font-variant-numeric:tabular-nums',
    'font-feature-settings:"tnum"'
  ].join(';');
}

function weaponSlotImageStyle(): string {
  return [
    'position:relative',
    'z-index:1',
    'max-width:38px',
    'max-height:38px',
    'object-fit:contain',
    'filter:drop-shadow(0 2px 5px rgba(0,0,0,0.38))'
  ].join(';');
}

function cooldownFillStyle(): string {
  return [
    'position:absolute',
    'left:0',
    'right:0',
    'bottom:0',
    'height:0%',
    'background:rgba(126,188,255,0.26)',
    'z-index:0'
  ].join(';');
}

function badgeShellStyle(): string {
  return [
    'position:relative',
    'width:18px',
    'height:18px',
    'box-sizing:border-box',
    'border-radius:4px',
    'border:1px solid rgba(255,255,255,0.24)',
    'background:rgba(5,8,14,0.68)',
    'box-shadow:0 4px 10px rgba(0,0,0,0.24)',
    'overflow:hidden'
  ].join(';');
}

function badgeImageStyle(): string {
  return [
    'position:relative',
    'z-index:1',
    'display:block',
    'width:100%',
    'height:100%',
    'object-fit:contain'
  ].join(';');
}

function badgeCountStyle(): string {
  return [
    'position:absolute',
    'right:1px',
    'bottom:0',
    'z-index:2',
    ...comicTextStyle({
      fontSize: '9px',
      fontWeight: 900,
      lineHeight: '1',
      color: '#ffffff'
    }),
    'font-variant-numeric:tabular-nums',
    'font-feature-settings:"tnum"'
  ].join(';');
}

function timedBadgeFillStyle(): string {
  return [
    'position:absolute',
    'left:0',
    'right:0',
    'bottom:0',
    'height:0%',
    'background:rgba(126,188,255,0.34)',
    'z-index:0'
  ].join(';');
}

function fireHintStyle(): string {
  return [
    'position:fixed',
    'right:64px',
    'bottom:54px',
    'display:flex',
    'align-items:center',
    'gap:8px',
    'padding:8px 10px',
    'border:1px solid rgba(255,255,255,0.14)',
    'border-radius:8px',
    'background:rgba(5,8,14,0.48)',
    'opacity:0.7',
    'box-shadow:0 6px 18px rgba(0,0,0,0.2)'
  ].join(';');
}

function mouseIconStyle(): string {
  return [
    'position:relative',
    'display:inline-block',
    'width:18px',
    'height:28px',
    'box-sizing:border-box',
    'border:2px solid rgba(255,255,255,0.84)',
    'border-radius:10px 10px 8px 8px'
  ].join(';');
}

function mouseButtonStyle(): string {
  return [
    'position:absolute',
    'top:4px',
    'left:4px',
    'width:4px',
    'height:8px',
    'border-radius:3px',
    'background:rgba(255,255,255,0.86)'
  ].join(';');
}

function fireHintTextStyle(): string {
  return [
    ...comicTextStyle({
      fontSize: '13px',
      fontWeight: 900,
      lineHeight: '1',
      color: '#f4f8ff'
    }),
    'white-space:nowrap',
  ].join(';');
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}
