import { BOSS_ARCHETYPES, type BossArchetype } from '../../shared/content/bosses';
import type { SessionDefinition } from '../../shared/session';
import type {
  BossHudSnapshot,
  BossSnapshot,
  EncounterSnapshot,
  PlayerSnapshot,
  Snapshot,
  WaveProgressSnapshot
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
  hpText: string;
  encounterIdText: string;
  encounterTypeText: string;
  encounterElapsedText: string;
  waveTitleText: string | null;
  waveProgressText: string | null;
  boss: BossViewModel | null;
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

  const hpBlock = createBlock('HP');
  const encounterBlock = createBlock('Encounter');
  const waveBlock = createBlock('Wave');
  const bossBlock = createBossBlock();

  root.appendChild(hpBlock.root);
  root.appendChild(encounterBlock.root);
  root.appendChild(waveBlock.root);
  root.appendChild(bossBlock.root);
  init.parent.appendChild(root);

  let session: SessionDefinition | null = null;

  return {
    attach(nextSession): void {
      session = nextSession;
      root.style.display = 'grid';
      render(deriveHudViewModel(nextSession, null), hpBlock, encounterBlock, waveBlock, bossBlock);
    },
    update(snapshotPair): void {
      if (session === null) return;
      render(deriveHudViewModel(session, snapshotPair.curr), hpBlock, encounterBlock, waveBlock, bossBlock);
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
  const encounter = snapshot?.encounter ?? null;
  const wave = deriveWaveSummary(session, encounter, snapshot?.waveProgress ?? null);

  return {
    hpText:
      player === null
        ? `-- / ${session.player.maxHp}`
        : `${clampHp(player.hp)} / ${player.maxHp}`,
    encounterIdText: encounter?.id ?? 'waiting',
    encounterTypeText: encounter?.type ?? 'none',
    encounterElapsedText: encounter === null ? '--:--' : formatElapsedMs(encounter.elapsedMs),
    waveTitleText: wave?.title ?? null,
    waveProgressText: wave?.progress ?? null,
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
  hpBlock: HudBlock,
  encounterBlock: HudBlock,
  waveBlock: HudBlock,
  bossBlock: BossHudBlock
): void {
  hpBlock.value.textContent = viewModel.hpText;
  hpBlock.meta.textContent = '';
  encounterBlock.value.textContent = `${viewModel.encounterTypeText} • ${viewModel.encounterIdText}`;
  encounterBlock.meta.textContent = `t=${viewModel.encounterElapsedText}`;

  if (viewModel.waveTitleText === null || viewModel.waveProgressText === null) {
    waveBlock.root.style.display = 'none';
    waveBlock.value.textContent = '';
    waveBlock.meta.textContent = '';
  } else {
    waveBlock.root.style.display = 'flex';
    waveBlock.value.textContent = viewModel.waveTitleText;
    waveBlock.meta.textContent = viewModel.waveProgressText;
  }

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

function deriveWaveSummary(
  session: SessionDefinition,
  encounter: EncounterSnapshot | null,
  waveProgress: WaveProgressSnapshot | null
): Readonly<{ title: string; progress: string }> | null {
  if (encounter === null || waveProgress === null || encounter.type !== 'wave') {
    return null;
  }

  const totalWaves = session.encounters.filter((entry) => entry.type === 'wave').length;
  if (totalWaves === 0) {
    return null;
  }

  const waveNumber = resolveWaveNumber(session, encounter);
  if (waveNumber === null) {
    return null;
  }

  return {
    title: `Волна ${waveNumber} из ${totalWaves}`,
    progress: `Выпущено ${waveProgress.dispatched}/${waveProgress.total} · Живых ${waveProgress.alive}`
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

function formatBossPhaseText(
  bossHud: BossHudSnapshot,
  bossArchetype: BossArchetype | null
): string {
  const phaseCountText =
    bossArchetype === null ? '?' : `${Math.max(1, bossArchetype.phases.length)}`;
  const phaseId = bossArchetype?.phases[bossHud.phaseIndex]?.id ?? bossHud.phaseId;
  return `Фаза ${bossHud.phaseIndex + 1}/${phaseCountText} · ${phaseId}`;
}

function resolveWaveNumber(
  session: SessionDefinition,
  encounter: EncounterSnapshot
): number | null {
  const encounterIndex = resolveEncounterIndex(session, encounter);
  if (encounterIndex === null) {
    return null;
  }

  let waveNumber = 0;
  for (let index = 0; index <= encounterIndex; index += 1) {
    if (session.encounters[index]?.type === 'wave') {
      waveNumber += 1;
    }
  }
  return waveNumber > 0 ? waveNumber : null;
}

function resolveEncounterIndex(
  session: SessionDefinition,
  encounter: EncounterSnapshot
): number | null {
  const fromIndex = session.encounters[encounter.index];
  if (fromIndex?.id === encounter.id) {
    return encounter.index;
  }

  const byId = session.encounters.findIndex((entry) => entry.id === encounter.id);
  return byId >= 0 ? byId : null;
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
    'top:16px',
    'left:16px',
    'right:16px',
    'display:grid',
    'grid-template-columns:repeat(auto-fit, minmax(180px, max-content))',
    'gap:12px',
    'justify-content:start',
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
