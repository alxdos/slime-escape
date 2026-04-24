export type InputCommand =
  | { kind: 'move'; dx: number; dy: number }
  | { kind: 'aim'; x: number; y: number }
  | { kind: 'fire'; phase: 'start' | 'stop' }
  | { kind: 'selectWeaponSlot'; slotIndex: number }
  | { kind: 'holsterWeapon' };
