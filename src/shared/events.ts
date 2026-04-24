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
      ownerKind: 'player' | 'enemy' | 'boss';
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
      targetId: number;
      targetKind: 'enemy' | 'player' | 'boss';
      targetArchetypeId: string | null;
      weaponArchetypeId: string;
      damage: number;
      impactDirX: number;
      impactDirY: number;
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
      x: number;
      y: number;
    }
  | { kind: 'win'; simTime: number }
  | { kind: 'loss'; simTime: number }
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
