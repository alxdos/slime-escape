import { describe, expect, it, vi } from 'vitest';

import { installPageContextMenuBlocker, installPageInteractionBlockers } from './pageContextMenu';

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

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  parent: FakeElement | null = null;
  textContent = '';

  appendChild(child: FakeElement): FakeElement {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  remove(): void {
    if (this.parent === null) {
      return;
    }
    this.parent.children.splice(this.parent.children.indexOf(this), 1);
    this.parent = null;
  }
}

class FakeDocument extends FakeEventTarget {
  readonly head = new FakeElement();

  createElement(): FakeElement {
    return new FakeElement();
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

describe('installPageInteractionBlockers', () => {
  it('prevents page text selection and injects global selection CSS until disposed', () => {
    const documentTarget = new FakeDocument();
    const blockers = installPageInteractionBlockers(documentTarget as unknown as Document);
    const selectPreventDefault = vi.fn();
    const contextPreventDefault = vi.fn();
    const afterDisposePreventDefault = vi.fn();
    const style = documentTarget.head.children[0];

    documentTarget.dispatch(
      'selectstart',
      { preventDefault: selectPreventDefault } as unknown as Event
    );
    documentTarget.dispatch(
      'contextmenu',
      { preventDefault: contextPreventDefault } as unknown as Event
    );

    expect(style?.dataset['role']).toBe('page-interaction-blockers');
    expect(style?.textContent).toContain('user-select:none');
    expect(style?.textContent).toContain('-webkit-touch-callout:none');
    expect(selectPreventDefault).toHaveBeenCalledTimes(1);
    expect(contextPreventDefault).toHaveBeenCalledTimes(1);

    blockers.dispose();
    documentTarget.dispatch(
      'selectstart',
      { preventDefault: afterDisposePreventDefault } as unknown as Event
    );

    expect(afterDisposePreventDefault).not.toHaveBeenCalled();
    expect(documentTarget.head.children).toHaveLength(0);
  });
});
