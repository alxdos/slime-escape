import type { SessionResultSummary } from './sessionResult.js';

export type RuntimeEvent =
  | { kind: 'sessionStart'; simTime: number }
  | { kind: 'sessionStop'; simTime: number }
  | { kind: 'encounterStart'; simTime: number }
  | { kind: 'encounterEnd'; simTime: number }
  | { kind: 'pause'; simTime: number }
  | { kind: 'resume'; simTime: number }
  | {
      kind: 'fire';
      simTime: number;
      shooterId: number;
      ownerKind: 'player' | 'companion' | 'enemy' | 'boss';
      weaponArchetypeId: string;
      originX: number;
      originY: number;
      dirX: number;
      dirY: number;
    }
  | {
      kind: 'hit';
      simTime: number;
      projectileId: number;
      ownerId: number;
      ownerKind: 'player' | 'companion' | 'enemy' | 'boss';
      targetId: number;
      targetKind: 'enemy' | 'player' | 'companion' | 'boss';
      targetArchetypeId: string | null;
      weaponArchetypeId: string;
      damage: number;
      impactDirX: number;
      impactDirY: number;
      x: number;
      y: number;
    }
  | {
      kind: 'explosion';
      simTime: number;
      projectileId: number;
      ownerId: number;
      ownerKind: 'player' | 'companion' | 'enemy' | 'boss';
      weaponArchetypeId: string;
      damage: number;
      radius: number;
      x: number;
      y: number;
    }
  | {
      kind: 'death';
      simTime: number;
      entityId: number;
      entityKind: 'enemy' | 'player' | 'boss';
      archetypeId: string | null;
      weaponArchetypeId: string | null;
      impactDirX: number | null;
      impactDirY: number | null;
      killerId: number | null;
      x: number;
      y: number;
    }
  | {
      kind: 'playerSpawn';
      simTime: number;
      entityId: number;
      playerId: string;
      x: number;
      y: number;
      formArchetypeId: string | null;
    }
  | {
      kind: 'playerDowned';
      simTime: number;
      entityId: number;
      playerId: string;
      weaponArchetypeId: string | null;
      impactDirX: number | null;
      impactDirY: number | null;
      x: number;
      y: number;
    }
  | {
      kind: 'playerRevived';
      simTime: number;
      entityId: number;
      playerId: string;
      rescuerEntityId: number;
      rescuerPlayerId: string;
      hp: number;
      maxHp: number;
      x: number;
      y: number;
    }
  | {
      kind: 'companionDowned';
      simTime: number;
      companionId: number;
      petArchetypeId: string;
      weaponArchetypeId: string | null;
      impactDirX: number | null;
      impactDirY: number | null;
      x: number;
      y: number;
    }
  | {
      kind: 'companionBoop';
      simTime: number;
      companionId: number;
      targetId: number;
      targetKind: 'enemy' | 'boss';
      x: number;
      y: number;
      impulseDirX: number;
      impulseDirY: number;
    }
  | {
      kind: 'companionRescued';
      simTime: number;
      companionId: number;
      petArchetypeId: string;
      hp: number;
      maxHp: number;
      x: number;
      y: number;
    }
  | { kind: 'win'; simTime: number; summary: SessionResultSummary }
  | { kind: 'loss'; simTime: number; summary: SessionResultSummary }
  | {
      kind: 'dropSpawn';
      simTime: number;
      entityId: number;
      archetypeId: string;
      x: number;
      y: number;
    }
  | {
      kind: 'dropPickup';
      simTime: number;
      entityId: number;
      archetypeId: string;
      pickerId: number;
      x: number;
      y: number;
    }
  | {
      kind: 'dropExpire';
      simTime: number;
      entityId: number;
      archetypeId: string;
      x: number;
      y: number;
    }
  | {
      kind: 'bossPhaseChange';
      simTime: number;
      bossId: number;
      phaseIndex: number;
      phaseId: string;
    };
