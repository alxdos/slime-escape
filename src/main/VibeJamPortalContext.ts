export const SLIME_ESCAPE_PORTAL_URL = 'https://slimeescape.com/portal';
export const VIBE_JAM_EXIT_URL = 'https://vibej.am/portal/2026';
export const VIBE_JAM_PORTAL_CONTEXT_STORAGE_KEY = 'slime-escape:vibe-jam-portal-context';

export type VibeJamPortalForwardParam = readonly [name: string, value: string];

export type VibeJamPortalContext = Readonly<{
  returnUrl: string;
  forwardParams: ReadonlyArray<VibeJamPortalForwardParam>;
}>;

export type VibeJamPortalStorage = Readonly<{
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}>;

type StoredVibeJamPortalContext = Readonly<{
  version: 1;
  returnUrl: string;
  forwardParams: ReadonlyArray<VibeJamPortalForwardParam>;
}>;

export function parseVibeJamPortalContextFromUrl(href: string): VibeJamPortalContext | null {
  const url = parseAbsoluteUrl(href);
  if (url === null) return null;
  if (url.searchParams.get('portal') !== 'true') return null;

  const rawRef = url.searchParams.get('ref');
  const returnUrl = parseUsableReturnUrl(rawRef);
  if (returnUrl === null) return null;

  return {
    returnUrl,
    forwardParams: collectForwardParams(url.searchParams)
  };
}

export function hasInboundVibeJamPortalMarker(href: string): boolean {
  const url = parseAbsoluteUrl(href);
  return url?.searchParams.get('portal') === 'true';
}

export function resolveInitialVibeJamPortalContext(
  href: string,
  storage: VibeJamPortalStorage | null
): VibeJamPortalContext | null {
  const parsed = parseVibeJamPortalContextFromUrl(href);
  if (parsed !== null) {
    writeStoredVibeJamPortalContext(storage, parsed);
    return parsed;
  }

  if (hasInboundVibeJamPortalMarker(href)) {
    clearStoredVibeJamPortalContext(storage);
    return null;
  }

  return readStoredVibeJamPortalContext(storage);
}

export function readStoredVibeJamPortalContext(
  storage: VibeJamPortalStorage | null
): VibeJamPortalContext | null {
  if (storage === null) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(VIBE_JAM_PORTAL_CONTEXT_STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    clearStoredVibeJamPortalContext(storage);
    return null;
  }

  const parsed = parseStoredVibeJamPortalContext(value);
  if (parsed === null) {
    clearStoredVibeJamPortalContext(storage);
  }
  return parsed;
}

export function writeStoredVibeJamPortalContext(
  storage: VibeJamPortalStorage | null,
  context: VibeJamPortalContext
): void {
  if (storage === null) return;
  const stored: StoredVibeJamPortalContext = {
    version: 1,
    returnUrl: context.returnUrl,
    forwardParams: context.forwardParams
  };
  try {
    storage.setItem(VIBE_JAM_PORTAL_CONTEXT_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage is best-effort. The in-memory controller can keep the context for this page load.
  }
}

export function clearStoredVibeJamPortalContext(storage: VibeJamPortalStorage | null): void {
  if (storage === null) return;
  try {
    storage.removeItem(VIBE_JAM_PORTAL_CONTEXT_STORAGE_KEY);
  } catch {
    // Clearing is best-effort for browsers that deny sessionStorage access.
  }
}

export function createBrowserVibeJamPortalStorage(): VibeJamPortalStorage | null {
  if (typeof globalThis === 'undefined' || !('sessionStorage' in globalThis)) {
    return null;
  }
  return globalThis.sessionStorage;
}

export function buildVibeJamReturnUrl(context: VibeJamPortalContext): string {
  const url = new URL(context.returnUrl);
  appendForwardParams(url, context.forwardParams);
  url.searchParams.set('portal', 'true');
  url.searchParams.set('ref', SLIME_ESCAPE_PORTAL_URL);
  return url.toString();
}

export function buildVibeJamExitUrl(context: VibeJamPortalContext | null): string {
  const url = new URL(VIBE_JAM_EXIT_URL);
  appendForwardParams(url, context?.forwardParams ?? []);
  url.searchParams.set('ref', SLIME_ESCAPE_PORTAL_URL);
  return url.toString();
}

function parseAbsoluteUrl(href: string): URL | null {
  try {
    return new URL(href);
  } catch {
    return null;
  }
}

function parseUsableReturnUrl(rawRef: string | null): string | null {
  if (rawRef === null || rawRef.trim().length === 0) return null;
  let url: URL;
  try {
    url = new URL(rawRef);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  return url.toString();
}

function collectForwardParams(searchParams: URLSearchParams): ReadonlyArray<VibeJamPortalForwardParam> {
  const params: VibeJamPortalForwardParam[] = [];
  for (const [name, value] of searchParams.entries()) {
    if (name === 'portal' || name === 'ref') continue;
    params.push([name, value]);
  }
  return params;
}

function appendForwardParams(
  url: URL,
  params: ReadonlyArray<VibeJamPortalForwardParam>
): void {
  for (const [name, value] of params) {
    url.searchParams.append(name, value);
  }
}

function parseStoredVibeJamPortalContext(value: unknown): VibeJamPortalContext | null {
  if (!isRecord(value)) return null;
  if (value['version'] !== 1) return null;
  if (typeof value['returnUrl'] !== 'string') return null;
  if (parseUsableReturnUrl(value['returnUrl']) === null) return null;
  const rawForwardParams = value['forwardParams'];
  if (!Array.isArray(rawForwardParams)) return null;

  const forwardParams: VibeJamPortalForwardParam[] = [];
  for (const entry of rawForwardParams) {
    if (!Array.isArray(entry) || entry.length !== 2) return null;
    const [name, paramValue] = entry;
    if (typeof name !== 'string' || typeof paramValue !== 'string') return null;
    if (name === 'portal' || name === 'ref') return null;
    forwardParams.push([name, paramValue]);
  }

  return {
    returnUrl: value['returnUrl'],
    forwardParams
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
