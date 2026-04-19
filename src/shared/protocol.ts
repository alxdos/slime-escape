import type { Snapshot } from './snapshot';

export type MainToSim =
  | { kind: 'pause' }
  | { kind: 'resume' };

export type SimToMain =
  | { kind: 'snapshot'; snapshot: Snapshot };

export function assertNever(value: never): never {
  throw new Error(`unexpected value: ${JSON.stringify(value)}`);
}
