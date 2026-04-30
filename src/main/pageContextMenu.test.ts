import { describe, expect, it, vi } from 'vitest';

import { installPageContextMenuBlocker } from './pageContextMenu';

class FakeEventTarget {
  private readonly listeners = new Map<string, Set<EventListener>>();

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string, event: Event): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

describe('installPageContextMenuBlocker', () => {
  it('prevents the browser context menu until disposed', () => {
    const target = new FakeEventTarget();
    const blocker = installPageContextMenuBlocker(target);
    const firstPreventDefault = vi.fn();
    const secondPreventDefault = vi.fn();

    target.dispatch('contextmenu', { preventDefault: firstPreventDefault } as unknown as Event);
    blocker.dispose();
    target.dispatch('contextmenu', { preventDefault: secondPreventDefault } as unknown as Event);

    expect(firstPreventDefault).toHaveBeenCalledTimes(1);
    expect(secondPreventDefault).not.toHaveBeenCalled();
  });
});
