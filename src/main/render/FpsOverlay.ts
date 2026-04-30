export type FpsOverlay = Readonly<{
  onFrame(nowMs: number): void;
  dispose(): void;
}>;

const SMOOTHING = 0.1;
const TEXT_INTERVAL_MS = 250;

export function createFpsOverlay(parent: HTMLElement): FpsOverlay {
  const el = document.createElement('div');
  el.dataset['role'] = 'fps';
  el.style.cssText = [
    'position:fixed',
    'top:108px',
    'right:56px',
    'padding:3px 6px',
    'font:10px/1 ui-monospace,SFMono-Regular,Menlo,monospace',
    'color:#cdd5e3',
    'background:rgba(10,12,16,0.6)',
    'border-radius:4px',
    'opacity:0.56',
    'pointer-events:none',
    'user-select:none',
    'z-index:30'
  ].join(';');
  el.textContent = '— fps';
  parent.appendChild(el);

  let lastFrameMs = -1;
  let emaFps = 0;
  let lastTextMs = 0;

  return {
    onFrame(nowMs: number): void {
      if (lastFrameMs >= 0) {
        const dt = nowMs - lastFrameMs;
        if (dt > 0) {
          const fps = 1000 / dt;
          emaFps = emaFps === 0 ? fps : emaFps * (1 - SMOOTHING) + fps * SMOOTHING;
        }
      }
      lastFrameMs = nowMs;
      if (nowMs - lastTextMs >= TEXT_INTERVAL_MS) {
        el.textContent = `${Math.round(emaFps)} fps`;
        lastTextMs = nowMs;
      }
    },
    dispose(): void {
      el.remove();
    }
  };
}
