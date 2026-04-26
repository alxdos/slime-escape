export type StartupPresentationStep = Readonly<{
  label: string;
  durationMs: number;
}>;

export type StartupOverlayViewModel = Readonly<{
  kind: 'assets' | 'ritual';
  label: string;
  progressPercent: number;
}>;

export const STARTUP_ASSET_PROGRESS_END_PERCENT = 82;

export const STARTUP_PRESENTATION_STEPS = Object.freeze([
  { label: 'Активируем слизь', durationMs: 700 },
  { label: 'Спавним слаймов', durationMs: 700 },
  { label: 'Пробуждаем босса', durationMs: 700 }
]) satisfies ReadonlyArray<StartupPresentationStep>;

export function createStartupAssetProgressViewModel(
  loaded: number,
  total: number
): StartupOverlayViewModel {
  const safeLoaded = Math.max(0, Math.floor(loaded));
  const safeTotal = Math.max(0, Math.floor(total));
  const clampedLoaded = Math.min(safeLoaded, safeTotal);
  const assetRatio = safeTotal <= 0 ? 0 : clampedLoaded / safeTotal;

  return {
    kind: 'assets',
    label: `Loading assets ${clampedLoaded}/${safeTotal}`,
    progressPercent: Math.round(assetRatio * STARTUP_ASSET_PROGRESS_END_PERCENT)
  };
}

export function createStartupRitualViewModel(
  stepIndex: number,
  steps: ReadonlyArray<StartupPresentationStep> = STARTUP_PRESENTATION_STEPS
): StartupOverlayViewModel {
  const totalSteps = Math.max(1, steps.length);
  const safeIndex = Math.min(Math.max(0, Math.floor(stepIndex)), totalSteps - 1);
  const step = steps[safeIndex];
  const ritualRatio = (safeIndex + 1) / totalSteps;
  const progressPercent =
    STARTUP_ASSET_PROGRESS_END_PERCENT +
    Math.round(ritualRatio * (100 - STARTUP_ASSET_PROGRESS_END_PERCENT));

  return {
    kind: 'ritual',
    label: step?.label ?? '',
    progressPercent: Math.min(100, progressPercent)
  };
}

export async function playStartupPresentationRitual(
  applyViewModel: (viewModel: StartupOverlayViewModel) => void,
  options: Readonly<{
    steps?: ReadonlyArray<StartupPresentationStep>;
    wait?: (durationMs: number) => Promise<void>;
  }> = {}
): Promise<void> {
  const steps = options.steps ?? STARTUP_PRESENTATION_STEPS;
  const wait = options.wait ?? waitMs;

  for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
    applyViewModel(createStartupRitualViewModel(stepIndex, steps));
    await wait(steps[stepIndex]?.durationMs ?? 0);
  }
}

function waitMs(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, durationMs);
  });
}
