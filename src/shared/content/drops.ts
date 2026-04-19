export type DropEffect = { kind: 'heal'; amount: number };

export type DropArchetype = Readonly<{
  id: string;
  displayName: string;
  radius: number;
  ttlMs: number;
  effect: DropEffect;
  color: number;
}>;

export const HEAL_ORB: DropArchetype = {
  id: 'heal-orb',
  displayName: 'Heal Orb',
  radius: 0.35,
  ttlMs: 8000,
  effect: { kind: 'heal', amount: 1 },
  color: 0xff7aa8
};

export const DROP_ARCHETYPES: Readonly<Record<string, DropArchetype>> = {
  [HEAL_ORB.id]: HEAL_ORB
};
