import { BOSS_ARCHETYPES, type BossArchetype } from '../../shared/content/bosses';
import { WEAPON_ARCHETYPES, type WeaponModifier } from '../../shared/content/weapons';
import type { SessionDefinition } from '../../shared/session';
import type {
  BossHudSnapshot,
  BossSnapshot,
  PlayerSnapshot,
  Snapshot
} from '../../shared/snapshot';
import type { SnapshotPair } from '../sim/SimWorkerHost';

export type HudInit = Readonly<{
  parent: HTMLElement;
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
  isSelected: boolean;
  cooldownRatio: number;
  modifierBadges: ReadonlyArray<WeaponModifierBadgeViewModel>;
  timedBadges: ReadonlyArray<WeaponTimedBadgeViewModel>;
}>;

export type WeaponModifierBadgeViewModel = Readonly<{
  kind: WeaponModifier['kind'];
  count: number;
}>;

export type WeaponTimedBadgeViewModel = Readonly<{
  kind: 'temporaryOverdrive';
  remainingRatio: number;
}>;

export type BossViewModel = Readonly<{
  titleText: string;
  phaseText: string;
  hpText: string;
  hpRatio: number;
}>;

export function createHud(init: HudInit): Hud {
  const root = document.createElement('div');
  root.dataset['role'] = 'hud';
  root.style.cssText = rootStyle();
  root.style.display = 'none';

  const hudDom = createHudDom(root);

  init.parent.appendChild(root);

  let session: SessionDefinition | null = null;

  return {
    attach(nextSession): void {
      session = nextSession;
      root.style.display = 'block';
      render(deriveHudViewModel(nextSession, null), hudDom);
    },
    update(snapshotPair): void {
      if (session === null) return;
      render(deriveHudViewModel(session, snapshotPair.curr), hudDom);
    },
    detach(): void {
      session = null;
      root.style.display = 'none';
    },
    dispose(): void {
      root.remove();
    }
  };
}

export function deriveHudViewModel(
  session: SessionDefinition,
  snapshot: Snapshot | null
): HudViewModel {
  const player = snapshot === null ? null : findPlayerSnapshot(snapshot);

  return {
    runTimerText: formatElapsedMs(snapshot?.simTimeMs ?? 0),
    playerHp: derivePlayerHp(session, player),
    weaponSlots: deriveWeaponSlots(snapshot),
    selectedWeaponIndex: snapshot?.weaponHud?.selectedIndex ?? null,
    boss: deriveBossSummary(snapshot)
  };
}

export function formatElapsedMs(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${pad2(minutes)}:${pad2(seconds)}`;
}

function render(viewModel: HudViewModel, dom: HudDom): void {
  dom.timer.textContent = viewModel.runTimerText;
  dom.hpText.textContent = viewModel.playerHp.text;
  dom.hpFill.style.width = `${Math.round(viewModel.playerHp.ratio * 100)}%`;
  renderBossStrip(viewModel.boss, dom);
  renderWeaponSlots(viewModel.weaponSlots, dom.weaponBar);
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

function createHudDom(root: HTMLElement): HudDom {
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

  root.appendChild(createMovementHint());

  const weaponBar = document.createElement('section');
  weaponBar.dataset['role'] = 'hud-weapon-bar';
  weaponBar.style.cssText = weaponBarStyle();
  root.appendChild(weaponBar);

  root.appendChild(createFireHint());

  return { timer, hpText, hpFill, bossStrip, bossTitle, bossMeta, bossFill, weaponBar };
}

function renderBossStrip(viewModel: BossViewModel | null, dom: HudDom): void {
  if (viewModel === null) {
    dom.bossStrip.style.display = 'none';
    dom.bossTitle.textContent = '';
    dom.bossMeta.textContent = '';
    dom.bossFill.style.width = '0%';
    return;
  }
  dom.bossStrip.style.display = 'grid';
  dom.bossTitle.textContent = viewModel.titleText;
  dom.bossMeta.textContent = `${viewModel.phaseText} · ${viewModel.hpText}`;
  dom.bossFill.style.width = `${Math.round(viewModel.hpRatio * 100)}%`;
}

function renderWeaponSlots(
  slots: ReadonlyArray<WeaponSlotViewModel>,
  weaponBar: HTMLElement
): void {
  weaponBar.replaceChildren(...slots.map(createWeaponSlotElement));
  weaponBar.style.display = slots.length === 0 ? 'none' : 'flex';
}

function createWeaponSlotElement(slot: WeaponSlotViewModel): HTMLElement {
  const root = document.createElement('div');
  root.dataset['weaponSlot'] = String(slot.index);
  root.dataset['selected'] = slot.isSelected ? 'true' : 'false';
  root.style.cssText = weaponSlotStyle(slot.isSelected);

  const hotkey = document.createElement('span');
  hotkey.textContent = slot.hotkeyText;
  hotkey.style.cssText = weaponSlotHotkeyStyle();
  root.appendChild(hotkey);

  const placeholder = document.createElement('span');
  placeholder.textContent = weaponPlaceholderText(slot.titleText);
  placeholder.style.cssText = weaponSlotPlaceholderStyle();
  root.appendChild(placeholder);

  return root;
}

function createMovementHint(): HTMLElement {
  const root = document.createElement('section');
  root.dataset['role'] = 'hud-movement-hint';
  root.style.cssText = movementHintStyle();
  for (const key of ['W', 'A', 'S', 'D']) {
    const keycap = document.createElement('span');
    keycap.textContent = key;
    keycap.dataset['key'] = key;
    keycap.style.cssText = keycapStyle(key);
    root.appendChild(keycap);
  }
  return root;
}

function createFireHint(): HTMLElement {
  const root = document.createElement('section');
  root.dataset['role'] = 'hud-fire-hint';
  root.style.cssText = fireHintStyle();
  const mouse = document.createElement('span');
  mouse.setAttribute('aria-hidden', 'true');
  mouse.style.cssText = mouseIconStyle();
  const button = document.createElement('span');
  button.style.cssText = mouseButtonStyle();
  mouse.appendChild(button);
  const label = document.createElement('span');
  label.textContent = 'ЛКМ: выстрел';
  label.style.cssText = fireHintTextStyle();
  root.appendChild(mouse);
  root.appendChild(label);
  return root;
}

function derivePlayerHp(session: SessionDefinition, player: PlayerSnapshot | null): PlayerHpViewModel {
  const max = player?.maxHp ?? session.player.maxHp;
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

function deriveWeaponSlots(snapshot: Snapshot | null): ReadonlyArray<WeaponSlotViewModel> {
  const weaponHud = snapshot?.weaponHud ?? null;
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
        isSelected: weaponHud.selectedIndex === weapon.index,
        cooldownRatio: deriveCooldownRatio(
          weapon.cooldownStartedAtSimMs,
          weapon.cooldownReadyAtSimMs,
          simTimeMs
        ),
        modifierBadges: groupModifierBadges(weapon.modifiers),
        timedBadges: weapon.timedEffects.map((effect) => ({
          kind: effect.kind,
          remainingRatio: deriveTimedEffectRemainingRatio(
            effect.startedAtSimMs,
            effect.expiresAtSimMs,
            simTimeMs
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
  modifiers: ReadonlyArray<WeaponModifier>
): ReadonlyArray<WeaponModifierBadgeViewModel> {
  const badges: WeaponModifierBadgeViewModel[] = [];
  for (const modifier of modifiers) {
    const existing = badges.find((badge) => badge.kind === modifier.kind);
    if (existing === undefined) {
      badges.push({ kind: modifier.kind, count: 1 });
    } else {
      badges[badges.indexOf(existing)] = { kind: existing.kind, count: existing.count + 1 };
    }
  }
  return badges;
}

function formatBossPhaseText(
  bossHud: BossHudSnapshot,
  bossArchetype: BossArchetype | null
): string {
  const phaseCountText =
    bossArchetype === null ? '?' : `${Math.max(1, bossArchetype.phases.length)}`;
  const phaseId = bossArchetype?.phases[bossHud.phaseIndex]?.id ?? bossHud.phaseId;
  return `Фаза ${bossHud.phaseIndex + 1}/${phaseCountText} · ${phaseId}`;
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
    'font-family:Inter, ui-sans-serif, system-ui, sans-serif',
    'color:#eef4ff'
  ].join(';');
}

function topLeftStatusStyle(): string {
  return [
    'position:fixed',
    'top:14px',
    'left:14px',
    'display:grid',
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
    'font:700 22px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    'font-variant-numeric:tabular-nums',
    'letter-spacing:0',
    'color:#ffffff',
    'text-shadow:0 1px 8px rgba(0,0,0,0.45)'
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
    'font:700 12px/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    'font-variant-numeric:tabular-nums',
    'letter-spacing:0',
    'color:#c9d7e8',
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
    'width:min(520px, 56vw)',
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
    'font-size:14px',
    'font-weight:800',
    'line-height:1.15',
    'white-space:nowrap',
    'overflow:hidden',
    'text-overflow:ellipsis',
    'color:#ffffff'
  ].join(';');
}

function bossMetaStyle(): string {
  return [
    'font-size:11px',
    'font-weight:700',
    'line-height:1.15',
    'white-space:nowrap',
    'color:#d6dfef'
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
    'left:16px',
    'bottom:16px',
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
    'font-size:13px',
    'font-weight:800',
    'line-height:1',
    'color:#f5f8ff'
  ].join(';');
}

function weaponBarStyle(): string {
  return [
    'position:fixed',
    'left:50%',
    'bottom:16px',
    'transform:translateX(-50%)',
    'display:none',
    'align-items:end',
    'justify-content:center',
    'gap:8px',
    'max-width:min(72vw, 620px)',
    'padding:8px',
    'overflow:hidden'
  ].join(';');
}

function weaponSlotStyle(isSelected: boolean): string {
  return [
    'position:relative',
    'display:grid',
    'place-items:center',
    'width:58px',
    'height:58px',
    'box-sizing:border-box',
    'flex:0 0 58px',
    'border-radius:8px',
    `border:${isSelected ? '2px solid rgba(255,255,255,0.92)' : '1px solid rgba(255,255,255,0.18)'}`,
    `background:${isSelected ? 'rgba(36,44,62,0.78)' : 'rgba(5,8,14,0.54)'}`,
    'box-shadow:0 8px 22px rgba(0,0,0,0.24)',
    'overflow:hidden'
  ].join(';');
}

function weaponSlotHotkeyStyle(): string {
  return [
    'position:absolute',
    'top:4px',
    'left:5px',
    'font:700 11px/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    'font-variant-numeric:tabular-nums',
    'letter-spacing:0',
    'color:#dfe8f8'
  ].join(';');
}

function weaponSlotPlaceholderStyle(): string {
  return [
    'max-width:44px',
    'padding:0 4px',
    'box-sizing:border-box',
    'font-size:11px',
    'font-weight:800',
    'line-height:1.1',
    'text-align:center',
    'color:#eef4ff',
    'overflow:hidden',
    'text-overflow:ellipsis'
  ].join(';');
}

function fireHintStyle(): string {
  return [
    'position:fixed',
    'right:16px',
    'bottom:18px',
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
    'font-size:13px',
    'font-weight:800',
    'line-height:1',
    'white-space:nowrap',
    'color:#f4f8ff'
  ].join(';');
}

function weaponPlaceholderText(titleText: string): string {
  return titleText
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}
