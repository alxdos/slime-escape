import { describe, expect, it } from 'vitest';

import {
  STARTUP_ASSET_PROGRESS_END_PERCENT,
  STARTUP_PRESENTATION_STEPS,
  createStartupAssetProgressViewModel,
  createStartupRitualViewModel,
  playStartupPresentationRitual
} from './startupPresentation';

describe('startup presentation view model', () => {
  it('keeps asset counts honest and reserves the final progress slice for ritual steps', () => {
    expect(createStartupAssetProgressViewModel(2.7, 5)).toEqual({
      kind: 'assets',
      label: 'Loading assets 2/5',
      progressPercent: Math.round((2 / 5) * STARTUP_ASSET_PROGRESS_END_PERCENT)
    });
    expect(createStartupAssetProgressViewModel(5, 5)).toEqual({
      kind: 'assets',
      label: 'Loading assets 5/5',
      progressPercent: STARTUP_ASSET_PROGRESS_END_PERCENT
    });
  });

  it('uses themed ritual labels and reaches 100%', () => {
    expect(STARTUP_PRESENTATION_STEPS.map((step) => step.label)).toEqual([
      'Активируем слизь',
      'Спавним слаймов',
      'Пробуждаем босса'
    ]);
    expect(STARTUP_PRESENTATION_STEPS.reduce((sum, step) => sum + step.durationMs, 0)).toBe(2100);

    expect(createStartupRitualViewModel(0)).toMatchObject({
      kind: 'ritual',
      label: 'Активируем слизь'
    });
    expect(createStartupRitualViewModel(STARTUP_PRESENTATION_STEPS.length - 1)).toEqual({
      kind: 'ritual',
      label: 'Пробуждаем босса',
      progressPercent: 100
    });
  });

  it('plays ritual steps using presentation time without changing asset counts', async () => {
    const labels: string[] = [];
    const waits: number[] = [];

    await playStartupPresentationRitual(
      (viewModel) => {
        labels.push(viewModel.label);
      },
      {
        steps: [
          { label: 'Шаг один', durationMs: 11 },
          { label: 'Шаг два', durationMs: 22 }
        ],
        wait(durationMs) {
          waits.push(durationMs);
          return Promise.resolve();
        }
      }
    );

    expect(labels).toEqual(['Шаг один', 'Шаг два']);
    expect(waits).toEqual([11, 22]);
  });
});
