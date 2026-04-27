import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig, loadEnv, type Plugin } from 'vite';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const GTM_ID_PATTERN = /^GTM-[A-Z0-9]+$/i;

export default defineConfig(({ mode }) => {
  const gtmId = resolveGoogleTagManagerId(mode);

  return {
    plugins: gtmId === null ? [] : [googleTagManagerPlugin(gtmId)],
    worker: {
      format: 'es'
    },
    build: {
      target: 'es2022',
      rollupOptions: {
        input: {
          main: resolve(rootDir, 'index.html'),
          portal: resolve(rootDir, 'portal/index.html')
        }
      }
    }
  };
});

function resolveGoogleTagManagerId(mode: string): string | null {
  const rawId = loadEnv(mode, rootDir, '')['VITE_GTM_ID']?.trim();

  if (rawId === undefined || rawId === '') {
    return null;
  }

  if (!GTM_ID_PATTERN.test(rawId)) {
    throw new Error('VITE_GTM_ID must look like GTM-XXXXXXX.');
  }

  return rawId.toUpperCase();
}

function googleTagManagerPlugin(gtmId: string): Plugin {
  return {
    name: 'slime-escape-google-tag-manager',
    transformIndexHtml(html) {
      return injectGoogleTagManager(html, gtmId);
    }
  };
}

function injectGoogleTagManager(html: string, gtmId: string): string {
  if (html.includes('googletagmanager.com/gtm.js') || html.includes('googletagmanager.com/ns.html')) {
    return html;
  }

  return html
    .replace(/(<head(?:\s[^>]*)?>)/i, `$1\n${googleTagManagerHeadSnippet(gtmId)}`)
    .replace(/(<body(?:\s[^>]*)?>)/i, `$1\n${googleTagManagerBodySnippet(gtmId)}`);
}

function googleTagManagerHeadSnippet(gtmId: string): string {
  const containerId = JSON.stringify(gtmId);

  return `<!-- Google Tag Manager -->
    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer',${containerId});</script>
    <!-- End Google Tag Manager -->`;
}

function googleTagManagerBodySnippet(gtmId: string): string {
  const encodedId = encodeURIComponent(gtmId);

  return `<!-- Google Tag Manager (noscript) -->
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${encodedId}"
    height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
    <!-- End Google Tag Manager (noscript) -->`;
}
