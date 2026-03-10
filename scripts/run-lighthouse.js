const fs = require('fs');
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const puppeteer = require('puppeteer');

async function runLighthouse(url, formFactor, outPath) {
  // Use Puppeteer's Chromium for compatibility
  const puppeteerBrowser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const chromePath = puppeteer.executablePath();
  await puppeteerBrowser.close();

  const chrome = await chromeLauncher.launch({
    chromePath,
    chromeFlags: ['--no-first-run', '--no-default-browser-check', '--headless']
  });

  const options = {
    port: chrome.port,
    output: 'html',
    onlyCategories: ['performance','accessibility','best-practices','seo'],
    emulatedFormFactor: formFactor
  };

  console.log(`Running Lighthouse (${formFactor}) for ${url} ...`);
  const runnerResult = await lighthouse(url, options);

  // Save HTML report
  const reportHtml = runnerResult.report;
  fs.mkdirSync(require('path').dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, reportHtml);
  console.log(`Saved Lighthouse report: ${outPath}`);

  await chrome.kill();
}

(async () => {
  try {
    const url = 'http://localhost:3000';
    await runLighthouse(url, 'mobile', 'reports/lighthouse-mobile.html');
    await runLighthouse(url, 'desktop', 'reports/lighthouse-desktop.html');
    console.log('All Lighthouse reports generated in ./reports');
  } catch (err) {
    console.error('Lighthouse run failed:', err);
    process.exit(1);
  }
})();
