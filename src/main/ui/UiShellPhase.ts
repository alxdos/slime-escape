import type { ResultOutcome } from './ResultOverlay';
import type { ResultViewModel } from './ResultViewModel';
import type { SessionResultSummary } from '../../shared/sessionResult';

export type UiShellPhase =
  | Readonly<{ kind: 'loading' }>
  | Readonly<{ kind: 'menu' }>
  | Readonly<{ kind: 'running' }>
  | Readonly<{ kind: 'onlineConnecting' }>
  | Readonly<{ kind: 'online' }>
  | Readonly<{ kind: 'paused' }>
  | Readonly<{
      kind: 'result';
      outcome: ResultOutcome;
      summary: SessionResultSummary;
      viewModel: ResultViewModel;
    }>
  | Readonly<{ kind: 'error'; reason: 'preload'; message: string }>;
