import type {
  ArenaHostLobbyJoinedActor,
  PublicArenaRoomState
} from '../../shared/arenaHostProtocol';

import { comicTextStyle } from './comicTextStyle';

export type PublicArenaStatusOverlayInit = Readonly<{
  parent: HTMLElement;
  onBack(): void;
  onLobbyStart?: () => void;
  onLobbyTransferHost?: (targetActorId: string) => void;
}>;

export type PublicArenaStatusLobbyViewModel = Readonly<{
  sessionDisplayName: string;
  roomId: string;
  selfActorId: string;
  state: PublicArenaRoomState;
  joined: ReadonlyArray<ArenaHostLobbyJoinedActor>;
  hostActorId: string;
  maxPlayers: number;
  lateJoinAllowed: boolean;
}>;

export type PublicArenaStatusOverlay = Readonly<{
  show(message: string): void;
  showLobby(viewModel: PublicArenaStatusLobbyViewModel): void;
  hide(): void;
  isVisible(): boolean;
  dispose(): void;
}>;

export function createPublicArenaStatusOverlay(
  init: PublicArenaStatusOverlayInit
): PublicArenaStatusOverlay {
  const root = document.createElement('div');
  root.dataset['role'] = 'public-arena-status-overlay';
  root.style.cssText = rootStyle();

  const message = document.createElement('div');
  message.dataset['role'] = 'public-arena-status-message';
  message.style.cssText = messageStyle();
  root.appendChild(message);

  const lobby = document.createElement('section');
  lobby.dataset['role'] = 'online-lobby';
  lobby.style.cssText = lobbyStyle();
  root.appendChild(lobby);

  const back = document.createElement('button');
  back.type = 'button';
  back.dataset['role'] = 'public-arena-back';
  back.textContent = 'Back';
  back.style.cssText = backButtonStyle();
  back.addEventListener('click', init.onBack);
  root.appendChild(back);

  init.parent.appendChild(root);

  let visible = false;
  root.style.display = 'none';

  return {
    show(nextMessage): void {
      visible = true;
      message.textContent = nextMessage;
      message.style.display = 'block';
      lobby.style.display = 'none';
      back.textContent = 'Back';
      root.style.display = 'flex';
    },
    showLobby(viewModel): void {
      visible = true;
      message.style.display = 'none';
      lobby.style.display = 'grid';
      back.textContent = 'Leave';
      renderLobby(lobby, viewModel, init);
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

function renderLobby(
  lobby: HTMLElement,
  viewModel: PublicArenaStatusLobbyViewModel,
  init: PublicArenaStatusOverlayInit
): void {
  lobby.replaceChildren(
    createLobbyTitle(viewModel),
    createLobbyMeta(viewModel),
    createLobbyRoster(viewModel, init),
    createLobbyActions(viewModel, init)
  );
}

function createLobbyTitle(viewModel: PublicArenaStatusLobbyViewModel): HTMLElement {
  const title = document.createElement('h1');
  title.dataset['role'] = 'online-lobby-title';
  title.textContent = viewModel.sessionDisplayName;
  title.style.cssText = lobbyTitleStyle();
  return title;
}

function createLobbyMeta(viewModel: PublicArenaStatusLobbyViewModel): HTMLElement {
  const meta = document.createElement('div');
  meta.dataset['role'] = 'online-lobby-meta';
  meta.textContent = `Room ${viewModel.roomId} - ${viewModel.joined.length}/${viewModel.maxPlayers}`;
  meta.style.cssText = lobbyMetaStyle();
  return meta;
}

function createLobbyRoster(
  viewModel: PublicArenaStatusLobbyViewModel,
  init: PublicArenaStatusOverlayInit
): HTMLElement {
  const roster = document.createElement('div');
  roster.dataset['role'] = 'online-lobby-roster';
  roster.style.cssText = lobbyRosterStyle();
  for (const actor of viewModel.joined) {
    roster.appendChild(createLobbyRosterRow(actor, viewModel, init));
  }
  return roster;
}

function createLobbyRosterRow(
  actor: ArenaHostLobbyJoinedActor,
  viewModel: PublicArenaStatusLobbyViewModel,
  init: PublicArenaStatusOverlayInit
): HTMLElement {
  const row = document.createElement('div');
  row.dataset['role'] = 'online-lobby-player';
  row.dataset['actorId'] = actor.actorId;
  row.dataset['host'] = actor.actorId === viewModel.hostActorId ? 'true' : 'false';
  row.dataset['self'] = actor.actorId === viewModel.selfActorId ? 'true' : 'false';
  row.style.cssText = lobbyRosterRowStyle(actor.actorId === viewModel.selfActorId);

  const label = document.createElement('span');
  label.textContent = lobbyPlayerLabel(actor, viewModel);
  label.style.cssText = lobbyPlayerLabelStyle();
  row.appendChild(label);

  if (viewModel.selfActorId === viewModel.hostActorId && actor.actorId !== viewModel.selfActorId) {
    const transfer = document.createElement('button');
    transfer.type = 'button';
    transfer.dataset['role'] = 'online-lobby-transfer-host';
    transfer.dataset['targetActorId'] = actor.actorId;
    transfer.textContent = 'Transfer';
    transfer.style.cssText = lobbySmallButtonStyle();
    transfer.addEventListener('click', () => init.onLobbyTransferHost?.(actor.actorId));
    row.appendChild(transfer);
  }

  return row;
}

function createLobbyActions(
  viewModel: PublicArenaStatusLobbyViewModel,
  init: PublicArenaStatusOverlayInit
): HTMLElement {
  const actions = document.createElement('div');
  actions.dataset['role'] = 'online-lobby-actions';
  actions.style.cssText = lobbyActionsStyle();

  if (viewModel.selfActorId === viewModel.hostActorId && viewModel.state === 'open') {
    const start = document.createElement('button');
    start.type = 'button';
    start.dataset['role'] = 'online-lobby-start';
    start.textContent = 'Start';
    start.style.cssText = lobbyPrimaryButtonStyle();
    start.addEventListener('click', () => init.onLobbyStart?.());
    actions.appendChild(start);
  }

  return actions;
}

function lobbyPlayerLabel(
  actor: ArenaHostLobbyJoinedActor,
  viewModel: PublicArenaStatusLobbyViewModel
): string {
  const parts = [actor.actorId];
  if (actor.actorId === viewModel.selfActorId) parts.push('you');
  if (actor.actorId === viewModel.hostActorId) parts.push('host');
  if (actor.petArchetypeId !== null) parts.push(actor.petArchetypeId);
  return parts.length === 1 ? parts[0]! : `${parts[0]} (${parts.slice(1).join(', ')})`;
}

function rootStyle(): string {
  return [
    'position:fixed',
    'inset:0',
    'z-index:95',
    'display:none',
    'align-items:center',
    'justify-content:center',
    'flex-direction:column',
    'gap:22px',
    'box-sizing:border-box',
    'padding:24px',
    'background:#050505',
    'pointer-events:auto'
  ].join(';');
}

function messageStyle(): string {
  return [
    'max-width:min(720px, 88vw)',
    ...comicTextStyle({
      fontSize: '34px',
      color: '#fff38b',
      lineHeight: '1.05',
      textAlign: 'center'
    }),
    'font-size:min(34px, 8vw)',
    'overflow-wrap:anywhere'
  ].join(';');
}

function lobbyStyle(): string {
  return [
    'display:none',
    'width:min(720px, 92vw)',
    'box-sizing:border-box',
    'grid-template-columns:1fr',
    'gap:14px',
    'padding:18px',
    'border:4px solid #050505',
    'border-radius:8px',
    'background:#fffdf4',
    'box-shadow:7px 7px 0 #000000'
  ].join(';');
}

function lobbyTitleStyle(): string {
  return [
    'margin:0',
    ...comicTextStyle({
      fontSize: '30px',
      color: '#ffffff',
      lineHeight: '1',
      textAlign: 'center'
    }),
    'font-size:min(30px, 7vw)',
    'overflow-wrap:anywhere'
  ].join(';');
}

function lobbyMetaStyle(): string {
  return [
    ...comicTextStyle({
      fontSize: '16px',
      color: '#2a1711',
      lineHeight: '1.2',
      textAlign: 'center'
    }),
    '-webkit-text-stroke:0',
    'text-shadow:none',
    'overflow-wrap:anywhere'
  ].join(';');
}

function lobbyRosterStyle(): string {
  return ['display:grid', 'grid-template-columns:1fr', 'gap:8px'].join(';');
}

function lobbyRosterRowStyle(isSelf: boolean): string {
  return [
    'display:flex',
    'align-items:center',
    'justify-content:space-between',
    'gap:10px',
    'min-height:38px',
    'box-sizing:border-box',
    'padding:8px 10px',
    'border:3px solid #050505',
    'border-radius:8px',
    `background:${isSelf ? '#d9fbff' : '#f4f7d7'}`
  ].join(';');
}

function lobbyPlayerLabelStyle(): string {
  return [
    'min-width:0',
    ...comicTextStyle({
      fontSize: '16px',
      color: '#2a1711',
      lineHeight: '1',
      textAlign: 'left'
    }),
    '-webkit-text-stroke:0',
    'text-shadow:none',
    'overflow-wrap:anywhere'
  ].join(';');
}

function lobbyActionsStyle(): string {
  return ['display:flex', 'justify-content:center', 'min-height:42px'].join(';');
}

function lobbyPrimaryButtonStyle(): string {
  return [
    'appearance:none',
    'min-width:132px',
    'box-sizing:border-box',
    'padding:10px 18px 12px',
    'border:4px solid #050505',
    'border-radius:8px',
    'background:#fff38b',
    'box-shadow:5px 5px 0 #000000',
    'cursor:pointer',
    ...comicTextStyle({
      fontSize: '22px',
      color: '#ffffff',
      lineHeight: '1',
      textAlign: 'center'
    })
  ].join(';');
}

function lobbySmallButtonStyle(): string {
  return [
    'appearance:none',
    'flex:0 0 auto',
    'box-sizing:border-box',
    'padding:6px 10px 8px',
    'border:3px solid #050505',
    'border-radius:8px',
    'background:#d7f7a2',
    'box-shadow:3px 3px 0 #000000',
    'cursor:pointer',
    ...comicTextStyle({
      fontSize: '14px',
      color: '#ffffff',
      lineHeight: '1',
      textAlign: 'center'
    })
  ].join(';');
}

function backButtonStyle(): string {
  return [
    'appearance:none',
    'min-width:128px',
    'box-sizing:border-box',
    'padding:10px 18px 12px',
    'border:4px solid #050505',
    'border-radius:8px',
    'background:#fffdf4',
    'box-shadow:5px 5px 0 #000000',
    'cursor:pointer',
    ...comicTextStyle({
      fontSize: '22px',
      color: '#ffffff',
      lineHeight: '1',
      textAlign: 'center'
    })
  ].join(';');
}
