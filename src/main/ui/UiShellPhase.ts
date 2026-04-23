import type { ResultOutcome } from './ResultOverlay';

export type UiShellPhase =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'menu' }>
  | Readonly<{ kind: 'running' }>
  | Readonly<{ kind: 'paused' }>
  | Readonly<{ kind: 'result'; outcome: ResultOutcome }>
  | Readonly<{ kind: 'error'; reason: 'preload'; message: string }>;
