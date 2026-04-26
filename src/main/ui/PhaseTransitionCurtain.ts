export type PhaseTransitionCurtainInit = Readonly<{
  parent: HTMLElement;
  durationMs?: number;
  requestFrame?: () => Promise<void>;
  wait?: (durationMs: number) => Promise<void>;
}>;

export type PhaseTransitionCurtain = Readonly<{
  run(
    commit: () => void | Promise<void>,
    reveal?: () => void | Promise<void>
  ): Promise<void>;
  isActive(): boolean;
  dispose(): void;
}>;

const DEFAULT_TRANSITION_DURATION_MS = 360;

export function createPhaseTransitionCurtain(
  init: PhaseTransitionCurtainInit
): PhaseTransitionCurtain {
  const durationMs = init.durationMs ?? DEFAULT_TRANSITION_DURATION_MS;
  const root = document.createElement('div');
  root.dataset['role'] = 'phase-transition-curtain';
  root.style.cssText = rootStyle(durationMs);
  init.parent.appendChild(root);

  const requestFrame = init.requestFrame ?? requestAnimationFramePromise;
  const wait = init.wait ?? waitMs;
  let active = false;
  let disposed = false;

  async function fadeTo(opacity: '0' | '1'): Promise<void> {
    if (disposed) {
      return;
    }
    root.style.opacity = opacity;
    await wait(durationMs);
  }

  return {
    async run(commit, reveal): Promise<void> {
      if (active) {
        return;
      }

      active = true;
      root.style.display = 'block';
      root.style.opacity = '0';

      try {
        await requestFrame();
        await fadeTo('1');
        await commit();
        await requestFrame();
        await reveal?.();
        await fadeTo('0');
      } finally {
        if (!disposed) {
          root.style.display = 'none';
        }
        active = false;
      }
    },
    isActive(): boolean {
      return active;
    },
    dispose(): void {
      disposed = true;
      root.remove();
      active = false;
    }
  };
}

function rootStyle(durationMs: number): string {
  return [
    'position:fixed',
    'inset:0',
    'display:none',
    'opacity:0',
    'background:#000000',
    'z-index:125',
    'pointer-events:auto',
    `transition:opacity ${durationMs}ms ease`
  ].join(';');
}

function requestAnimationFramePromise(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function waitMs(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, durationMs);
  });
}
