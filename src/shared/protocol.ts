export type MainToSim =
  | { kind: 'pause' }
  | { kind: 'resume' };

export function assertNever(value: never): never {
  throw new Error(`unexpected value: ${JSON.stringify(value)}`);
}
