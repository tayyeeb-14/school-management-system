const fs = require('fs');
const puppeteer = require('puppeteer');

(async ()=>{
  try {
    const outDir = 'screenshots/premium';
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    const viewports = [
      { name: 'desktop-1920x1080', width: 1920, height: 1080 },
      { name: 'desktop-1440x900', width: 1440, height: 900 },
      { name: 'tablet-1024x768', width: 1024, height: 768 },
      { name: 'tablet-834x1112', width: 834, height: 1112 },
      { name: 'mobile-393x852', width: 393, height: 852, isMobile: true },
      { name: 'mobile-375x812', width: 375, height: 812, isMobile: true }
    ];

    async function safeWaitFor(selector, timeout = 3000) {
      try { await page.waitForSelector(selector, { timeout }); return true; } catch(e) { return false; }
    }

    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height, isMobile: !!vp.isMobile });
      const url = 'http://localhost:3000/';
      await page.goto(url, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 600));

      const nameBase = `${outDir}/home-${vp.name}`;

      // Full page capture for context
      await page.screenshot({ path: `${nameBase}-full.png`, fullPage: true });

      // Navbar
      if (await safeWaitFor('.premium-navbar', 1000)) {
        const el = await page.$('.premium-navbar');
        const box = el ? await el.boundingBox() : null;
        if (box) {
          await page.screenshot({ path: `${nameBase}-navbar.png`, clip: {
            x: Math.max(box.x-8,0), y: Math.max(box.y-8,0), width: Math.min(box.width+16, vp.width), height: Math.min(box.height+16, vp.height)
          }});
        } else {
          console.warn('Navbar bounding box unavailable for', vp.name);
        }
      }

      // Hero
      if (await safeWaitFor('.premium-hero', 1000)) {
        const el = await page.$('.premium-hero');
        const box = el ? await el.boundingBox() : null;
        if (box) {
          await page.screenshot({ path: `${nameBase}-hero.png`, clip: {
            x: Math.max(box.x,0), y: Math.max(box.y,0), width: Math.min(box.width, vp.width), height: Math.min(box.height, vp.height)
          }});
        } else {
          console.warn('Hero bounding box unavailable for', vp.name);
        }
      }

      // Stats card
      if (await safeWaitFor('.premium-stats-card', 1000)) {
        const el = await page.$('.premium-stats-card');
        const box = el ? await el.boundingBox() : null;
        if (box) {
          await page.screenshot({ path: `${nameBase}-stats.png`, clip: {
            x: Math.max(box.x-6,0), y: Math.max(box.y-6,0), width: Math.min(box.width+12, vp.width), height: Math.min(box.height+12, vp.height)
          }});
        } else {
          console.warn('Stats card bounding box unavailable for', vp.name);
        }
      }

      // Mobile menu (if mobile or toggle exists)
      const toggleExists = await page.$('#mobileNavToggle');
      if (toggleExists) {
        try {
          await page.click('#mobileNavToggle');
          await new Promise(r => setTimeout(r, 300));
          if (await safeWaitFor('#mobileNav', 1000)) {
            const el = await page.$('#mobileNav');
            const box = el ? await el.boundingBox() : null;
            if (box) {
              await page.screenshot({ path: `${nameBase}-mobile-menu.png`, clip: {
                x: Math.max(box.x-6,0), y: Math.max(box.y-6,0), width: Math.min(box.width+12, vp.width), height: Math.min(box.height+12, vp.height)
              }});
            } else {
              console.warn('Mobile nav bounding box unavailable for', vp.name);
            }
          }
        } catch(e) {
          // ignore
        }
      }

      // Close any open mobile panel for next iteration
      try { await page.evaluate(()=>{ const p=document.getElementById('mobileNav'); if (p) p.style.display='none'; const b=document.getElementById('mobileNavToggle'); if (b) b.setAttribute('aria-expanded','false'); }); } catch(e) {}

      console.log('Captured', vp.name);
    }

    await browser.close();
    console.log('All premium screenshots saved to', outDir);
  } catch(err){
    console.error('Error capturing premium screenshots:', err);
    process.exit(1);
  }
})();
