import { describe, expect, it } from 'vitest';

import { createFpsOverlay } from './FpsOverlay';

class FakeStyle {
  cssText = '';
}

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly style = new FakeStyle();
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

class FakeDocument {
  createElement(): FakeElement {
    return new FakeElement();
  }
}

describe('FpsOverlay', () => {
  it('is demoted below the top-right progress lane', () => {
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: new FakeDocument()
    });
    try {
      const parent = new FakeElement();
      const overlay = createFpsOverlay(parent as unknown as HTMLElement);
      const fps = parent.children[0];

      expect(fps?.dataset['role']).toBe('fps');
      expect(fps?.style.cssText).toContain('top:108px');
      expect(fps?.style.cssText).toContain('right:56px');
      expect(fps?.style.cssText).toContain('opacity:0.56');
      expect(fps?.style.cssText).toContain('z-index:30');

      overlay.dispose();
      expect(parent.children).toHaveLength(0);
    } finally {
      if (originalDocument === undefined) {
        delete (globalThis as Partial<typeof globalThis>).document;
      } else {
        Object.defineProperty(globalThis, 'document', {
          configurable: true,
          value: originalDocument
        });
      }
    }
  });
});
