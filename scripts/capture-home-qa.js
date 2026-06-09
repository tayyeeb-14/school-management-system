const fs = require('fs');
const puppeteer = require('puppeteer');

(async () => {
  try {
    const outDir = 'screenshots/ui/qa/home-only';
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const pageDef = { path: '/', name: 'home' };

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

    for (const vp of viewports) {
      await page.setViewport({ width: vp.w, height: vp.h, isMobile: !!vp.mobile });
      const url = `http://localhost:3000${pageDef.path}`;
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
        const togglers = Array.from(document.querySelectorAll('.navbar-toggler, .mobile-menu-toggle'));
        results.togglerCount = togglers.length;
        results.togglerVisibleOnDesktop = togglers.some(t => {
          try { const style = window.getComputedStyle(t); return style && style.display !== 'none' && style.visibility !== 'hidden' && t.offsetParent !== null; } catch (e) { return false; }
        });
        results.linkCount = document.querySelectorAll('nav a, .navbar a').length;
        results.bodyOverflowX = getComputedStyle(document.body).overflowX;
        results.tableCount = document.querySelectorAll('table').length;
        results.formCount = document.querySelectorAll('form').length;
        return results;
      });

      const filenameBase = `${outDir}/${pageDef.name}-${vp.label}`;
      await page.screenshot({ path: `${filenameBase}-viewport.png`, fullPage: false });
      await page.screenshot({ path: `${filenameBase}-full.png`, fullPage: true });

      report.push({ page: pageDef.path, name: pageDef.name, viewport: vp.label, checks, screenshots: { viewport: `${filenameBase}-viewport.png`, full: `${filenameBase}-full.png` } });
      console.log('Captured', pageDef.path, vp.label);
    }

    fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 2));
    await browser.close();
    console.log('Home QA capture complete. Report saved to', `${outDir}/report.json`);
  } catch (err) {
    console.error('QA script error:', err);
    process.exit(1);
  }
})();
