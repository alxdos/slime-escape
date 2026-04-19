import type { RuntimeEvent } from './events';
import type { InputCommand } from './input';
import type { SessionDefinition } from './session';
import type { Snapshot } from './snapshot';

export type DebugCommand = unknown;
export type TelemetryRecord = unknown;

export type MainToSim =
  | { kind: 'startSession'; session: SessionDefinition }
  | { kind: 'stopSession' }
  | { kind: 'pause' }
  | { kind: 'resume' }
  | { kind: 'input'; command: InputCommand }
  | { kind: 'debug'; command: DebugCommand };

export type SimToMain =
  | { kind: 'snapshot'; snapshot: Snapshot }
  | { kind: 'event'; event: RuntimeEvent }
  | { kind: 'telemetry'; record: TelemetryRecord };

export function assertNever(value: never): never {
  throw new Error(`unexpected value: ${JSON.stringify(value)}`);
}
