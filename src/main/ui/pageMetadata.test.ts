import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

type ExpectedMetadata = Readonly<{
  filePath: string;
  title: string;
  description: string;
  ogUrl: string;
}>;

const MAIN_DESCRIPTION =
  'Survive escalating slime waves, outrun the closing darkness, and defeat the boss trapping you in a strange arena.';
const PORTAL_DESCRIPTION =
  'Enter Slime Escape through the Vibe Jam portal, fight through the slime arena, and find the way back or onward.';

describe('static page metadata', () => {
  it.each([
    {
      filePath: 'index.html',
      title: 'Slime Escape',
      description: MAIN_DESCRIPTION,
      ogUrl: 'https://slimeescape.com/'
    },
    {
      filePath: 'portal/index.html',
      title: 'Slime Escape - Vibe Jam 2026',
      description: PORTAL_DESCRIPTION,
      ogUrl: 'https://slimeescape.com/portal'
    }
  ] satisfies ReadonlyArray<ExpectedMetadata>)(
    'declares SEO, Open Graph, and PNG icon metadata for $filePath',
    (expected) => {
      const html = readFileSync(join(process.cwd(), expected.filePath), 'utf8');

      expect(html).toContain(`<title>${expected.title}</title>`);
      expect(findTag(html, 'meta', 'name', 'description')).toContain(
        `content="${expected.description}"`
      );
      expect(findTag(html, 'meta', 'property', 'og:title')).toContain(
        `content="${expected.title}"`
      );
      expect(findTag(html, 'meta', 'property', 'og:description')).toContain(
        `content="${expected.description}"`
      );
      expect(findTag(html, 'meta', 'property', 'og:image')).toContain(
        'content="/images/slime-escape-og.jpg"'
      );
      expect(findTag(html, 'meta', 'property', 'og:url')).toContain(
        `content="${expected.ogUrl}"`
      );
      expect(findTag(html, 'link', 'href', '/images/favicon-32.png')).toContain(
        'sizes="32x32"'
      );
      expect(findTag(html, 'link', 'href', '/images/icon-192.png')).toContain(
        'sizes="192x192"'
      );
      expect(findTag(html, 'link', 'href', '/images/apple-icon.png')).toContain(
        'rel="apple-touch-icon"'
      );
    }
  );

  it('configures the portal page as the Public Arena online entrypoint', () => {
    const html = readFileSync(join(process.cwd(), 'portal/index.html'), 'utf8');

    expect(html).toContain('window.SLIME_ESCAPE_AUTO_START_PUBLIC_ARENA = true;');
    expect(html).not.toContain('window.SLIME_ESCAPE_AUTO_START = "portal";');
  });
});

function findTag(html: string, tagName: string, attrName: string, attrValue: string): string {
  const pattern = new RegExp(
    `<${tagName}\\b[^>]*\\b${escapeRegExp(attrName)}="${escapeRegExp(attrValue)}"[^>]*>`,
    'u'
  );
  const match = html.match(pattern);
  if (match === null) {
    throw new Error(`Missing <${tagName}> with ${attrName}="${attrValue}"`);
  }
  return match[0] ?? '';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
