import type { RuntimeEvent } from './events.js';
import type { InputCommand } from './input.js';
import type { SessionDefinition } from './session.js';
import type { Snapshot } from './snapshot.js';

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
