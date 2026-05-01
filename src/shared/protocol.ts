import type { RuntimeEvent } from './events.js';
import type { InputCommand } from './input.js';
import type { SessionDefinition } from './session.js';
import type { Snapshot } from './snapshot.js';

export type DebugCommand = unknown;
export type TelemetryRecord = unknown;
export type SimWorkerMode = 'local-authoritative' | 'online-predictor';

export type StartSessionMessage =
  | { kind: 'startSession'; session: SessionDefinition; mode?: 'local-authoritative' }
  | {
      kind: 'startSession';
      session: SessionDefinition;
      mode: 'online-predictor';
      selfPlayerId: string;
    };

export type MainToSim =
  | StartSessionMessage
  | { kind: 'stopSession' }
  | { kind: 'pause' }
  | { kind: 'resume' }
  | { kind: 'input'; command: InputCommand; inputSequence: number }
  | { kind: 'authoritativeSnapshot'; snapshot: Snapshot }
  | { kind: 'debug'; command: DebugCommand };

export type SimToMain =
  | { kind: 'snapshot'; snapshot: Snapshot }
  | { kind: 'predictedSnapshot'; snapshot: Snapshot }
  | { kind: 'event'; event: RuntimeEvent }
  | { kind: 'telemetry'; record: TelemetryRecord };

export function assertNever(value: never): never {
  throw new Error(`unexpected value: ${JSON.stringify(value)}`);
}
