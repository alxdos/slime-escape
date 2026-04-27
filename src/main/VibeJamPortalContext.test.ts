import { describe, expect, it } from 'vitest';

import {
  SLIME_ESCAPE_PORTAL_URL,
  VIBE_JAM_EXIT_URL,
  VIBE_JAM_PORTAL_CONTEXT_STORAGE_KEY,
  buildVibeJamExitUrl,
  buildVibeJamReturnUrl,
  clearStoredVibeJamPortalContext,
  createBrowserVibeJamPortalStorage,
  parseVibeJamPortalContextFromUrl,
  readStoredVibeJamPortalContext,
  resolveInitialVibeJamPortalContext,
  writeStoredVibeJamPortalContext,
  type VibeJamPortalContext,
  type VibeJamPortalStorage
} from './VibeJamPortalContext';

describe('parseVibeJamPortalContextFromUrl', () => {
  it('returns null when portal=true is absent', () => {
    expect(
      parseVibeJamPortalContextFromUrl('https://slimeescape.com/portal?ref=https%3A%2F%2Fexample.com')
    ).toBeNull();
    expect(
      parseVibeJamPortalContextFromUrl(
        'https://slimeescape.com/portal?portal=false&ref=https%3A%2F%2Fexample.com'
      )
    ).toBeNull();
  });

  it('returns null for missing, malformed, relative, and non-web refs', () => {
    const refs = [
      '',
      'not a url',
      '/relative-return',
      'ftp://example.com/back',
      'javascript:alert(1)'
    ];

    for (const ref of refs) {
      expect(
        parseVibeJamPortalContextFromUrl(
          `https://slimeescape.com/portal?portal=true&ref=${encodeURIComponent(ref)}`
        )
      ).toBeNull();
    }
  });

  it('parses usable refs and preserves optional query parameters opaquely', () => {
    const context = parseVibeJamPortalContextFromUrl(
      'https://slimeescape.com/portal?portal=true&ref=https%3A%2F%2Fprevious.example%2Fgame%3Fslot%3D7&username=Alex&color=lime&hp=3&speed=2.5&avatar_url=https%3A%2F%2Fimg.example%2Fa.png&color=purple'
    );

    expect(context).toEqual({
      returnUrl: 'https://previous.example/game?slot=7',
      forwardParams: [
        ['username', 'Alex'],
        ['color', 'lime'],
        ['hp', '3'],
        ['speed', '2.5'],
        ['avatar_url', 'https://img.example/a.png'],
        ['color', 'purple']
      ]
    });
  });
});

describe('Vibe Jam portal URL builders', () => {
  it('builds a return URL with Slime Escape as ref and preserved optional params', () => {
    const url = new URL(
      buildVibeJamReturnUrl({
        returnUrl: 'https://previous.example/return?existing=1',
        forwardParams: [
          ['username', 'Alex'],
          ['color', 'lime']
        ]
      })
    );

    expect(url.origin + url.pathname).toBe('https://previous.example/return');
    expect(url.searchParams.get('existing')).toBe('1');
    expect(url.searchParams.get('portal')).toBe('true');
    expect(url.searchParams.get('ref')).toBe(SLIME_ESCAPE_PORTAL_URL);
    expect(url.searchParams.get('username')).toBe('Alex');
    expect(url.searchParams.get('color')).toBe('lime');
  });

  it('builds a return URL when optional params are absent', () => {
    const url = new URL(
      buildVibeJamReturnUrl({
        returnUrl: 'https://previous.example/return',
        forwardParams: []
      })
    );

    expect(url.searchParams.get('portal')).toBe('true');
    expect(url.searchParams.get('ref')).toBe(SLIME_ESCAPE_PORTAL_URL);
  });

  it('builds an exit URL with Slime Escape as ref and optional params when available', () => {
    const url = new URL(
      buildVibeJamExitUrl({
        returnUrl: 'https://previous.example/return',
        forwardParams: [
          ['username', 'Alex'],
          ['speed', '2.5']
        ]
      })
    );

    expect(url.origin + url.pathname).toBe(VIBE_JAM_EXIT_URL);
    expect(url.searchParams.get('ref')).toBe(SLIME_ESCAPE_PORTAL_URL);
    expect(url.searchParams.get('username')).toBe('Alex');
    expect(url.searchParams.get('speed')).toBe('2.5');
  });

  it('builds an exit URL without optional params', () => {
    const url = new URL(buildVibeJamExitUrl(null));

    expect(url.origin + url.pathname).toBe(VIBE_JAM_EXIT_URL);
    expect(url.searchParams.get('ref')).toBe(SLIME_ESCAPE_PORTAL_URL);
    expect([...url.searchParams.keys()]).toEqual(['ref']);
  });
});

describe('Vibe Jam portal context storage', () => {
  it('stores context in tab-scoped storage and reads it in a later helper instance', () => {
    const storage = new FakeStorage();
    const inboundUrl =
      'https://slimeescape.com/portal?portal=true&ref=https%3A%2F%2Fprevious.example%2Freturn&username=Alex';
    const context = resolveInitialVibeJamPortalContext(inboundUrl, storage);

    expect(context?.returnUrl).toBe('https://previous.example/return');
    expect(storage.entries.has(VIBE_JAM_PORTAL_CONTEXT_STORAGE_KEY)).toBe(true);
    expect(resolveInitialVibeJamPortalContext('https://slimeescape.com/', storage)).toEqual(context);
  });

  it('clears stale storage when the current inbound URL has an unusable ref', () => {
    const storage = new FakeStorage();
    writeStoredVibeJamPortalContext(storage, sampleContext());

    const context = resolveInitialVibeJamPortalContext(
      'https://slimeescape.com/portal?portal=true&ref=not-a-url',
      storage
    );

    expect(context).toBeNull();
    expect(readStoredVibeJamPortalContext(storage)).toBeNull();
  });

  it('returns null and removes invalid stored JSON', () => {
    const storage = new FakeStorage();
    storage.entries.set(VIBE_JAM_PORTAL_CONTEXT_STORAGE_KEY, '{oops');

    expect(readStoredVibeJamPortalContext(storage)).toBeNull();
    expect(storage.entries.has(VIBE_JAM_PORTAL_CONTEXT_STORAGE_KEY)).toBe(false);
  });

  it('ignores denied storage writes while preserving pure helper output', () => {
    const storage = new FakeStorage();
    storage.throwOnSet = true;
    const context = sampleContext();

    writeStoredVibeJamPortalContext(storage, context);

    expect(storage.entries.has(VIBE_JAM_PORTAL_CONTEXT_STORAGE_KEY)).toBe(false);
    expect(buildVibeJamReturnUrl(context)).toContain('portal=true');
  });

  it('clears stored context explicitly', () => {
    const storage = new FakeStorage();
    writeStoredVibeJamPortalContext(storage, sampleContext());

    clearStoredVibeJamPortalContext(storage);

    expect(readStoredVibeJamPortalContext(storage)).toBeNull();
  });

  it('returns null when browser storage access is denied', () => {
    const previousDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get() {
        throw new Error('sessionStorage denied');
      }
    });

    try {
      expect(createBrowserVibeJamPortalStorage()).toBeNull();
    } finally {
      if (previousDescriptor === undefined) {
        Reflect.deleteProperty(globalThis, 'sessionStorage');
      } else {
        Object.defineProperty(globalThis, 'sessionStorage', previousDescriptor);
      }
    }
  });
});

function sampleContext(): VibeJamPortalContext {
  return {
    returnUrl: 'https://previous.example/return',
    forwardParams: [['username', 'Alex']]
  };
}

class FakeStorage implements VibeJamPortalStorage {
  readonly entries = new Map<string, string>();
  throwOnSet = false;

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.throwOnSet) {
      throw new Error('set denied');
    }
    this.entries.set(key, value);
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }
}
