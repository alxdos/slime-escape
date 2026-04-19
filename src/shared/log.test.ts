import { afterEach, describe, expect, it, vi } from 'vitest';

import { log } from './log';

describe('log', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('forwards message and meta to console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    log.warn('something happened', { code: 42 });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(expect.any(String), 'something happened', { code: 42 });
  });

  it('omits meta when not provided', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});

    log.info('plain');

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]).toHaveLength(2);
  });

  it('does not throw when underlying console method throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('console blew up');
    });

    expect(() => log.error('boom', { context: 'test' })).not.toThrow();
  });
});
