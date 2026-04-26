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

  const statusBlock = createBlock('Run');
  const weaponBlock = createBlock('Weapons');
  const bossBlock = createBossBlock();

  root.appendChild(statusBlock.root);
  root.appendChild(weaponBlock.root);
  root.appendChild(bossBlock.root);
  init.parent.appendChild(root);

  let session: SessionDefinition | null = null;

  return {
    attach(nextSession): void {
      session = nextSession;
      root.style.display = 'grid';
      render(
        deriveHudViewModel(nextSession, null),
        statusBlock,
        weaponBlock,
        bossBlock
      );
    },
    update(snapshotPair): void {
      if (session === null) return;
      render(
        deriveHudViewModel(session, snapshotPair.curr),
        statusBlock,
        weaponBlock,
        bossBlock
      );
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

function render(
  viewModel: HudViewModel,
  statusBlock: HudBlock,
  weaponBlock: HudBlock,
  bossBlock: BossHudBlock
): void {
  statusBlock.value.textContent = viewModel.runTimerText;
  statusBlock.meta.textContent = `HP ${viewModel.playerHp.text}`;
  renderWeaponBlock(weaponBlock, viewModel);

  if (viewModel.boss === null) {
    bossBlock.root.style.display = 'none';
    bossBlock.value.textContent = '';
    bossBlock.meta.textContent = '';
    bossBlock.barFill.style.width = '0%';
    return;
  }

  bossBlock.root.style.display = 'flex';
  bossBlock.value.textContent = viewModel.boss.titleText;
  bossBlock.meta.textContent = `${viewModel.boss.phaseText} · ${viewModel.boss.hpText}`;
  bossBlock.barFill.style.width = `${Math.round(viewModel.boss.hpRatio * 100)}%`;
}

function renderWeaponBlock(block: HudBlock, viewModel: HudViewModel): void {
  if (viewModel.weaponSlots.length === 0) {
    block.root.style.display = 'none';
    block.value.textContent = '';
    block.meta.textContent = '';
    return;
  }
  block.root.style.display = 'flex';
  const selected = viewModel.weaponSlots.find((slot) => slot.isSelected);
  if (selected === undefined) {
    block.value.textContent = 'Holstered';
    block.meta.textContent = `${viewModel.weaponSlots.length} slots`;
    return;
  }
  const badgeCount =
    selected.modifierBadges.reduce((total, badge) => total + badge.count, 0) +
    selected.timedBadges.length;
  block.value.textContent = selected.titleText;
  block.meta.textContent = `${selected.hotkeyText} · cooldown ${Math.round(
    selected.cooldownRatio * 100
  )}% · upgrades ${badgeCount}`;
}

type HudBlock = Readonly<{
  root: HTMLElement;
  value: HTMLElement;
  meta: HTMLElement;
}>;

type BossHudBlock = HudBlock &
  Readonly<{
    barFill: HTMLElement;
  }>;

function createBlock(labelText: string): HudBlock {
  const root = document.createElement('section');
  root.style.cssText = blockStyle();

  const label = document.createElement('div');
  label.textContent = labelText;
  label.style.cssText = labelStyle();
  root.appendChild(label);

  const value = document.createElement('div');
  value.style.cssText = valueStyle();
  root.appendChild(value);

  const meta = document.createElement('div');
  meta.style.cssText = metaStyle();
  root.appendChild(meta);

  return { root, value, meta };
}

function createBossBlock(): BossHudBlock {
  const root = document.createElement('section');
  root.style.cssText = blockStyle();
  root.style.display = 'none';

  const label = document.createElement('div');
  label.textContent = 'Boss';
  label.style.cssText = labelStyle();
  root.appendChild(label);

  const value = document.createElement('div');
  value.style.cssText = valueStyle();
  root.appendChild(value);

  const meta = document.createElement('div');
  meta.style.cssText = metaStyle();
  root.appendChild(meta);

  const barTrack = document.createElement('div');
  barTrack.style.cssText = bossBarTrackStyle();
  const barFill = document.createElement('div');
  barFill.style.cssText = bossBarFillStyle();
  barTrack.appendChild(barFill);
  root.appendChild(barTrack);

  return { root, value, meta, barFill };
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
    'bottom:16px',
    'left:16px',
    'right:16px',
    'display:grid',
    'grid-template-columns:repeat(auto-fit, minmax(180px, max-content))',
    'gap:12px',
    'justify-content:center',
    'z-index:30',
    'pointer-events:none'
  ].join(';');
}

function blockStyle(): string {
  return [
    'display:flex',
    'flex-direction:column',
    'gap:4px',
    'padding:12px 14px',
    'background:rgba(10,12,16,0.82)',
    'border:1px solid rgba(154,214,255,0.18)',
    'border-radius:8px',
    'box-shadow:0 8px 24px rgba(0,0,0,0.28)',
    'min-width:180px'
  ].join(';');
}

function labelStyle(): string {
  return [
    'font-size:11px',
    'font-weight:700',
    'letter-spacing:0.08em',
    'text-transform:uppercase',
    'color:#8ca1bf'
  ].join(';');
}

function valueStyle(): string {
  return [
    'font-size:20px',
    'font-weight:700',
    'line-height:1.2',
    'color:#edf3ff'
  ].join(';');
}

function metaStyle(): string {
  return [
    'font-size:13px',
    'line-height:1.4',
    'color:#b7c3d8'
  ].join(';');
}

function bossBarTrackStyle(): string {
  return [
    'width:100%',
    'height:8px',
    'margin-top:4px',
    'background:rgba(255,255,255,0.08)',
    'border-radius:999px',
    'overflow:hidden'
  ].join(';');
}

function bossBarFillStyle(): string {
  return [
    'width:0%',
    'height:100%',
    'background:linear-gradient(90deg, #ff8a7a 0%, #ff5e7a 100%)',
    'border-radius:999px'
  ].join(';');
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}
