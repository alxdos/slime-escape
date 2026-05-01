import type {
  PublicArenaPlayerFormSnapshot,
  PublicArenaPlayerId,
  PublicArenaSnapshot
} from '../../shared/publicArenaProtocol';
import {
  PUBLIC_ARENA_BOSS_ARCHETYPE_ID,
  PUBLIC_ARENA_BOSS_LEVEL,
  PUBLIC_ARENA_SLIME_FORM_CHAIN
} from '../../shared/publicArenaProgression';
import type {
  PlayerSnapshot,
  ProjectileSnapshot,
  Snapshot,
  WeaponHudSnapshot
} from '../../shared/snapshot';

export type PublicArenaOnlineSnapshot = PublicArenaSnapshot | Snapshot;

export type PublicArenaPlayerViewForm =
  | Readonly<{ kind: 'player'; archetypeId: null }>
  | PublicArenaPlayerFormSnapshot;

export type PublicArenaPlayerView = Readonly<{
  id: PublicArenaPlayerId;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  level: number;
  form: PublicArenaPlayerViewForm;
  selectedWeaponIndex: number | null;
  weaponHud: WeaponHudSnapshot | null;
}>;

export type PublicArenaProjectileView = Readonly<
  Omit<ProjectileSnapshot, 'id'> & { id: string }
>;

export type PublicArenaSnapshotView = Readonly<{
  simTimeMs: number;
  population: number;
  players: ReadonlyArray<PublicArenaPlayerView>;
  projectiles: ReadonlyArray<PublicArenaProjectileView>;
}>;

export function publicArenaSnapshotView(
  snapshot: PublicArenaOnlineSnapshot | null
): PublicArenaSnapshotView | null {
  if (snapshot === null) return null;
  if ('entities' in snapshot) return sharedSnapshotView(snapshot);
  return legacySnapshotView(snapshot);
}

export function publicArenaLevelForForm(formArchetypeId: string | null): number {
  if (formArchetypeId === PUBLIC_ARENA_BOSS_ARCHETYPE_ID) return PUBLIC_ARENA_BOSS_LEVEL;
  if (formArchetypeId === null) return 1;
  const chainIndex = PUBLIC_ARENA_SLIME_FORM_CHAIN.indexOf(formArchetypeId);
  return chainIndex < 0 ? 1 : chainIndex + 1;
}

function sharedSnapshotView(snapshot: Snapshot): PublicArenaSnapshotView {
  const players = snapshot.entities
    .filter((entity): entity is PlayerSnapshot => entity.kind === 'player')
    .map(sharedPlayerView);
  return {
    simTimeMs: snapshot.simTimeMs,
    population: players.length,
    players,
    projectiles: snapshot.entities
      .filter((entity): entity is ProjectileSnapshot => entity.kind === 'projectile')
      .map(sharedProjectileView)
  };
}

function sharedPlayerView(player: PlayerSnapshot): PublicArenaPlayerView {
  return {
    id: player.playerId,
    x: player.x,
    y: player.y,
    hp: player.hp,
    maxHp: player.maxHp,
    level: publicArenaLevelForForm(player.formArchetypeId),
    form: publicArenaFormView(player.formArchetypeId),
    selectedWeaponIndex: player.weaponHud?.selectedIndex ?? null,
    weaponHud: player.weaponHud
  };
}

function publicArenaFormView(formArchetypeId: string | null): PublicArenaPlayerViewForm {
  if (formArchetypeId === null) return { kind: 'player', archetypeId: null };
  if (formArchetypeId === PUBLIC_ARENA_BOSS_ARCHETYPE_ID) {
    return { kind: 'boss', archetypeId: formArchetypeId };
  }
  return { kind: 'slime', archetypeId: formArchetypeId };
}

function sharedProjectileView(projectile: ProjectileSnapshot): PublicArenaProjectileView {
  return {
    ...projectile,
    id: String(projectile.id)
  };
}

function legacySnapshotView(snapshot: PublicArenaSnapshot): PublicArenaSnapshotView {
  return {
    simTimeMs: snapshot.simTimeMs,
    population: snapshot.population,
    players: snapshot.players.map((player) => ({ ...player, weaponHud: null })),
    projectiles: snapshot.projectiles.map((projectile) => ({
      ...projectile,
      kind: 'projectile' as const
    }))
  };
}
