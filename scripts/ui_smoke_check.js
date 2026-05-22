const http = require('http');
const https = require('https');
const { URL } = require('url');

function checkUrl(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === 'https:' ? https : http;
      const opts = { method: 'GET', headers: { 'User-Agent': 'UI-Smoke-Checker' } };
      const req = lib.request(parsed, opts, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk.toString());
        res.on('end', () => resolve({ status: res.statusCode, text: data }));
      });
      req.on('error', (err) => resolve({ error: err.message }));
      req.end();
    } catch (err) {
      resolve({ error: String(err && err.message ? err.message : err) });
    }
  });
}

(async function() {
  const base = 'http://localhost:3000';
  const pages = ['/', '/auth/login', '/profile', '/admin/teacher-shifts'];
  const results = {};

  for (const p of pages) {
    const url = base + p;
    process.stdout.write(`Checking ${url} ... `);
    const r = await checkUrl(url);
    if (r.error) {
      console.log('ERROR:', r.error);
      results[p] = { ok: false, error: r.error };
      continue;
    }
    const html = r.text || '';
    const checks = {
      logo: html.includes('/img/logo.png'),
      favicon: html.includes('/img/favicon.svg') || html.includes('/favicon.ico'),
      hero: html.includes('home-carousel') || html.includes('home-hero'),
      loginHeaderLogo: html.includes('card-header') && html.includes('/img/logo.png')
    };
    console.log('status', r.status, 'logo', checks.logo, 'favicon', checks.favicon, 'hero', checks.hero);
    results[p] = { status: r.status, checks };
  }

  console.log('\nSummary:');
  console.dir(results, { depth: 4 });

  // Basic console error check: read server log not available; skip.

  process.exit(0);
})();
