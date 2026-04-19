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
      ownerKind: 'player' | 'enemy';
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
      targetKind: 'enemy' | 'player';
      weaponArchetypeId: string;
      damage: number;
      x: number;
      y: number;
    }
  | {
      kind: 'death';
      simTime: number;
      entityId: number;
      entityKind: 'enemy' | 'player';
      archetypeId: string | null;
      x: number;
      y: number;
    };
