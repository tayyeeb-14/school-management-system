const fs = require('fs');
const puppeteer = require('puppeteer');

(async () => {
  try {
    const outDir = 'screenshots/ui/qa';
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const pages = [
      { path: '/', name: 'home' },
      { path: '/about', name: 'about' },
      { path: '/admissions', name: 'admissions' },
      { path: '/blog', name: 'blog' },
      { path: '/contact', name: 'contact' },
      { path: '/auth/login', name: 'login' },
      { path: '/auth/register', name: 'register' },
      { path: '/admin/dashboard', name: 'dashboard' }
    ];

    const viewports = [
      { w: 1920, h: 1080, label: '1920x1080', mobile: false },
      { w: 1440, h: 900, label: '1440x900', mobile: false },
      { w: 1366, h: 768, label: '1366x768', mobile: false },
      { w: 1024, h: 768, label: '1024x768', mobile: false },
      { w: 834, h: 1112, label: '834x1112', mobile: false },
      { w: 412, h: 915, label: '412x915', mobile: true },
      { w: 393, h: 852, label: '393x852', mobile: true },
      { w: 375, h: 812, label: '375x812', mobile: true },
      { w: 360, h: 800, label: '360x800', mobile: true }
    ];

    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    const report = [];

    for (const p of pages) {
      for (const vp of viewports) {
        await page.setViewport({ width: vp.w, height: vp.h, isMobile: !!vp.mobile });
        const url = `http://localhost:3000${p.path}`;
        await page.goto(url, { waitUntil: 'networkidle2' });

        // brief pause for dynamic layout
        await page.waitForTimeout(300);

        // checks
        const checks = await page.evaluate(() => {
          const results = {};
          results.scrollWidth = document.documentElement.scrollWidth;
          results.innerWidth = window.innerWidth;
          results.overflowX = document.documentElement.scrollWidth > window.innerWidth;
          // nav counts
          const navs = Array.from(document.querySelectorAll('nav, header[role="banner"], .navbar'));
          results.navCount = navs.length;
          // logo count inside navs
          results.logoCount = navs.reduce((acc, n) => acc + n.querySelectorAll('img, .brand, .navbar-brand').length, 0);
          // hamburger presence and visibility
          const togglers = Array.from(document.querySelectorAll('.navbar-toggler, .mobile-menu-toggle'));
          results.togglerCount = togglers.length;
          results.togglerVisibleOnDesktop = false;
          try {
            results.togglerVisibleOnDesktop = togglers.some(t => {
              const style = window.getComputedStyle(t);
              return style && style.display !== 'none' && style.visibility !== 'hidden' && t.offsetParent !== null;
            });
          } catch (e) {}
          // detect duplicate menu items (rough heuristic)
          const links = document.querySelectorAll('nav a, .navbar a');
          results.linkCount = links.length;
          // small viewport font/overflow checks
          results.bodyOverflowX = getComputedStyle(document.body).overflowX;
          // find tables
          const tables = Array.from(document.querySelectorAll('table'));
          results.tableCount = tables.length;
          // find forms
          const forms = Array.from(document.querySelectorAll('form'));
          results.formCount = forms.length;

          return results;
        });

        // Save screenshot (viewport) and full page
        const filenameBase = `${outDir}/${p.name}-${vp.label}`;
        await page.screenshot({ path: `${filenameBase}-viewport.png`, fullPage: false });
        await page.screenshot({ path: `${filenameBase}-full.png`, fullPage: true });

        report.push({ page: p.path, name: p.name, viewport: vp.label, checks, screenshots: { viewport: `${filenameBase}-viewport.png`, full: `${filenameBase}-full.png` } });
        console.log('Captured', p.path, vp.label);
      }
    }

    // Save JSON report
    fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2));
    await browser.close();
    console.log('QA capture complete. Report saved to', `${outDir}/report.json`);
  } catch (err) {
    console.error('QA script error:', err);
    process.exit(1);
  }
})();
