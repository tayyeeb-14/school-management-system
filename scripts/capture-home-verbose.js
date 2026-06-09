const fs = require('fs');
const puppeteer = require('puppeteer');

(async () => {
  try {
    const outDir = 'screenshots/ui/qa/home-only';
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const pageDef = { path: '/', name: 'home' };

    const viewports = [
      { w: 360, h: 800, label: '360x800', mobile: true },
      { w: 375, h: 812, label: '375x812', mobile: true },
      { w: 768, h: 1024, label: '768x1024', mobile: false },
      { w: 834, h: 1112, label: '834x1112', mobile: false },
      { w: 1366, h: 768, label: '1366x768', mobile: false },
      { w: 1920, h: 1080, label: '1920x1080', mobile: false }
    ];

    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    const report = [];

    for (const vp of viewports) {
      await page.setViewport({ width: vp.w, height: vp.h, isMobile: !!vp.mobile });
      const url = `http://localhost:3000${pageDef.path}`;

      const consoleEntries = [];
      const pageErrors = [];
      const failedRequests = [];

      page.removeAllListeners('console');
      page.removeAllListeners('pageerror');
      page.removeAllListeners('requestfailed');

      page.on('console', msg => {
        consoleEntries.push({ type: msg.type(), text: msg.text() });
      });
      page.on('pageerror', err => {
        pageErrors.push({ message: err.message, stack: err.stack });
      });
      page.on('requestfailed', req => {
        failedRequests.push({ url: req.url(), resourceType: req.resourceType(), failure: req.failure() });
      });

      await page.goto(url, { waitUntil: 'networkidle2' });
      await new Promise(res => setTimeout(res, 350));

      const checks = await page.evaluate(() => {
        const results = {};
        results.scrollWidth = document.documentElement.scrollWidth;
        results.innerWidth = window.innerWidth;
        results.overflowX = document.documentElement.scrollWidth > window.innerWidth;
        const navs = Array.from(document.querySelectorAll('nav, header[role="banner"], .navbar'));
        results.navCount = navs.length;
        results.logoCount = navs.reduce((acc, n) => acc + n.querySelectorAll('img, .brand, .navbar-brand').length, 0);
        const togglers = Array.from(document.querySelectorAll('.navbar-toggler, .mobile-menu-toggle, .ph-hamburger'));
        results.togglerCount = togglers.length;
        results.togglerVisibleOnDesktop = togglers.some(t => {
          try { const style = window.getComputedStyle(t); return style && style.display !== 'none' && style.visibility !== 'hidden' && t.offsetParent !== null; } catch (e) { return false; }
        });
        results.linkCount = document.querySelectorAll('nav a, .navbar a, .ph-links a').length;
        results.bodyOverflowX = getComputedStyle(document.body).overflowX;
        results.heroVisible = !!document.querySelector('.ph-hero, .hero');
        results.ctaCount = document.querySelectorAll('.ph-ctas a, .ph-ctas .btn, .hero-ctas a, .btn-primary, .btn-ghost').length;
        results.images = Array.from(document.images).map(i => ({ src: i.currentSrc || i.src, naturalWidth: i.naturalWidth, naturalHeight: i.naturalHeight, complete: i.complete }));
        return results;
      });

      const filenameBase = `${outDir}/${pageDef.name}-${vp.label}`;
      await page.screenshot({ path: `${filenameBase}-viewport.png`, fullPage: false });
      await page.screenshot({ path: `${filenameBase}-full.png`, fullPage: true });

      report.push({ page: pageDef.path, name: pageDef.name, viewport: vp.label, checks, screenshots: { viewport: `${filenameBase}-viewport.png`, full: `${filenameBase}-full.png` }, console: consoleEntries, pageErrors, failedRequests });
      console.log('Captured', pageDef.path, vp.label);
    }

    fs.writeFileSync(`${outDir}/verbose-report.json`, JSON.stringify(report, null, 2));
    await browser.close();
    console.log('Home verbose QA complete. Report saved to', `${outDir}/verbose-report.json`);
  } catch (err) {
    console.error('Verbose QA script error:', err);
    process.exit(1);
  }
})();
