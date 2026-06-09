const puppeteer = require('puppeteer');
(async()=>{
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812, isMobile: true });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });
  const res = await page.evaluate(()=>{
    const collapse = document.getElementById('navbarNav');
    if(!collapse) return { exists: false };
    const classes = collapse.className;
    const rect = collapse.getBoundingClientRect();
    const computed = window.getComputedStyle(collapse);
    return { exists: true, classes, height: rect.height, display: computed.display, visibility: computed.visibility };
  });
  console.log('Navbar collapse state:', res);
  await browser.close();
})();
