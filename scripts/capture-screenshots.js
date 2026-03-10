const fs = require('fs');
const puppeteer = require('puppeteer');

(async () => {
  try {
    const outDir = 'screenshots';
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();

    // Desktop
    await page.setViewport({ width: 1366, height: 768 });
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: `${outDir}/desktop.png`, fullPage: true });

    // Mobile
    await page.setViewport({ width: 375, height: 812, isMobile: true });
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: `${outDir}/mobile.png`, fullPage: true });

    await browser.close();
    console.log('Screenshots saved to', outDir);
  } catch (err) {
    console.error('Error capturing screenshots:', err);
    process.exit(1);
  }
})();
