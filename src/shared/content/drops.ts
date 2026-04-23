import { HEAL_ORB } from './drops.generated';

export type DropEffect = { kind: 'heal'; amount: number };

export type DropArchetype = Readonly<{
  id: string;
  displayName: string;
  radius: number;
  ttlMs: number;
  effect: DropEffect;
  color: number;
}>;

export { HEAL_ORB };

export const DROP_ARCHETYPES: Readonly<Record<string, DropArchetype>> = {
  [HEAL_ORB.id]: HEAL_ORB
};
